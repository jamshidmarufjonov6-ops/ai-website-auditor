"""Technical website health analyzer."""
from __future__ import annotations

from typing import List
from urllib.parse import urljoin

from app.services.analyzers.base import STATUS_FAIL, STATUS_PASS, STATUS_WARNING, BaseAnalyzer, result


class TechnicalAnalyzer(BaseAnalyzer):
    category = "technical"

    def analyze(self, ctx) -> List:
        checks: List = []
        page = ctx.start_page
        parsed = ctx.start_parsed
        if page is None or parsed is None:
            return checks

        # 1. HTTP status
        status = page.status_code
        if 200 <= status < 300:
            checks.append(
                result(
                    "tech_http_status", self.category, STATUS_PASS, 100,
                    "Homepage responds successfully",
                    "We checked the HTTP status code returned by the homepage.",
                    f"The homepage returned HTTP {status}.",
                    "A successful status means the site is reachable by visitors and search engines.",
                    "No action needed.",
                    weight=1.2,
                )
            )
        elif 300 <= status < 400:
            checks.append(
                result(
                    "tech_http_status", self.category, STATUS_WARNING, 60,
                    "Homepage uses a redirect",
                    "We checked the HTTP status code returned by the homepage.",
                    f"The homepage returned HTTP {status}.",
                    "Redirects are normal for domain moves but can slow first paint and confuse bookmarks.",
                    "Where possible, serve the final content directly at the requested URL.",
                )
            )
        elif status == 404:
            checks.append(
                result(
                    "tech_http_status", self.category, STATUS_FAIL, 10,
                    "Homepage returns 404",
                    "We checked the HTTP status code returned by the homepage.",
                    "The URL you entered returns HTTP 404 (not found).",
                    "Visitors cannot reach the page they were looking for.",
                    "Check the URL or restore the page.",
                    weight=1.2,
                )
            )
        else:
            checks.append(
                result(
                    "tech_http_status", self.category, STATUS_FAIL, 20,
                    f"Homepage returned HTTP {status}",
                    "We checked the HTTP status code returned by the homepage.",
                    f"The homepage responded with HTTP {status}.",
                    "Error responses prevent visitors from using the site.",
                    "Investigate the server configuration and error logs.",
                    weight=1.2,
                )
            )

        # 2. Redirect chain
        redirects = len(page.history)
        if redirects == 0:
            checks.append(
                result(
                    "tech_redirects", self.category, STATUS_PASS, 100,
                    "No redirect chain",
                    "We counted how many redirects the homepage follows.",
                    "The homepage loads without redirects.",
                    "Fewer redirects means faster loading and fewer chances for issues.",
                    "No action needed.",
                )
            )
        elif redirects <= 2:
            checks.append(
                result(
                    "tech_redirects", self.category, STATUS_WARNING, 70,
                    "Short redirect chain",
                    "We counted how many redirects the homepage follows.",
                    f"The homepage redirects {redirects} time(s).",
                    "Each redirect adds a little latency for visitors.",
                    "Consider consolidating redirects so each URL reaches its destination in one hop.",
                )
            )
        else:
            checks.append(
                result(
                    "tech_redirects", self.category, STATUS_WARNING, 45,
                    "Long redirect chain",
                    "We counted how many redirects the homepage follows.",
                    f"The homepage redirects {redirects} times.",
                    "Long redirect chains slow visitors and can dilute link value.",
                    "Reduce the redirect chain to a single hop where possible.",
                )
            )

        # 3. Canonical
        if parsed.canonical:
            checks.append(
                result(
                    "tech_canonical", self.category, STATUS_PASS, 100,
                    "Canonical URL is declared",
                    "We looked for a canonical link tag in the page head.",
                    f"Canonical URL found: {parsed.canonical[:80]}.",
                    "A canonical tag prevents duplicate-content confusion.",
                    "Keep canonical tags accurate.",
                )
            )
        else:
            checks.append(
                result(
                    "tech_canonical", self.category, STATUS_WARNING, 45,
                    "Canonical URL missing",
                    "We looked for a canonical link tag in the page head.",
                    "No canonical URL was found.",
                    "Without a canonical URL, duplicate versions of pages can confuse search engines.",
                    "Add a canonical link tag to each page.",
                )
            )

        # 4. robots.txt
        if ctx.robots.available:
            checks.append(
                result(
                    "tech_robots_txt", self.category, STATUS_PASS, 100,
                    "robots.txt available",
                    "We fetched robots.txt at the site root.",
                    "robots.txt is available.",
                    "A robots.txt file gives crawlers guidance about your site.",
                    "Keep robots.txt maintained.",
                )
            )
        else:
            checks.append(
                result(
                    "tech_robots_txt", self.category, STATUS_WARNING, 60,
                    "robots.txt not found",
                    "We looked for robots.txt at the site root.",
                    "No robots.txt file was found.",
                    "Without robots.txt, crawlers use default behavior, which is usually fine but less controlled.",
                    "Add a robots.txt file, even a minimal one.",
                )
            )

        # 5. Sitemap
        if ctx.sitemap.available:
            checks.append(
                result(
                    "tech_sitemap", self.category, STATUS_PASS, 100,
                    "Sitemap available",
                    "We checked for an XML sitemap.",
                    f"Sitemap found at {ctx.sitemap.url}.",
                    "A sitemap helps search engines discover all your pages.",
                    "Keep the sitemap up to date.",
                )
            )
        else:
            checks.append(
                result(
                    "tech_sitemap", self.category, STATUS_WARNING, 50,
                    "Sitemap missing",
                    "We checked for an XML sitemap.",
                    "No sitemap.xml was found.",
                    "Without a sitemap, search engines may miss pages.",
                    "Publish a sitemap and reference it from robots.txt.",
                )
            )

        # 6. HTTPS
        if page.final_url.startswith("https"):
            checks.append(
                result(
                    "tech_https", self.category, STATUS_PASS, 100,
                    "HTTPS in use",
                    "We checked whether the homepage is served over HTTPS.",
                    "The homepage is served over HTTPS.",
                    "HTTPS keeps visitor data encrypted and is expected by browsers and search engines.",
                    "Keep HTTPS enabled.",
                    weight=1.2,
                )
            )
        else:
            checks.append(
                result(
                    "tech_https", self.category, STATUS_FAIL, 0,
                    "HTTPS not used",
                    "We checked whether the homepage is served over HTTPS.",
                    "The homepage is served over HTTP only.",
                    "HTTP-only sites put visitor data at risk and are flagged by browsers.",
                    "Enable HTTPS and redirect HTTP to HTTPS.",
                    weight=1.2,
                )
            )

        # 7. Broken links
        if ctx.broken_links:
            checks.append(
                result(
                    "tech_broken_links", self.category, STATUS_WARNING, 40,
                    "Broken internal links detected",
                    "We checked internal links on the crawled pages.",
                    f"{len(ctx.broken_links)} internal link(s) returned an error.",
                    "Broken links frustrate visitors and waste search engine crawl budget.",
                    f"Fix broken links such as {ctx.broken_links[0]['url']} (HTTP {ctx.broken_links[0]['status_code']}).",
                    details={"broken": ctx.broken_links},
                )
            )
        else:
            checks.append(
                result(
                    "tech_broken_links", self.category, STATUS_PASS, 100,
                    "No broken links found",
                    "We checked internal links on the crawled pages.",
                    "All checked internal links responded successfully.",
                    "Healthy links keep visitors moving through your site.",
                    "No action needed.",
                    weight=0.8,
                )
            )

        # 8. Duplicate metadata across crawled pages
        titles = [p.title for p in ctx.parsed_pages if p.title]
        descriptions = [p.meta_description for p in ctx.parsed_pages if p.meta_description]
        dup_titles = len(titles) - len(set(titles))
        dup_descs = len(descriptions) - len(set(descriptions))
        if len(ctx.parsed_pages) > 1 and (dup_titles or dup_descs):
            checks.append(
                result(
                    "tech_duplicate_metadata", self.category, STATUS_WARNING, 50,
                    "Duplicate page metadata detected",
                    "We compared titles and meta descriptions across the crawled pages.",
                    f"{dup_titles} duplicate title(s) and {dup_descs} duplicate description(s) were found.",
                    "Duplicate metadata makes it harder for search engines to tell pages apart.",
                    "Give each page a unique title and meta description.",
                    details={"duplicate_titles": dup_titles, "duplicate_descriptions": dup_descs},
                )
            )
        else:
            checks.append(
                result(
                    "tech_duplicate_metadata", self.category, STATUS_PASS, 100,
                    "Metadata looks unique",
                    "We compared titles and meta descriptions across the crawled pages.",
                    "Crawled pages have distinct titles and descriptions.",
                    "Unique metadata helps search engines index each page correctly.",
                    "Keep metadata unique as the site grows.",
                )
            )

        # 9. Basic HTML structure
        soup = parsed.soup
        raw_start = (page.text or "")[:200].lstrip().lower()
        has_doctype = raw_start.startswith("<!doctype")
        html_tag = soup.find("html") is not None
        head_tag = soup.find("head") is not None
        body_tag = soup.find("body") is not None
        missing = []
        if not has_doctype:
            missing.append("doctype")
        if not html_tag:
            missing.append("<html>")
        if not head_tag:
            missing.append("<head>")
        if not body_tag:
            missing.append("<body>")
        if missing:
            checks.append(
                result(
                    "tech_html_structure", self.category, STATUS_WARNING, 50,
                    "Basic HTML structure is incomplete",
                    "We checked for a doctype and standard <html>, <head> and <body> elements.",
                    "Missing elements: " + ", ".join(missing) + ".",
                    "Incomplete HTML structure can cause inconsistent rendering in browsers.",
                    "Ensure pages start with <!doctype html> and include <html>, <head> and <body>.",
                )
            )
        else:
            checks.append(
                result(
                    "tech_html_structure", self.category, STATUS_PASS, 100,
                    "Basic HTML structure is valid",
                    "We checked for a doctype and standard <html>, <head> and <body> elements.",
                    "The page has a doctype and standard html/head/body elements.",
                    "Valid HTML structure renders consistently across browsers.",
                    "No action needed.",
                )
            )

        # 10. Server response information
        server = page.headers.get("server")
        if server:
            checks.append(
                result(
                    "tech_server_info", self.category, STATUS_WARNING, 55,
                    "Server header exposes software details",
                    "We checked the HTTP response for a Server header.",
                    f"The server identifies itself as \"{server}\".",
                    "Exposing server software details helps attackers target known weaknesses.",
                    "Minimize server header details (e.g. ServerTokens Prod).",
                )
            )
        else:
            checks.append(
                result(
                    "tech_server_info", self.category, STATUS_PASS, 100,
                    "Server header is not exposed",
                    "We checked the HTTP response for a Server header.",
                    "No Server header was found.",
                    "Hiding server details reduces the information available to attackers.",
                    "No action needed.",
                )
            )

        # 11. Favicon
        icon = soup.find("link", rel=lambda r: r and "icon" in r)
        if icon and icon.get("href"):
            checks.append(
                result(
                    "tech_favicon", self.category, STATUS_PASS, 100,
                    "Favicon is configured",
                    "We looked for a favicon link in the page head.",
                    "A favicon link was found.",
                    "A favicon helps visitors identify your site in browser tabs and bookmarks.",
                    "No action needed.",
                )
            )
        else:
            # Fall back to /favicon.ico probe
            favicon_status = None
            if page.status_code == 200:
                from app.services.crawler.crawler import _probe_url  # local import avoids cycle
                favicon_url = urljoin(page.final_url, "/favicon.ico")
                favicon_status = _probe_url(favicon_url)
            if favicon_status and favicon_status < 400:
                checks.append(
                    result(
                        "tech_favicon", self.category, STATUS_PASS, 100,
                        "Favicon found",
                        "We looked for a favicon link or /favicon.ico.",
                        "A favicon is available at /favicon.ico.",
                        "A favicon makes your site recognizable in browser tabs.",
                        "No action needed.",
                    )
                )
            else:
                checks.append(
                    result(
                        "tech_favicon", self.category, STATUS_WARNING, 65,
                        "Favicon is missing",
                        "We looked for a favicon link or /favicon.ico.",
                        "No favicon was detected.",
                        "Without a favicon, browser tabs show a generic icon.",
                        "Add a favicon and reference it with <link rel=\"icon\">.",
                        weight=0.6,
                    )
                )

        # 12. Language metadata
        lang = parsed.html_attrs.get("lang")
        if lang:
            checks.append(
                result(
                    "tech_language", self.category, STATUS_PASS, 100,
                    "Page language is declared",
                    "We checked the lang attribute on the <html> tag.",
                    f"The page declares its language as \"{lang}\".",
                    "Declaring language helps translation tools and search engines understand your content.",
                    "No action needed.",
                )
            )
        else:
            checks.append(
                result(
                    "tech_language", self.category, STATUS_WARNING, 50,
                    "Page language is not declared",
                    "We checked the lang attribute on the <html> tag.",
                    "No lang attribute was found.",
                    "Missing language metadata can affect translation tools and accessibility.",
                    "Add lang=\"en\" (or your language) to the <html> tag.",
                )
            )

        return checks
