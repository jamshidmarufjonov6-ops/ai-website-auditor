import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config.js";

let transporter: Transporter | null = null;

/**
 * Gmail SMTP forwarding is optional. It is enabled only when both
 * SMTP_USER (the Gmail address) and SMTP_PASS (a Google App Password)
 * are configured. Without them, messages are still stored in MongoDB
 * and visible in the admin panel — they are just not emailed.
 */
export function isMailConfigured(): boolean {
  return Boolean(config.smtpUser && config.smtpPass && config.adminEmail);
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }
  return transporter;
}

export interface ForwardPayload {
  name: string;
  email: string;
  subject: string;
  body: string;
  userId?: string | null;
  createdAt: Date;
}

/** Escape HTML special characters so user input can never inject markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Forward a contact message to the admin inbox. Returns true when the
 * email was handed to the SMTP server, false otherwise (with a reason).
 */
export async function forwardToAdmin(payload: ForwardPayload): Promise<{ sent: boolean; error?: string }> {
  if (!isMailConfigured()) {
    return { sent: false, error: "smtp_not_configured" };
  }

  const safeName = escapeHtml(payload.name);
  const safeBody = escapeHtml(payload.body).replace(/\n/g, "<br />");
  const safeEmail = escapeHtml(payload.email);

  try {
    await getTransporter().sendMail({
      from: `"AI Website Auditor" <${config.smtpUser}>`,
      to: config.adminEmail,
      replyTo: payload.email,
      subject: `[Contact] ${payload.subject}`.slice(0, 200),
      text:
        `New message from the AI Website Auditor contact form\n\n` +
        `From: ${payload.name} <${payload.email}>\n` +
        `User ID: ${payload.userId || "guest"}\n` +
        `Date: ${payload.createdAt.toISOString()}\n\n` +
        `${payload.body}\n`,
      html:
        `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">` +
        `<h2 style="color:#7c3aed;margin-bottom:4px;">New contact message</h2>` +
        `<p style="color:#6b7280;font-size:13px;margin-top:0;">AI Website Auditor contact form</p>` +
        `<table style="font-size:14px;color:#111827;margin:16px 0;">` +
        `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">From:</td><td>${safeName} &lt;${safeEmail}&gt;</td></tr>` +
        `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">User:</td><td>${escapeHtml(payload.userId || "guest")}</td></tr>` +
        `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date:</td><td>${payload.createdAt.toISOString()}</td></tr>` +
        `</table>` +
        `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:14px;line-height:1.6;color:#111827;">${safeBody}</div>` +
        `<p style="font-size:12px;color:#9ca3af;margin-top:16px;">Reply directly to this email to answer ${safeName}.</p>` +
        `</div>`,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_smtp_error";
    console.error("Failed to forward contact message:", message);
    return { sent: false, error: message.slice(0, 200) };
  }
}
