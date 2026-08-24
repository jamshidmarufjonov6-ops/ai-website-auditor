import type { CrawlContext } from "../crawler/crawler.js";
import type { CheckResult } from "../../types.js";
import { BaseAnalyzer, result, STATUS_FAIL, STATUS_PASS, STATUS_WARNING } from "./base.js";

export class MobileAnalyzer extends BaseAnalyzer {
  category = "mobile";

  analyze(ctx: CrawlContext) {
    const checks: CheckResult[] = [];
    const parsed = ctx.parsedPages[0];
    const page = ctx.pages[0];
    if (!parsed || !page) return checks;
    const $ = parsed.$;

    // 1. Viewport meta tag
    const viewport = parsed.metaTags["viewport"];
    if (viewport && viewport.toLowerCase().includes("width=device-width")) {
      checks.push(
        result({
          id: "mobile_viewport", category: this.category, status: STATUS_PASS, score: 100,
          title: "Mobile viewport is configured",
          whatWasChecked: "We looked for a viewport meta tag with width=device-width.",
          actualResult: `Viewport found: "${viewport}".`,
          whyItMatters: "A correct viewport lets phones render the page at the right width without zooming out.",
          howToFix: "No action needed.",
          weight: 1.3,
        })
      );
    } else if (viewport) {
      checks.push(
        result({
          id: "mobile_viewport", category: this.category, status: STATUS_WARNING, score: 60,
          title: "Viewport may not be fully mobile-friendly",
          whatWasChecked: "We looked for a viewport meta tag with width=device-width.",
          actualResult: `The viewport tag is "${viewport}", which may not use the device width.`,
          whyItMatters: "A viewport that ignores device width can make the site hard to read on phones.",
          howToFix: '<meta name="viewport" content="width=device-width, initial-scale=1">',
          weight: 1.3,
        })
      );
    } else {
      checks.push(
        result({
          id: "mobile_viewport", category: this.category, status: STATUS_FAIL, score: 15,
          title: "Viewport meta tag is missing",
          whatWasChecked: "We looked for a viewport meta tag with width=device-width.",
          actualResult: "No viewport meta tag was found.",
          whyItMatters: "Without a viewport tag, phones render the desktop layout and users must pinch to zoom.",
          howToFix: '<meta name="viewport" content="width=device-width, initial-scale=1">',
          weight: 1.3,
        })
      );
    }

    // 2. Responsive indicators
    let responsiveHints = 0;
    $("style").each((_, el) => {
      const text = $(el).text() || "";
      if (text.includes("@media")) responsiveHints += 1;
    });
    for (const link of parsed.stylesheets) {
      const href = (link.href || "").toLowerCase();
      if (["bootstrap", "tailwind", "foundation", "bulma"].some((tok) => href.includes(tok))) {
        responsiveHints += 1;
      }
    }
    if (responsiveHints) {
      checks.push(
        result({
          id: "mobile_responsive", category: this.category, status: STATUS_PASS, score: 100,
          title: "Responsive design indicators found",
          whatWasChecked: "We looked for media queries or known responsive frameworks.",
          actualResult: `Found ${responsiveHints} responsive design signal(s).`,
          whyItMatters: "Responsive design lets the layout adapt to phones and tablets.",
          howToFix: "No action needed.",
        })
      );
    } else {
      checks.push(
        result({
          id: "mobile_responsive", category: this.category, status: STATUS_WARNING, score: 55,
          title: "Limited responsive design signals",
          whatWasChecked: "We looked for media queries or known responsive frameworks.",
          actualResult: "No media queries or responsive framework were detected.",
          whyItMatters: "The layout may not adapt to phone screens.",
          howToFix: "Use CSS media queries (or a responsive framework) to adapt the layout to small screens.",
        })
      );
    }

    // 3. Horizontal overflow indicators
    let overflowRisks = 0;
    $("[style]").each((_, el) => {
      const style = ($(el).attr("style") || "").toLowerCase();
      if (style.includes("width:") && [700, 800, 900, 1000, 1200].some((n) => style.includes(`${n}px`))) {
        overflowRisks += 1;
      }
    });
    $("table").each((_, el) => {
      const width = $(el).attr("width");
      if (width && /^\d+$/.test(width) && parseInt(width, 10) > 600) overflowRisks += 1;
    });
    if (overflowRisks === 0) {
      checks.push(
        result({
          id: "mobile_overflow", category: this.category, status: STATUS_PASS, score: 100,
          title: "No obvious horizontal overflow",
          whatWasChecked: "We looked for fixed-width elements and wide tables that could overflow on phones.",
          actualResult: "No fixed-width elements likely to cause horizontal scrolling were found.",
          whyItMatters: "Horizontal scrolling makes mobile pages hard to use.",
          howToFix: "No action needed.",
        })
      );
    } else {
      checks.push(
        result({
          id: "mobile_overflow", category: this.category, status: STATUS_WARNING, score: 50,
          title: "Possible horizontal overflow",
          whatWasChecked: "We looked for fixed-width elements and wide tables that could overflow on phones.",
          actualResult: `Found ${overflowRisks} element(s) with fixed widths that may overflow on small screens.`,
          whyItMatters: "Horizontal scrolling makes mobile pages frustrating to read.",
          howToFix: "Replace fixed pixel widths with max-width and fluid layouts.",
        })
      );
    }

    // 4. Mobile-friendly HTML patterns
    let goodPatterns = 0;
    $("input").each((_, el) => {
      const type = ($(el).attr("type") || "").toLowerCase();
      if (["tel", "email", "search", "number", "date"].includes(type)) goodPatterns += 1;
    });
    $("a[href]").each((_, el) => {
      if (($(el).attr("href") || "").startsWith("tel:")) goodPatterns += 1;
    });
    if (goodPatterns) {
      checks.push(
        result({
          id: "mobile_patterns", category: this.category, status: STATUS_PASS, score: 100,
          title: "Mobile-friendly input patterns found",
          whatWasChecked: "We looked for mobile-friendly input types and tap-to-call links.",
          actualResult: `Found ${goodPatterns} mobile-friendly pattern(s).`,
          whyItMatters: "Mobile-friendly inputs show the right keyboard and make forms easier on phones.",
          howToFix: "No action needed.",
          weight: 0.6,
        })
      );
    } else {
      checks.push(
        result({
          id: "mobile_patterns", category: this.category, status: STATUS_PASS, score: 80,
          title: "No special mobile patterns detected",
          whatWasChecked: "We looked for mobile-friendly input types and tap-to-call links.",
          actualResult: "No special mobile patterns were found.",
          whyItMatters: "This is fine for many sites; forms just may not show the most convenient mobile keyboard.",
          howToFix: "For forms, consider input types like tel and email for better mobile keyboards.",
          weight: 0.5,
        })
      );
    }

    // 5. Image sizing indicators
    const images = ctx.parsedPages.flatMap((p) => p.images);
    if (images.length) {
      const withSize = images.filter((i) => i.width || i.srcset);
      const ratio = withSize.length / images.length;
      if (ratio >= 0.8) {
        checks.push(
          result({
            id: "mobile_images", category: this.category, status: STATUS_PASS, score: 100,
            title: "Images have size hints",
            whatWasChecked: "We checked whether images declare dimensions or srcset.",
            actualResult: `${withSize.length} of ${images.length} images declare dimensions or srcset.`,
            whyItMatters: "Size hints prevent layout shift and help phones load appropriate image sizes.",
            howToFix: "No action needed.",
          })
        );
      } else if (ratio >= 0.4) {
        checks.push(
          result({
            id: "mobile_images", category: this.category, status: STATUS_WARNING, score: 60,
            title: "Some images lack size hints",
            whatWasChecked: "We checked whether images declare dimensions or srcset.",
            actualResult: `${images.length - withSize.length} of ${images.length} images lack width/height or srcset.`,
            whyItMatters: "Images without size hints can cause layout shift on mobile.",
            howToFix: "Add width/height attributes or srcset to images.",
          })
        );
      } else {
        checks.push(
          result({
            id: "mobile_images", category: this.category, status: STATUS_WARNING, score: 40,
            title: "Most images lack size hints",
            whatWasChecked: "We checked whether images declare dimensions or srcset.",
            actualResult: `Only ${withSize.length} of ${images.length} images declare dimensions.`,
            whyItMatters: "Most images lack size hints, which can cause noticeable layout shift on mobile.",
            howToFix: "Add width/height attributes or responsive srcset to images.",
          })
        );
      }
    } else {
      checks.push(
        result({
          id: "mobile_images", category: this.category, status: STATUS_PASS, score: 100,
          title: "No images to check",
          whatWasChecked: "We looked for images on the crawled pages.",
          actualResult: "The page contains no images.",
          whyItMatters: "There are no mobile image sizing issues to flag.",
          howToFix: "No action needed.",
          weight: 0.4,
        })
      );
    }

    // 6. Tap target size (basic heuristic)
    let smallLinks = 0;
    $("a[href][style]").each((_, el) => {
      const style = ($(el).attr("style") || "").toLowerCase();
      if (style.includes("font-size")) {
        for (let n = 5; n < 12; n++) {
          if (style.includes(`${n}px`)) {
            smallLinks += 1;
            break;
          }
        }
      }
    });
    if (smallLinks === 0) {
      checks.push(
        result({
          id: "mobile_tap_targets", category: this.category, status: STATUS_PASS, score: 100,
          title: "No tiny tap targets detected",
          whatWasChecked: "We looked for links with very small inline font sizes that could be hard to tap.",
          actualResult: "No tiny tap targets were detected.",
          whyItMatters: "Small tap targets are frustrating on touch screens.",
          howToFix: "No action needed.",
          weight: 0.5,
        })
      );
    } else {
      checks.push(
        result({
          id: "mobile_tap_targets", category: this.category, status: STATUS_WARNING, score: 55,
          title: "Some tap targets may be too small",
          whatWasChecked: "We looked for links with very small inline font sizes that could be hard to tap.",
          actualResult: `Found ${smallLinks} link(s) with very small inline font sizes.`,
          whyItMatters: "Tiny tap targets are hard to hit accurately on phones.",
          howToFix: "Make tap targets at least 44x44 px with adequate spacing.",
          weight: 0.5,
        })
      );
    }

    return checks;
  }
}
