import type { CrawlContext } from "../crawler/crawler.js";
import type { CheckResult } from "../../types.js";
import { BaseAnalyzer, result, STATUS_FAIL, STATUS_PASS, STATUS_WARNING } from "./base.js";

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const META_MIN = 70;
const META_MAX = 160;

export class SEOAnalyzer extends BaseAnalyzer {
  category = "seo";

  analyze(ctx: CrawlContext) {
    const checks: CheckResult[] = [];
    const page = ctx.parsedPages[0];
    if (!page) return checks;

    // 1. Title tag exists
    if (page.title) {
      checks.push(
        result({
          id: "seo_title_exists", category: this.category, status: STATUS_PASS, score: 100,
          title: "Page title is present",
          whatWasChecked: "We looked for a <title> tag in the page's HTML head.",
          actualResult: `Found a title: "${page.title.slice(0, 80)}".`,
          whyItMatters: "Search engines display this title as the main headline in results, and browser tabs use it too.",
          howToFix: "Keep the title tag in place and make sure each page has a unique one.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_title_exists", category: this.category, status: STATUS_FAIL, score: 0,
          title: "Page title is missing",
          whatWasChecked: "We looked for a <title> tag in the page's HTML head.",
          actualResult: "No <title> tag was found on the page.",
          whyItMatters: "Without a title, search engines cannot show a meaningful headline for your page in results.",
          howToFix: "Add a <title> tag in the <head> of the page, e.g. <title>Your business name — what you do</title>.",
          weight: 1.5,
        })
      );
    }

    // 2. Title length
    if (page.title) {
      const length = page.title.length;
      if (length >= TITLE_MIN && length <= TITLE_MAX) {
        checks.push(
          result({
            id: "seo_title_length", category: this.category, status: STATUS_PASS, score: 100,
            title: "Page title has a good length",
            whatWasChecked: "We measured the number of characters in the title tag.",
            actualResult: `Your title is ${length} characters, within the recommended 30–60 range.`,
            whyItMatters: "Titles in the recommended range display fully in search results and stay descriptive.",
            howToFix: "Keep titles between 30 and 60 characters.",
          })
        );
      } else if (length < TITLE_MIN) {
        checks.push(
          result({
            id: "seo_title_length", category: this.category, status: STATUS_WARNING, score: 60,
            title: "Page title is quite short",
            whatWasChecked: "We measured the number of characters in the title tag.",
            actualResult: `Your title is ${length} characters; the recommended range is 30–60.`,
            whyItMatters: "Short titles waste space and often under-describe the page in search results.",
            howToFix: "Expand the title to 30–60 characters while keeping it descriptive.",
          })
        );
      } else {
        checks.push(
          result({
            id: "seo_title_length", category: this.category, status: STATUS_WARNING, score: 60,
            title: "Page title is too long",
            whatWasChecked: "We measured the number of characters in the title tag.",
            actualResult: `Your title is ${length} characters; the recommended range is 30–60.`,
            whyItMatters: "Search engines typically truncate long titles, so important words can be cut off.",
            howToFix: "Shorten the title to 60 characters or fewer, front-loading the most important words.",
          })
        );
      }
    }

    // 3. Meta description exists
    if (page.metaDescription) {
      checks.push(
        result({
          id: "seo_meta_description_exists", category: this.category, status: STATUS_PASS, score: 100,
          title: "Meta description is present",
          whatWasChecked: "We looked for a meta description tag in the page head.",
          actualResult: "A meta description was found.",
          whyItMatters: "Search engines can use it as the summary snippet under your result, which influences clicks.",
          howToFix: "Keep the meta description unique per page and compelling for humans.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_meta_description_exists", category: this.category, status: STATUS_WARNING, score: 30,
          title: "Meta description is missing",
          whatWasChecked: "We looked for a meta description tag in the page head.",
          actualResult: "No meta description was found.",
          whyItMatters: "Without a description, search engines improvise the snippet shown in results, which can reduce clicks.",
          howToFix: 'Add <meta name="description" content="..."> with a clear 1–2 sentence summary.',
          weight: 1.2,
        })
      );
    }

    // 4. Meta description length
    if (page.metaDescription) {
      const length = page.metaDescription.length;
      if (length >= META_MIN && length <= META_MAX) {
        checks.push(
          result({
            id: "seo_meta_description_length", category: this.category, status: STATUS_PASS, score: 100,
            title: "Meta description has a good length",
            whatWasChecked: "We measured the number of characters in the meta description.",
            actualResult: `Your description is ${length} characters, within the recommended 70–160 range.`,
            whyItMatters: "Descriptions in the recommended range display well in search results.",
            howToFix: "Keep descriptions between 70 and 160 characters.",
          })
        );
      } else if (length < META_MIN) {
        checks.push(
          result({
            id: "seo_meta_description_length", category: this.category, status: STATUS_WARNING, score: 60,
            title: "Meta description is quite short",
            whatWasChecked: "We measured the number of characters in the meta description.",
            actualResult: `Your description is ${length} characters; the recommended range is 70–160.`,
            whyItMatters: "A little more detail usually earns more clicks from search results.",
            howToFix: "Expand the description to 70–160 characters.",
          })
        );
      } else {
        checks.push(
          result({
            id: "seo_meta_description_length", category: this.category, status: STATUS_WARNING, score: 60,
            title: "Meta description is too long",
            whatWasChecked: "We measured the number of characters in the meta description.",
            actualResult: `Your description is ${length} characters; the recommended range is 70–160.`,
            whyItMatters: "Search engines may cut off long descriptions, hiding your best message.",
            howToFix: "Shorten the description to 160 characters or fewer.",
          })
        );
      }
    }

    // 5. H1 exists
    if (page.h1s.length) {
      checks.push(
        result({
          id: "seo_h1_exists", category: this.category, status: STATUS_PASS, score: 100,
          title: "Main heading (H1) is present",
          whatWasChecked: "We looked for an H1 heading in the page content.",
          actualResult: `Found an H1: "${page.h1s[0].slice(0, 80)}".`,
          whyItMatters: "An H1 helps both users and search engines understand the page's primary topic.",
          howToFix: "Keep one descriptive H1 per page.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_h1_exists", category: this.category, status: STATUS_FAIL, score: 15,
          title: "Main heading (H1) is missing",
          whatWasChecked: "We looked for an H1 heading in the page content.",
          actualResult: "No H1 heading was found.",
          whyItMatters: "Without an H1, the page's main topic is less obvious to visitors and search engines.",
          howToFix: "Add a single <h1> that summarises the page.",
          weight: 1.3,
        })
      );
    }

    // 6. H1 count
    if (page.h1s.length > 1) {
      checks.push(
        result({
          id: "seo_h1_count", category: this.category, status: STATUS_WARNING, score: 55,
          title: "More than one H1 heading",
          whatWasChecked: "We counted the H1 headings on the page.",
          actualResult: `Found ${page.h1s.length} H1 headings.`,
          whyItMatters: "Multiple H1s can dilute the page's focus for search engines and confuse screen reader users.",
          howToFix: "Use a single H1 per page; convert the others to H2 or H3.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_h1_count", category: this.category, status: STATUS_PASS, score: 100,
          title: "Single H1 heading",
          whatWasChecked: "We counted the H1 headings on the page.",
          actualResult: "Found exactly one H1 heading.",
          whyItMatters: "A single H1 keeps the page focused and easy to navigate.",
          howToFix: "Keep exactly one H1 per page.",
        })
      );
    }

    // 7. Heading structure
    let structureOk = true;
    const headings: number[] = [];
    for (let level = 1; level <= 6; level++) {
      const list = page[`h${level}s` as keyof typeof page] as string[];
      for (let i = 0; i < list.length; i++) headings.push(level);
    }
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] > headings[i - 1] + 1) {
        structureOk = false;
        break;
      }
    }
    if (structureOk) {
      checks.push(
        result({
          id: "seo_heading_structure", category: this.category, status: STATUS_PASS, score: 100,
          title: "Heading structure is logical",
          whatWasChecked: "We checked the order of H1–H6 headings on the page.",
          actualResult: "Headings progress in a sensible order without skipping levels.",
          whyItMatters: "Logical heading order helps readers and search engines understand the page structure.",
          howToFix: "Maintain a logical H1 → H2 → H3 hierarchy.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_heading_structure", category: this.category, status: STATUS_WARNING, score: 55,
          title: "Heading levels are skipped",
          whatWasChecked: "We checked the order of H1–H6 headings on the page.",
          actualResult: "Some heading levels skip a step (for example H2 jumping to H4).",
          whyItMatters: "Skipped heading levels can confuse screen readers and make the page structure harder to scan.",
          howToFix: "Adjust headings so levels never skip more than one step.",
        })
      );
    }

    // 8. Canonical
    if (page.canonical) {
      checks.push(
        result({
          id: "seo_canonical", category: this.category, status: STATUS_PASS, score: 100,
          title: "Canonical URL is set",
          whatWasChecked: "We looked for a canonical link tag in the page head.",
          actualResult: `Canonical URL found: ${page.canonical.slice(0, 80)}.`,
          whyItMatters: "A canonical tag tells search engines which URL is the preferred version, avoiding duplicate-content confusion.",
          howToFix: "Keep canonical tags pointing to the intended version of each page.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_canonical", category: this.category, status: STATUS_WARNING, score: 45,
          title: "Canonical URL is missing",
          whatWasChecked: "We looked for a canonical link tag in the page head.",
          actualResult: "No canonical URL was found.",
          whyItMatters: "Without a canonical tag, duplicate versions of the page can compete in search results.",
          howToFix: 'Add <link rel="canonical" href="..."> pointing to the preferred URL.',
        })
      );
    }

    // 9. Robots meta
    if (page.robotsMeta && page.robotsMeta.toLowerCase().includes("noindex")) {
      checks.push(
        result({
          id: "seo_robots_meta", category: this.category, status: STATUS_FAIL, score: 25,
          title: "Page asks search engines not to index it",
          whatWasChecked: "We checked the robots meta tag in the page head.",
          actualResult: `The robots meta tag contains "${page.robotsMeta}".`,
          whyItMatters: "Search engines may exclude this page from results, hiding it from people searching for you.",
          howToFix: "Remove the noindex directive unless hiding the page is intentional.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_robots_meta", category: this.category, status: STATUS_PASS, score: 100,
          title: "Page allows indexing",
          whatWasChecked: "We checked the robots meta tag in the page head.",
          actualResult: "No noindex directive was found.",
          whyItMatters: "Search engines are allowed to include this page in their results.",
          howToFix: "Keep the page indexable unless it is intentionally private.",
        })
      );
    }

    // 10. robots.txt
    if (ctx.robots.available) {
      if (ctx.robots.disallowAll) {
        checks.push(
          result({
            id: "seo_robots_txt", category: this.category, status: STATUS_FAIL, score: 20,
            title: "robots.txt blocks all crawlers",
            whatWasChecked: "We fetched and reviewed the robots.txt file at the site root.",
            actualResult: "robots.txt contains a blanket Disallow: / rule.",
            whyItMatters: "Search engines may be prevented from indexing your entire site.",
            howToFix: "Review robots.txt and remove the blanket disallow unless it is intentional.",
          })
        );
      } else {
        checks.push(
          result({
            id: "seo_robots_txt", category: this.category, status: STATUS_PASS, score: 100,
            title: "robots.txt is present",
            whatWasChecked: "We fetched the robots.txt file at the site root.",
            actualResult: "robots.txt is available and does not block all crawlers.",
            whyItMatters: "A maintained robots.txt helps search engines crawl your site efficiently.",
            howToFix: "Keep robots.txt maintained and make sure it does not block important pages.",
          })
        );
      }
    } else {
      checks.push(
        result({
          id: "seo_robots_txt", category: this.category, status: STATUS_WARNING, score: 60,
          title: "robots.txt is missing",
          whatWasChecked: "We looked for a robots.txt file at the site root.",
          actualResult: "No robots.txt file was found.",
          whyItMatters: "Many sites publish robots.txt to guide crawlers; without it, crawlers use default behavior.",
          howToFix: "Add a robots.txt at the site root, e.g. https://yourdomain/robots.txt.",
        })
      );
    }

    // 11. Sitemap
    if (ctx.sitemap.available) {
      checks.push(
        result({
          id: "seo_sitemap", category: this.category, status: STATUS_PASS, score: 100,
          title: "Sitemap is available",
          whatWasChecked: "We checked for an XML sitemap (from robots.txt or /sitemap.xml).",
          actualResult: `Sitemap found at ${ctx.sitemap.url}.`,
          whyItMatters: "A sitemap helps search engines discover pages, especially new or rarely linked content.",
          howToFix: "Keep the sitemap up to date as pages change.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_sitemap", category: this.category, status: STATUS_WARNING, score: 50,
          title: "Sitemap is missing",
          whatWasChecked: "We checked for an XML sitemap (from robots.txt or /sitemap.xml).",
          actualResult: "No sitemap.xml was found.",
          whyItMatters: "Without a sitemap, search engines may take longer to discover all your pages.",
          howToFix: "Generate and upload a sitemap (many CMS plugins do this automatically).",
        })
      );
    }

    // 12. Image alt attributes (across crawled pages)
    const allImages = ctx.parsedPages.flatMap((p) => p.images);
    if (allImages.length) {
      const missing = allImages.filter((i) => !i.alt);
      const ratio = missing.length / allImages.length;
      if (ratio === 0) {
        checks.push(
          result({
            id: "seo_image_alt", category: this.category, status: STATUS_PASS, score: 100,
            title: "All images have alt text",
            whatWasChecked: "We checked every crawled image for an alt attribute.",
            actualResult: `All ${allImages.length} crawled images include alt text.`,
            whyItMatters: "Alt text helps search engines understand images and improves image search visibility.",
            howToFix: "Keep writing descriptive alt text for new images.",
          })
        );
      } else if (ratio <= 0.2) {
        checks.push(
          result({
            id: "seo_image_alt", category: this.category, status: STATUS_WARNING, score: 65,
            title: "Some images are missing alt text",
            whatWasChecked: "We checked every crawled image for an alt attribute.",
            actualResult: `${missing.length} of ${allImages.length} images lack alt text.`,
            whyItMatters: "Missing alt text hurts image search and makes images less accessible.",
            howToFix: `Add alt text to these images: ${missing.slice(0, 3).map((m) => (m.src || "unknown").slice(0, 80)).join(", ")}`,
          })
        );
      } else {
        checks.push(
          result({
            id: "seo_image_alt", category: this.category, status: STATUS_FAIL, score: 25,
            title: "Many images are missing alt text",
            whatWasChecked: "We checked every crawled image for an alt attribute.",
            actualResult: `${missing.length} of ${allImages.length} images lack alt text.`,
            whyItMatters: "This significantly limits image search and accessibility for screen reader users.",
            howToFix: "Add descriptive alt text to every meaningful image.",
            weight: 1.2,
          })
        );
      }
    } else {
      checks.push(
        result({
          id: "seo_image_alt", category: this.category, status: STATUS_PASS, score: 100,
          title: "No images to check",
          whatWasChecked: "We looked for images on the crawled pages.",
          actualResult: "No images were found.",
          whyItMatters: "There is nothing to flag for image search optimization.",
          howToFix: "No action needed.",
          weight: 0.5,
        })
      );
    }

    // 13. Broken internal links
    if (ctx.brokenLinks.length) {
      checks.push(
        result({
          id: "seo_broken_links", category: this.category, status: STATUS_WARNING, score: 40,
          title: "Some internal links are broken",
          whatWasChecked: "We checked internal links found on the crawled pages.",
          actualResult: `Found ${ctx.brokenLinks.length} internal link(s) returning an error status.`,
          whyItMatters: "Broken links frustrate visitors and waste crawl budget for search engines.",
          howToFix: `Fix or remove broken links, e.g. ${ctx.brokenLinks[0].url} (HTTP ${ctx.brokenLinks[0].status_code}).`,
          details: { broken: ctx.brokenLinks },
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_broken_links", category: this.category, status: STATUS_PASS, score: 100,
          title: "No broken internal links found",
          whatWasChecked: "We checked internal links found on the crawled pages.",
          actualResult: "All checked internal links responded successfully.",
          whyItMatters: "Healthy internal links keep visitors moving through your site.",
          howToFix: "Continue monitoring links as the site grows.",
          weight: 0.8,
        })
      );
    }

    // 14. Open Graph
    const ogKeys = Object.keys(page.metaTags).filter((k) => k.startsWith("og:"));
    if (ogKeys.length >= 3) {
      checks.push(
        result({
          id: "seo_open_graph", category: this.category, status: STATUS_PASS, score: 100,
          title: "Open Graph tags are present",
          whatWasChecked: "We looked for Open Graph meta tags (og:title, og:description, og:image, etc.).",
          actualResult: `Found ${ogKeys.length} Open Graph tags.`,
          whyItMatters: "Open Graph tags control how your page looks when shared on social media.",
          howToFix: "Keep Open Graph tags updated with the correct title, description and image.",
        })
      );
    } else if (ogKeys.length) {
      checks.push(
        result({
          id: "seo_open_graph", category: this.category, status: STATUS_WARNING, score: 60,
          title: "Open Graph tags are incomplete",
          whatWasChecked: "We looked for Open Graph meta tags (og:title, og:description, og:image, etc.).",
          actualResult: `Found only ${ogKeys.length} Open Graph tag(s).`,
          whyItMatters: "Incomplete Open Graph tags may cause plain or missing previews when your page is shared.",
          howToFix: "Add og:title, og:description and og:image to the page head.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_open_graph", category: this.category, status: STATUS_WARNING, score: 45,
          title: "Open Graph tags are missing",
          whatWasChecked: "We looked for Open Graph meta tags (og:title, og:description, og:image, etc.).",
          actualResult: "No Open Graph tags were found.",
          whyItMatters: "Without Open Graph tags, links shared on social media may show no image or summary.",
          howToFix: "Add og:title, og:description, og:image and og:url meta tags.",
        })
      );
    }

    // 15. Structured data
    let sd = 0;
    for (const p of ctx.parsedPages) {
      sd += p.$("script[type]").toArray().filter((el) => (p.$(el).attr("type") || "").toLowerCase().includes("ld+json")).length;
      sd += p.$("[itemtype]").length;
    }
    if (sd) {
      checks.push(
        result({
          id: "seo_structured_data", category: this.category, status: STATUS_PASS, score: 100,
          title: "Structured data found",
          whatWasChecked: "We looked for JSON-LD or microdata structured data on the crawled pages.",
          actualResult: `Found ${sd} structured data block(s).`,
          whyItMatters: "Structured data can enable rich results (e.g. star ratings, product info) in search.",
          howToFix: "Validate structured data with a testing tool and keep it accurate.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_structured_data", category: this.category, status: STATUS_WARNING, score: 50,
          title: "No structured data detected",
          whatWasChecked: "We looked for JSON-LD or microdata structured data on the crawled pages.",
          actualResult: "No structured data was detected.",
          whyItMatters: "Structured data helps search engines understand your business, products or articles.",
          howToFix: "Add JSON-LD structured data (e.g. Organization or Product schema).",
        })
      );
    }

    // 16. URL structure
    let path = "";
    try {
      path = new URL(ctx.pages[0]?.finalUrl || ctx.startUrl).pathname;
    } catch {
      path = "/";
    }
    const bad =
      path.length > 100 ||
      path.split("/").length - 1 > 6 ||
      ["?p=", "index.php", "/tag/"].some((tok) => path.toLowerCase().includes(tok));
    if (!bad && ctx.pages[0]?.finalUrl.startsWith("https")) {
      checks.push(
        result({
          id: "seo_url_structure", category: this.category, status: STATUS_PASS, score: 100,
          title: "URL structure looks clean",
          whatWasChecked: "We reviewed the page URL length, path depth and HTTPS usage.",
          actualResult: `The page URL is concise and served over HTTPS: ${path}`,
          whyItMatters: "Clean, short URLs are easier for people to read and for search engines to understand.",
          howToFix: "Keep URLs short, readable and consistent.",
        })
      );
    } else if (!bad) {
      checks.push(
        result({
          id: "seo_url_structure", category: this.category, status: STATUS_WARNING, score: 70,
          title: "Consider HTTPS URLs",
          whatWasChecked: "We reviewed the page URL length, path depth and HTTPS usage.",
          actualResult: "The URL structure is clean but the page is served over HTTP.",
          whyItMatters: "Search engines and browsers prefer HTTPS, and visitors expect a secure connection.",
          howToFix: "Redirect HTTP traffic to HTTPS.",
        })
      );
    } else {
      checks.push(
        result({
          id: "seo_url_structure", category: this.category, status: STATUS_WARNING, score: 55,
          title: "URL structure could be cleaner",
          whatWasChecked: "We reviewed the page URL length, path depth and parameters.",
          actualResult: `The URL path is: ${path}`,
          whyItMatters: "Long or parameter-heavy URLs are less friendly for users and search engines.",
          howToFix: "Use short, descriptive paths without unnecessary parameters.",
        })
      );
    }

    return checks;
  }
}
