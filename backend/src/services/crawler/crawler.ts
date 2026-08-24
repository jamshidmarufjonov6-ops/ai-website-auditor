import { config } from "../../config.js";
import { FetchError, fetchPage, probeUrl, type FetchedPage } from "./fetcher.js";
import { parsePage, type ParsedPage } from "./htmlParser.js";
import { getDomain, validateUrl } from "./urlValidator.js";

export interface RobotsInfo {
  available: boolean;
  statusCode: number | null;
  disallowAll: boolean;
  disallowedPaths: string[];
  sitemapUrls: string[];
}

export interface SitemapInfo {
  available: boolean;
  url: string | null;
  statusCode: number | null;
}

export interface CrawlContext {
  startUrl: string;
  domain: string;
  pages: FetchedPage[];
  parsedPages: ParsedPage[];
  robots: RobotsInfo;
  sitemap: SitemapInfo;
  crawlLimited: boolean;
  brokenLinks: { url: string; status_code: number }[];
  fetchErrors: { url: string; kind: string; message: string; status_code?: number }[];
}

export type ProgressCallback = (progress: number, stage: string) => void;

function noop(_progress: number, _stage: string): void {}

function parseRobots(text: string, baseUrl: string): RobotsInfo {
  const info: RobotsInfo = {
    available: true,
    statusCode: null,
    disallowAll: false,
    disallowedPaths: [],
    sitemapUrls: [],
  };
  let currentAgents: string[] = [];
  let globalDisallow = false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line || !line.includes(":")) continue;
    const colonIndex = line.indexOf(":");
    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    if (key === "user-agent") {
      currentAgents = [value.toLowerCase()];
    } else if (key === "disallow" && value) {
      if (currentAgents.includes("*") || currentAgents.includes("aiwebsiteauditor")) {
        if (value === "/") globalDisallow = true;
        info.disallowedPaths.push(value);
      }
    } else if (key === "sitemap" && value) {
      try {
        info.sitemapUrls.push(new URL(value, baseUrl).toString());
      } catch {
        // ignore invalid sitemap URL
      }
    }
  }
  info.disallowAll = globalDisallow;
  return info;
}

function extractInternalLinks(parsed: ParsedPage, domain: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const link of parsed.links) {
    const href = link.absolute;
    if (!href.startsWith("http://") && !href.startsWith("https://")) continue;
    let host = "";
    try {
      host = new URL(href).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (host === domain || host === `www.${domain}` || `www.${host}` === domain) {
      const cleanHref = href.split("#", 1)[0];
      if (!seen.has(cleanHref)) {
        seen.add(cleanHref);
        out.push(cleanHref);
      }
    }
  }
  return out;
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function crawl(
  rawUrl: string,
  progress: ProgressCallback = noop,
  maxPages?: number
): Promise<CrawlContext> {
  const validated = await validateUrl(rawUrl);
  const domain = getDomain(validated.url);
  const ctx: CrawlContext = {
    startUrl: validated.url,
    domain,
    pages: [],
    parsedPages: [],
    robots: {
      available: false,
      statusCode: null,
      disallowAll: false,
      disallowedPaths: [],
      sitemapUrls: [],
    },
    sitemap: { available: false, url: null, statusCode: null },
    crawlLimited: false,
    brokenLinks: [],
    fetchErrors: [],
  };
  const pageLimit = maxPages || config.maxPages;

  // 1. Start page
  progress(8, "Fetching homepage");
  const start = await fetchPage(validated.url);
  if (start.statusCode >= 500) {
    throw new FetchError(
      `Start page returned ${start.statusCode}`,
      `The website returned a server error (HTTP ${start.statusCode}).`,
      "http_5xx"
    );
  }
  ctx.pages.push(start);
  ctx.parsedPages.push(parsePage(start));

  // 2. robots.txt
  progress(16, "Checking robots.txt");
  const robotsUrl = `${validated.scheme}://${domain}/robots.txt`;
  try {
    const robotsResp = await fetchPage(robotsUrl);
    ctx.robots.statusCode = robotsResp.statusCode;
    if (robotsResp.statusCode < 400 && robotsResp.content.length > 0) {
      const parsedRobots = parseRobots(decodeText(robotsResp), robotsResp.finalUrl);
      parsedRobots.statusCode = robotsResp.statusCode;
      ctx.robots = parsedRobots;
    }
  } catch {
    // robots.txt unavailable is a finding, not a crash
  }

  // 3. sitemap
  progress(24, "Checking sitemap");
  const sitemapCandidates = [...ctx.robots.sitemapUrls.slice(0, 2), `${validated.scheme}://${domain}/sitemap.xml`];
  for (const candidate of sitemapCandidates) {
    const status = await probeUrl(candidate);
    if (status !== null && status < 400) {
      ctx.sitemap = { available: true, url: candidate, statusCode: status };
      break;
    } else if (status !== null) {
      ctx.sitemap = { available: false, url: candidate, statusCode: status };
    }
  }

  // 4. Internal pages (depth 1)
  progress(32, "Discovering pages");
  const startParsed = ctx.parsedPages[0];
  const internalLinks = startParsed ? extractInternalLinks(startParsed, domain) : [];
  const maxExtra = Math.max(0, pageLimit - 1);
  if (maxExtra > 0 && internalLinks.length > 0) {
    const toFetch = internalLinks.slice(0, maxExtra);
    let done = 0;
    await mapConcurrent(
      toFetch,
      Math.min(config.crawlerMaxConcurrency, toFetch.length),
      async (url) => {
        done += 1;
        progress(32 + Math.floor((24 * done) / Math.max(1, toFetch.length)), `Crawling page ${done} of ${toFetch.length}`);
        try {
          const page = await fetchPage(url);
          if (page.statusCode < 400) {
            ctx.pages.push(page);
            ctx.parsedPages.push(parsePage(page));
          } else {
            ctx.fetchErrors.push({
              url,
              kind: "http_status",
              status_code: page.statusCode,
              message: `HTTP ${page.statusCode}`,
            });
          }
        } catch (err) {
          if (err instanceof FetchError) {
            ctx.fetchErrors.push({ url, kind: err.kind, message: err.safeMessage });
          } else {
            ctx.fetchErrors.push({ url, kind: "fetch_error", message: "Failed to fetch page." });
          }
        }
      }
    );
    if (internalLinks.length > maxExtra) ctx.crawlLimited = true;
  }

  // 5. Broken internal links (practical, bounded)
  progress(60, "Checking links");
  if (startParsed) {
    const fetchedUrls = new Set(ctx.pages.map((p) => p.url));
    const candidates = internalLinks.slice(0, 12).filter((u) => !fetchedUrls.has(u));
    for (const url of candidates) {
      const status = await probeUrl(url);
      if (status !== null && status >= 400) {
        ctx.brokenLinks.push({ url, status_code: status });
      }
    }
  }

  progress(66, "Analyzing pages");
  return ctx;
}

function decodeText(page: FetchedPage): string {
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
