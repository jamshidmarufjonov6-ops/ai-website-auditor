import { ObjectId } from "mongodb";
import { collections, getDb, toId, type AuditDoc } from "../db.js";
import type { CheckResult } from "../types.js";
import { AccessibilityAnalyzer } from "./analyzers/accessibility.js";
import { BaseAnalyzer } from "./analyzers/base.js";
import { MobileAnalyzer } from "./analyzers/mobile.js";
import { PerformanceAnalyzer } from "./analyzers/performance.js";
import { SecurityAnalyzer } from "./analyzers/security.js";
import { SEOAnalyzer } from "./analyzers/seo.js";
import { TechnicalAnalyzer } from "./analyzers/technical.js";
import { crawl } from "./crawler/crawler.js";
import { FetchError } from "./crawler/fetcher.js";
import { getDomain, URLValidationError } from "./crawler/urlValidator.js";
import { generateRecommendations } from "./rulesEngine.js";
import { CATEGORY_LABELS, computeScores, summarize } from "./scoring.js";

const ANALYZERS: BaseAnalyzer[] = [
  new SEOAnalyzer(),
  new SecurityAnalyzer(),
  new PerformanceAnalyzer(),
  new AccessibilityAnalyzer(),
  new MobileAnalyzer(),
  new TechnicalAnalyzer(),
];

const FETCH_ERROR_CODES: Record<string, string> = {
  timeout: "timeout",
  ssl_error: "ssl_error",
  connection_error: "connection_error",
  too_large: "page_too_large",
  http_5xx: "server_error",
  unsafe_redirect: "unsafe_redirect",
  too_many_redirects: "too_many_redirects",
  request_error: "request_error",
  fetch_error: "fetch_error",
};

function errorCodeFromException(exc: unknown): string {
  if (exc instanceof URLValidationError) return "invalid_url";
  if (exc instanceof FetchError) return FETCH_ERROR_CODES[exc.kind] || "fetch_error";
  return "internal_error";
}

async function stage(auditId: ObjectId, progress: number, stageText: string): Promise<void> {
  await collections().audits.updateOne({ _id: auditId }, { $set: { progress, stage: stageText } });
}

export async function runAudit(auditId: string | ObjectId): Promise<void> {
  const db = getDb();
  const id = toId(auditId);
  const audits = collections().audits;
  const websites = collections().websites;

  const audit = await audits.findOne({ _id: id });
  if (!audit) return;

  await audits.updateOne({ _id: id }, { $set: { status: "running", progress: 5, stage: "Validating URL" } });

  try {
    // 1. Validate URL (fail fast with a safe message)
    await stage(id, 6, "Validating URL");
    let domain: string;
    try {
      const { validateUrl } = await import("./crawler/urlValidator.js");
      const validated = await validateUrl(audit.url);
      domain = getDomain(validated.url);
    } catch (err) {
      if (err instanceof URLValidationError) {
        await failAudit(id, err.safeMessage, "invalid_url");
        return;
      }
      throw err;
    }

    // 2. Crawl
    const progressCb = (progress: number, stageText: string) => {
      void stage(id, progress, stageText);
    };
    let ctx;
    try {
      ctx = await crawl(audit.url, progressCb, audit.maxPages || undefined);
    } catch (err) {
      if (err instanceof FetchError) {
        await failAudit(id, err.safeMessage, errorCodeFromException(err));
        return;
      }
      console.error("Crawl failed for audit", auditId, err);
      await failAudit(id, "We could not analyze this website. It may be blocking automated audits.", "crawl_failed");
      return;
    }

    // 3. Analyze
    await stage(id, 68, "Running SEO checks");
    const allChecks: CheckResult[] = [];
    const analyzerErrors: string[] = [];
    for (const analyzer of ANALYZERS) {
      const index = ANALYZERS.indexOf(analyzer);
      await stage(id, Math.min(70 + 4 * index, 86), `Analyzing ${CATEGORY_LABELS[analyzer.category] || analyzer.category}`);
      try {
        const checks = await analyzer.analyze(ctx);
        allChecks.push(...checks);
      } catch (err) {
        console.error("Analyzer failed", analyzer.category, err);
        analyzerErrors.push(analyzer.category);
      }
    }

    // 4. Score
    await stage(id, 88, "Calculating scores");
    const scores = computeScores(allChecks);
    const summary = summarize(allChecks) as Record<string, unknown>;
    summary["methodology"] = scores.methodology;
    summary["overall_explanation"] = scores.overall_explanation;

    // 5. Rules engine recommendations (always available, no external services)
    await stage(id, 92, "Generating recommendations");
    const actions = generateRecommendations(allChecks, audit.language || "en");

    // 6. Persist
    await stage(id, 96, "Saving results");
    const partial = Boolean(analyzerErrors.length || ctx.fetchErrors.length);
    const results = {
      checks: allChecks,
      pages_crawled: ctx.pages.length,
      crawl_limited: ctx.crawlLimited,
      broken_links: ctx.brokenLinks,
      fetch_errors: ctx.fetchErrors,
      analyzer_errors: analyzerErrors,
      partial,
    };

    // Website bookkeeping
    let website = await websites.findOne({ domain });
    if (!website) {
      const inserted = await websites.insertOne({
        _id: new ObjectId(),
        domain,
        firstSeenAt: new Date(),
        lastAuditedAt: new Date(),
      });
      website = { _id: inserted.insertedId, domain, firstSeenAt: new Date(), lastAuditedAt: new Date() };
    } else {
      await websites.updateOne({ _id: website._id }, { $set: { lastAuditedAt: new Date() } });
    }

    await audits.updateOne(
      { _id: id },
      {
        $set: {
          websiteId: website._id,
          overallScore: scores.overall_score,
          categoryScores: scores.category_scores,
          summary,
          results,
          aiRecommendations: { provider: "rules-engine", actions },
          status: "completed",
          progress: 100,
          stage: "Complete",
          completedAt: new Date(),
          errorMessage: null,
          errorCode: null,
        },
      }
    );
  } catch (err) {
    console.error("Audit failed unexpectedly", auditId, err);
    try {
      const current = await audits.findOne({ _id: id });
      if (current && current.status !== "failed") {
        await audits.updateOne(
          { _id: id },
          {
            $set: {
              status: "failed",
              errorCode: "internal_error",
              errorMessage: "Something went wrong during the audit. Please try again.",
              completedAt: new Date(),
            },
          }
        );
      }
    } catch (innerErr) {
      console.error("Could not mark audit as failed", auditId, innerErr);
    }
  }
}

async function failAudit(auditId: ObjectId, message: string, errorCode: string): Promise<void> {
  await collections().audits.updateOne(
    { _id: auditId },
    {
      $set: {
        status: "failed",
        errorMessage: message,
        errorCode,
        completedAt: new Date(),
      },
    }
  );
}
