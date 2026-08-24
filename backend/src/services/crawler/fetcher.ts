import { config } from "../../config.js";
import { URLValidationError, validateUrl, type ValidatedURL } from "./urlValidator.js";

export const MAX_REDIRECTS = 5;

export class FetchError extends Error {
  safeMessage: string;
  kind: string;
  constructor(message: string, safeMessage: string, kind = "fetch_error") {
    super(message);
    this.name = "FetchError";
    this.safeMessage = safeMessage;
    this.kind = kind;
  }
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  content: Buffer;
  elapsedMs: number;
  history: string[];
  error?: string;
}

function headerObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function decodeContent(content: Buffer, contentType: string): string {
  let charset = "";
  const lower = contentType.toLowerCase();
  if (lower.includes("charset=")) {
    charset = lower.split("charset=")[1].split(";")[0].trim().replace(/^"|"$/g, "");
  }
  try {
    return new TextDecoder(charset || "utf-8", { fatal: false }).decode(content);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(content);
  }
}

async function safeCancel(body: ReadableStream<Uint8Array> | null): Promise<void> {
  try {
    await body?.cancel();
  } catch {
    // body may already be consumed/closed; nothing to do
  }
}

async function readLimited(body: ReadableStream<Uint8Array> | null, limit: number): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new FetchError(
          `Page exceeds size limit (${total} > ${limit} bytes)`,
          "This page is too large for the free audit. Try a smaller page.",
          "too_large"
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

function fetchErrorMessage(err: unknown, url: string): FetchError {
  const anyErr = err as { name?: string; cause?: { code?: string; message?: string }; message?: string };
  const code = anyErr?.cause?.code || anyErr?.name || "";
  const message = anyErr?.cause?.message || anyErr?.message || "";

  if (code === "AbortError" || /timeout|timed out/i.test(message)) {
    return new FetchError(
      `Timeout fetching ${url}: ${message}`,
      "The website took too long to respond.",
      "timeout"
    );
  }
  if (/certificate|CERT_|SSL|TLS|DEPTH_ZERO|UNABLE_TO_VERIFY/i.test(code + message)) {
    return new FetchError(
      `SSL error for ${url}: ${message}`,
      "The website has an SSL certificate problem, so we could not connect securely.",
      "ssl_error"
    );
  }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|network|fetch failed/i.test(code + message)) {
    return new FetchError(
      `Connection error for ${url}: ${message}`,
      "We could not connect to that website. Check the address and try again.",
      "connection_error"
    );
  }
  return new FetchError(
    `Request error for ${url}: ${message}`,
    "We could not fetch that website.",
    "request_error"
  );
}

export async function fetchUrl(validated: ValidatedURL): Promise<FetchedPage> {
  let currentUrl = validated.url;
  const history: string[] = [];
  const started = Date.now();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutSeconds * 1000);
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": config.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch (err) {
      throw fetchErrorMessage(err, currentUrl);
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        await safeCancel(response.body);
        throw new FetchError("Redirect without Location header", "The website sent an invalid redirect.");
      }
      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        await safeCancel(response.body);
        throw new FetchError("Invalid redirect location", "The website sent an invalid redirect.");
      }
      try {
        const nextValidated = await validateUrl(nextUrl);
        history.push(currentUrl);
        currentUrl = nextValidated.url;
        await safeCancel(response.body);
        continue;
      } catch (err) {
        await safeCancel(response.body);
        if (err instanceof URLValidationError) {
          throw new FetchError(
            `Blocked unsafe redirect to ${nextUrl}`,
            "The website redirected us somewhere we cannot safely scan.",
            "unsafe_redirect"
          );
        }
        throw err;
      }
    }

    try {
      const content = await readLimited(response.body, config.maxResponseBytes);
      const elapsedMs = Date.now() - started;
      return {
        url: validated.url,
        finalUrl: response.url || currentUrl,
        statusCode: response.status,
        headers: headerObject(response.headers),
        content,
        elapsedMs,
        history,
      };
    } finally {
      await safeCancel(response.body);
    }
  }

  throw new FetchError(
    `Too many redirects for ${validated.url}`,
    "The website redirected too many times.",
    "too_many_redirects"
  );
}

export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const validated = await validateUrl(rawUrl);
  return fetchUrl(validated);
}

export async function probeUrl(url: string): Promise<number | null> {
  try {
    const validated = await validateUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(config.requestTimeoutSeconds, 10) * 1000);
    try {
      let response = await fetch(validated.url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": config.userAgent },
        method: "HEAD",
      });
      if (response.status === 405 || response.status === 501) {
        await safeCancel(response.body);
        response = await fetch(validated.url, {
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": config.userAgent },
          method: "GET",
        });
      }
      const status = response.status;
      await safeCancel(response.body);
      return status;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
