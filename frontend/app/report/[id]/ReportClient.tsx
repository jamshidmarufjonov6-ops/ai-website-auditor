"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionPlan } from "@/components/ActionPlan";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ScoreRing } from "@/components/ScoreRing";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { Audit } from "@/lib/types";

export default function ReportClient({ publicId }: { publicId: string }) {
  const { t, tc } = useI18n();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getAudit(publicId)
      .then(setAudit)
      .catch((err) => setError(err instanceof Error ? err.message : t("reportUnavailable")));
  }, [publicId, t]);

  if (error) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <h1 className="text-xl font-bold">{t("reportUnavailable")}</h1>
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
        <p className="mt-4 text-sm text-ink-500">{t("reportLoading")}</p>
      </div>
    );
  }

  if (audit.status !== "completed") {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-xl font-bold">{t("reportNotFinished")}</h1>
        <Link href={`/audit/${audit.public_id}`} className="btn-primary mt-6">{t("reportBackToLive")}</Link>
      </div>
    );
  }

  const checks = audit.results?.checks || [];
  const failed = checks.filter((c) => c.status === "fail");
  const warnings = checks.filter((c) => c.status === "warning");
  const passed = checks.filter((c) => c.status === "pass");
  const criticalHigh = checks.filter((c) => c.priority === "CRITICAL" || c.priority === "HIGH");
  const categories = audit.category_scores || {};
  const actions = audit.ai_recommendations?.actions || [];
  const provider = audit.ai_recommendations?.provider || "rules-engine";
  const date = audit.completed_at ? new Date(audit.completed_at).toLocaleString() : "";
  const partial = audit.results?.partial ?? false;

  return (
    <main className="container-page py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between no-print">
        <Link href={`/audit/${audit.public_id}`} className="btn-secondary !py-2">{t("reportBackDashboard")}</Link>
        <button onClick={() => window.print()} className="btn-primary !py-2">{t("reportPrint")}</button>
      </div>

      <div className="card p-8">
        <header className="flex flex-col items-center justify-between gap-6 border-b border-ink-200 pb-6 sm:flex-row dark:border-ink-700">
          <div>
            <h1 className="text-2xl font-extrabold">{t("reportTitle")}</h1>
            <p className="mt-1 text-sm text-ink-500">{audit.url}</p>
            <p className="mt-1 text-sm text-ink-500">{t("auditAuditedOn")} {date}</p>
          </div>
          <ScoreRing score={audit.overall_score} label={t("exampleOverall")} size={140} />
        </header>

        {/* Executive summary */}
        <section className="mt-8 rounded-xl bg-brand-50 p-5 dark:bg-brand-950/40">
          <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">{t("reportSummary")}</h2>
          <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">
            {audit.summary?.overall_explanation || `${t("exampleOverall")} ${audit.overall_score}/100`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t("auditChecksPassed"), value: audit.summary?.passed ?? 0, cls: "text-green-700 dark:text-green-400" },
              { label: t("auditWarnings"), value: audit.summary?.warnings ?? 0, cls: "text-yellow-700 dark:text-yellow-400" },
              { label: t("auditCriticalHigh"), value: criticalHigh.length, cls: "text-red-700 dark:text-red-400" },
              { label: t("auditTotalChecks"), value: audit.summary?.total_checks ?? 0, cls: "text-ink-800 dark:text-ink-100" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-white/70 p-3 text-center dark:bg-ink-900/70">
                <p className={`text-2xl font-extrabold tabular-nums ${item.cls}`}>{item.value}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {partial && (
          <section className="mt-6 rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
            {t("reportPartialWarning")}
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-bold">{t("reportCategoryScores")}</h2>
          <p className="mt-1 text-sm text-ink-500">{t("reportCategoryHint")}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Object.entries(categories).map(([name, data]) => (
              <div key={name} className="rounded-xl border border-ink-200 p-4 dark:border-ink-700">
                <p className="text-sm font-semibold">{data.label}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{data.score}<span className="text-sm font-semibold text-ink-400">/100</span></p>
                <p className="mt-1 text-xs text-ink-500">{data.passed} {t("categoryPassed")} · {data.warnings} {t("categoryWarnings")} · {data.failed} {t("categoryFailed")}</p>
                <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">{data.explanation}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">{t("reportScoringTitle")}</h2>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{t("reportScoringFormula")}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">{t("reportImportantIssues")}</h2>
          {failed.length === 0 && warnings.length === 0 ? (
            <p className="mt-3 text-sm text-ink-600">{t("reportNoIssues")}</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {[...failed, ...warnings].map((c) => (
                <li key={c.id} className="rounded-xl border border-ink-200 p-4 dark:border-ink-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={c.priority} />
                    <h3 className="font-semibold">{tc(c.id, c.title)}</h3>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <p><span className="font-semibold">{t("reportWhatChecked")} </span>{c.what_was_checked || c.description}</p>
                    <p><span className="font-semibold">{t("reportActualResult")} </span>{c.actual_result || "—"}</p>
                    <p><span className="font-semibold">{t("reportWhyMatters")} </span>{c.why_it_matters || c.description}</p>
                    <p><span className="font-semibold">{t("reportHowFix")} </span>{c.how_to_fix || c.recommendation}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">{t("reportPassedChecks")}</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {passed.map((c) => (
              <li key={c.id} className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
                ✓ {tc(c.id, c.title)}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">{t("reportAiPlan")}</h2>
          <div className="mt-4">
            <ActionPlan actions={actions} provider={provider} />
          </div>
        </section>

        <footer className="mt-10 border-t border-ink-200 pt-4 text-xs text-ink-400 dark:border-ink-700">
          <p>{t("reportFooter")}</p>
        </footer>
      </div>
    </main>
  );
}
