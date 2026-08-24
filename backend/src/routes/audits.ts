import { Router } from "express";
import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { collections, toId, type AuditDoc } from "../db.js";
import { asyncHandler, optionalAuth, requiredAuth, type AuthRequest } from "../middleware/auth.js";
import { auditPerHour, auditPerMinute, clientKey } from "../rateLimit.js";
import { enqueueAudit } from "../queue.js";
import { URLValidationError, validateUrl } from "../services/crawler/urlValidator.js";

export const auditsRouter = Router();

function serializeAudit(audit: AuditDoc, previousScore?: number | null) {
  const scoreChange =
    audit.overallScore != null && previousScore != null ? audit.overallScore - previousScore : null;
  return {
    public_id: audit.publicId,
    url: audit.url,
    status: audit.status,
    progress: audit.progress,
    stage: audit.stage,
    max_pages: audit.maxPages,
    language: audit.language,
    overall_score: audit.overallScore ?? null,
    category_scores: audit.categoryScores ?? null,
    summary: audit.summary ?? null,
    results: audit.results ?? null,
    ai_recommendations: audit.aiRecommendations ?? null,
    error_message: audit.errorMessage ?? null,
    error_code: audit.errorCode ?? null,
    started_at: audit.startedAt,
    completed_at: audit.completedAt ?? null,
    previous_score: previousScore ?? null,
    score_change: scoreChange,
  };
}

async function getPreviousScore(audit: AuditDoc): Promise<number | null> {
  if (!audit.websiteId) return null;
  const prev = await collections()
    .audits.find({
      websiteId: audit.websiteId,
      _id: { $ne: audit._id },
      status: "completed",
      overallScore: { $ne: null },
    })
    .sort({ completedAt: -1 })
    .limit(1)
    .next();
  return prev?.overallScore ?? null;
}

async function getAuditForAccess(publicId: string, userId: string | null | undefined) {
  const audit = await collections().audits.findOne({ publicId });
  if (!audit) return { error: { status: 404, message: "Audit not found." } };
  if (audit.userId && (!userId || audit.userId.toString() !== userId)) {
    return { error: { status: 403, message: "You do not have access to this audit." } };
  }
  return { audit };
}

auditsRouter.use(optionalAuth);

auditsRouter.post(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const key = clientKey(req);
    if (!auditPerMinute.allow(key)) {
      res.status(429).json({ detail: "You are starting audits too quickly. Please wait a moment." });
      return;
    }
    if (!auditPerHour.allow(key)) {
      res.status(429).json({ detail: "You have reached the hourly audit limit. Please try again later." });
      return;
    }

    const { url: rawUrl, language } = req.body || {};
    const lang = String(language || "en").trim().toLowerCase();
    if (!["en", "uz", "ru"].includes(lang)) {
      res.status(422).json({ detail: "Unsupported language." });
      return;
    }
    let validatedUrl: string;
    try {
      const validated = await validateUrl(String(rawUrl || ""));
      validatedUrl = validated.url;
    } catch (err) {
      if (err instanceof URLValidationError) {
        res.status(422).json({ detail: err.safeMessage });
        return;
      }
      throw err;
    }

    let maxPages = config.maxPages;
    if (req.user) {
      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);
      const used = await collections().audits.countDocuments({
        userId: req.user._id,
        startedAt: { $gte: startOfMonth },
      });
      if (used >= config.monthlyAuditLimit) {
        res.status(403).json({
          detail: {
            code: "monthly_limit_reached",
            message: "You have reached your monthly audit limit.",
          },
        });
        return;
      }
    }

    const audit: AuditDoc = {
      _id: new ObjectId(),
      publicId: randomUUID(),
      userId: req.user?._id ?? null,
      websiteId: null,
      url: validatedUrl,
      status: "queued",
      progress: 0,
      stage: "Queued",
      maxPages,
      language: lang,
      overallScore: null,
      categoryScores: null,
      summary: null,
      results: null,
      aiRecommendations: null,
      errorMessage: null,
      errorCode: null,
      startedAt: new Date(),
      completedAt: null,
    };
    await collections().audits.insertOne(audit);

    if (!enqueueAudit(audit._id.toString())) {
      await collections().audits.updateOne(
        { _id: audit._id },
        {
          $set: {
            status: "failed",
            errorMessage: "Our auditors are busy right now. Please try again in a moment.",
            errorCode: "crawl_failed",
          },
        }
      );
      audit.status = "failed";
      audit.errorMessage = "Our auditors are busy right now. Please try again in a moment.";
      audit.errorCode = "crawl_failed";
    }

    res.status(201).json(serializeAudit(audit));
  })
);

