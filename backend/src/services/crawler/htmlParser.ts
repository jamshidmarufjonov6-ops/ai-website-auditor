import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { FetchedPage } from "./fetcher.js";

export interface ParsedPage {
  url: string;
  finalUrl: string;
  statusCode: number;
  $: CheerioAPI;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  h4s: string[];
  h5s: string[];
  h6s: string[];
  images: Array<{
    src?: string;
    alt?: string;
    width?: string;
    height?: string;
    loading?: string;
    srcset?: string;
  }>;
  links: Array<{
    href: string;
    absolute: string;
    text: string;
    internal: boolean;
    rel?: string;
    hasAriaLabel: boolean;
  }>;
  scripts: Array<{ src?: string; inline: boolean; async: boolean; defer: boolean }>;
  stylesheets: Array<{ href?: string; media?: string }>;
  forms: Array<{
    controls: Array<{
      type: string;
      id?: string;
      hasLabel: boolean;
      ariaLabel?: string;
      ariaLabelledby?: string;
    }>;
  }>;
  buttons: Array<{ text: string; ariaLabel?: string; hasAriaLabel: boolean }>;
  metaTags: Record<string, string>;
  htmlAttrs: Record<string, string>;
  textLength: number;
  wordCount: number;
}

export function parseHtml(html: string): CheerioAPI {
  return cheerio.load(html || "");
}

function clean(text: string | null | undefined): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function getMeta($: CheerioAPI, key: string): string | null {
  const lowerKey = key.toLowerCase();
  const tag = $("meta")
    .toArray()
    .find((el) => {
      const attrs = $(el).attr() || {};
      return ["name", "property", "http-equiv"].some((attr) => {
        const value = attrs[attr];
        return value !== undefined && value.toLowerCase() === lowerKey;
      });
    });
  if (tag) {
    const content = $(tag).attr("content");
    if (content) return clean(content);
  }
  return null;
}

function getCanonical($: CheerioAPI): string | null {
  const link = $("link")
    .toArray()
    .find((el) => {
      const rel = ($(el).attr("rel") || "").toLowerCase();
      return rel.split(/\s+/).includes("canonical");
    });
  if (link) {
    const href = $(link).attr("href");
    if (href) return clean(href);
  }
  return null;
}

function headingList($: CheerioAPI, level: number): string[] {
  return $(`h${level}`)
    .toArray()
    .map((el) => clean($(el).text()));
}

export function extractStructuredDataIndicators($: CheerioAPI): number {
  let count = 0;
  $("script[type]").each((_, el) => {
    const type = ($(el).attr("type") || "").toLowerCase();
    if (type.includes("ld+json") && clean($(el).text())) count += 1;
  });
  count += $("[itemtype]").length;
  count += $("[vocab]").length;
  return count;
}

export function parsePage(page: FetchedPage): ParsedPage {
  const $ = parseHtml(decodePageText(page));
  const htmlTag = $("html")[0];
  const htmlAttrs = htmlTag ? (htmlTag.attribs as Record<string, string>) : {};

  const images = $("img")
    .toArray()
    .map((el) => ({
      src: $(el).attr("src"),
      alt: $(el).attr("alt"),
      width: $(el).attr("width"),
      height: $(el).attr("height"),
      loading: $(el).attr("loading"),
      srcset: $(el).attr("srcset"),
    }));

  const finalHostname = hostnameOf(page.finalUrl);

  const links = $("a[href]")
    .toArray()
    .map((el) => {
      const href = $(el).attr("href") || "";
      let absolute = href;
      try {
        absolute = new URL(href, page.finalUrl).toString();
      } catch {
        absolute = href;
      }
      return {
        href,
        absolute,
        text: clean($(el).text()),
        internal: hostnameOf(absolute) === finalHostname || hostnameOf(absolute) === null,
        rel: $(el).attr("rel"),
        hasAriaLabel: Boolean($(el).attr("aria-label")),
      };
    });

  const scripts = $("script")
    .toArray()
    .map((el) => ({
      src: $(el).attr("src"),
      inline: $(el).text().trim().length > 0,
      async: el.attribs.async !== undefined,
      defer: el.attribs.defer !== undefined,
    }));

  const stylesheets = $("link[rel]")
    .toArray()
    .filter((el) => (($(el).attr("rel") || "").toLowerCase().split(/\s+/).includes("stylesheet")))
    .map((el) => ({ href: $(el).attr("href"), media: $(el).attr("media") }));

  const forms = $("form")
    .toArray()
    .map((form) => {
      const controls = $(form)
        .find("input, select, textarea")
        .toArray()
        .map((el) => ({
          type: $(el).attr("type") || el.name,
          id: $(el).attr("id"),
          hasLabel: false,
          ariaLabel: $(el).attr("aria-label"),
          ariaLabelledby: $(el).attr("aria-labelledby"),
        }));
      return { controls };
    });

  const buttons = $("button")
    .toArray()
    .map((el) => ({
      text: clean($(el).text()),
      ariaLabel: $(el).attr("aria-label"),
      hasAriaLabel: Boolean($(el).attr("aria-label")),
    }));

  const labelledIds = new Set<string>();
  $("label[for]").each((_, el) => {
    const forId = $(el).attr("for");
    if (forId) labelledIds.add(forId);
  });
  for (const form of forms) {
    for (const control of form.controls) {
      if (control.id && labelledIds.has(control.id)) control.hasLabel = true;
    }
  }

  const text = clean($("body").text() || $("html").text());
  const metaTags: Record<string, string> = {};
  $("meta").each((_, el) => {
    const key = $(el).attr("name") || $(el).attr("property") || $(el).attr("http-equiv");
    const content = $(el).attr("content");
    if (key && content) metaTags[key.toLowerCase()] = clean(content);
  });

  return {
    url: page.url,
    finalUrl: page.finalUrl,
    statusCode: page.statusCode,
    $,
    title: pageTitle($),
    metaDescription: getMeta($, "description"),
    canonical: getCanonical($) || getMeta($, "og:url"),
    robotsMeta: getMeta($, "robots"),
    h1s: headingList($, 1),
    h2s: headingList($, 2),
    h3s: headingList($, 3),
    h4s: headingList($, 4),
    h5s: headingList($, 5),
    h6s: headingList($, 6),
    images,
    links,
    scripts,
    stylesheets,
    forms,
    buttons,
    metaTags,
    htmlAttrs,
    textLength: text.length,
    wordCount: text ? text.split(/\s+/).length : 0,
  };
}

function decodePageText(page: FetchedPage): string {
  const contentType = page.headers["content-type"] || "";
  let charset = "";
  if (contentType.toLowerCase().includes("charset=")) {
    charset = contentType.toLowerCase().split("charset=")[1].split(";")[0].trim().replace(/^"|"$/g, "");
  }
  try {
    return new TextDecoder(charset || "utf-8", { fatal: false }).decode(page.content);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(page.content);
  }
}

function pageTitle($: CheerioAPI): string | null {
  const title = $("title").first().text();
  return title ? clean(title) : null;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
