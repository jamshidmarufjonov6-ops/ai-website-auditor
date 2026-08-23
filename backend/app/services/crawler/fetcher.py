"""HTTP fetching with size/time limits, safe redirects and SSRF re-validation."""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from urllib.parse import urljoin

import httpx

from app.core.config import settings
from app.services.crawler.url_validator import ValidatedURL, validate_url

MAX_REDIRECTS = 5


class FetchError(Exception):
    def __init__(self, message: str, safe_message: str, kind: str = "fetch_error"):
        super().__init__(message)
        self.safe_message = safe_message
        self.kind = kind


@dataclass
class FetchedPage:
    url: str
    final_url: str
    status_code: int
    headers: Dict[str, str] = field(default_factory=dict)
    content: bytes = b""
    elapsed_ms: int = 0
    history: List[str] = field(default_factory=list)
    error: Optional[str] = None

    @property
    def text(self) -> str:
        if not self.content:
            return ""
        # Prefer the declared charset, fall back to utf-8 with replacement.
        content_type = self.headers.get("content-type", "")
        charset = None
        if "charset=" in content_type.lower():
            charset = content_type.lower().split("charset=", 1)[1].split(";")[0].strip().strip('"')
        if not charset:
            charset = "utf-8"
        try:
            return self.content.decode(charset, errors="replace")
        except LookupError:
            return self.content.decode("utf-8", errors="replace")

    @property
    def size_bytes(self) -> int:
        return len(self.content)


def _build_client() -> httpx.Client:
    return httpx.Client(
        timeout=settings.REQUEST_TIMEOUT_SECONDS,
        follow_redirects=False,
        headers={
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
        limits=httpx.Limits(max_connections=settings.CRAWLER_MAX_CONCURRENCY, max_keepalive_connections=2),
    )


def _read_limited(response: httpx.Response) -> bytes:
    """Read a response body up to MAX_RESPONSE_BYTES."""
    limit = settings.MAX_RESPONSE_BYTES
    chunks: List[bytes] = []
    total = 0
    for chunk in response.iter_bytes():
        total += len(chunk)
        if total > limit:
            raise FetchError(
                f"Page exceeds size limit ({total} > {limit} bytes)",
                "This page is too large for the free audit. Try a smaller page.",
                kind="too_large",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def fetch_url(validated: ValidatedURL) -> FetchedPage:
    """Fetch a validated URL. Follows redirects, re-validating every hop."""
    current_url = validated.url
    history: List[str] = []
    started = time.monotonic()

    with _build_client() as client:
        for _ in range(MAX_REDIRECTS + 1):
            try:
                response = client.build_request("GET", current_url)
                resp = client.send(response, stream=True)
            except httpx.TimeoutException as exc:
                raise FetchError(
                    f"Timeout fetching {current_url}: {exc}",
                    "The website took too long to respond.",
                    kind="timeout",
                ) from exc
            except httpx.SSLError as exc:
                raise FetchError(
                    f"SSL error for {current_url}: {exc}",
                    "The website has an SSL certificate problem, so we could not connect securely.",
                    kind="ssl_error",
                ) from exc
            except httpx.ConnectError as exc:
                raise FetchError(
                    f"Connection error for {current_url}: {exc}",
                    "We could not connect to that website. Check the address and try again.",
                    kind="connection_error",
                ) from exc
            except httpx.RequestError as exc:
                raise FetchError(
                    f"Request error for {current_url}: {exc}",
                    "We could not fetch that website.",
                    kind="request_error",
                ) from exc

            if resp.is_redirect:
                location = resp.headers.get("location")
                if not location:
                    raise FetchError("Redirect without Location header", "The website sent an invalid redirect.")
                next_url = urljoin(current_url, location)
                # SSRF guard: re-validate the redirect target before following.
                try:
                    next_validated = validate_url(next_url)
                except Exception as exc:  # URLValidationError
                    raise FetchError(
                        f"Blocked unsafe redirect to {next_url}",
                        "The website redirected us somewhere we cannot safely scan.",
                        kind="unsafe_redirect",
                    ) from exc
                history.append(current_url)
                current_url = next_validated.url
                resp.close()
                continue

            try:
                body = _read_limited(resp)
            finally:
                resp.close()

            elapsed = int((time.monotonic() - started) * 1000)
            return FetchedPage(
                url=validated.url,
                final_url=str(resp.url),
                status_code=resp.status_code,
                headers={k.lower(): v for k, v in resp.headers.items()},
                content=body,
                elapsed_ms=elapsed,
                history=history,
            )

    raise FetchError(
        f"Too many redirects for {validated.url}",
        "The website redirected too many times.",
        kind="too_many_redirects",
    )


def fetch_page(raw_url: str) -> FetchedPage:
    """Validate then fetch. Convenience entrypoint used by the crawler."""
    validated = validate_url(raw_url)
    return fetch_url(validated)