auditsRouter.get(
  "/",
  requiredAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const audits = await collections()
      .audits.find({ userId: req.user!._id })
      .sort({ startedAt: -1 })
      .limit(100)
      .toArray();
    const items = [];
    for (const audit of audits) {
      const previous = await getPreviousScore(audit);
      items.push({
        public_id: audit.publicId,
        url: audit.url,
        status: audit.status,
        overall_score: audit.overallScore ?? null,
        started_at: audit.startedAt,
        score_change:
          audit.overallScore != null && previous != null ? audit.overallScore - previous : null,
        partial: Boolean(audit.results && (audit.results as { partial?: boolean }).partial),
        error_code: audit.errorCode ?? null,
        error_message: audit.errorMessage ?? null,
      });
    }
    res.json(items);
  })
);

auditsRouter.get(
  "/stats",
  requiredAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const audits = await collections()
      .audits.find({ userId: req.user!._id })
      .toArray();
    const completed = audits.filter((a) => a.status === "completed" && a.overallScore != null);
    const scores = completed.map((a) => a.overallScore as number);
    const recent = [...audits].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, 5);
    res.json({
      total_audits: audits.length,
      completed_audits: completed.length,
      average_score: scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null,
      best_score: scores.length ? Math.max(...scores) : null,
      recent_audits: recent.map((a) => ({
        public_id: a.publicId,
        url: a.url,
        status: a.status,
        overall_score: a.overallScore ?? null,
        started_at: a.startedAt,
        partial: Boolean(a.results && (a.results as { partial?: boolean }).partial),
        error_code: a.errorCode ?? null,
      })),
    });
  })
);

auditsRouter.get(
  "/:publicId",
  asyncHandler(async (req: AuthRequest, res) => {
    const { audit, error } = await getAuditForAccess(req.params.publicId, req.userId);
    if (error || !audit) {
      res.status(error?.status || 404).json({ detail: error?.message || "Audit not found." });
      return;
    }
    res.json(serializeAudit(audit, await getPreviousScore(audit)));
  })
);

auditsRouter.get(
  "/:publicId/report",
  asyncHandler(async (req: AuthRequest, res) => {
    const { audit, error } = await getAuditForAccess(req.params.publicId, req.userId);
    if (error || !audit) {
      res.status(error?.status || 404).json({ detail: error?.message || "Audit not found." });
      return;
    }
    if (audit.status !== "completed") {
      res.status(409).json({ detail: "This audit has not finished yet." });
      return;
    }
    res.json(serializeAudit(audit, await getPreviousScore(audit)));
  })
);

auditsRouter.delete(
  "/:publicId",
  requiredAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { audit, error } = await getAuditForAccess(req.params.publicId, req.userId);
    if (error || !audit) {
      res.status(error?.status || 404).json({ detail: error?.message || "Audit not found." });
      return;
    }
    if (!audit.userId || audit.userId.toString() !== req.userId) {
      res.status(403).json({ detail: "You can only delete your own audits." });
      return;
    }
    await collections().audits.deleteOne({ _id: audit._id });
    res.json({ ok: true });
  })
);
