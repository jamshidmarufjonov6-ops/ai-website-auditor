"""Tests for URL validation and SSRF protection."""
from __future__ import annotations

import socket

import pytest

from app.services.crawler.url_validator import URLValidationError, normalize_url, validate_url


def _public_dns(host, port=80, proto=socket.IPPROTO_TCP):
    return [(socket.AF_INET, socket.SOCK_STREAM, proto, "", ("93.184.216.34", port))]


@pytest.mark.parametrize(
    "raw",
    [
        "http://localhost",
        "http://localhost:8080",
        "http://127.0.0.1",
        "http://127.0.0.1:80",
        "http://10.0.0.1",
        "http://172.16.0.1",
        "http://192.168.1.1",
        "http://169.254.169.254",
        "http://[::1]",
        "http://0.0.0.0",
        "http://2130706433",  # integer-encoded 127.0.0.1
        "http://0x7f000001",  # hex-encoded 127.0.0.1
        "http://metadata.google.internal",
        "http://instance-data.ec2.internal",
        "http://foo.internal",
        "http://example.com:8080",
        "ftp://example.com",
        "http://user:pass@example.com",
    ],
)
def test_blocked_urls(monkeypatch, raw):
    monkeypatch.setattr(socket, "getaddrinfo", _public_dns)
    with pytest.raises(URLValidationError):
        validate_url(raw)


def test_domain_resolving_to_private_ip_is_blocked(monkeypatch):
    def private_dns(host, port=80, proto=socket.IPPROTO_TCP):
        return [(socket.AF_INET, socket.SOCK_STREAM, proto, "", ("10.0.0.5", port))]

    monkeypatch.setattr(socket, "getaddrinfo", private_dns)
    with pytest.raises(URLValidationError):
        validate_url("http://evil.example.com")


def test_valid_public_url(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _public_dns)
    validated = validate_url("example.com")
    assert validated.scheme == "https"
    assert validated.hostname == "example.com"
    assert "93.184.216.34" in validated.resolved_ips


def test_normalize_adds_https():
    assert normalize_url("example.com/path") == "https://example.com/path"


def test_empty_url_rejected():
    with pytest.raises(URLValidationError):
        validate_url("   ")


def test_url_without_host_rejected():
    with pytest.raises(URLValidationError):
        validate_url("https:///path-only")


def test_non_public_ipv6_is_blocked(monkeypatch):
    def ipv6_private(host, port=80, proto=socket.IPPROTO_TCP):
        return [(socket.AF_INET6, socket.SOCK_STREAM, proto, "", ("fe80::1", port, 0, 0))]

    monkeypatch.setattr(socket, "getaddrinfo", ipv6_private)
    with pytest.raises(URLValidationError):
        validate_url("http://example.com")
