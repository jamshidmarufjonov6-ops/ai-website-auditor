"""Performance analyzer based on practical, self-contained measurements."""
from __future__ import annotations

from typing import List

from app.services.analyzers.base import STATUS_FAIL, STATUS_PASS, STATUS_WARNING, BaseAnalyzer, result

KB = 1024


class PerformanceAnalyzer(BaseAnalyzer):
    category = "performance"

    def analyze(self, ctx) -> List:
        checks: List = []
        page = ctx.start_page
        parsed = ctx.start_parsed
        if page is None or parsed is None:
            return checks

        # 1. Response time
        ms = page.elapsed_ms
        if ms < 800:
            checks.append(
                result(
                    "perf_response_time", self.category, STATUS_PASS, 100,
                    "Server responds quickly",
                    "We measured how long the server took to respond to our request.",
                    f"The homepage responded in {ms} ms.",
                    "Fast server response time means visitors start seeing your page sooner.",
                    "Keep server response time under 800 ms.",
                    weight=1.2,
                )
            )
        elif ms < 2000:
            checks.append(
                result(
                    "perf_response_time", self.category, STATUS_WARNING, 60,
                    "Server response is somewhat slow",
                    "We measured how long the server took to respond to our request.",
                    f"The homepage took {ms} ms to respond.",
                    "Slow responses make the whole page feel sluggish, especially on mobile.",
                    "Use caching, a CDN or faster hosting to reduce server response time.",
                    weight=1.2,
                )
            )
        else:
            checks.append(
                result(
                    "perf_response_time", self.category, STATUS_FAIL, 20,
                    "Server response is slow",
                    "We measured how long the server took to respond to our request.",
                    f"The homepage took {ms} ms to respond.",
                    "Slow server responses frustrate visitors and increase abandonment.",
                    "Investigate hosting performance, enable caching and consider a CDN.",
                    weight=1.2,
                )
            )

        # 2. HTTP status (perf angle)
        if 200 <= page.status_code < 300:
            checks.append(
                result(
                    "perf_http_status", self.category, STATUS_PASS, 100,
                    "Homepage loads successfully",
                    "We checked the HTTP status code returned by the homepage.",
                    f"HTTP {page.status_code} — the page is available.",
                    "A successful status means visitors can actually reach your site.",
                    "No action needed.",
                )
            )
        else:
            checks.append(
                result(
                    "perf_http_status", self.category, STATUS_WARNING, 40,
                    "Homepage did not return a normal response",
                    "We checked the HTTP status code returned by the homepage.",
                    f"The homepage returned HTTP {page.status_code}.",
                    "Error or redirect responses can prevent the page from loading normally.",
                    "Fix the HTTP status so the page loads normally.",
                )
            )

        # 3. Page size
        size_kb = page.size_bytes / KB
        if size_kb < 500:
            checks.append(
                result(
                    "perf_page_size", self.category, STATUS_PASS, 100,
                    "Page size is reasonable",
                    "We measured the size of the HTML document.",
                    f"The HTML document is {size_kb:.0f} KB.",
                    "Lighter pages download faster, especially on slower connections.",
                    "Keep the initial HTML lean.",
                    weight=1.2,
                )
            )
        elif size_kb < 1500:
            checks.append(
                result(
                    "perf_page_size", self.category, STATUS_WARNING, 55,
                    "Page is somewhat heavy",
                    "We measured the size of the HTML document.",
                    f"The HTML document is {size_kb:.0f} KB.",
                    "Large HTML documents can load slowly on mobile connections.",
                    "Reduce HTML size: remove unused markup and inline scripts where possible.",
                    weight=1.2,
                )
            )
        else:
            checks.append(
                result(
                    "perf_page_size", self.category, STATUS_FAIL, 20,
                    "Page is very heavy",
                    "We measured the size of the HTML document.",
                    f"The HTML document is {size_kb:.0f} KB.",
                    "Very large pages will be slow for typical visitors.",
                    "Trim the HTML, offload content to cached endpoints and compress the response.",
                    weight=1.2,
                )
            )

        # 4. Number of resources
        resources = len(parsed.images) + len(parsed.scripts) + len(parsed.stylesheets)
        if resources <= 40:
            checks.append(
                result(
                    "perf_resource_count", self.category, STATUS_PASS, 100,
                    "Reasonable number of resources",
                    "We counted images, scripts and stylesheets referenced by the page.",
                    f"The page references {resources} resources.",
                    "Fewer resources means fewer network requests and faster loading.",
                    "No action needed.",
                )
            )
        elif resources <= 80:
            checks.append(
                result(
                    "perf_resource_count", self.category, STATUS_WARNING, 60,
                    "Many page resources",
                    "We counted images, scripts and stylesheets referenced by the page.",
                    f"The page references {resources} resources.",
                    "Each resource requires a network request, which can slow loading.",
                    "Combine CSS/JS files, use sprites or inline small assets.",
                )
            )
        else:
            checks.append(
                result(
                    "perf_resource_count", self.category, STATUS_FAIL, 25,
                    "Very high number of resources",
                    "We counted images, scripts and stylesheets referenced by the page.",
                    f"The page references {resources} resources.",
                    "A very high resource count significantly slows page loading.",
                    "Consolidate assets, lazy-load below-the-fold media and remove unused files.",
                )
            )

        # 5. Image optimization indicators
        images = parsed.images
        if images:
            missing_dims = [i for i in images if not (i.get("width") or i.get("srcset"))]
            lazy = sum(1 for i in images if i.get("loading") == "lazy")
            if not missing_dims and lazy:
                checks.append(
                    result(
                        "perf_images", self.category, STATUS_PASS, 100,
                        "Images look well optimized",
                        "We checked whether images declare dimensions and use lazy loading.",
                        f"All {len(images)} images declare dimensions; {lazy} use lazy loading.",
                        "Declared dimensions prevent layout shift and lazy loading speeds up initial render.",
                        "Keep new images optimized and lazy-loaded.",
                    )
                )
            elif not missing_dims:
                checks.append(
                    result(
                        "perf_images", self.category, STATUS_PASS, 85,
                        "Images declare dimensions",
                        "We checked whether images declare dimensions and use lazy loading.",
                        "Images include width/height attributes.",
                        "Declared dimensions prevent layout shift while the page loads.",
                        "Consider adding loading=\"lazy\" to below-the-fold images.",
                    )
                )
            else:
                checks.append(
                    result(
                        "perf_images", self.category, STATUS_WARNING, 50,
                        "Some images lack size hints",
                        "We checked whether images declare dimensions and use lazy loading.",
                        f"{len(missing_dims)} image(s) do not declare width/height.",
                        "Images without size hints can cause layout shift and slower rendering.",
                        "Add width/height attributes to images and use lazy loading.",
                    )
                )
        else:
            checks.append(
                result(
                    "perf_images", self.category, STATUS_PASS, 100,
                    "No images to evaluate",
                    "We looked for images on the page.",
                    "The page contains no images.",
                    "There is nothing to optimize for image loading.",
                    "No action needed.",
                    weight=0.5,
                )
            )

        # 6. Script count
        scripts = parsed.scripts
        if len(scripts) <= 5:
            checks.append(
                result(
                    "perf_scripts", self.category, STATUS_PASS, 100,
                    "Few scripts",
                    "We counted the <script> tags on the page.",
                    f"The page uses {len(scripts)} script(s).",
                    "Fewer scripts usually means faster interactivity.",
                    "No action needed.",
                )
            )
        elif len(scripts) <= 15:
            checks.append(
                result(
                    "perf_scripts", self.category, STATUS_WARNING, 60,
                    "Many scripts",
                    "We counted the <script> tags on the page.",
                    f"The page loads {len(scripts)} scripts.",
                    "Many scripts can delay how quickly the page becomes interactive.",
                    "Defer non-critical scripts and remove unused ones.",
                )
            )
        else:
            checks.append(
                result(
                    "perf_scripts", self.category, STATUS_FAIL, 25,
                    "Large number of scripts",
                    "We counted the <script> tags on the page.",
                    f"The page loads {len(scripts)} scripts.",
                    "This volume of scripts will slow down interactivity for visitors.",
                    "Audit scripts, defer or async-load them, and remove anything unused.",
                )
            )

        # 7. Stylesheet count
        stylesheets = parsed.stylesheets
        if len(stylesheets) <= 4:
            checks.append(
                result(
                    "perf_stylesheets", self.category, STATUS_PASS, 100,
                    "Few stylesheets",
                    "We counted the stylesheet <link> tags on the page.",
                    f"The page uses {len(stylesheets)} stylesheet(s).",
                    "Fewer stylesheets reduce render-blocking requests.",
                    "No action needed.",
                )
            )
        elif len(stylesheets) <= 10:
            checks.append(
                result(
                    "perf_stylesheets", self.category, STATUS_WARNING, 60,
                    "Several stylesheets",
                    "We counted the stylesheet <link> tags on the page.",
                    f"The page loads {len(stylesheets)} stylesheets.",
                    "Multiple stylesheets increase render time.",
                    "Combine CSS files and load non-critical styles asynchronously.",
                )
            )
        else:
            checks.append(
                result(
                    "perf_stylesheets", self.category, STATUS_FAIL, 30,
                    "Many stylesheets",
                    "We counted the stylesheet <link> tags on the page.",
                    f"The page loads {len(stylesheets)} stylesheets.",
                    "Many stylesheets significantly increase render time.",
                    "Consolidate CSS into fewer files and remove unused rules.",
                )
            )

        # 8. Compression
        encoding = page.headers.get("content-encoding", "")
        if encoding:
            checks.append(
                result(
                    "perf_compression", self.category, STATUS_PASS, 100,
                    "Response is compressed",
                    "We checked the response's Content-Encoding header.",
                    f"The server compresses responses with {encoding}.",
                    "Compression shrinks download size, making pages load faster.",
                    "No action needed.",
                )
            )
        else:
            checks.append(
                result(
                    "perf_compression", self.category, STATUS_WARNING, 55,
                    "Response is not compressed",
                    "We checked the response's Content-Encoding header.",
                    "No gzip or brotli compression was found.",
                    "Uncompressed responses take longer to download.",
                    "Enable gzip or brotli compression on the server.",
                )
            )

        # 9. Caching headers
        cache_control = page.headers.get("cache-control")
        etag = page.headers.get("etag")
        expires = page.headers.get("expires")
        if cache_control or etag or expires:
            checks.append(
                result(
                    "perf_caching", self.category, STATUS_PASS, 100,
                    "Caching headers present",
                    "We checked for Cache-Control, ETag and Expires headers.",
                    f"Found caching headers (Cache-Control: {cache_control or 'none'}, ETag: {'yes' if etag else 'no'}).",
                    "Caching lets repeat visitors load your site faster.",
                    "Set sensible cache lifetimes for static assets.",
                )
            )
        else:
            checks.append(
                result(
                    "perf_caching", self.category, STATUS_WARNING, 45,
                    "Caching headers missing",
                    "We checked for Cache-Control, ETag and Expires headers.",
                    "No caching headers were found.",
                    "Without caching, browsers re-download resources more often than necessary.",
                    "Add caching headers: long-lived for static assets, short for HTML.",
                )
            )

        # 10. Render-blocking indicators
        blocking = [s for s in scripts if not (s.get("async") or s.get("defer")) and not s.get("src")]
        blocking += [s for s in scripts if not (s.get("async") or s.get("defer")) and s.get("src")]
        if not blocking:
            checks.append(
                result(
                    "perf_render_blocking", self.category, STATUS_PASS, 100,
                    "No obvious render-blocking scripts",
                    "We checked whether scripts load with async/defer attributes.",
                    "Scripts appear to be deferred or asynchronous.",
                    "Async/defer scripts let the page render before JavaScript finishes loading.",
                    "No action needed.",
                )
            )
        else:
            checks.append(
                result(
                    "perf_render_blocking", self.category, STATUS_WARNING, 50,
                    "Scripts may block rendering",
                    "We checked whether scripts load with async/defer attributes.",
                    f"{len(blocking)} script(s) load without async/defer.",
                    "Blocking scripts can delay the first visible paint of the page.",
                    "Add defer (or async) to non-critical scripts and move them before </body>.",
                )
            )

        return checks
