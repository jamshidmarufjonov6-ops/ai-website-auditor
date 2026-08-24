import type { CrawlContext } from "../crawler/crawler.js";
import type { CheckResult } from "../../types.js";
import { BaseAnalyzer, result, STATUS_FAIL, STATUS_PASS, STATUS_WARNING } from "./base.js";

export class AccessibilityAnalyzer extends BaseAnalyzer {
  category = "accessibility";

  analyze(ctx: CrawlContext) {
    const checks: CheckResult[] = [];
    const parsed = ctx.parsedPages[0];
    if (!parsed) return checks;

    // 1. Images missing alt text
    const images = ctx.parsedPages.flatMap((p) => p.images);
    if (images.length) {
      const missing = images.filter((i) => !i.alt);
      const ratio = missing.length / images.length;
      if (ratio === 0) {
        checks.push(
          result({
            id: "a11y_image_alt", category: this.category, status: STATUS_PASS, score: 100,
            title: "All images have alt text",
            whatWasChecked: "We checked every crawled image for an alt attribute.",
            actualResult: `All ${images.length} images include alt text.`,
            whyItMatters: "Alt text lets screen reader users understand images they cannot see.",
            howToFix: "Keep alt text descriptive for meaningful images.",
            weight: 1.2,
          })
        );
      } else if (ratio <= 0.2) {
        checks.push(
          result({
            id: "a11y_image_alt", category: this.category, status: STATUS_WARNING, score: 65,
            title: "Some images missing alt text",
            whatWasChecked: "We checked every crawled image for an alt attribute.",
            actualResult: `${missing.length} of ${images.length} images lack alt text.`,
            whyItMatters: "Screen reader users will not know what missing-alt images show.",
            howToFix: `Add alt text to images such as: ${(missing[0].src || "image").slice(0, 80)}`,
            weight: 1.2,
          })
        );
      } else {
        checks.push(
          result({
            id: "a11y_image_alt", category: this.category, status: STATUS_FAIL, score: 25,
            title: "Many images missing alt text",
            whatWasChecked: "We checked every crawled image for an alt attribute.",
            actualResult: `${missing.length} of ${images.length} images lack alt text.`,
            whyItMatters: "This makes the page much harder to use with a screen reader.",
            howToFix: "Add meaningful alt text to all images (empty alt is fine for decorative ones).",
            weight: 1.2,
          })
        );
      }
    } else {
      checks.push(
        result({
          id: "a11y_image_alt", category: this.category, status: STATUS_PASS, score: 100,
          title: "No images to check",
          whatWasChecked: "We looked for images on the crawled pages.",
          actualResult: "The page has no images.",
          whyItMatters: "There are no image accessibility issues to flag.",
          howToFix: "No action needed.",
          weight: 0.4,
        })
      );
    }

    // 2. Page language
    const lang = parsed.htmlAttrs["lang"];
    if (lang) {
      checks.push(
        result({
          id: "a11y_language", category: this.category, status: STATUS_PASS, score: 100,
          title: "Page language is declared",
          whatWasChecked: "We checked the lang attribute on the <html> tag.",
          actualResult: `The page declares lang="${lang}".`,
          whyItMatters: "Screen readers and translation tools use the language to pronounce and process content correctly.",
          howToFix: "No action needed.",
        })
      );
    } else {
      checks.push(
        result({
          id: "a11y_language", category: this.category, status: STATUS_FAIL, score: 20,
          title: "Page language is missing",
          whatWasChecked: "We checked the lang attribute on the <html> tag.",
          actualResult: "No lang attribute was found.",
          whyItMatters: "Assistive technology may mispronounce or mishandle content without a declared language.",
          howToFix: 'Add lang="en" (or the appropriate language code) to the <html> tag.',
          weight: 1.1,
        })
      );
    }

    // 3. Form inputs without labels
    const unlabelled = [];
    for (const form of parsed.forms) {
      for (const control of form.controls) {
        if (!control.hasLabel && !control.ariaLabel && !control.ariaLabelledby) unlabelled.push(control);
      }
    }
    if (unlabelled.length) {
      checks.push(
        result({
          id: "a11y_form_labels", category: this.category, status: STATUS_FAIL, score: 25,
          title: "Form fields missing labels",
          whatWasChecked: "We checked every form control for an associated label or ARIA label.",
          actualResult: `Found ${unlabelled.length} form field(s) without a label.`,
          whyItMatters: "Screen reader users cannot tell what an unlabelled form field is for.",
          howToFix: 'Associate every input with a <label for="..."> or add aria-label.',
          weight: 1.1,
        })
      );
    } else {
      checks.push(
        result({
          id: "a11y_form_labels", category: this.category, status: STATUS_PASS, score: 100,
          title: "Form fields are labelled",
          whatWasChecked: "We checked every form control for an associated label or ARIA label.",
          actualResult: "All form controls are labelled or use ARIA labels.",
          whyItMatters: "Labelled form fields are usable by everyone, including screen reader users.",
          howToFix: "No action needed.",
        })
      );
    }

    // 4. Heading structure
    const h1Count = parsed.h1s.length;
    if (h1Count === 0) {
      checks.push(
        result({
          id: "a11y_headings", category: this.category, status: STATUS_WARNING, score: 45,
          title: "No main heading",
          whatWasChecked: "We counted the H1 headings on the page.",
          actualResult: "No H1 heading was found.",
          whyItMatters: "Without a main heading, screen reader users cannot quickly understand the page topic.",
          howToFix: "Add one descriptive H1 to the page.",
        })
      );
    } else if (h1Count === 1) {
      checks.push(
        result({
          id: "a11y_headings", category: this.category, status: STATUS_PASS, score: 100,
          title: "Clear heading structure",
          whatWasChecked: "We counted the H1 headings on the page.",
          actualResult: "The page has a single H1 heading.",
          whyItMatters: "A single H1 gives screen reader users a clear starting point.",
          howToFix: "No action needed.",
        })
      );
    } else {
      checks.push(
        result({
          id: "a11y_headings", category: this.category, status: STATUS_WARNING, score: 55,
          title: "Multiple H1 headings",
          whatWasChecked: "We counted the H1 headings on the page.",
          actualResult: `The page has ${h1Count} H1 headings.`,
          whyItMatters: "Multiple H1s can disorient screen reader navigation.",
          howToFix: "Use one H1 and demote the others.",
        })
      );
    }

    // 5. Buttons without accessible names
    const unnamedButtons = parsed.buttons.filter(
      (b) => !(b.text || "").trim() && !b.ariaLabel
    );
    if (unnamedButtons.length) {
      checks.push(
        result({
          id: "a11y_buttons", category: this.category, status: STATUS_WARNING, score: 50,
          title: "Buttons missing accessible names",
          whatWasChecked: "We checked every <button> for visible text or an aria-label.",
          actualResult: `Found ${unnamedButtons.length} button(s) without an accessible name.`,
          whyItMatters: "Screen reader users cannot tell what an unnamed button does.",
          howToFix: "Add text inside the button or an aria-label attribute.",
        })
      );
    } else {
      checks.push(
        result({
          id: "a11y_buttons", category: this.category, status: STATUS_PASS, score: 100,
          title: "Buttons have accessible names",
          whatWasChecked: "We checked every <button> for visible text or an aria-label.",
          actualResult: "All buttons have accessible names.",
          whyItMatters: "Named buttons are usable by screen reader users.",
          howToFix: "No action needed.",
        })
      );
    }

    // 6. Links without meaningful text
    const badLinks = parsed.links.filter(
      (l) =>
        !(l.text || "").trim() &&
        !l.hasAriaLabel &&
        !(l.href || "").startsWith("mailto:") &&
        !(l.href || "").startsWith("tel:")
    );
    if (badLinks.length) {
      checks.push(
        result({
          id: "a11y_links", category: this.category, status: STATUS_WARNING, score: 50,
          title: "Links without meaningful text",
          whatWasChecked: "We checked links for readable text or aria-labels.",
          actualResult: `Found ${badLinks.length} link(s) without meaningful text.`,
          whyItMatters: "Screen reader users may not know where a textless link goes.",
          howToFix: "Add descriptive link text or aria-label to each link.",
          weight: 1.1,
        })
      );
    } else {
      checks.push(
        result({
          id: "a11y_links", category: this.category, status: STATUS_PASS, score: 100,
          title: "Links have meaningful text",
          whatWasChecked: "We checked links for readable text or aria-labels.",
          actualResult: "All checked links include readable text.",
          whyItMatters: "Meaningful link text helps everyone navigate the page.",
          howToFix: "No action needed.",
        })
      );
    }

    // 7. Viewport configuration
    const viewport = parsed.metaTags["viewport"];
    if (viewport) {
      checks.push(
        result({
          id: "a11y_viewport", category: this.category, status: STATUS_PASS, score: 100,
          title: "Viewport is configured",
          whatWasChecked: "We looked for a viewport meta tag.",
          actualResult: `Viewport meta tag found: "${viewport}".`,
          whyItMatters: "A proper viewport lets users zoom and read content comfortably on mobile.",
          howToFix: "No action needed.",
          weight: 0.8,
        })
      );
    } else {
      checks.push(
        result({
          id: "a11y_viewport", category: this.category, status: STATUS_WARNING, score: 40,
          title: "Viewport meta tag missing",
          whatWasChecked: "We looked for a viewport meta tag.",
          actualResult: "No viewport meta tag was found.",
          whyItMatters: "Without a viewport tag, mobile devices render the page at desktop width, requiring zoom and pan.",
          howToFix: '<meta name="viewport" content="width=device-width, initial-scale=1">',
          weight: 0.8,
        })
      );
    }

    // 8. Basic semantic HTML
    const semantic = {
      header: parsed.$("header").length > 0,
      nav: parsed.$("nav").length > 0,
      main: parsed.$("main").length > 0,
      footer: parsed.$("footer").length > 0,
    };
    const present = Object.entries(semantic).filter(([, v]) => v).map(([k]) => k);
    if (present.length >= 3) {
      checks.push(
        result({
          id: "a11y_semantic", category: this.category, status: STATUS_PASS, score: 100,
          title: "Semantic landmarks are used",
          whatWasChecked: "We looked for <header>, <nav>, <main> and <footer> landmarks.",
          actualResult: `Found ${present.length} semantic landmark(s): ${present.join(", ")}.`,
          whyItMatters: "Semantic landmarks let screen reader users jump directly to important regions.",
          howToFix: "No action needed.",
        })
      );
    } else if (present.length) {
      checks.push(
        result({
          id: "a11y_semantic", category: this.category, status: STATUS_WARNING, score: 55,
          title: "Some semantic landmarks missing",
          whatWasChecked: "We looked for <header>, <nav>, <main> and <footer> landmarks.",
          actualResult: `Only found: ${present.join(", ")}.`,
          whyItMatters: "Screen reader users benefit from landmarks to navigate the page.",
          howToFix: "Wrap key regions in semantic landmark elements.",
        })
      );
    } else {
      checks.push(
        result({
          id: "a11y_semantic", category: this.category, status: STATUS_WARNING, score: 40,
          title: "Semantic landmarks missing",
          whatWasChecked: "We looked for <header>, <nav>, <main> and <footer> landmarks.",
          actualResult: "No semantic landmarks were found.",
          whyItMatters: "Without landmarks, screen reader navigation is more difficult.",
          howToFix: "Use semantic elements (<header>, <nav>, <main>, <footer>) to structure the page.",
        })
      );
    }

    return checks;
  }
}
