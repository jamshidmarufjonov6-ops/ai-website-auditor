"""Mobile friendliness analyzer."""
from __future__ import annotations

from typing import List

from app.services.analyzers.base import STATUS_FAIL, STATUS_PASS, STATUS_WARNING, BaseAnalyzer, result


class MobileAnalyzer(BaseAnalyzer):
    category = "mobile"

    def analyze(self, ctx) -> List:
        checks: List = []
        parsed = ctx.start_parsed
        page = ctx.start_page
        if parsed is None or page is None:
            return checks

        # 1. Viewport meta tag
        viewport = parsed.meta_tags.get("viewport")
        if viewport and "width=device-width" in viewport.lower():
            checks.append(
                result(
                    "mobile_viewport", self.category, STATUS_PASS, 100,
                    "Mobile viewport is configured",
                    "We looked for a viewport meta tag with width=device-width.",
                    f"Viewport found: \"{viewport}\".",
                    "A correct viewport lets phones render the page at the right width without zooming out.",
                    "No action needed.",
                    weight=1.3,
                )
            )
        elif viewport:
            checks.append(
                result(
                    "mobile_viewport", self.category, STATUS_WARNING, 60,
                    "Viewport may not be fully mobile-friendly",
                    "We looked for a viewport meta tag with width=device-width.",
                    f"The viewport tag is \"{viewport}\", which may not use the device width.",
                    "A viewport that ignores device width can make the site hard to read on phones.",
                    "Use <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
                    weight=1.3,
                )
            )
        else:
            checks.append(
                result(
                    "mobile_viewport", self.category, STATUS_FAIL, 15,
                    "Viewport meta tag is missing",
                    "We looked for a viewport meta tag with width=device-width.",
                    "No viewport meta tag was found.",
                    "Without a viewport tag, phones render the desktop layout and users must pinch to zoom.",
                    "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
                    weight=1.3,
                )
            )

        # 2. Responsive indicators (media queries / responsive framework)
        soup = parsed.soup
        responsive_hints = 0
        for style in soup.find_all("style"):
            if style.string and "@media" in style.string:
                responsive_hints += 1
        for link in parsed.stylesheets:
            if any(tok in (link.get("href") or "").lower() for tok in ("bootstrap", "tailwind", "foundation", "bulma")):
                responsive_hints += 1
        if responsive_hints:
            checks.append(
                result(
                    "mobile_responsive", self.category, STATUS_PASS, 100,
                    "Responsive design indicators found",
                    "We looked for media queries or known responsive frameworks.",
                    f"Found {responsive_hints} responsive design signal(s).",
                    "Responsive design lets the layout adapt to phones and tablets.",
                    "No action needed.",
                )
            )
        else:
            checks.append(
                result(
                    "mobile_responsive", self.category, STATUS_WARNING, 55,
                    "Limited responsive design signals",
                    "We looked for media queries or known responsive frameworks.",
                    "No media queries or responsive framework were detected.",
                    "The layout may not adapt to phone screens.",
                    "Use CSS media queries (or a responsive framework) to adapt the layout to small screens.",
                )
            )

        # 3. Horizontal overflow indicators
        overflow_risks = 0
        for tag in soup.find_all(attrs={"style": True}):
            style = (tag.get("style") or "").lower()
            if "width:" in style and any(f"{n}px" in style for n in (700, 800, 900, 1000, 1200)):
                overflow_risks += 1
        wide_tables = sum(1 for t in soup.find_all("table") if (t.get("width") or "").isdigit() and int(t.get("width")) > 600)
        overflow_risks += wide_tables
        if overflow_risks == 0:
            checks.append(
                result(
                    "mobile_overflow", self.category, STATUS_PASS, 100,
                    "No obvious horizontal overflow",
                    "We looked for fixed-width elements and wide tables that could overflow on phones.",
                    "No fixed-width elements likely to cause horizontal scrolling were found.",
                    "Horizontal scrolling makes mobile pages hard to use.",
                    "No action needed.",
                )
            )
        else:
            checks.append(
                result(
                    "mobile_overflow", self.category, STATUS_WARNING, 50,
                    "Possible horizontal overflow",
                    "We looked for fixed-width elements and wide tables that could overflow on phones.",
                    f"Found {overflow_risks} element(s) with fixed widths that may overflow on small screens.",
                    "Horizontal scrolling makes mobile pages frustrating to read.",
                    "Replace fixed pixel widths with max-width and fluid layouts.",
                )
            )

        # 4. Mobile-friendly HTML patterns
        good_patterns = 0
        for tag in soup.find_all("input"):
            t = (tag.get("type") or "").lower()
            if t in ("tel", "email", "search", "number", "date"):
                good_patterns += 1
        for a in soup.find_all("a", href=True):
            if (a.get("href") or "").startswith("tel:"):
                good_patterns += 1
        if good_patterns:
            checks.append(
                result(
                    "mobile_patterns", self.category, STATUS_PASS, 100,
                    "Mobile-friendly input patterns found",
                    "We looked for mobile-friendly input types and tap-to-call links.",
                    f"Found {good_patterns} mobile-friendly pattern(s).",
                    "Mobile-friendly inputs show the right keyboard and make forms easier on phones.",
                    "No action needed.",
                    weight=0.6,
                )
            )
        else:
            checks.append(
                result(
                    "mobile_patterns", self.category, STATUS_PASS, 80,
                    "No special mobile patterns detected",
                    "We looked for mobile-friendly input types and tap-to-call links.",
                    "No special mobile patterns were found.",
                    "This is fine for many sites; forms just may not show the most convenient mobile keyboard.",
                    "For forms, consider input types like tel and email for better mobile keyboards.",
                    weight=0.5,
                )
            )

        # 5. Image sizing indicators
        images = [img for p in ctx.parsed_pages for img in p.images]
        if images:
            with_size = [i for i in images if i.get("width") or i.get("srcset")]
            ratio = len(with_size) / len(images)
            if ratio >= 0.8:
                checks.append(
                    result(
                        "mobile_images", self.category, STATUS_PASS, 100,
                        "Images have size hints",
                        "We checked whether images declare dimensions or srcset.",
                        f"{len(with_size)} of {len(images)} images declare dimensions or srcset.",
                        "Size hints prevent layout shift and help phones load appropriate image sizes.",
                        "No action needed.",
                    )
                )
            elif ratio >= 0.4:
                checks.append(
                    result(
                        "mobile_images", self.category, STATUS_WARNING, 60,
                        "Some images lack size hints",
                        "We checked whether images declare dimensions or srcset.",
                        f"{len(images) - len(with_size)} of {len(images)} images lack width/height or srcset.",
                        "Images without size hints can cause layout shift on mobile.",
                        "Add width/height attributes or srcset to images.",
                    )
                )
            else:
                checks.append(
                    result(
                        "mobile_images", self.category, STATUS_WARNING, 40,
                        "Most images lack size hints",
                        "We checked whether images declare dimensions or srcset.",
                        f"Only {len(with_size)} of {len(images)} images declare dimensions.",
                        "Most images lack size hints, which can cause noticeable layout shift on mobile.",
                        "Add width/height attributes or responsive srcset to images.",
                    )
                )
        else:
            checks.append(
                result(
                    "mobile_images", self.category, STATUS_PASS, 100,
                    "No images to check",
                    "We looked for images on the crawled pages.",
                    "The page contains no images.",
                    "There are no mobile image sizing issues to flag.",
                    "No action needed.",
                    weight=0.4,
                )
            )

        # 6. Tap target size (basic heuristic)
        small_links = 0
        for a in soup.find_all("a", href=True, attrs={"style": True}):
            style = (a.get("style") or "").lower()
            if "font-size" in style and any(f"{n}px" in style for n in range(5, 12)):
                small_links += 1
        if small_links == 0:
            checks.append(
                result(
                    "mobile_tap_targets", self.category, STATUS_PASS, 100,
                    "No tiny tap targets detected",
                    "We looked for links with very small inline font sizes that could be hard to tap.",
                    "No tiny tap targets were detected.",
                    "Small tap targets are frustrating on touch screens.",
                    "No action needed.",
                    weight=0.5,
                )
            )
        else:
            checks.append(
                result(
                    "mobile_tap_targets", self.category, STATUS_WARNING, 55,
                    "Some tap targets may be too small",
                    "We looked for links with very small inline font sizes that could be hard to tap.",
                    f"Found {small_links} link(s) with very small inline font sizes.",
                    "Tiny tap targets are hard to hit accurately on phones.",
                    "Make tap targets at least 44x44 px with adequate spacing.",
                    weight=0.5,
                )
            )

        return checks
