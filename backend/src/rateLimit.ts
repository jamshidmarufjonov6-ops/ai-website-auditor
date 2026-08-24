import type { Request } from "express";
import { config } from "./config.js";

class SlidingWindowLimiter {
  private events = new Map<string, number[]>();

  constructor(
    private maxRequests: number,
    private windowSeconds: number
  ) {}

  allow(key: string): boolean {
    const now = Date.now() / 1000;
    const cutoff = now - this.windowSeconds;
    const events = (this.events.get(key) || []).filter((t) => t > cutoff);
    if (events.length >= this.maxRequests) {
      this.events.set(key, events);
      return false;
    }
    events.push(now);
    this.events.set(key, events);
    return true;
  }

  reset(key: string): void {
    this.events.delete(key);
  }
}

export const auditPerHour = new SlidingWindowLimiter(config.rateLimitAuditPerHour, 3600);
export const auditPerMinute = new SlidingWindowLimiter(config.rateLimitAuditPerMinute, 60);
export const authPerMinute = new SlidingWindowLimiter(config.rateLimitAuthPerMinute, 60);
export const contactPerHour = new SlidingWindowLimiter(5, 3600);

export function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}
