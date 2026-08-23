"""Accessibility analyzer — automated checks, not a WCAG certification."""
from __future__ import annotations

from typing import List

from app.services.analyzers.base import STATUS_FAIL, STATUS_PASS, STATUS_WARNING, BaseAnalyzer, result


class AccessibilityAnalyzer(BaseAnalyzer):
    category = "accessibility"

    def analyze(self, ctx) -> List:
        checks: List = []
        parsed = ctx.start_parsed
        if parsed is None:
            return checks

        # 1. Images missing alt text
        images = [img for p in ctx.parsed_pages for img in p.images]
        if images:
            missing = [i for i in images if not i.get("alt")]
            ratio = len(missing) / len(images)
            if ratio == 0:
                checks.append(
                    result(
                        "a11y_image_alt", self.category, STATUS_PASS, 100,
                        "All images have alt text",
                        "We checked every crawled image for an alt attribute.",
                        f"All {len(images)} images include alt text.",
                        "Alt text lets screen reader users understand images they cannot see.",
                        "Keep alt text descriptive for meaningful images.",
                        weight=1.2,
                    )
                )
            elif ratio <= 0.2:
                checks.append(
                    result(
                        "a11y_image_alt", self.category, STATUS_WARNING, 65,
                        "Some images missing alt text",
                        "We checked every crawled image for an alt attribute.",
                        f"{len(missing)} of {len(images)} images lack alt text.",
                        "Screen reader users will not know what missing-alt images show.",
                        f"Add alt text to images such as: {(missing[0].get('src') or 'image')[:80]}",
                        weight=1.2,
                    )
                )
            else:
                checks.append(
                    result(
                        "a11y_image_alt", self.category, STATUS_FAIL, 25,
                        "Many images missing alt text",
                        "We checked every crawled image for an alt attribute.",
                        f"{len(missing)} of {len(images)} images lack alt text.",
                        "This makes the page much harder to use with a screen reader.",
                        "Add meaningful alt text to all images (empty alt is fine for decorative ones).",
                        weight=1.2,
                    )
                )
        else:
            checks.append(
                result(
                    "a11y_image_alt", self.category, STATUS_PASS, 100,
                    "No images to check",
                    "We looked for images on the crawled pages.",
                    "The page has no images.",
                    "There are no image accessibility issues to flag.",
                    "No action needed.",
                    weight=0.4,
                )
            )

        # 2. Page language
        lang = parsed.html_attrs.get("lang")
        if lang:
            checks.append(
                result(
                    "a11y_language", self.category, STATUS_PASS, 100,
                    "Page language is declared",
                    "We checked the lang attribute on the <html> tag.",
                    f"The page declares lang=\"{lang}\".",
                    "Screen readers and translation tools use the language to pronounce and process content correctly.",
                    "No action needed.",
                )
            )
        else:
            checks.append(
                result(
                    "a11y_language", self.category, STATUS_FAIL, 20,
                    "Page language is missing",
                    "We checked the lang attribute on the <html> tag.",
                    "No lang attribute was found.",
                    "Assistive technology may mispronounce or mishandle content without a declared language.",
                    "Add lang=\"en\" (or the appropriate language code) to the <html> tag.",
                    weight=1.1,
                )
            )

        # 3. Form inputs without labels
        unlabelled = []
        for f in parsed.forms:
            for c in f["controls"]:
                if not c.get("has_label") and not c.get("aria_label") and not c.get("aria_labelledby"):
                    unlabelled.append(c)
        if unlabelled:
            checks.append(
                result(
                    "a11y_form_labels", self.category, STATUS_FAIL, 25,
                    "Form fields missing labels",
                    "We checked every form control for an associated label or ARIA label.",
                    f"Found {len(unlabelled)} form field(s) without a label.",
                    "Screen reader users cannot tell what an unlabelled form field is for.",
                    "Associate every input with a <label for=\"...\"> or add aria-label.",
                    weight=1.1,
                )
            )
        else:
            checks.append(
                result(
                    "a11y_form_labels", self.category, STATUS_PASS, 100,
                    "Form fields are labelled",
                    "We checked every form control for an associated label or ARIA label.",
                    "All form controls are labelled or use ARIA labels.",
                    "Labelled form fields are usable by everyone, including screen reader users.",
                    "No action needed.",
                )
            )

        # 4. Heading structure
        h1_count = len(parsed.h1s)
        if h1_count == 0:
            checks.append(
                result(
                    "a11y_headings", self.category, STATUS_WARNING, 45,
                    "No main heading",
                    "We counted the H1 headings on the page.",
                    "No H1 heading was found.",
                    "Without a main heading, screen reader users cannot quickly understand the page topic.",
                    "Add one descriptive H1 to the page.",
                )
            )
        elif h1_count == 1:
            checks.append(
                result(
                    "a11y_headings", self.category, STATUS_PASS, 100,
                    "Clear heading structure",
                    "We counted the H1 headings on the page.",
                    "The page has a single H1 heading.",
                    "A single H1 gives screen reader users a clear starting point.",
                    "No action needed.",
                )
            )
        else:
            checks.append(
                result(
                    "a11y_headings", self.category, STATUS_WARNING, 55,
                    "Multiple H1 headings",
                    "We counted the H1 headings on the page.",
                    f"The page has {h1_count} H1 headings.",
                    "Multiple H1s can disorient screen reader navigation.",
                    "Use one H1 and demote the others.",
                )
            )

        # 5. Buttons without accessible names
        unnamed_buttons = [
            b for b in parsed.buttons
            if not (b.get("text") or "").strip() and not b.get("aria_label")
        ]
        if unnamed_buttons:
            checks.append(
                result(
                    "a11y_buttons", self.category, STATUS_WARNING, 50,
                    "Buttons missing accessible names",
                    "We checked every <button> for visible text or an aria-label.",
                    f"Found {len(unnamed_buttons)} button(s) without an accessible name.",
                    "Screen reader users cannot tell what an unnamed button does.",
                    "Add text inside the button or an aria-label attribute.",
                )
            )
        else:
            checks.append(
                result(
                    "a11y_buttons", self.category, STATUS_PASS, 100,
                    "Buttons have accessible names",
                    "We checked every <button> for visible text or an aria-label.",
                    "All buttons have accessible names.",
                    "Named buttons are usable by screen reader users.",
                    "No action needed.",
                )
            )

        # 6. Links without meaningful text
        bad_links = [
            l for l in parsed.links
            if not (l.get("text") or "").strip()
            and not l.get("has_aria_label")
            and not (l.get("href") or "").startswith(("mailto:", "tel:"))
        ]
        if bad_links:
            checks.append(
                result(
                    "a11y_links", self.category, STATUS_WARNING, 50,
                    "Links without meaningful text",
                    "We checked links for readable text or aria-labels.",
                    f"Found {len(bad_links)} link(s) without meaningful text.",
                    "Screen reader users may not know where a textless link goes.",
                    "Add descriptive link text or aria-label to each link.",
                    weight=1.1,
                )
            )
        else:
            checks.append(
                result(
                    "a11y_links", self.category, STATUS_PASS, 100,
                    "Links have meaningful text",
                    "We checked links for readable text or aria-labels.",
                    "All checked links include readable text.",
                    "Meaningful link text helps everyone navigate the page.",
                    "No action needed.",
                )
            )

        # 7. Viewport configuration
        viewport = parsed.meta_tags.get("viewport")
        if viewport:
            checks.append(
                result(
                    "a11y_viewport", self.category, STATUS_PASS, 100,
                    "Viewport is configured",
                    "We looked for a viewport meta tag.",
                    f"Viewport meta tag found: \"{viewport}\".",
                    "A proper viewport lets users zoom and read content comfortably on mobile.",
                    "No action needed.",
                    weight=0.8,
                )
            )
        else:
            checks.append(
                result(
                    "a11y_viewport", self.category, STATUS_WARNING, 40,
                    "Viewport meta tag missing",
                    "We looked for a viewport meta tag.",
                    "No viewport meta tag was found.",
                    "Without a viewport tag, mobile devices render the page at desktop width, requiring zoom and pan.",
                    "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
                    weight=0.8,
                )
            )

        # 8. Basic semantic HTML
        semantic = {name: parsed.soup.find(name) is not None for name in ("header", "nav", "main", "footer")}
        present = [k for k, v in semantic.items() if v]
        if len(present) >= 3:
            checks.append(
                result(
                    "a11y_semantic", self.category, STATUS_PASS, 100,
                    "Semantic landmarks are used",
                    "We looked for <header>, <nav>, <main> and <footer> landmarks.",
                    f"Found {len(present)} semantic landmark(s): {', '.join(present)}.",
                    "Semantic landmarks let screen reader users jump directly to important regions.",
                    "No action needed.",
                )
            )
        elif present:
            checks.append(
                result(
                    "a11y_semantic", self.category, STATUS_WARNING, 55,
                    "Some semantic landmarks missing",
                    "We looked for <header>, <nav>, <main> and <footer> landmarks.",
                    f"Only found: {', '.join(present)}.",
                    "Screen reader users benefit from landmarks to navigate the page.",
                    "Wrap key regions in semantic landmark elements.",
                )
            )
        else:
            checks.append(
                result(
                    "a11y_semantic", self.category, STATUS_WARNING, 40,
                    "Semantic landmarks missing",
                    "We looked for <header>, <nav>, <main> and <footer> landmarks.",
                    "No semantic landmarks were found.",
                    "Without landmarks, screen reader navigation is more difficult.",
                    "Use semantic elements (<header>, <nav>, <main>, <footer>) to structure the page.",
                )
            )

        return checks
