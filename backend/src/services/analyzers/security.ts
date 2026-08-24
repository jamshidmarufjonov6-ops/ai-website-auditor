import type { CrawlContext } from "../crawler/crawler.js";
import type { CheckResult } from "../../types.js";
import { BaseAnalyzer, result, STATUS_FAIL, STATUS_PASS, STATUS_WARNING } from "./base.js";

const SECURITY_HEADERS: Record<string, [string, string]> = {
  "content-security-policy": ["Content Security Policy", "Content-Security-Policy"],
  "strict-transport-security": ["Strict Transport Security", "Strict-Transport-Security"],
  "x-content-type-options": ["X-Content-Type-Options", "X-Content-Type-Options"],
  "referrer-policy": ["Referrer-Policy", "Referrer-Policy"],
  "permissions-policy": ["Permissions-Policy", "Permissions-Policy"],
  "x-frame-options": ["X-Frame-Options", "X-Frame-Options"],
};

export class SecurityAnalyzer extends BaseAnalyzer {
  category = "security";

  analyze(ctx: CrawlContext) {
    const checks: CheckResult[] = [];
    const page = ctx.pages[0];
    if (!page) return checks;

    const headers = page.headers;
    const finalUrl = page.finalUrl;
    const isHttps = finalUrl.startsWith("https://");

    // 1. HTTPS
    if (isHttps) {
      checks.push(
        result({
          id: "security_https", category: this.category, status: STATUS_PASS, score: 100,
          title: "HTTPS is enabled",
          whatWasChecked: "We checked whether the website is served over an encrypted HTTPS connection.",
          actualResult: `HTTPS is enabled (${finalUrl}).`,
          whyItMatters: "HTTPS encrypts data between visitors and your server, protecting logins, forms and personal information.",
          howToFix: "Keep HTTPS enabled and renew certificates before they expire.",
          weight: 1.5,
        })
      );
    } else {
      checks.push(
        result({
          id: "security_https", category: this.category, status: STATUS_FAIL, score: 0,
          title: "Website is not using HTTPS",
          whatWasChecked: "We checked whether the website is served over an encrypted HTTPS connection.",
          actualResult: "The site is served over plain HTTP.",
          whyItMatters: "Without HTTPS, data between visitors and the server can be intercepted by third parties.",
          howToFix: "Install an SSL/TLS certificate and redirect all HTTP traffic to HTTPS.",
          weight: 1.5,
        })
      );
    }

    // 2. SSL/TLS handshake
    if (isHttps) {
      checks.push(
        result({
          id: "security_ssl_valid", category: this.category, status: STATUS_PASS, score: 100,
          title: "SSL/TLS connection succeeded",
          whatWasChecked: "We established a secure connection to the server.",
          actualResult: "The SSL/TLS handshake completed successfully.",
          whyItMatters: "A valid TLS connection means visitors' data is encrypted in transit.",
          howToFix: "Monitor certificate expiry and use modern TLS settings.",
          weight: 1.2,
        })
      );
    } else {
      checks.push(
        result({
          id: "security_ssl_valid", category: this.category, status: STATUS_WARNING, score: 30,
          title: "No SSL/TLS in use",
          whatWasChecked: "We checked whether a secure connection could be established.",
          actualResult: "Because the site uses HTTP, no encrypted channel exists.",
          whyItMatters: "Without SSL/TLS, visitors have no encrypted connection to your website.",
          howToFix: "Enable HTTPS with a valid certificate.",
        })
      );
    }

    // 3. Security headers
    for (const [key, [friendly, headerName]] of Object.entries(SECURITY_HEADERS)) {
      const value = headers[key];
      if (value) {
        checks.push(
          result({
            id: `security_header_${key}`, category: this.category, status: STATUS_PASS, score: 100,
            title: `${friendly} header is present`,
            whatWasChecked: `We checked the HTTP response for the ${headerName} header.`,
            actualResult: `The server sends: ${headerName}: ${value.slice(0, 80)}.`,
            whyItMatters: `This browser protection helps reduce certain client-side attacks.`,
            howToFix: `Review the ${headerName} policy regularly and keep it strict but compatible.`,
          })
        );
      } else {
        checks.push(
          result({
            id: `security_header_${key}`, category: this.category, status: STATUS_WARNING, score: 35,
            title: `Missing browser protection: ${friendly}`,
            whatWasChecked: `We checked the HTTP response for the ${headerName} header.`,
            actualResult: `The ${headerName} header was not found.`,
            whyItMatters: `Without this protection, the site has less defense against certain browser-based attacks.`,
            howToFix: `Configure ${headerName} on the server. Start with a policy that matches your site's needs.`,
          })
        );
      }
    }

    // 4. Mixed content
    if (isHttps) {
      const mixed: string[] = [];
      const parsed = ctx.parsedPages[0];
      if (parsed) {
        for (const img of parsed.images) {
          if ((img.src || "").startsWith("http://")) mixed.push(img.src || "");
        }
        for (const script of parsed.scripts) {
          if ((script.src || "").startsWith("http://")) mixed.push(script.src || "");
        }
        for (const link of parsed.stylesheets) {
          if ((link.href || "").startsWith("http://")) mixed.push(link.href || "");
        }
      }
      if (mixed.length) {
        checks.push(
          result({
            id: "security_mixed_content", category: this.category, status: STATUS_FAIL, score: 20,
            title: "Insecure content on an HTTPS page",
            whatWasChecked: "We looked for resources (scripts, stylesheets, images) loaded over plain HTTP on an HTTPS page.",
            actualResult: `Found ${mixed.length} resource(s) loaded over HTTP.`,
            whyItMatters: "Browsers may block or warn about insecure resources, which can break parts of your page and weaken encryption.",
            howToFix: `Update insecure resources to HTTPS, e.g. ${mixed[0].slice(0, 100)}.`,
            details: { mixed: mixed.slice(0, 10) },
          })
        );
      } else {
        checks.push(
          result({
            id: "security_mixed_content", category: this.category, status: STATUS_PASS, score: 100,
            title: "No mixed content detected",
            whatWasChecked: "We looked for resources loaded over plain HTTP on an HTTPS page.",
            actualResult: "All inspected resources are loaded over HTTPS.",
            whyItMatters: "Mixed content can weaken security; none was found.",
            howToFix: "Keep all future resources on HTTPS.",
          })
        );
      }
    } else {
      checks.push(
        result({
          id: "security_mixed_content", category: this.category, status: STATUS_WARNING, score: 40,
          title: "Mixed content cannot be evaluated over HTTP",
          whatWasChecked: "We looked for mixed content on the page.",
          actualResult: "The page is served over HTTP, so mixed content could not be evaluated.",
          whyItMatters: "Mixed content only applies to HTTPS pages; this page is served over HTTP.",
          howToFix: "Move the site to HTTPS first, then audit mixed content.",
          weight: 0.5,
        })
      );
    }

    // 5. Server information exposure
    const server = headers["server"];
    if (server) {
      const verbose = server.length > 30 || /\d/.test(server);
      const score = verbose ? 55 : 80;
      checks.push(
        result({
          id: "security_server_header", category: this.category,
          status: verbose ? STATUS_WARNING : STATUS_PASS,
          score,
          title: verbose ? "Server software information is exposed" : "Server header is minimal",
          whatWasChecked: "We checked the HTTP response for a Server header.",
          actualResult: `The server header reveals: "${server}".`,
          whyItMatters: verbose
            ? "Detailed version information helps attackers target known weaknesses."
            : "Minimal server information is good practice.",
          howToFix: "Configure the web server to hide detailed version information (e.g. ServerTokens Prod).",
        })
      );
    } else {
      checks.push(
        result({
          id: "security_server_header", category: this.category, status: STATUS_PASS, score: 100,
          title: "No detailed server information exposed",
          whatWasChecked: "We checked the HTTP response for a Server header.",
          actualResult: "No Server header was found.",
          whyItMatters: "Not advertising server software reduces the information available to attackers.",
          howToFix: "Keep server banners minimal.",
        })
      );
    }

    // 6. Cookie flags
    const setCookies = headers["set-cookie"];
    if (setCookies) {
      const cookieHeaders = Array.isArray(setCookies) ? setCookies : [setCookies];
      const insecure: string[] = [];
      for (const cookie of cookieHeaders) {
        const flags = cookie.toLowerCase();
        if (isHttps && !flags.includes("secure")) insecure.push("missing Secure");
        if (!flags.includes("httponly")) insecure.push("missing HttpOnly");
      }
      if (insecure.length) {
        checks.push(
          result({
            id: "security_cookie_flags", category: this.category, status: STATUS_WARNING, score: 45,
            title: "Cookies could be better protected",
            whatWasChecked: "We checked cookies set by the server for Secure and HttpOnly flags.",
            actualResult: `Found cookie flag issue(s): ${insecure.join(", ")}.`,
            whyItMatters: "Cookies without Secure/HttpOnly are easier for attackers to steal or read.",
            howToFix: "Set the Secure and HttpOnly flags on session cookies where possible.",
            details: { flags: insecure },
          })
        );
      } else {
        checks.push(
          result({
            id: "security_cookie_flags", category: this.category, status: STATUS_PASS, score: 100,
            title: "Cookies have protective flags",
            whatWasChecked: "We checked cookies set by the server for Secure and HttpOnly flags.",
            actualResult: "Observed cookies include Secure and HttpOnly flags.",
            whyItMatters: "Protected cookies are harder for attackers to steal.",
            howToFix: "Keep cookie flags strict.",
          })
        );
      }
    } else {
      checks.push(
        result({
          id: "security_cookie_flags", category: this.category, status: STATUS_PASS, score: 100,
          title: "No cookies observed",
          whatWasChecked: "We checked the response for cookies.",
          actualResult: "The response set no cookies.",
          whyItMatters: "There are no cookie flags to check when no cookies are set.",
          howToFix: "No action needed.",
          weight: 0.5,
        })
      );
    }

    return checks;
  }
}
