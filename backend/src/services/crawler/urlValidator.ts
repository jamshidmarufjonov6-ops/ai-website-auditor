import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

export class URLValidationError extends Error {
  safeMessage: string;
  constructor(message: string, safeMessage?: string) {
    super(message);
    this.name = "URLValidationError";
    this.safeMessage = safeMessage || message;
  }
}

export interface ValidatedURL {
  original: string;
  url: string;
  scheme: string;
  hostname: string;
  port: number | null;
  path: string;
  resolvedIps: string[];
}

const ALLOWED_SCHEMES = new Set(["http", "https"]);
const ALLOWED_PORTS = new Set([80, 443]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp",
  ".intranet",
  ".test",
  ".invalid",
  ".example",
];
const BLOCKED_HOSTNAME_EXACT = new Set(["localhost", "0.0.0.0", "255.255.255.255"]);
const BLOCKED_HOST_METADATA = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "instance-data.ec2.internal",
  "metadata.goog",
]);

function isBlockedIp(ipStr: string): boolean {
  try {
    const addr = ipaddr.parse(ipStr);
    // Treat IPv4-mapped IPv6 as the underlying IPv4 address.
    if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
      return isBlockedIp((addr as ipaddr.IPv6).toIPv4Address().toString());
    }
    // Python's ip.is_global() is essentially "publicly routable unicast".
    // ipaddr.js classifies private/loopback/link-local/multicast/reserved/etc.
    return addr.range() !== "unicast";
  } catch {
    return true;
  }
}

function hostnameToCandidates(hostname: string): string[] {
  const candidates: string[] = [];
  const cleaned = hostname.replace(/^\[|\]$/g, "");
  if (!cleaned) return candidates;

  try {
    candidates.push(ipaddr.process(cleaned).toString());
    return candidates;
  } catch {
    // Not a plain IP literal; keep checking encoded forms.
  }

  // Integer / hex encoded IPv4 (e.g. 2130706433, 0x7f000001).
  try {
    if (/^\d+$/.test(cleaned)) {
      const int = Number(cleaned);
      if (Number.isSafeInteger(int)) {
        candidates.push(intToIpv4(int));
      }
    } else if (/^0x[0-9a-f]+$/i.test(cleaned)) {
      candidates.push(intToIpv4(parseInt(cleaned.slice(2), 16)));
    }
  } catch {
    // ignore
  }

  // Dotted quad with leading zeros (some resolvers treat as octal).
  const parts = cleaned.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    try {
      const octets = parts.map((p) => parseInt(p, 8));
      if (octets.every((o) => o >= 0 && o <= 255)) {
        candidates.push(octets.join("."));
      }
    } catch {
      // ignore
    }
  }
  return candidates;
}

function intToIpv4(value: number): string {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
}

function checkHostnameLiterals(hostname: string): void {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAME_EXACT.has(lower) || BLOCKED_HOST_METADATA.has(lower)) {
    throw new URLValidationError(`Blocked host: ${hostname}`, "This website address is not allowed.");
  }
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    throw new URLValidationError(`Blocked hostname suffix: ${hostname}`, "This website address is not allowed.");
  }
  for (const candidate of hostnameToCandidates(lower)) {
    if (isBlockedIp(candidate)) {
      throw new URLValidationError(
        `Hostname resolves to blocked IP ${candidate}`,
        "This website address is not allowed."
      );
    }
  }
}

async function resolvePublicIps(hostname: string): Promise<string[]> {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOST_METADATA.has(lower)) {
    throw new URLValidationError("Blocked metadata host", "This website address is not allowed.");
  }

  let records: { address: string }[];
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new URLValidationError(
      `Could not resolve hostname: ${hostname}`,
      "We could not find that website. Check the address and try again."
    );
  }

  if (!records.length) {
    throw new URLValidationError(`No addresses for ${hostname}`, "We could not find that website.");
  }

  const ips: string[] = [];
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new URLValidationError(
        `Hostname ${hostname} resolves to blocked IP ${record.address}`,
        "This website address is not allowed for security reasons."
      );
    }
    if (!ips.includes(record.address)) ips.push(record.address);
  }
  return ips;
}

export function normalizeUrl(raw: string): string {
  const value = (raw || "").trim();
  if (!value) throw new URLValidationError("URL is empty", "Please enter a website address.");
  if (value.length > 2048) throw new URLValidationError("URL too long", "That address is too long.");
  let withScheme = value;
  if (!withScheme.includes("://")) withScheme = `https://${withScheme}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new URLValidationError("Invalid URL", "Please enter a valid website address.");
  }
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (!ALLOWED_SCHEMES.has(scheme)) {
    throw new URLValidationError(
      `Unsupported scheme: ${scheme}`,
      "Only http:// and https:// websites can be audited."
    );
  }
  if (!parsed.hostname) {
    throw new URLValidationError("Missing hostname", "Please enter a full website address such as example.com.");
  }
  if (parsed.username || parsed.password) {
    throw new URLValidationError("Credentials in URL are not allowed", "That address is not valid.");
  }
  return parsed.toString();
}

export async function validateUrl(raw: string): Promise<ValidatedURL> {
  const normalized = normalizeUrl(raw);
  const parsed = new URL(normalized);
  const hostname = parsed.hostname;
  const port = parsed.port ? parseInt(parsed.port, 10) : null;

  if (port !== null && !ALLOWED_PORTS.has(port)) {
    throw new URLValidationError(
      `Port ${port} is not allowed`,
      "Only standard web ports (80 and 443) are allowed."
    );
  }

  checkHostnameLiterals(hostname);
  const ips = await resolvePublicIps(hostname);

  let netloc = hostname;
  if (hostname.includes(":") && !hostname.startsWith("[")) netloc = `[${hostname}]`;
  if (port) netloc = `${netloc}:${port}`;
  parsed.hostname = hostname;
  parsed.port = port ? String(port) : "";
  const canonical = `${parsed.protocol}//${netloc}${parsed.pathname}${parsed.search}${parsed.hash}`;

  return {
    original: raw.trim(),
    url: canonical,
    scheme: parsed.protocol.replace(":", "").toLowerCase(),
    hostname,
    port,
    path: parsed.pathname || "/",
    resolvedIps: ips,
  };
}

export function getDomain(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
  if (host.startsWith("www.")) host = host.slice(4);
  return host;
}

export function isInternalLink(base: ValidatedURL, candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const baseHost = base.hostname.toLowerCase();
    return host === baseHost || host === `www.${baseHost}` || baseHost === `www.${host}`;
  } catch {
    return false;
  }
}
