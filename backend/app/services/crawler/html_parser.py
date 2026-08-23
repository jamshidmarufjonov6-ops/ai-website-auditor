"""HTML parsing and metadata extraction helpers built on BeautifulSoup."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup


@dataclass
class ParsedPage:
    url: str
    final_url: str
    status_code: int
    soup: BeautifulSoup
    title: Optional[str] = None
    meta_description: Optional[str] = None
    canonical: Optional[str] = None
    robots_meta: Optional[str] = None
    h1s: List[str] = field(default_factory=list)
    h2s: List[str] = field(default_factory=list)
    h3s: List[str] = field(default_factory=list)
    h4s: List[str] = field(default_factory=list)
    h5s: List[str] = field(default_factory=list)
    h6s: List[str] = field(default_factory=list)
    images: List[Dict] = field(default_factory=list)
    links: List[Dict] = field(default_factory=list)
    scripts: List[Dict] = field(default_factory=list)
    stylesheets: List[Dict] = field(default_factory=list)
    forms: List[Dict] = field(default_factory=list)
    buttons: List[Dict] = field(default_factory=list)
    meta_tags: Dict[str, str] = field(default_factory=dict)
    html_attrs: Dict[str, str] = field(default_factory=dict)
    text_length: int = 0
    word_count: int = 0


def parse_html(html: str) -> BeautifulSoup:
    return BeautifulSoup(html or "", "html.parser")


def _clean(text: Optional[str]) -> str:
    return " ".join((text or "").split())


def _get_meta(soup: BeautifulSoup, key: str) -> Optional[str]:
    for attr in ("name", "property", "http-equiv"):
        tag = soup.find("meta", attrs={attr: key})
        if tag and tag.get("content"):
            return _clean(tag.get("content"))
    return None


def _get_canonical(soup: BeautifulSoup) -> Optional[str]:
    link = soup.find("link", rel=lambda r: r and "canonical" in r)
    if link and link.get("href"):
        return _clean(link.get("href"))
    return None


def _heading_list(soup: BeautifulSoup, level: int) -> List[str]:
    return [_clean(h.get_text(" ", strip=True)) for h in soup.find_all(f"h{level}")]


def extract_structured_data_indicators(soup: BeautifulSoup) -> int:
    """Count structured-data containers (JSON-LD, microdata, RDFa)."""
    count = 0
    for script in soup.find_all("script", attrs={"type": lambda t: t and "ld+json" in t.lower()}):
        if script.string and script.string.strip():
            count += 1
    count += len(soup.find_all(attrs={"itemtype": True}))
    count += len(soup.find_all(attrs={"vocab": True}))
    return count


def parse_page(page) -> ParsedPage:
    """Parse a FetchedPage into a ParsedPage with extracted metadata."""
    soup = parse_html(page.text)
    html_tag = soup.find("html")
    html_attrs = dict(html_tag.attrs) if html_tag else {}

    images = []
    for img in soup.find_all("img"):
        images.append(
            {
                "src": img.get("src"),
                "alt": img.get("alt"),
                "width": img.get("width"),
                "height": img.get("height"),
                "loading": img.get("loading"),
                "srcset": img.get("srcset"),
            }
        )

    links = []
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        absolute = urljoin(page.final_url, href)
        links.append(
            {
                "href": href,
                "absolute": absolute,
                "text": _clean(a.get_text(" ", strip=True)),
                "internal": urlparse(absolute).hostname == urlparse(page.final_url).hostname
                or urlparse(absolute).hostname is None,
                "rel": a.get("rel"),
                "has_aria_label": bool(a.get("aria-label")),
            }
        )

    scripts = []
    for s in soup.find_all("script"):
        scripts.append({"src": s.get("src"), "inline": s.string is not None, "async": s.has_attr("async"), "defer": s.has_attr("defer")})

    stylesheets = []
    for link in soup.find_all("link", rel=lambda r: r and "stylesheet" in r):
        stylesheets.append({"href": link.get("href"), "media": link.get("media")})

    forms = []
    for f in soup.find_all("form"):
        controls = []
        for c in f.find_all(["input", "select", "textarea"]):
            controls.append(
                {
                    "type": c.get("type") or c.name,
                    "id": c.get("id"),
                    "has_label": False,  # resolved below
                    "aria_label": c.get("aria-label"),
                    "aria_labelledby": c.get("aria-labelledby"),
                }
            )
        forms.append({"controls": controls})

    buttons = []
    for b in soup.find_all("button"):
        buttons.append(
            {
                "text": _clean(b.get_text(" ", strip=True)),
                "aria_label": b.get("aria-label"),
                "has_aria_label": bool(b.get("aria-label")),
            }
        )

    # Label resolution for form controls (id -> label[for], or wrapped in label).
    labelled_ids = set()
    for label in soup.find_all("label"):
        for_id = label.get("for")
        if for_id:
            labelled_ids.add(for_id)
    for f in forms:
        for c in f["controls"]:
            if c["id"] in labelled_ids:
                c["has_label"] = True

    text = _clean(soup.get_text(" ", strip=True))

    return ParsedPage(
        url=page.url,
        final_url=page.final_url,
        status_code=page.status_code,
        soup=soup,
        title=_clean(soup.title.string) if soup.title and soup.title.string else None,
        meta_description=_get_meta(soup, "description"),
        canonical=_get_canonical(soup) or _get_meta(soup, "og:url"),
        robots_meta=_get_meta(soup, "robots"),
        h1s=_heading_list(soup, 1),
        h2s=_heading_list(soup, 2),
        h3s=_heading_list(soup, 3),
        h4s=_heading_list(soup, 4),
        h5s=_heading_list(soup, 5),
        h6s=_heading_list(soup, 6),
        images=images,
        links=links,
        scripts=scripts,
        stylesheets=stylesheets,
        forms=forms,
        buttons=buttons,
        meta_tags=_extract_all_meta(soup),
        html_attrs=html_attrs,
        text_length=len(text),
        word_count=len(text.split()) if text else 0,
    )


def _extract_all_meta(soup: BeautifulSoup) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for tag in soup.find_all("meta"):
        key = tag.get("name") or tag.get("property") or tag.get("http-equiv")
        content = tag.get("content")
        if key and content:
            out[str(key).lower()] = _clean(content)
    return out
