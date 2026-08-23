"""Safe URL validation with SSRF protection.

The scanner must never reach:
  * localhost / loopback
  * private networks (RFC 1918)
  * link-local, carrier-grade NAT, documentation and benchmark ranges
  * cloud metadata endpoints (169.254.169.254 and equivalents)
  * multicast / reserved / unspecified addresses
  * non-standard ports (only 80/443 are allowed)

We resolve DNS before every request and verify that every returned address
is a globally routable public IP.
"""
from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass, field
from typing import List, Optional
from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443, None}

# Hostname patterns that must never be contacted.
BLOCKED_HOSTNAME_SUFFIXES = (
    ".localhost",
    ".local",
    ".internal",
    ".lan",
    ".home",
    ".corp",
    ".intranet",
    ".test",
    ".invalid",
    ".example",
)
BLOCKED_HOSTNAME_EXACT = {"localhost", "0.0.0.0", "255.255.255.255"}

# Common cloud metadata targets (defence in depth, also covered by IP checks).
BLOCKED_HOST_METADATA = {
    "169.254.169.254",
    "metadata.google.internal",
    "instance-data.ec2.internal",
    "metadata.goog",
}

# IPv6 equivalents of well-known metadata / special ranges are covered by
# ipaddress checks below.


@dataclass
class ValidatedURL:
    """A URL that has passed SSRF validation."""

    original: str
    url: str
    scheme: str
    hostname: str
    port: Optional[int]
    path: str
    resolved_ips: List[str] = field(default_factory=list)

    @property
    def display(self) -> str:
        return self.url


class URLValidationError(ValueError):
    """Raised when a URL is invalid or unsafe to scan."""

    def __init__(self, message: str, safe_message: str | None = None):
        super().__init__(message)
        self.safe_message = safe_message or message


def _is_blocked_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True
    return not ip.is_global  # global == publicly routable unicast


def _hostname_to_candidates(hostname: str) -> List[str]:
    """Return IP literals the hostname might encode (dotted, integer, hex, octal)."""
    candidates: List[str] = []
    cleaned = hostname.strip("[]")
    if not cleaned:
        return candidates

    # Direct IPv4/IPv6 literal.
    try:
        candidates.append(str(ipaddress.ip_address(cleaned)))
        return candidates
    except ValueError:
        pass

    # Integer / hex / octal encoded IPv4 (e.g. 2130706433, 0x7f000001, 017700000001).
    try:
        if cleaned.isdigit():
            candidates.append(str(ipaddress.ip_address(int(cleaned))))
        elif cleaned.lower().startswith("0x") and all(
            c in "0123456789abcdefABCDEF" for c in cleaned[2:]
        ):
            candidates.append(str(ipaddress.ip_address(int(cleaned, 16))))
    except ValueError:
        pass

    # Rare dotted-quad with leading zeros (some resolvers treat as octal).
    parts = cleaned.split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        try:
            octets = [int(p, 8) for p in parts]
            if all(0 <= o <= 255 for o in octets):
                candidates.append(str(ipaddress.ip_address(bytes(octets))))
        except ValueError:
            pass
    return candidates


def _check_hostname_literals(hostname: str) -> None:
    lower = hostname.lower().strip("[]")
    if lower in BLOCKED_HOSTNAME_EXACT or lower in BLOCKED_HOST_METADATA:
        raise URLValidationError(f"Blocked host: {hostname}", "This website address is not allowed.")
    if lower.endswith(BLOCKED_HOSTNAME_SUFFIXES):
        raise URLValidationError(f"Blocked hostname suffix: {hostname}", "This website address is not allowed.")
    for candidate in _hostname_to_candidates(lower):
        if _is_blocked_ip(candidate):
            raise URLValidationError(
                f"Hostname resolves to blocked IP {candidate}",
                "This website address is not allowed.",
            )


def _resolve_public_ips(hostname: str) -> List[str]:
    """Resolve the hostname and require every address to be a public IP."""
    if hostname.lower().strip("[]") in BLOCKED_HOST_METADATA:
        raise URLValidationError("Blocked metadata host", "This website address is not allowed.")

    try:
        infos = socket.getaddrinfo(hostname, 80, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise URLValidationError(
            f"Could not resolve hostname: {hostname}", "We could not find that website. Check the address and try again."
        ) from exc

    if not infos:
        raise URLValidationError(f"No addresses for {hostname}", "We could not find that website.")

    ips: List[str] = []
    for info in infos:
        ip = info[4][0]
        if _is_blocked_ip(ip):
            raise URLValidationError(
                f"Hostname {hostname} resolves to blocked IP {ip}",
                "This website address is not allowed for security reasons.",
            )
        if ip not in ips:
            ips.append(ip)
    return ips


def normalize_url(raw: str) -> str:
    """Add a scheme when missing and return a normalized URL string."""
    raw = (raw or "").strip()
    if not raw:
        raise URLValidationError("URL is empty", "Please enter a website address.")
    if len(raw) > 2048:
        raise URLValidationError("URL too long", "That address is too long.")
    if "://" not in raw:
        raw = "https://" + raw
    parsed = urlparse(raw)
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise URLValidationError(
            f"Unsupported scheme: {parsed.scheme}", "Only http:// and https:// websites can be audited."
        )
    if not parsed.hostname:
        raise URLValidationError("Missing hostname", "Please enter a full website address such as example.com.")
    if parsed.username or parsed.password:
        raise URLValidationError("Credentials in URL are not allowed", "That address is not valid.")
    return parsed.geturl()


def validate_url(raw: str) -> ValidatedURL:
    """Validate a user-supplied URL and ensure it is safe to fetch.

    Raises URLValidationError with a user-safe message when invalid/unsafe.
    """
    normalized = normalize_url(raw)
    parsed = urlparse(normalized)
    hostname = parsed.hostname or ""
    port = parsed.port

    if port not in ALLOWED_PORTS:
        raise URLValidationError(
            f"Port {port} is not allowed", "Only standard web ports (80 and 443) are allowed."
        )

    _check_hostname_literals(hostname)
    ips = _resolve_public_ips(hostname)

    # Rebuild a canonical URL.
    netloc = hostname
    if ":" in hostname and not hostname.startswith("["):  # IPv6 literal
        netloc = f"[{hostname}]"
    if port:
        netloc = f"{netloc}:{port}"
    canonical = parsed._replace(netloc=netloc).geturl()

    return ValidatedURL(
        original=raw.strip(),
        url=canonical,
        scheme=parsed.scheme.lower(),
        hostname=hostname,
        port=port,
        path=parsed.path or "/",
        resolved_ips=ips,
    )


def get_domain(url: str) -> str:
    """Return a normalized domain (lowercase hostname without www.)."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def is_internal_link(base: ValidatedURL, candidate: str) -> bool:
    """True when a crawled link stays on the same domain."""
    try:
        parsed = urlparse(candidate)
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    base_host = base.hostname.lower()
    return host == base_host or host == f"www.{base_host}" or base_host == f"www.{host}"
