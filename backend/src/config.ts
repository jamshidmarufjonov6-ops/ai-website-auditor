import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 8000),
  mongoUrl: process.env.MONGODB_URL || "mongodb://localhost:27017/auditor",
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
  accessTokenExpireMinutes: Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 60 * 24 * 7),
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  // Crawler limits
  maxPages: 5,
  maxCrawlDepth: 1,
  maxResponseBytes: 5 * 1024 * 1024,
  requestTimeoutSeconds: 15,
  userAgent: "AIWebsiteAuditor/2.0 (+https://localhost; compliance@example.com)",
  crawlerMaxConcurrency: 4,

  // Rate limiting (in-memory sliding window)
  rateLimitAuditPerHour: 20,
  rateLimitAuditPerMinute: 4,
  rateLimitAuthPerMinute: 10,
  maxConcurrentAudits: 2,

  // Usage limits (simple, no billing)
  monthlyAuditLimit: 3,
} as const;

export function corsOriginList(): string[] {
  return config.corsOrigins;
}
