"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ActionPlan } from "@/components/ActionPlan";
import { CategoryCard } from "@/components/CategoryCard";
import { IssueList } from "@/components/IssueList";
import { ScoreRing } from "@/components/ScoreRing";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { Audit } from "@/lib/types";

const PROGRESS_STEPS: { threshold: number; key: string }[] = [
  { threshold: 0, key: "stepValidating" },
  { threshold: 2, key: "stepConnecting" },
  { threshold: 8, key: "stepFetching" },
  { threshold: 16, key: "stepRobots" },
  { threshold: 24, key: "stepSitemap" },
  { threshold: 32, key: "stepCrawling" },
  { threshold: 60, key: "stepLinks" },
  { threshold: 68, key: "stepAnalyzing" },
  { threshold: 88, key: "stepScoring" },
  { threshold: 92, key: "stepRecommendations" },
  { threshold: 96, key: "stepSaving" },
];

const ERROR_HINT_KEYS: Record<string, string> = {
  invalid_url: "errInvalidUrl",
  timeout: "errTimeout",
  ssl_error: "errSsl",
  connection_error: "errConnection",
  page_too_large: "errPageTooLarge",
  server_error: "errServerError",
  unsafe_redirect: "errUnsafeRedirect",
  too_many_redirects: "errTooManyRedirects",
  request_error: "errRequestError",
  crawl_failed: "errCrawlFailed",
};

function ErrorHint({ code, t }: { code: string | null; t: (k: string) => string }) {
  const key = (code && ERROR_HINT_KEYS[code]) || "errDefault";
  return <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{t(key)}</p>;
}

