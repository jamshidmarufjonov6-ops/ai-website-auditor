"""Crawler: fetches a small, bounded set of pages for analysis.

MVP limits (configurable via env):
  * MAX_PAGES pages (default 5)
  * depth 1 (links found on the start page only)
  * per-request timeout and byte cap handled by fetcher
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

from app.core.config import settings
from app.services.crawler.fetcher import FetchError, FetchedPage, fetch_page
from app.services.crawler.html_parser import ParsedPage, parse_page
from app.services.crawler.url_validator import get_domain, validate_url


@dataclass
class RobotsInfo:
    available: bool = False
    status_code: Optional[int] = None
    disallow_all: bool = False
    disallowed_paths: List[str] = field(default_factory=list)
    sitemap_urls: List[str] = field(default_factory=list)


@dataclass
class SitemapInfo:
    available: bool = False
    url: Optional[str] = None
    status_code: Optional[int] = None


@dataclass
class CrawlContext:
    start_url: str
    domain: str
    pages: List[FetchedPage] = field(default_factory=list)
    parsed_pages: List[ParsedPage] = field(default_factory=list)
    robots: RobotsInfo = field(default_factory=RobotsInfo)
    sitemap: SitemapInfo = field(default_factory=SitemapInfo)
    crawl_limited: bool = False
    broken_links: List[Dict] = field(default_factory=list)
    fetch_errors: List[Dict] = field(default_factory=list)

    @property
    def start_page(self) -> Optional[FetchedPage]:
        return self.pages[0] if self.pages else None

    @property
    def start_parsed(self) -> Optional[ParsedPage]:
        return self.parsed_pages[0] if self.parsed_pages else None


ProgressCallback = Callable[[int, str], None]


def _noop(progress: int, stage: str) -> None:
    pass


def _parse_robots(text: str, base_url: str) -> RobotsInfo:
    info = RobotsInfo(available=True)
    current_agents: List[str] = []
    global_disallow = False
    for raw_line in text.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().lower()
        value = value.strip()
        if key == "user-agent":
            current_agents = [value.lower()]
        elif key == "disallow" and value and ("*" in current_agents or "aiwebsiteauditor" in current_agents):
            if value == "/":
                global_disallow = True
            info.disallowed_paths.append(value)
        elif key == "sitemap" and value:
            info.sitemap_urls.append(urljoin(base_url, value))
    info.disallow_all = global_disallow
    return info


def _probe_url(url: str) -> Optional[int]:
    """Lightweight availability probe.

    Redirects are intentionally NOT followed automatically: every hop in the
    main fetcher is re-validated against SSRF rules, and probes must not open
    unvalidated destinations. A 3xx status is treated as available.
    """
    try:
        validated = validate_url(url)
    except Exception:
        return None
    with httpx.Client(
        timeout=min(settings.REQUEST_TIMEOUT_SECONDS, 10.0),
        follow_redirects=False,
        headers={"User-Agent": settings.USER_AGENT},
    ) as client:
        try:
            resp = client.head(validated.url)
            if resp.status_code in (405, 501):
                resp = client.get(validated.url, stream=True)
            return resp.status_code
        except httpx.HTTPError:
            return None


def _extract_internal_links(parsed: ParsedPage, domain: str) -> List[str]:
    seen = set()
    out = []
    for link in parsed.links:
        href = link["absolute"]
        if not href.startswith(("http://", "https://")):
            continue
        host = (urlparse(href).hostname or "").lower()
        if host == domain or host == f"www.{domain}" or f"www.{host}" == domain:
            # Drop fragments and query-only duplicates.
            clean = href.split("#", 1)[0]
            if clean not in seen:
                seen.add(clean)
                out.append(clean)
    return out


def crawl(
    raw_url: str,
    progress: ProgressCallback = _noop,
    max_pages: Optional[int] = None,
) -> CrawlContext:
    """Crawl a site with strict limits and return everything the analyzers need."""
    validated = validate_url(raw_url)
    domain = get_domain(validated.url)
    ctx = CrawlContext(start_url=validated.url, domain=domain)
    page_limit = max_pages or settings.MAX_PAGES

    # 1. Start page
    progress(8, "Fetching homepage")
    start = fetch_page(validated.url)
    if start.status_code >= 500:
        raise FetchError(
            f"Start page returned {start.status_code}",
            f"The website returned a server error (HTTP {start.status_code}).",
            kind="http_5xx",
        )
    ctx.pages.append(start)
    ctx.parsed_pages.append(parse_page(start))

    # 2. robots.txt
    progress(16, "Checking robots.txt")
    robots_url = urlunparse((validated.scheme, f"{domain}", "/robots.txt", "", "", ""))
    try:
        robots_resp = fetch_page(robots_url)
        ctx.robots.status_code = robots_resp.status_code
        if robots_resp.status_code < 400 and robots_resp.text:
            parsed_robots = _parse_robots(robots_resp.text, robots_resp.final_url)
            parsed_robots.status_code = robots_resp.status_code
            ctx.robots = parsed_robots
    except FetchError:
        pass  # robots.txt unavailable is a finding, not a crash

    # 3. sitemap
    progress(24, "Checking sitemap")
    sitemap_candidates = list(ctx.robots.sitemap_urls[:2])
    sitemap_candidates.append(urlunparse((validated.scheme, f"{domain}", "/sitemap.xml", "", "", "")))
    for candidate in sitemap_candidates:
        status = _probe_url(candidate)
        if status and status < 400:
            ctx.sitemap = SitemapInfo(available=True, url=candidate, status_code=status)
            break
        elif status:
            ctx.sitemap = SitemapInfo(available=False, url=candidate, status_code=status)

    # 4. Internal pages (depth 1)
    progress(32, "Discovering pages")
    start_parsed = ctx.start_parsed
    internal_links = _extract_internal_links(start_parsed, domain) if start_parsed else []
    max_extra = max(0, page_limit - 1)
    if max_extra > 0 and internal_links:
        to_fetch = internal_links[:max_extra]
        with ThreadPoolExecutor(max_workers=min(settings.CRAWLER_MAX_CONCURRENCY, len(to_fetch))) as pool:
            futures = {pool.submit(fetch_page, url): url for url in to_fetch}
            done = 0
            for fut in as_completed(futures):
                done += 1
                progress(32 + int(24 * done / max(1, len(futures))), f"Crawling page {done} of {len(futures)}")
                url = futures[fut]
                try:
                    page = fut.result()
                    if page.status_code < 400:
                        ctx.pages.append(page)
                        ctx.parsed_pages.append(parse_page(page))
                    else:
                        ctx.fetch_errors.append(
                            {"url": url, "kind": "http_status", "status_code": page.status_code, "message": f"HTTP {page.status_code}"}
                        )
                except FetchError as exc:
                    ctx.fetch_errors.append(
                        {"url": url, "kind": exc.kind, "message": exc.safe_message}
                    )
        if len(internal_links) > max_extra:
            ctx.crawl_limited = True

    # 5. Broken internal links (practical, bounded)
    progress(60, "Checking links")
    if start_parsed:
        candidates = [u for u in internal_links[:12] if u not in {p.url for p in ctx.pages}]
        for url in candidates:
            status = _probe_url(url)
            if status and status >= 400:
                ctx.broken_links.append({"url": url, "status_code": status})

    progress(66, "Analyzing pages")
    return ctx
