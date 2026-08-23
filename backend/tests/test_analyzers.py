"""Tests for SEO and security analyzers using synthetic pages."""
from __future__ import annotations

from app.services.analyzers.seo import SEOAnalyzer
from app.services.analyzers.security import SecurityAnalyzer
from app.services.crawler.crawler import CrawlContext, RobotsInfo, SitemapInfo
from app.services.crawler.fetcher import FetchedPage
from app.services.crawler.html_parser import parse_page


def make_ctx(html: str, headers=None, url="https://example.com") -> CrawlContext:
    page = FetchedPage(
        url=url,
        final_url=url,
        status_code=200,
        headers=headers or {},
        content=html.encode("utf-8"),
        elapsed_ms=200,
    )
    ctx = CrawlContext(start_url=url, domain="example.com")
    ctx.pages = [page]
    ctx.parsed_pages = [parse_page(page)]
    ctx.robots = RobotsInfo(available=True, status_code=200)
    ctx.sitemap = SitemapInfo(available=True, url="https://example.com/sitemap.xml", status_code=200)
    return ctx


def find(check_id: str, checks):
    return next(c for c in checks if c.id == check_id)


GOOD_HTML = """
<!doctype html>
<html lang="en">
<head>
  <title>Example Business — Quality Web Design Services</title>
  <meta name="description" content="Example Business provides quality web design, SEO and hosting services for small businesses across the region with care and expertise.">
  <link rel="canonical" href="https://example.com/">
  <meta property="og:title" content="Example Business">
  <meta property="og:description" content="Quality web design services">
  <meta property="og:image" content="https://example.com/og.png">
</head>
<body>
  <h1>Quality Web Design Services</h1>
  <h2>Our services</h2>
  <img src="/a.png" alt="Team photo">
  <img src="/b.png" alt="Office">
</body>
</html>
"""


def test_seo_good_page_scores_high():
    ctx = make_ctx(GOOD_HTML)
    checks = SEOAnalyzer().analyze(ctx)
    assert find("seo_title_exists", checks).status == "pass"
    assert find("seo_title_length", checks).status == "pass"
    assert find("seo_meta_description_exists", checks).status == "pass"
    assert find("seo_h1_exists", checks).status == "pass"
    assert find("seo_h1_count", checks).status == "pass"
    assert find("seo_canonical", checks).status == "pass"
    assert find("seo_open_graph", checks).status == "pass"


def test_seo_missing_title_and_meta_fail():
    ctx = make_ctx("<html><body><p>Hello</p></body></html>")
    checks = SEOAnalyzer().analyze(ctx)
    assert find("seo_title_exists", checks).status == "fail"
    assert find("seo_meta_description_exists", checks).status == "warning"
    assert find("seo_h1_exists", checks).status == "fail"


def test_seo_title_too_long_warns():
    ctx = make_ctx(f"<html><head><title>{'X' * 80}</title></head><body><h1>Hi</h1></body></html>")
    checks = SEOAnalyzer().analyze(ctx)
    check = find("seo_title_length", checks)
    assert check.status == "warning"
    assert check.score < 100


def test_seo_multiple_h1_warns():
    ctx = make_ctx("<html><head><title>My Example Page Title Is Long Enough</title></head><body><h1>A</h1><h1>B</h1></body></html>")
    checks = SEOAnalyzer().analyze(ctx)
    assert find("seo_h1_count", checks).status == "warning"


def test_security_missing_headers_flagged():
    ctx = make_ctx(GOOD_HTML, headers={"content-type": "text/html"})
    checks = SecurityAnalyzer().analyze(ctx)
    csp = find("security_header_content-security-policy", checks)
    assert csp.status == "warning"
    assert "browser security protection" in csp.title.lower() or "Content Security Policy" in csp.title
    # All security checks must be passive, descriptive and never claim "secure".
    for check in checks:
        assert "completely secure" not in check.description.lower()


def test_security_http_site_fails_https():
    ctx = make_ctx(GOOD_HTML, url="http://example.com", headers={})
    ctx.start_page.final_url = "http://example.com"
    checks = SecurityAnalyzer().analyze(ctx)
    assert find("security_https", checks).status == "fail"
    assert find("security_https", checks).score == 0


def test_security_headers_present_pass():
    ctx = make_ctx(
        GOOD_HTML,
        headers={
            "content-security-policy": "default-src 'self'",
            "strict-transport-security": "max-age=31536000",
            "x-content-type-options": "nosniff",
            "referrer-policy": "strict-origin-when-cross-origin",
            "permissions-policy": "geolocation=()",
            "x-frame-options": "DENY",
        },
    )
    checks = SecurityAnalyzer().analyze(ctx)
    assert find("security_header_content-security-policy", checks).status == "pass"
    assert find("security_header_strict-transport-security", checks).status == "pass"


# --- Performance / accessibility / mobile analyzer basics ---


def test_performance_analyzer_scores_fast_page():
    from app.services.analyzers.performance import PerformanceAnalyzer

    ctx = make_ctx(
        GOOD_HTML,
        headers={"content-encoding": "gzip", "cache-control": "max-age=3600"},
    )
    ctx.start_page.elapsed_ms = 300
    checks = PerformanceAnalyzer().analyze(ctx)
    assert find("perf_response_time", checks).status == "pass"
    assert find("perf_compression", checks).status == "pass"
    assert find("perf_caching", checks).status == "pass"
    # Structured explanation fields must be present.
    check = find("perf_response_time", checks)
    assert check.what_was_checked
    assert check.actual_result
    assert check.why_it_matters
    assert check.how_to_fix


def test_performance_analyzer_flags_slow_page():
    from app.services.analyzers.performance import PerformanceAnalyzer

    ctx = make_ctx(GOOD_HTML)
    ctx.start_page.elapsed_ms = 4000
    checks = PerformanceAnalyzer().analyze(ctx)
    assert find("perf_response_time", checks).status == "fail"


def test_accessibility_analyzer_flags_missing_lang_and_alt():
    from app.services.analyzers.accessibility import AccessibilityAnalyzer

    html = """
    <html>
      <head><title>Example Page Title That Is Long Enough</title></head>
      <body>
        <img src="/photo.jpg">
        <form><input type="text"></form>
      </body>
    </html>
    """
    ctx = make_ctx(html)
    checks = AccessibilityAnalyzer().analyze(ctx)
    assert find("a11y_language", checks).status == "fail"
    assert find("a11y_image_alt", checks).status == "fail"
    assert find("a11y_form_labels", checks).status == "fail"


def test_mobile_analyzer_missing_viewport_fails():
    from app.services.analyzers.mobile import MobileAnalyzer

    html = "<html><head><title>Example Page Title That Is Long Enough</title></head><body><p>Hi</p></body></html>"
    ctx = make_ctx(html)
    checks = MobileAnalyzer().analyze(ctx)
    assert find("mobile_viewport", checks).status == "fail"


def test_mobile_analyzer_viewport_present_passes():
    from app.services.analyzers.mobile import MobileAnalyzer

    html = """
    <html>
      <head>
        <title>Example Page Title That Is Long Enough</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body><p>Hi</p></body>
    </html>
    """
    ctx = make_ctx(html)
    checks = MobileAnalyzer().analyze(ctx)
    assert find("mobile_viewport", checks).status == "pass"
