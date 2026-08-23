"""SEO analyzer: on-page and basic technical SEO checks."""
from __future__ import annotations

from typing import List
from urllib.parse import urlparse

from app.services.analyzers.base import STATUS_FAIL, STATUS_PASS, STATUS_WARNING, BaseAnalyzer, result
from app.services.crawler.html_parser import ParsedPage

TITLE_MIN = 30
TITLE_MAX = 60
META_MIN = 70
META_MAX = 160


class SEOAnalyzer(BaseAnalyzer):
    category = "seo"

    def analyze(self, ctx) -> List:
        checks: List = []
        page: ParsedPage = ctx.start_parsed
        if page is None:
            return checks

        # 1. Title tag exists
        if page.title:
            checks.append(
                result(
                    "seo_title_exists", self.category, STATUS_PASS, 100,
                    "Page title is present",
                    "We looked for a <title> tag in the page's HTML head.",
                    f"Found a title: \"{page.title[:80]}\".",
                    "Search engines display this title as the main headline in results, and browser tabs use it too.",
                    "Keep the title tag in place and make sure each page has a unique one.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_title_exists", self.category, STATUS_FAIL, 0,
                    "Page title is missing",
                    "We looked for a <title> tag in the page's HTML head.",
                    "No <title> tag was found on the page.",
                    "Without a title, search engines cannot show a meaningful headline for your page in results.",
                    "Add a <title> tag in the <head> of the page, e.g. <title>Your business name — what you do</title>.",
                    weight=1.5,
                )
            )

        # 2. Title length
        if page.title:
            length = len(page.title)
            if TITLE_MIN <= length <= TITLE_MAX:
                checks.append(
                    result(
                        "seo_title_length", self.category, STATUS_PASS, 100,
                        "Page title has a good length",
                        "We measured the number of characters in the title tag.",
                        f"Your title is {length} characters, within the recommended 30–60 range.",
                        "Titles in the recommended range display fully in search results and stay descriptive.",
                        "Keep titles between 30 and 60 characters.",
                    )
                )
            elif length < TITLE_MIN:
                checks.append(
                    result(
                        "seo_title_length", self.category, STATUS_WARNING, 60,
                        "Page title is quite short",
                        "We measured the number of characters in the title tag.",
                        f"Your title is {length} characters; the recommended range is 30–60.",
                        "Short titles waste space and often under-describe the page in search results.",
                        "Expand the title to 30–60 characters while keeping it descriptive.",
                    )
                )
            else:
                checks.append(
                    result(
                        "seo_title_length", self.category, STATUS_WARNING, 60,
                        "Page title is too long",
                        "We measured the number of characters in the title tag.",
                        f"Your title is {length} characters; the recommended range is 30–60.",
                        "Search engines typically truncate long titles, so important words can be cut off.",
                        "Shorten the title to 60 characters or fewer, front-loading the most important words.",
                    )
                )

        # 3. Meta description exists
        if page.meta_description:
            checks.append(
                result(
                    "seo_meta_description_exists", self.category, STATUS_PASS, 100,
                    "Meta description is present",
                    "We looked for a meta description tag in the page head.",
                    "A meta description was found.",
                    "Search engines can use it as the summary snippet under your result, which influences clicks.",
                    "Keep the meta description unique per page and compelling for humans.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_meta_description_exists", self.category, STATUS_WARNING, 30,
                    "Meta description is missing",
                    "We looked for a meta description tag in the page head.",
                    "No meta description was found.",
                    "Without a description, search engines improvise the snippet shown in results, which can reduce clicks.",
                    "Add <meta name=\"description\" content=\"...\"> with a clear 1–2 sentence summary.",
                    weight=1.2,
                )
            )

        # 4. Meta description length
        if page.meta_description:
            length = len(page.meta_description)
            if META_MIN <= length <= META_MAX:
                checks.append(
                    result(
                        "seo_meta_description_length", self.category, STATUS_PASS, 100,
                        "Meta description has a good length",
                        "We measured the number of characters in the meta description.",
                        f"Your description is {length} characters, within the recommended 70–160 range.",
                        "Descriptions in the recommended range display well in search results.",
                        "Keep descriptions between 70 and 160 characters.",
                    )
                )
            elif length < META_MIN:
                checks.append(
                    result(
                        "seo_meta_description_length", self.category, STATUS_WARNING, 60,
                        "Meta description is quite short",
                        "We measured the number of characters in the meta description.",
                        f"Your description is {length} characters; the recommended range is 70–160.",
                        "A little more detail usually earns more clicks from search results.",
                        "Expand the description to 70–160 characters.",
                    )
                )
            else:
                checks.append(
                    result(
                        "seo_meta_description_length", self.category, STATUS_WARNING, 60,
                        "Meta description is too long",
                        "We measured the number of characters in the meta description.",
                        f"Your description is {length} characters; the recommended range is 70–160.",
                        "Search engines may cut off long descriptions, hiding your best message.",
                        "Shorten the description to 160 characters or fewer.",
                    )
                )

        # 5. H1 exists
        if page.h1s:
            checks.append(
                result(
                    "seo_h1_exists", self.category, STATUS_PASS, 100,
                    "Main heading (H1) is present",
                    "We looked for an H1 heading in the page content.",
                    f"Found an H1: \"{page.h1s[0][:80]}\".",
                    "An H1 helps both users and search engines understand the page's primary topic.",
                    "Keep one descriptive H1 per page.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_h1_exists", self.category, STATUS_FAIL, 15,
                    "Main heading (H1) is missing",
                    "We looked for an H1 heading in the page content.",
                    "No H1 heading was found.",
                    "Without an H1, the page's main topic is less obvious to visitors and search engines.",
                    "Add a single <h1> that summarises the page.",
                    weight=1.3,
                )
            )

        # 6. H1 count
        if len(page.h1s) > 1:
            checks.append(
                result(
                    "seo_h1_count", self.category, STATUS_WARNING, 55,
                    "More than one H1 heading",
                    "We counted the H1 headings on the page.",
                    f"Found {len(page.h1s)} H1 headings.",
                    "Multiple H1s can dilute the page's focus for search engines and confuse screen reader users.",
                    "Use a single H1 per page; convert the others to H2 or H3.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_h1_count", self.category, STATUS_PASS, 100,
                    "Single H1 heading",
                    "We counted the H1 headings on the page.",
                    "Found exactly one H1 heading.",
                    "A single H1 keeps the page focused and easy to navigate.",
                    "Keep exactly one H1 per page.",
                )
            )

        # 7. Heading structure
        structure_ok = True
        headings = []
        for level in range(1, 7):
            headings += [level] * len(getattr(page, f"h{level}s"))
        for i in range(1, len(headings)):
            if headings[i] > headings[i - 1] + 1:
                structure_ok = False
                break
        if structure_ok:
            checks.append(
                result(
                    "seo_heading_structure", self.category, STATUS_PASS, 100,
                    "Heading structure is logical",
                    "We checked the order of H1–H6 headings on the page.",
                    "Headings progress in a sensible order without skipping levels.",
                    "Logical heading order helps readers and search engines understand the page structure.",
                    "Maintain a logical H1 → H2 → H3 hierarchy.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_heading_structure", self.category, STATUS_WARNING, 55,
                    "Heading levels are skipped",
                    "We checked the order of H1–H6 headings on the page.",
                    "Some heading levels skip a step (for example H2 jumping to H4).",
                    "Skipped heading levels can confuse screen readers and make the page structure harder to scan.",
                    "Adjust headings so levels never skip more than one step.",
                )
            )

        # 8. Canonical
        if page.canonical:
            checks.append(
                result(
                    "seo_canonical", self.category, STATUS_PASS, 100,
                    "Canonical URL is set",
                    "We looked for a canonical link tag in the page head.",
                    f"Canonical URL found: {page.canonical[:80]}.",
                    "A canonical tag tells search engines which URL is the preferred version, avoiding duplicate-content confusion.",
                    "Keep canonical tags pointing to the intended version of each page.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_canonical", self.category, STATUS_WARNING, 45,
                    "Canonical URL is missing",
                    "We looked for a canonical link tag in the page head.",
                    "No canonical URL was found.",
                    "Without a canonical tag, duplicate versions of the page can compete in search results.",
                    "Add <link rel=\"canonical\" href=\"...\"> pointing to the preferred URL.",
                )
            )

        # 9. Robots meta
        if page.robots_meta and "noindex" in page.robots_meta.lower():
            checks.append(
                result(
                    "seo_robots_meta", self.category, STATUS_FAIL, 25,
                    "Page asks search engines not to index it",
                    "We checked the robots meta tag in the page head.",
                    f"The robots meta tag contains \"{page.robots_meta}\".",
                    "Search engines may exclude this page from results, hiding it from people searching for you.",
                    "Remove the noindex directive unless hiding the page is intentional.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_robots_meta", self.category, STATUS_PASS, 100,
                    "Page allows indexing",
                    "We checked the robots meta tag in the page head.",
                    "No noindex directive was found.",
                    "Search engines are allowed to include this page in their results.",
                    "Keep the page indexable unless it is intentionally private.",
                )
            )

        # 10. robots.txt
        if ctx.robots.available:
            if ctx.robots.disallow_all:
                checks.append(
                    result(
                        "seo_robots_txt", self.category, STATUS_FAIL, 20,
                        "robots.txt blocks all crawlers",
                        "We fetched and reviewed the robots.txt file at the site root.",
                        "robots.txt contains a blanket Disallow: / rule.",
                        "Search engines may be prevented from indexing your entire site.",
                        "Review robots.txt and remove the blanket disallow unless it is intentional.",
                    )
                )
            else:
                checks.append(
                    result(
                        "seo_robots_txt", self.category, STATUS_PASS, 100,
                        "robots.txt is present",
                        "We fetched the robots.txt file at the site root.",
                        "robots.txt is available and does not block all crawlers.",
                        "A maintained robots.txt helps search engines crawl your site efficiently.",
                        "Keep robots.txt maintained and make sure it does not block important pages.",
                    )
                )
        else:
            checks.append(
                result(
                    "seo_robots_txt", self.category, STATUS_WARNING, 60,
                    "robots.txt is missing",
                    "We looked for a robots.txt file at the site root.",
                    "No robots.txt file was found.",
                    "Many sites publish robots.txt to guide crawlers; without it, crawlers use default behavior.",
                    "Add a robots.txt at the site root, e.g. https://yourdomain/robots.txt.",
                )
            )

        # 11. Sitemap
        if ctx.sitemap.available:
            checks.append(
                result(
                    "seo_sitemap", self.category, STATUS_PASS, 100,
                    "Sitemap is available",
                    "We checked for an XML sitemap (from robots.txt or /sitemap.xml).",
                    f"Sitemap found at {ctx.sitemap.url}.",
                    "A sitemap helps search engines discover pages, especially new or rarely linked content.",
                    "Keep the sitemap up to date as pages change.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_sitemap", self.category, STATUS_WARNING, 50,
                    "Sitemap is missing",
                    "We checked for an XML sitemap (from robots.txt or /sitemap.xml).",
                    "No sitemap.xml was found.",
                    "Without a sitemap, search engines may take longer to discover all your pages.",
                    "Generate and upload a sitemap (many CMS plugins do this automatically).",
                )
            )

        # 12. Image alt attributes (across crawled pages)
        all_images = [img for p in ctx.parsed_pages for img in p.images]
        if all_images:
            missing = [i for i in all_images if not i.get("alt")]
            ratio = len(missing) / len(all_images)
            if ratio == 0:
                checks.append(
                    result(
                        "seo_image_alt", self.category, STATUS_PASS, 100,
                        "All images have alt text",
                        "We checked every crawled image for an alt attribute.",
                        f"All {len(all_images)} crawled images include alt text.",
                        "Alt text helps search engines understand images and improves image search visibility.",
                        "Keep writing descriptive alt text for new images.",
                    )
                )
            elif ratio <= 0.2:
                checks.append(
                    result(
                        "seo_image_alt", self.category, STATUS_WARNING, 65,
                        "Some images are missing alt text",
                        "We checked every crawled image for an alt attribute.",
                        f"{len(missing)} of {len(all_images)} images lack alt text.",
                        "Missing alt text hurts image search and makes images less accessible.",
                        f"Add alt text to these images: {', '.join((m.get('src') or 'unknown')[:80] for m in missing[:3])}",
                    )
                )
            else:
                checks.append(
                    result(
                        "seo_image_alt", self.category, STATUS_FAIL, 25,
                        "Many images are missing alt text",
                        "We checked every crawled image for an alt attribute.",
                        f"{len(missing)} of {len(all_images)} images lack alt text.",
                        "This significantly limits image search and accessibility for screen reader users.",
                        "Add descriptive alt text to every meaningful image.",
                        weight=1.2,
                    )
                )
        else:
            checks.append(
                result(
                    "seo_image_alt", self.category, STATUS_PASS, 100,
                    "No images to check",
                    "We looked for images on the crawled pages.",
                    "No images were found.",
                    "There is nothing to flag for image search optimization.",
                    "No action needed.",
                    weight=0.5,
                )
            )

        # 13. Broken internal links
        if ctx.broken_links:
            checks.append(
                result(
                    "seo_broken_links", self.category, STATUS_WARNING, 40,
                    "Some internal links are broken",
                    "We checked internal links found on the crawled pages.",
                    f"Found {len(ctx.broken_links)} internal link(s) returning an error status.",
                    "Broken links frustrate visitors and waste crawl budget for search engines.",
                    f"Fix or remove broken links, e.g. {ctx.broken_links[0]['url']} (HTTP {ctx.broken_links[0]['status_code']}).",
                    details={"broken": ctx.broken_links},
                )
            )
        else:
            checks.append(
                result(
                    "seo_broken_links", self.category, STATUS_PASS, 100,
                    "No broken internal links found",
                    "We checked internal links found on the crawled pages.",
                    "All checked internal links responded successfully.",
                    "Healthy internal links keep visitors moving through your site.",
                    "Continue monitoring links as the site grows.",
                    weight=0.8,
                )
            )

        # 14. Open Graph
        og_keys = [k for k in page.meta_tags if k.startswith("og:")]
        if len(og_keys) >= 3:
            checks.append(
                result(
                    "seo_open_graph", self.category, STATUS_PASS, 100,
                    "Open Graph tags are present",
                    "We looked for Open Graph meta tags (og:title, og:description, og:image, etc.).",
                    f"Found {len(og_keys)} Open Graph tags.",
                    "Open Graph tags control how your page looks when shared on social media.",
                    "Keep Open Graph tags updated with the correct title, description and image.",
                )
            )
        elif og_keys:
            checks.append(
                result(
                    "seo_open_graph", self.category, STATUS_WARNING, 60,
                    "Open Graph tags are incomplete",
                    "We looked for Open Graph meta tags (og:title, og:description, og:image, etc.).",
                    f"Found only {len(og_keys)} Open Graph tag(s).",
                    "Incomplete Open Graph tags may cause plain or missing previews when your page is shared.",
                    "Add og:title, og:description and og:image to the page head.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_open_graph", self.category, STATUS_WARNING, 45,
                    "Open Graph tags are missing",
                    "We looked for Open Graph meta tags (og:title, og:description, og:image, etc.).",
                    "No Open Graph tags were found.",
                    "Without Open Graph tags, links shared on social media may show no image or summary.",
                    "Add og:title, og:description, og:image and og:url meta tags.",
                )
            )

        # 15. Structured data
        sd = 0
        for p in ctx.parsed_pages:
            sd += len(p.soup.find_all("script", attrs={"type": lambda t: t and "ld+json" in t.lower()}))
            sd += len(p.soup.find_all(attrs={"itemtype": True}))
        if sd:
            checks.append(
                result(
                    "seo_structured_data", self.category, STATUS_PASS, 100,
                    "Structured data found",
                    "We looked for JSON-LD or microdata structured data on the crawled pages.",
                    f"Found {sd} structured data block(s).",
                    "Structured data can enable rich results (e.g. star ratings, product info) in search.",
                    "Validate structured data with a testing tool and keep it accurate.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_structured_data", self.category, STATUS_WARNING, 50,
                    "No structured data detected",
                    "We looked for JSON-LD or microdata structured data on the crawled pages.",
                    "No structured data was detected.",
                    "Structured data helps search engines understand your business, products or articles.",
                    "Add JSON-LD structured data (e.g. Organization or Product schema).",
                )
            )

        # 16. URL structure
        path = urlparse(ctx.start_page.final_url if ctx.start_page else ctx.start_url).path
        bad = len(path) > 100 or path.count("/") > 6 or any(tok in path.lower() for tok in ["?p=", "index.php", "/tag/"])
        if not bad and ctx.start_page and ctx.start_page.final_url.startswith("https"):
            checks.append(
                result(
                    "seo_url_structure", self.category, STATUS_PASS, 100,
                    "URL structure looks clean",
                    "We reviewed the page URL length, path depth and HTTPS usage.",
                    f"The page URL is concise and served over HTTPS: {path}",
                    "Clean, short URLs are easier for people to read and for search engines to understand.",
                    "Keep URLs short, readable and consistent.",
                )
            )
        elif not bad:
            checks.append(
                result(
                    "seo_url_structure", self.category, STATUS_WARNING, 70,
                    "Consider HTTPS URLs",
                    "We reviewed the page URL length, path depth and HTTPS usage.",
                    "The URL structure is clean but the page is served over HTTP.",
                    "Search engines and browsers prefer HTTPS, and visitors expect a secure connection.",
                    "Redirect HTTP traffic to HTTPS.",
                )
            )
        else:
            checks.append(
                result(
                    "seo_url_structure", self.category, STATUS_WARNING, 55,
                    "URL structure could be cleaner",
                    "We reviewed the page URL length, path depth and parameters.",
                    f"The URL path is: {path}",
                    "Long or parameter-heavy URLs are less friendly for users and search engines.",
                    "Use short, descriptive paths without unnecessary parameters.",
                )
            )

        return checks
