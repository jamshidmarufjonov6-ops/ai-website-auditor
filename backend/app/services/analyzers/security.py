"""Security analyzer — SAFE, PASSIVE checks only.

This module only inspects publicly available HTTP headers and HTML. It never
performs penetration testing, and it never claims a site is "secure".
"""
from __future__ import annotations

from typing import List

from app.services.analyzers.base import STATUS_FAIL, STATUS_PASS, STATUS_WARNING, BaseAnalyzer, result

SECURITY_HEADERS = {
    "content-security-policy": ("Content Security Policy", "Content-Security-Policy"),
    "strict-transport-security": ("Strict Transport Security", "Strict-Transport-Security"),
    "x-content-type-options": ("X-Content-Type-Options", "X-Content-Type-Options"),
    "referrer-policy": ("Referrer-Policy", "Referrer-Policy"),
    "permissions-policy": ("Permissions-Policy", "Permissions-Policy"),
    "x-frame-options": ("X-Frame-Options", "X-Frame-Options"),
}


class SecurityAnalyzer(BaseAnalyzer):
    category = "security"

    def analyze(self, ctx) -> List:
        checks: List = []
        page = ctx.start_page
        if page is None:
            return checks

        headers = page.headers
        final_url = page.final_url
        is_https = final_url.startswith("https://")

        # 1. HTTPS
        if is_https:
            checks.append(
                result(
                    "security_https", self.category, STATUS_PASS, 100,
                    "HTTPS is enabled",
                    "We checked whether the website is served over an encrypted HTTPS connection.",
                    f"HTTPS is enabled ({final_url}).",
                    "HTTPS encrypts data between visitors and your server, protecting logins, forms and personal information.",
                    "Keep HTTPS enabled and renew certificates before they expire.",
                    weight=1.5,
                )
            )
        else:
            checks.append(
                result(
                    "security_https", self.category, STATUS_FAIL, 0,
                    "Website is not using HTTPS",
                    "We checked whether the website is served over an encrypted HTTPS connection.",
                    "The site is served over plain HTTP.",
                    "Without HTTPS, data between visitors and the server can be intercepted by third parties.",
                    "Install an SSL/TLS certificate and redirect all HTTP traffic to HTTPS.",
                    weight=1.5,
                )
            )

        # 2. SSL/TLS handshake (when HTTPS and fetch succeeded)
        if is_https:
            checks.append(
                result(
                    "security_ssl_valid", self.category, STATUS_PASS, 100,
                    "SSL/TLS connection succeeded",
                    "We established a secure connection to the server.",
                    "The SSL/TLS handshake completed successfully.",
                    "A valid TLS connection means visitors' data is encrypted in transit.",
                    "Monitor certificate expiry and use modern TLS settings.",
                    weight=1.2,
                )
            )
        else:
            checks.append(
                result(
                    "security_ssl_valid", self.category, STATUS_WARNING, 30,
                    "No SSL/TLS in use",
                    "We checked whether a secure connection could be established.",
                    "Because the site uses HTTP, no encrypted channel exists.",
                    "Without SSL/TLS, visitors have no encrypted connection to your website.",
                    "Enable HTTPS with a valid certificate.",
                )
            )

        # 3. Security headers
        for key, (friendly, header_name) in SECURITY_HEADERS.items():
            value = headers.get(key)
            if value:
                checks.append(
                    result(
                        f"security_header_{key}", self.category, STATUS_PASS, 100,
                        f"{friendly} header is present",
                        f"We checked the HTTP response for the {header_name} header.",
                        f"The server sends: {header_name}: {value[:80]}.",
                        f"This browser protection helps reduce certain client-side attacks.",
                        f"Review the {header_name} policy regularly and keep it strict but compatible.",
                    )
                )
            else:
                checks.append(
                    result(
                        f"security_header_{key}", self.category, STATUS_WARNING, 35,
                        f"Missing browser protection: {friendly}",
                        f"We checked the HTTP response for the {header_name} header.",
                        f"The {header_name} header was not found.",
                        f"Without this protection, the site has less defense against certain browser-based attacks.",
                        f"Configure {header_name} on the server. Start with a policy that matches your site's needs.",
                    )
                )

        # 4. Mixed content
        if is_https:
            mixed = []
            parsed = ctx.start_parsed
            if parsed:
                for img in parsed.images:
                    if (img.get("src") or "").startswith("http://"):
                        mixed.append(img.get("src"))
                for script in parsed.scripts:
                    if (script.get("src") or "").startswith("http://"):
                        mixed.append(script.get("src"))
                for link in parsed.stylesheets:
                    if (link.get("href") or "").startswith("http://"):
                        mixed.append(link.get("href"))
            if mixed:
                checks.append(
                    result(
                        "security_mixed_content", self.category, STATUS_FAIL, 20,
                        "Insecure content on an HTTPS page",
                        "We looked for resources (scripts, stylesheets, images) loaded over plain HTTP on an HTTPS page.",
                        f"Found {len(mixed)} resource(s) loaded over HTTP.",
                        "Browsers may block or warn about insecure resources, which can break parts of your page and weaken encryption.",
                        f"Update insecure resources to HTTPS, e.g. {mixed[0][:100]}.",
                        details={"mixed": mixed[:10]},
                    )
                )
            else:
                checks.append(
                    result(
                        "security_mixed_content", self.category, STATUS_PASS, 100,
                        "No mixed content detected",
                        "We looked for resources loaded over plain HTTP on an HTTPS page.",
                        "All inspected resources are loaded over HTTPS.",
                        "Mixed content can weaken security; none was found.",
                        "Keep all future resources on HTTPS.",
                    )
                )
        else:
            checks.append(
                result(
                    "security_mixed_content", self.category, STATUS_WARNING, 40,
                    "Mixed content cannot be evaluated over HTTP",
                    "We looked for mixed content on the page.",
                    "The page is served over HTTP, so mixed content could not be evaluated.",
                    "Mixed content only applies to HTTPS pages; this page is served over HTTP.",
                    "Move the site to HTTPS first, then audit mixed content.",
                    weight=0.5,
                )
            )

        # 5. Server information exposure
        server = headers.get("server")
        if server:
            verbose = len(server) > 30 or any(c.isdigit() for c in server)
            score = 55 if verbose else 80
            checks.append(
                result(
                    "security_server_header", self.category,
                    STATUS_WARNING if verbose else STATUS_PASS,
                    score,
                    "Server software information is exposed" if verbose else "Server header is minimal",
                    "We checked the HTTP response for a Server header.",
                    f"The server header reveals: \"{server}\".",
                    "Detailed version information helps attackers target known weaknesses."
                    if verbose
                    else "Minimal server information is good practice.",
                    "Configure the web server to hide detailed version information (e.g. ServerTokens Prod).",
                )
            )
        else:
            checks.append(
                result(
                    "security_server_header", self.category, STATUS_PASS, 100,
                    "No detailed server information exposed",
                    "We checked the HTTP response for a Server header.",
                    "No Server header was found.",
                    "Not advertising server software reduces the information available to attackers.",
                    "Keep server banners minimal.",
                )
            )

        # 6. Cookie flags
        set_cookies = headers.get("set-cookie")
        if set_cookies:
            if not isinstance(set_cookies, list):
                set_cookies = [set_cookies]
            insecure = []
            for cookie in set_cookies:
                flags = cookie.lower()
                if is_https and "secure" not in flags:
                    insecure.append("missing Secure")
                if "httponly" not in flags:
                    insecure.append("missing HttpOnly")
            if insecure:
                checks.append(
                    result(
                        "security_cookie_flags", self.category, STATUS_WARNING, 45,
                        "Cookies could be better protected",
                        "We checked cookies set by the server for Secure and HttpOnly flags.",
                        f"Found cookie flag issue(s): {', '.join(insecure)}.",
                        "Cookies without Secure/HttpOnly are easier for attackers to steal or read.",
                        "Set the Secure and HttpOnly flags on session cookies where possible.",
                        details={"flags": insecure},
                    )
                )
            else:
                checks.append(
                    result(
                        "security_cookie_flags", self.category, STATUS_PASS, 100,
                        "Cookies have protective flags",
                        "We checked cookies set by the server for Secure and HttpOnly flags.",
                        "Observed cookies include Secure and HttpOnly flags.",
                        "Protected cookies are harder for attackers to steal.",
                        "Keep cookie flags strict.",
                    )
                )
        else:
            checks.append(
                result(
                    "security_cookie_flags", self.category, STATUS_PASS, 100,
                    "No cookies observed",
                    "We checked the response for cookies.",
                    "The response set no cookies.",
                    "There are no cookie flags to check when no cookies are set.",
                    "No action needed.",
                    weight=0.5,
                )
            )

        return checks