export default function AuditDashboard({
  publicId,
  fetchAudit,
  isPublic = false,
}: {
  publicId: string;
  fetchAudit?: (publicId: string) => Promise<Audit>;
  isPublic?: boolean;
}) {
  const { t } = useI18n();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const getAudit = fetchAudit || api.getAudit;
        const data = await getAudit(publicId);
        if (!active) return;
        setAudit(data);
        if (data.status === "completed" || data.status === "failed") {
          if (timer.current) clearInterval(timer.current);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : t("auditUnavailable"));
        if (timer.current) clearInterval(timer.current);
      }
    };
    poll();
    timer.current = setInterval(poll, 2000);
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [publicId, t]);

  const copyLink = async () => {
    try {
      const shareUrl = audit?.share_id
        ? `${window.location.origin}/share/${audit.share_id}`
        : window.location.href;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  if (error) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <h1 className="text-xl font-bold">{t("auditUnavailable")}</h1>
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">{error}</p>
          <Link href="/" className="btn-primary mt-6">{t("historyRunFirst")}</Link>
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="container-page py-16 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" aria-hidden="true" />
        <p className="mt-4 text-sm text-ink-500">{t("auditLoading")}</p>
      </div>
    );
  }

  if (audit.status === "queued" || audit.status === "running") {
    const activeStep = PROGRESS_STEPS.reduce(
      (acc, step) => (audit.progress >= step.threshold ? step : acc),
      PROGRESS_STEPS[0]
    );
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-xl p-8">
          <h1 className="text-lg font-bold">{t("auditAuditing")} {audit.url}</h1>
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{audit.stage}</span>
              <span className="tabular-nums text-ink-500">{audit.progress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-500"
                style={{ width: `${audit.progress}%` }}
                role="progressbar"
                aria-valuenow={audit.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
          <ol className="mt-6 space-y-2">
            {PROGRESS_STEPS.map((step) => {
              const done = audit.progress >= step.threshold;
              const current = step.key === activeStep.key && !done && audit.progress < 100;
              return (
                <li key={step.key} className={`flex items-center gap-2 text-sm ${done ? "text-green-600 dark:text-green-400" : current ? "font-semibold text-ink-800 dark:text-ink-100" : "text-ink-400 dark:text-ink-500"}`}>
                  {done ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 13 4 4L19 7" /></svg>
                  ) : current ? (
                    <span className="h-4 w-4 animate-pulse rounded-full border-2 border-brand-500" aria-hidden="true" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-ink-300 dark:border-ink-600" aria-hidden="true" />
                  )}
                  {t(step.key)}
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-sm text-ink-500 dark:text-ink-400">{t("auditProgressNote")}</p>
        </div>
      </div>
    );
  }

  if (audit.status === "failed") {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <h1 className="text-xl font-bold">{t("auditFailedTitle")}</h1>
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">{audit.error_message || t("auditFailedGeneric")}</p>
          <ErrorHint code={audit.error_code} t={t} />
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/" className="btn-primary">{t("auditTryAnother")}</Link>
            <button onClick={() => window.location.reload()} className="btn-secondary">{t("auditRetry")}</button>
          </div>
        </div>
      </div>
    );
  }

  const categories = audit.category_scores || {};
  const checks = audit.results?.checks || [];
  const actions = audit.ai_recommendations?.actions || [];
  const provider = audit.ai_recommendations?.provider || "rules-engine";
  const date = audit.completed_at ? new Date(audit.completed_at).toLocaleString() : "";
  const partial = audit.results?.partial ?? false;

  return (
    <main className="container-page py-8 sm:py-12">
      {/* Header */}
      <section className="card p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="min-w-0 text-center md:text-left">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{audit.url.replace(/^https?:\/\//, "")}</h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t("auditAuditedOn")} {date}</p>
            {audit.score_change !== null && (
              <p className={`mt-1 text-sm font-semibold ${audit.score_change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {audit.score_change >= 0 ? "+" : ""}
                {audit.score_change} {t("auditPointsChange")}
              </p>
            )}
          </div>
          <ScoreRing score={audit.overall_score} label={t("exampleOverall")} />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start no-print">
          <button onClick={copyLink} className="btn-secondary !py-2">
            {copied ? t("auditLinkCopied") : t("auditShareLink")}
          </button>
          {!isPublic && (
            <Link href={`/report/${audit.public_id}`} className="btn-primary !py-2">
              {t("auditViewReport")}
            </Link>
          )}
        </div>
      </section>

      {/* Executive summary */}
      <section className="mt-6">
        <div className="card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-400 dark:text-ink-500">{t("auditExecSummary")}</h2>
          <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">
            {audit.summary?.overall_explanation || `${t("exampleOverall")} ${audit.overall_score}/100`}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            {[
              { label: t("auditChecksPassed"), value: audit.summary?.passed ?? 0, cls: "text-green-600 dark:text-green-400" },
              { label: t("auditWarnings"), value: audit.summary?.warnings ?? 0, cls: "text-yellow-600 dark:text-yellow-400" },
              { label: t("auditCriticalHigh"), value: checks.filter((c) => c.priority === "CRITICAL" || c.priority === "HIGH").length, cls: "text-red-600 dark:text-red-400" },
              { label: t("auditTotalChecks"), value: audit.summary?.total_checks ?? 0, cls: "text-ink-800 dark:text-ink-100" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-ink-50 p-3 text-center dark:bg-ink-800">
                <p className={`text-2xl font-extrabold tabular-nums ${item.cls}`}>{item.value}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partial results notice */}
      {partial && (
        <section className="mt-6">
          <div className="card border-yellow-300 p-5 dark:border-yellow-800" role="status">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">{t("auditPartialTitle")}</p>
            <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-200/80">
              {t("auditPartialText")}
              {audit.results?.fetch_errors?.length ? ` ${audit.results.fetch_errors.length} page(s).` : ""}
            </p>
          </div>
        </section>
      )}

      {/* Category cards */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t("auditCategoryScores")}</h2>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t("auditCategoryHint")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(categories).map(([name, data]) => (
            <CategoryCard key={name} name={name} data={data} />
          ))}
        </div>
      </section>

      {/* Scoring methodology */}
      {audit.summary?.methodology && (
        <section className="mt-8">
          <div className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-400 dark:text-ink-500">{t("auditScoringMethod")}</h2>
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{audit.summary.methodology.formula}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(audit.summary.methodology.category_weights).map(([key, weight]) => (
                <span key={key} className="badge border border-ink-200 bg-ink-50 text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200">
                  {audit.summary?.methodology?.category_labels?.[key] || key}: {Math.round(weight * 100)}%
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AI Action Plan */}
      <section className="mt-12">
        <h2 className="text-lg font-bold">{t("auditAiPlan")}</h2>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          {t("auditAiPlanSub").replace("{count}", String(actions.length))}
        </p>
        <div className="mt-4">
          <ActionPlan actions={actions} provider={provider} />
        </div>
      </section>

      {/* Issue list */}
      <section className="mt-12">
        <h2 className="text-lg font-bold">{t("auditAllChecks")}</h2>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          {t("auditAllChecksSub").replace("{count}", String(checks.length)).replace("{pages}", String(audit.results?.pages_crawled ?? 1))}
        </p>
        <div className="mt-4">
          <IssueList checks={checks} />
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-ink-400">{t("auditFooterNote")}</p>
    </main>
  );
}
