import type { CrawlContext } from "../crawler/crawler.js";
import type { CheckResult } from "../../types.js";
import { BaseAnalyzer, result, STATUS_FAIL, STATUS_PASS, STATUS_WARNING } from "./base.js";

const KB = 1024;

export class PerformanceAnalyzer extends BaseAnalyzer {
  category = "performance";

  analyze(ctx: CrawlContext) {
    const checks: CheckResult[] = [];
    const page = ctx.pages[0];
    const parsed = ctx.parsedPages[0];
    if (!page || !parsed) return checks;

    // 1. Response time
    const ms = page.elapsedMs;
    if (ms < 800) {
      checks.push(
        result({
          id: "perf_response_time", category: this.category, status: STATUS_PASS, score: 100,
          title: "Server responds quickly",
          whatWasChecked: "We measured how long the server took to respond to our request.",
          actualResult: `The homepage responded in ${ms} ms.`,
          whyItMatters: "Fast server response time means visitors start seeing your page sooner.",
          howToFix: "Keep server response time under 800 ms.",
          weight: 1.2,
        })
      );
    } else if (ms < 2000) {
      checks.push(
        result({
          id: "perf_response_time", category: this.category, status: STATUS_WARNING, score: 60,
          title: "Server response is somewhat slow",
          whatWasChecked: "We measured how long the server took to respond to our request.",
          actualResult: `The homepage took ${ms} ms to respond.`,
          whyItMatters: "Slow responses make the whole page feel sluggish, especially on mobile.",
          howToFix: "Use caching, a CDN or faster hosting to reduce server response time.",
          weight: 1.2,
        })
      );
    } else {
      checks.push(
        result({
          id: "perf_response_time", category: this.category, status: STATUS_FAIL, score: 20,
          title: "Server response is slow",
          whatWasChecked: "We measured how long the server took to respond to our request.",
          actualResult: `The homepage took ${ms} ms to respond.`,
          whyItMatters: "Slow server responses frustrate visitors and increase abandonment.",
          howToFix: "Investigate hosting performance, enable caching and consider a CDN.",
          weight: 1.2,
        })
      );
    }

    // 2. HTTP status (perf angle)
    if (page.statusCode >= 200 && page.statusCode < 300) {
      checks.push(
        result({
          id: "perf_http_status", category: this.category, status: STATUS_PASS, score: 100,
          title: "Homepage loads successfully",
          whatWasChecked: "We checked the HTTP status code returned by the homepage.",
          actualResult: `HTTP ${page.statusCode} — the page is available.`,
          whyItMatters: "A successful status means visitors can actually reach your site.",
          howToFix: "No action needed.",
        })
      );
    } else {
      checks.push(
        result({
          id: "perf_http_status", category: this.category, status: STATUS_WARNING, score: 40,
          title: "Homepage did not return a normal response",
          whatWasChecked: "We checked the HTTP status code returned by the homepage.",
          actualResult: `The homepage returned HTTP ${page.statusCode}.`,
          whyItMatters: "Error or redirect responses can prevent the page from loading normally.",
          howToFix: "Fix the HTTP status so the page loads normally.",
        })
      );
    }

    // 3. Page size
    const sizeKb = page.content.length / KB;
    if (sizeKb < 500) {
      checks.push(
        result({
          id: "perf_page_size", category: this.category, status: STATUS_PASS, score: 100,
          title: "Page size is reasonable",
          whatWasChecked: "We measured the size of the HTML document.",
          actualResult: `The HTML document is ${sizeKb.toFixed(0)} KB.`,
          whyItMatters: "Lighter pages download faster, especially on slower connections.",
          howToFix: "Keep the initial HTML lean.",
          weight: 1.2,
        })
      );
    } else if (sizeKb < 1500) {
      checks.push(
        result({
          id: "perf_page_size", category: this.category, status: STATUS_WARNING, score: 55,
          title: "Page is somewhat heavy",
          whatWasChecked: "We measured the size of the HTML document.",
          actualResult: `The HTML document is ${sizeKb.toFixed(0)} KB.`,
          whyItMatters: "Large HTML documents can load slowly on mobile connections.",
          howToFix: "Reduce HTML size: remove unused markup and inline scripts where possible.",
          weight: 1.2,
        })
      );
    } else {
      checks.push(
        result({
          id: "perf_page_size", category: this.category, status: STATUS_FAIL, score: 20,
          title: "Page is very heavy",
          whatWasChecked: "We measured the size of the HTML document.",
          actualResult: `The HTML document is ${sizeKb.toFixed(0)} KB.`,
          whyItMatters: "Very large pages will be slow for typical visitors.",
          howToFix: "Trim the HTML, offload content to cached endpoints and compress the response.",
          weight: 1.2,
        })
      );
    }

    // 4. Number of resources
    const resources = parsed.images.length + parsed.scripts.length + parsed.stylesheets.length;
    if (resources <= 40) {
      checks.push(
        result({
          id: "perf_resource_count", category: this.category, status: STATUS_PASS, score: 100,
          title: "Reasonable number of resources",
          whatWasChecked: "We counted images, scripts and stylesheets referenced by the page.",
          actualResult: `The page references ${resources} resources.`,
          whyItMatters: "Fewer resources means fewer network requests and faster loading.",
          howToFix: "No action needed.",
        })
      );
    } else if (resources <= 80) {
      checks.push(
        result({
          id: "perf_resource_count", category: this.category, status: STATUS_WARNING, score: 60,
          title: "Many page resources",
          whatWasChecked: "We counted images, scripts and stylesheets referenced by the page.",
          actualResult: `The page references ${resources} resources.`,
          whyItMatters: "Each resource requires a network request, which can slow loading.",
          howToFix: "Combine CSS/JS files, use sprites or inline small assets.",
        })
      );
    } else {
      checks.push(
        result({
          id: "perf_resource_count", category: this.category, status: STATUS_FAIL, score: 25,
          title: "Very high number of resources",
          whatWasChecked: "We counted images, scripts and stylesheets referenced by the page.",
          actualResult: `The page references ${resources} resources.`,
          whyItMatters: "A very high resource count significantly slows page loading.",
          howToFix: "Consolidate assets, lazy-load below-the-fold media and remove unused files.",
        })
      );
    }

    // 5. Image optimization indicators
    const images = parsed.images;
    if (images.length) {
      const missingDims = images.filter((i) => !(i.width || i.srcset));
      const lazy = images.filter((i) => i.loading === "lazy").length;
      if (!missingDims.length && lazy) {
        checks.push(
          result({
            id: "perf_images", category: this.category, status: STATUS_PASS, score: 100,
            title: "Images look well optimized",
            whatWasChecked: "We checked whether images declare dimensions and use lazy loading.",
            actualResult: `All ${images.length} images declare dimensions; ${lazy} use lazy loading.`,
            whyItMatters: "Declared dimensions prevent layout shift and lazy loading speeds up initial render.",
            howToFix: "Keep new images optimized and lazy-loaded.",
          })
        );
      } else if (!missingDims.length) {
        checks.push(
          result({
            id: "perf_images", category: this.category, status: STATUS_PASS, score: 85,
            title: "Images declare dimensions",
            whatWasChecked: "We checked whether images declare dimensions and use lazy loading.",
            actualResult: "Images include width/height attributes.",
            whyItMatters: "Declared dimensions prevent layout shift while the page loads.",
            howToFix: 'Consider adding loading="lazy" to below-the-fold images.',
          })
        );
      } else {
        checks.push(
          result({
            id: "perf_images", category: this.category, status: STATUS_WARNING, score: 50,
            title: "Some images lack size hints",
            whatWasChecked: "We checked whether images declare dimensions and use lazy loading.",
            actualResult: `${missingDims.length} image(s) do not declare width/height.`,
            whyItMatters: "Images without size hints can cause layout shift and slower rendering.",
            howToFix: "Add width/height attributes to images and use lazy loading.",
          })
        );
      }
    } else {
      checks.push(
        result({
          id: "perf_images", category: this.category, status: STATUS_PASS, score: 100,
          title: "No images to evaluate",
          whatWasChecked: "We looked for images on the page.",
          actualResult: "The page contains no images.",
          whyItMatters: "There is nothing to optimize for image loading.",
          howToFix: "No action needed.",
          weight: 0.5,
        })
      );
    }

    // 6. Script count
    const scripts = parsed.scripts;
    if (scripts.length <= 5) {
      checks.push(
        result({
          id: "perf_scripts", category: this.category, status: STATUS_PASS, score: 100,
          title: "Few scripts",
          whatWasChecked: "We counted the <script> tags on the page.",
          actualResult: `The page uses ${scripts.length} script(s).`,
          whyItMatters: "Fewer scripts usually means faster interactivity.",
          howToFix: "No action needed.",
        })
      );
    } else if (scripts.length <= 15) {
      checks.push(
        result({
          id: "perf_scripts", category: this.category, status: STATUS_WARNING, score: 60,
          title: "Many scripts",
          whatWasChecked: "We counted the <script> tags on the page.",
          actualResult: `The page loads ${scripts.length} scripts.`,
          whyItMatters: "Many scripts can delay how quickly the page becomes interactive.",
          howToFix: "Defer non-critical scripts and remove unused ones.",
        })
      );
    } else {
      checks.push(
        result({
          id: "perf_scripts", category: this.category, status: STATUS_FAIL, score: 25,
          title: "Large number of scripts",
          whatWasChecked: "We counted the <script> tags on the page.",
          actualResult: `The page loads ${scripts.length} scripts.`,
          whyItMatters: "This volume of scripts will slow down interactivity for visitors.",
          howToFix: "Audit scripts, defer or async-load them, and remove anything unused.",
        })
      );
    }

    // 7. Stylesheet count
    const stylesheets = parsed.stylesheets;
    if (stylesheets.length <= 4) {
      checks.push(
        result({
          id: "perf_stylesheets", category: this.category, status: STATUS_PASS, score: 100,
          title: "Few stylesheets",
          whatWasChecked: "We counted the stylesheet <link> tags on the page.",
          actualResult: `The page uses ${stylesheets.length} stylesheet(s).`,
          whyItMatters: "Fewer stylesheets reduce render-blocking requests.",
          howToFix: "No action needed.",
        })
      );
    } else if (stylesheets.length <= 10) {
      checks.push(
        result({
          id: "perf_stylesheets", category: this.category, status: STATUS_WARNING, score: 60,
          title: "Several stylesheets",
          whatWasChecked: "We counted the stylesheet <link> tags on the page.",
          actualResult: `The page loads ${stylesheets.length} stylesheets.`,
          whyItMatters: "Multiple stylesheets increase render time.",
          howToFix: "Combine CSS files and load non-critical styles asynchronously.",
        })
      );
    } else {
      checks.push(
        result({
          id: "perf_stylesheets", category: this.category, status: STATUS_FAIL, score: 30,
          title: "Many stylesheets",
          whatWasChecked: "We counted the stylesheet <link> tags on the page.",
          actualResult: `The page loads ${stylesheets.length} stylesheets.`,
          whyItMatters: "Many stylesheets significantly increase render time.",
          howToFix: "Consolidate CSS into fewer files and remove unused rules.",
        })
      );
    }

    // 8. Compression
    const encoding = page.headers["content-encoding"] || "";
    if (encoding) {
      checks.push(
        result({
          id: "perf_compression", category: this.category, status: STATUS_PASS, score: 100,
          title: "Response is compressed",
          whatWasChecked: "We checked the response's Content-Encoding header.",
          actualResult: `The server compresses responses with ${encoding}.`,
          whyItMatters: "Compression shrinks download size, making pages load faster.",
          howToFix: "No action needed.",
        })
      );
    } else {
      checks.push(
        result({
          id: "perf_compression", category: this.category, status: STATUS_WARNING, score: 55,
          title: "Response is not compressed",
          whatWasChecked: "We checked the response's Content-Encoding header.",
          actualResult: "No gzip or brotli compression was found.",
          whyItMatters: "Uncompressed responses take longer to download.",
          howToFix: "Enable gzip or brotli compression on the server.",
        })
      );
    }

    // 9. Caching headers
    const cacheControl = page.headers["cache-control"];
    const etag = page.headers["etag"];
    const expires = page.headers["expires"];
    if (cacheControl || etag || expires) {
      checks.push(
        result({
          id: "perf_caching", category: this.category, status: STATUS_PASS, score: 100,
          title: "Caching headers present",
          whatWasChecked: "We checked for Cache-Control, ETag and Expires headers.",
          actualResult: `Found caching headers (Cache-Control: ${cacheControl || "none"}, ETag: ${etag ? "yes" : "no"}).`,
          whyItMatters: "Caching lets repeat visitors load your site faster.",
          howToFix: "Set sensible cache lifetimes for static assets.",
        })
      );
    } else {
      checks.push(
        result({
          id: "perf_caching", category: this.category, status: STATUS_WARNING, score: 45,
          title: "Caching headers missing",
          whatWasChecked: "We checked for Cache-Control, ETag and Expires headers.",
          actualResult: "No caching headers were found.",
          whyItMatters: "Without caching, browsers re-download resources more often than necessary.",
          howToFix: "Add caching headers: long-lived for static assets, short for HTML.",
        })
      );
    }

    // 10. Render-blocking indicators
    const blocking = scripts.filter((s) => !(s.async || s.defer) && !s.src);
    blocking.push(...scripts.filter((s) => !(s.async || s.defer) && Boolean(s.src)));
    if (!blocking.length) {
      checks.push(
        result({
          id: "perf_render_blocking", category: this.category, status: STATUS_PASS, score: 100,
          title: "No obvious render-blocking scripts",
          whatWasChecked: "We checked whether scripts load with async/defer attributes.",
          actualResult: "Scripts appear to be deferred or asynchronous.",
          whyItMatters: "Async/defer scripts let the page render before JavaScript finishes loading.",
          howToFix: "No action needed.",
        })
      );
    } else {
      checks.push(
        result({
          id: "perf_render_blocking", category: this.category, status: STATUS_WARNING, score: 50,
          title: "Scripts may block rendering",
          whatWasChecked: "We checked whether scripts load with async/defer attributes.",
          actualResult: `${blocking.length} script(s) load without async/defer.`,
          whyItMatters: "Blocking scripts can delay the first visible paint of the page.",
          howToFix: "Add defer (or async) to non-critical scripts and move them before </body>.",
        })
      );
    }

    return checks;
  }
}
