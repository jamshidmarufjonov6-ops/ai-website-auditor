import { probeUrl } from "../crawler/fetcher.js";
import type { CrawlContext } from "../crawler/crawler.js";
import type { CheckResult } from "../../types.js";
import { BaseAnalyzer, result, STATUS_FAIL, STATUS_PASS, STATUS_WARNING } from "./base.js";

export class TechnicalAnalyzer extends BaseAnalyzer {
  category = "technical";

  async analyze(ctx: CrawlContext) {
    const checks: CheckResult[] = [];
    const page = ctx.pages[0];
    const parsed = ctx.parsedPages[0];
    if (!page || !parsed) return checks;
    const $ = parsed.$;

    // 1. HTTP status
    const status = page.statusCode;
    if (status >= 200 && status < 300) {
      checks.push(
        result({
          id: "tech_http_status", category: this.category, status: STATUS_PASS, score: 100,
          title: "Homepage responds successfully",
          whatWasChecked: "We checked the HTTP status code returned by the homepage.",
          actualResult: `The homepage returned HTTP ${status}.`,
          whyItMatters: "A successful status means the site is reachable by visitors and search engines.",
          howToFix: "No action needed.",
          weight: 1.2,
        })
      );
    } else if (status >= 300 && status < 400) {
      checks.push(
        result({
          id: "tech_http_status", category: this.category, status: STATUS_WARNING, score: 60,
          title: "Homepage uses a redirect",
          whatWasChecked: "We checked the HTTP status code returned by the homepage.",
          actualResult: `The homepage returned HTTP ${status}.`,
          whyItMatters: "Redirects are normal for domain moves but can slow first paint and confuse bookmarks.",
          howToFix: "Where possible, serve the final content directly at the requested URL.",
        })
      );
    } else if (status === 404) {
      checks.push(
        result({
          id: "tech_http_status", category: this.category, status: STATUS_FAIL, score: 10,
          title: "Homepage returns 404",
          whatWasChecked: "We checked the HTTP status code returned by the homepage.",
          actualResult: "The URL you entered returns HTTP 404 (not found).",
          whyItMatters: "Visitors cannot reach the page they were looking for.",
          howToFix: "Check the URL or restore the page.",
          weight: 1.2,
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_http_status", category: this.category, status: STATUS_FAIL, score: 20,
          title: `Homepage returned HTTP ${status}`,
          whatWasChecked: "We checked the HTTP status code returned by the homepage.",
          actualResult: `The homepage responded with HTTP ${status}.`,
          whyItMatters: "Error responses prevent visitors from using the site.",
          howToFix: "Investigate the server configuration and error logs.",
          weight: 1.2,
        })
      );
    }

    // 2. Redirect chain
    const redirects = page.history.length;
    if (redirects === 0) {
      checks.push(
        result({
          id: "tech_redirects", category: this.category, status: STATUS_PASS, score: 100,
          title: "No redirect chain",
          whatWasChecked: "We counted how many redirects the homepage follows.",
          actualResult: "The homepage loads without redirects.",
          whyItMatters: "Fewer redirects means faster loading and fewer chances for issues.",
          howToFix: "No action needed.",
        })
      );
    } else if (redirects <= 2) {
      checks.push(
        result({
          id: "tech_redirects", category: this.category, status: STATUS_WARNING, score: 70,
          title: "Short redirect chain",
          whatWasChecked: "We counted how many redirects the homepage follows.",
          actualResult: `The homepage redirects ${redirects} time(s).`,
          whyItMatters: "Each redirect adds a little latency for visitors.",
          howToFix: "Consider consolidating redirects so each URL reaches its destination in one hop.",
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_redirects", category: this.category, status: STATUS_WARNING, score: 45,
          title: "Long redirect chain",
          whatWasChecked: "We counted how many redirects the homepage follows.",
          actualResult: `The homepage redirects ${redirects} times.`,
          whyItMatters: "Long redirect chains slow visitors and can dilute link value.",
          howToFix: "Reduce the redirect chain to a single hop where possible.",
        })
      );
    }

    // 3. Canonical
    if (parsed.canonical) {
      checks.push(
        result({
          id: "tech_canonical", category: this.category, status: STATUS_PASS, score: 100,
          title: "Canonical URL is declared",
          whatWasChecked: "We looked for a canonical link tag in the page head.",
          actualResult: `Canonical URL found: ${parsed.canonical.slice(0, 80)}.`,
          whyItMatters: "A canonical tag prevents duplicate-content confusion.",
          howToFix: "Keep canonical tags accurate.",
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_canonical", category: this.category, status: STATUS_WARNING, score: 45,
          title: "Canonical URL missing",
          whatWasChecked: "We looked for a canonical link tag in the page head.",
          actualResult: "No canonical URL was found.",
          whyItMatters: "Without a canonical URL, duplicate versions of pages can confuse search engines.",
          howToFix: "Add a canonical link tag to each page.",
        })
      );
    }

    // 4. robots.txt
    if (ctx.robots.available) {
      checks.push(
        result({
          id: "tech_robots_txt", category: this.category, status: STATUS_PASS, score: 100,
          title: "robots.txt available",
          whatWasChecked: "We fetched robots.txt at the site root.",
          actualResult: "robots.txt is available.",
          whyItMatters: "A robots.txt file gives crawlers guidance about your site.",
          howToFix: "Keep robots.txt maintained.",
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_robots_txt", category: this.category, status: STATUS_WARNING, score: 60,
          title: "robots.txt not found",
          whatWasChecked: "We looked for robots.txt at the site root.",
          actualResult: "No robots.txt file was found.",
          whyItMatters: "Without robots.txt, crawlers use default behavior, which is usually fine but less controlled.",
          howToFix: "Add a robots.txt file, even a minimal one.",
        })
      );
    }

    // 5. Sitemap
    if (ctx.sitemap.available) {
      checks.push(
        result({
          id: "tech_sitemap", category: this.category, status: STATUS_PASS, score: 100,
          title: "Sitemap available",
          whatWasChecked: "We checked for an XML sitemap.",
          actualResult: `Sitemap found at ${ctx.sitemap.url}.`,
          whyItMatters: "A sitemap helps search engines discover all your pages.",
          howToFix: "Keep the sitemap up to date.",
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_sitemap", category: this.category, status: STATUS_WARNING, score: 50,
          title: "Sitemap missing",
          whatWasChecked: "We checked for an XML sitemap.",
          actualResult: "No sitemap.xml was found.",
          whyItMatters: "Without a sitemap, search engines may miss pages.",
          howToFix: "Publish a sitemap and reference it from robots.txt.",
        })
      );
    }

    // 6. HTTPS
    if (page.finalUrl.startsWith("https")) {
      checks.push(
        result({
          id: "tech_https", category: this.category, status: STATUS_PASS, score: 100,
          title: "HTTPS in use",
          whatWasChecked: "We checked whether the homepage is served over HTTPS.",
          actualResult: "The homepage is served over HTTPS.",
          whyItMatters: "HTTPS keeps visitor data encrypted and is expected by browsers and search engines.",
          howToFix: "Keep HTTPS enabled.",
          weight: 1.2,
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_https", category: this.category, status: STATUS_FAIL, score: 0,
          title: "HTTPS not used",
          whatWasChecked: "We checked whether the homepage is served over HTTPS.",
          actualResult: "The homepage is served over HTTP only.",
          whyItMatters: "HTTP-only sites put visitor data at risk and are flagged by browsers.",
          howToFix: "Enable HTTPS and redirect HTTP to HTTPS.",
          weight: 1.2,
        })
      );
    }

    // 7. Broken links
    if (ctx.brokenLinks.length) {
      checks.push(
        result({
          id: "tech_broken_links", category: this.category, status: STATUS_WARNING, score: 40,
          title: "Broken internal links detected",
          whatWasChecked: "We checked internal links on the crawled pages.",
          actualResult: `${ctx.brokenLinks.length} internal link(s) returned an error.`,
          whyItMatters: "Broken links frustrate visitors and waste search engine crawl budget.",
          howToFix: `Fix broken links such as ${ctx.brokenLinks[0].url} (HTTP ${ctx.brokenLinks[0].status_code}).`,
          details: { broken: ctx.brokenLinks },
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_broken_links", category: this.category, status: STATUS_PASS, score: 100,
          title: "No broken links found",
          whatWasChecked: "We checked internal links on the crawled pages.",
          actualResult: "All checked internal links responded successfully.",
          whyItMatters: "Healthy links keep visitors moving through your site.",
          howToFix: "No action needed.",
          weight: 0.8,
        })
      );
    }

    // 8. Duplicate metadata across crawled pages
    const titles = ctx.parsedPages.map((p) => p.title).filter(Boolean) as string[];
    const descriptions = ctx.parsedPages.map((p) => p.metaDescription).filter(Boolean) as string[];
    const dupTitles = titles.length - new Set(titles).size;
    const dupDescs = descriptions.length - new Set(descriptions).size;
    if (ctx.parsedPages.length > 1 && (dupTitles || dupDescs)) {
      checks.push(
        result({
          id: "tech_duplicate_metadata", category: this.category, status: STATUS_WARNING, score: 50,
          title: "Duplicate page metadata detected",
          whatWasChecked: "We compared titles and meta descriptions across the crawled pages.",
          actualResult: `${dupTitles} duplicate title(s) and ${dupDescs} duplicate description(s) were found.`,
          whyItMatters: "Duplicate metadata makes it harder for search engines to tell pages apart.",
          howToFix: "Give each page a unique title and meta description.",
          details: { duplicate_titles: dupTitles, duplicate_descriptions: dupDescs },
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_duplicate_metadata", category: this.category, status: STATUS_PASS, score: 100,
          title: "Metadata looks unique",
          whatWasChecked: "We compared titles and meta descriptions across the crawled pages.",
          actualResult: "Crawled pages have distinct titles and descriptions.",
          whyItMatters: "Unique metadata helps search engines index each page correctly.",
          howToFix: "Keep metadata unique as the site grows.",
        })
      );
    }

    // 9. Basic HTML structure
    const rawStart = decodeStart(page).toLowerCase();
    const hasDoctype = rawStart.startsWith("<!doctype");
    const htmlTag = $("html").length > 0;
    const headTag = $("head").length > 0;
    const bodyTag = $("body").length > 0;
    const missing: string[] = [];
    if (!hasDoctype) missing.push("doctype");
    if (!htmlTag) missing.push("<html>");
    if (!headTag) missing.push("<head>");
    if (!bodyTag) missing.push("<body>");
    if (missing.length) {
      checks.push(
        result({
          id: "tech_html_structure", category: this.category, status: STATUS_WARNING, score: 50,
          title: "Basic HTML structure is incomplete",
          whatWasChecked: "We checked for a doctype and standard <html>, <head> and <body> elements.",
          actualResult: `Missing elements: ${missing.join(", ")}.`,
          whyItMatters: "Incomplete HTML structure can cause inconsistent rendering in browsers.",
          howToFix: "Ensure pages start with <!doctype html> and include <html>, <head> and <body>.",
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_html_structure", category: this.category, status: STATUS_PASS, score: 100,
          title: "Basic HTML structure is valid",
          whatWasChecked: "We checked for a doctype and standard <html>, <head> and <body> elements.",
          actualResult: "The page has a doctype and standard html/head/body elements.",
          whyItMatters: "Valid HTML structure renders consistently across browsers.",
          howToFix: "No action needed.",
        })
      );
    }

    // 10. Server response information
    const server = page.headers["server"];
    if (server) {
      checks.push(
        result({
          id: "tech_server_info", category: this.category, status: STATUS_WARNING, score: 55,
          title: "Server header exposes software details",
          whatWasChecked: "We checked the HTTP response for a Server header.",
          actualResult: `The server identifies itself as "${server}".`,
          whyItMatters: "Exposing server software details helps attackers target known weaknesses.",
          howToFix: "Minimize server header details (e.g. ServerTokens Prod).",
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_server_info", category: this.category, status: STATUS_PASS, score: 100,
          title: "Server header is not exposed",
          whatWasChecked: "We checked the HTTP response for a Server header.",
          actualResult: "No Server header was found.",
          whyItMatters: "Hiding server details reduces the information available to attackers.",
          howToFix: "No action needed.",
        })
      );
    }

    // 11. Favicon
    const icon = $("link").toArray().find((el) => (($(el).attr("rel") || "").toLowerCase().split(/\s+/).includes("icon")));
    if (icon && $(icon).attr("href")) {
      checks.push(
        result({
          id: "tech_favicon", category: this.category, status: STATUS_PASS, score: 100,
          title: "Favicon is configured",
          whatWasChecked: "We looked for a favicon link in the page head.",
          actualResult: "A favicon link was found.",
          whyItMatters: "A favicon helps visitors identify your site in browser tabs and bookmarks.",
          howToFix: "No action needed.",
        })
      );
    } else {
      let faviconStatus: number | null = null;
      if (page.statusCode === 200) {
        try {
          const faviconUrl = new URL("/favicon.ico", page.finalUrl).toString();
          faviconStatus = await probeUrl(faviconUrl);
        } catch {
          faviconStatus = null;
        }
      }
      if (faviconStatus !== null && faviconStatus < 400) {
        checks.push(
          result({
            id: "tech_favicon", category: this.category, status: STATUS_PASS, score: 100,
            title: "Favicon found",
            whatWasChecked: "We looked for a favicon link or /favicon.ico.",
            actualResult: "A favicon is available at /favicon.ico.",
            whyItMatters: "A favicon makes your site recognizable in browser tabs.",
            howToFix: "No action needed.",
          })
        );
      } else {
        checks.push(
          result({
            id: "tech_favicon", category: this.category, status: STATUS_WARNING, score: 65,
            title: "Favicon is missing",
            whatWasChecked: "We looked for a favicon link or /favicon.ico.",
            actualResult: "No favicon was detected.",
            whyItMatters: "Without a favicon, browser tabs show a generic icon.",
            howToFix: 'Add a favicon and reference it with <link rel="icon">.',
            weight: 0.6,
          })
        );
      }
    }

    // 12. Language metadata
    const lang = parsed.htmlAttrs["lang"];
    if (lang) {
      checks.push(
        result({
          id: "tech_language", category: this.category, status: STATUS_PASS, score: 100,
          title: "Page language is declared",
          whatWasChecked: "We checked the lang attribute on the <html> tag.",
          actualResult: `The page declares its language as "${lang}".`,
          whyItMatters: "Declaring language helps translation tools and search engines understand your content.",
          howToFix: "No action needed.",
        })
      );
    } else {
      checks.push(
        result({
          id: "tech_language", category: this.category, status: STATUS_WARNING, score: 50,
          title: "Page language is not declared",
          whatWasChecked: "We checked the lang attribute on the <html> tag.",
          actualResult: "No lang attribute was found.",
          whyItMatters: "Missing language metadata can affect translation tools and accessibility.",
          howToFix: 'Add lang="en" (or your language) to the <html> tag.',
        })
      );
    }

    return checks;
  }
}

function decodeStart(page: { content: Buffer }): string {
  const first = page.content.subarray(0, 400).toString("utf-8");
  return first.replace(/^\uFEFF/, "").trimStart();
}
