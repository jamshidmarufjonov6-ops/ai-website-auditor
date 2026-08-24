"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UrlForm } from "@/components/UrlForm";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { CreditsInfo, DashboardStats } from "@/lib/types";

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

function StatIcon({ name }: { name: "total" | "done" | "avg" | "best" }) {
  const paths: Record<string, React.ReactNode> = {
    total: <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm4 3v9m4-5v5m4-8v8" strokeLinecap="round" />,
    done: <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />,
    avg: <path d="M12 4v16M6 9v11M18 13v7" strokeLinecap="round" />,
    best: <path d="M12 3l2.7 5.6 6.3.9-4.5 4.3 1 6.2-5.5-3-5.5 3 1-6.2L3 9.5l6.3-.9L12 3Z" strokeLinejoin="round" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      {paths[name]}
    </svg>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [creditsInfo, setCreditsInfo] = useState<CreditsInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch((err) => setError(err instanceof Error ? err.message : ""));
    api.getCredits().then(setCreditsInfo).catch(() => setCreditsInfo(null));
  }, []);

  if (error) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <h1 className="text-xl font-bold">{t("dashboardDashboardUnavailable")}</h1>
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">{error}</p>
          <Link href="/login" className="btn-primary mt-6">{t("dashboardLogin")}</Link>
        </div>
      </div>
    );
  }

  const credits = creditsInfo?.credits ?? null;
  const packSize = creditsInfo?.pack?.size ?? 10;
  const creditPct = credits === null ? null : Math.max(4, Math.min(100, Math.round((credits / packSize) * 100)));

  return (
    <main className="container-page py-10 sm:py-14">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">{t("dashboardEyebrow")}</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
            {t("dashboardWelcome")} <span className="text-gradient">👋</span>
          </h1>
          <p className="mt-2 max-w-xl text-ink-600 dark:text-ink-300">{t("dashboardSubtitle")}</p>
        </div>
        <Link href="/history" className="btn-secondary shrink-0 !py-2.5">{t("dashboardViewHistory")}</Link>
      </div>

      {/* ---------- Top row: Audit CTA + Credits widget ---------- */}
      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        {/* Audit CTA */}
        <div className="glow-border lg:col-span-2">
          <div className="rounded-[calc(1.25rem-1px)] bg-white/95 p-6 backdrop-blur-xl dark:bg-ink-900/85 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500/15 to-cyan-400/15 ring-1 ring-inset ring-accent-500/25">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-accent-600 dark:text-accent-300">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5M11 8v6M8 11h6" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <h2 className="font-bold leading-tight">{t("dashboardAuditCta")}</h2>
                <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{t("dashboardAuditCtaText")}</p>
              </div>
            </div>
            <div className="mt-5">
              <UrlForm ctaLabel={t("urlAuditMyWebsite")} />
            </div>
          </div>
        </div>

        {/* Credits widget */}
        <div className="card card-hover relative overflow-hidden !p-0">
          <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-gradient-to-br from-accent-500/25 via-brand-500/20 to-cyan-400/15 blur-2xl animate-pulse-slow" />
          <div className="relative p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t("creditsWidgetTitle")}</p>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-400/10 ring-1 ring-inset ring-amber-500/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-amber-500">
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinejoin="round" />
                </svg>
              </span>
            </div>

            <p className="mt-3 flex items-baseline gap-1">
              <span className="bg-gradient-to-r from-accent-400 via-brand-400 to-cyan-300 bg-clip-text text-5xl font-extrabold tabular-nums text-transparent">
                {credits ?? "…"}
              </span>
              <span className="text-sm font-semibold text-ink-400">{credits === 1 ? t("creditSingular") : t("creditPlural")}</span>
            </p>

            {/* Progress toward a pack */}
            {creditPct !== null ? (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.07]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      credits !== null && (credits === 0 || credits <= 2)
                        ? "bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300"
                        : "bg-gradient-to-r from-accent-500 via-brand-500 to-cyan-400"
                    }`}
                    style={{ width: `${creditPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                  {t("dashboardPackNote").replace("{count}", String(packSize))}
                </p>
              </div>
            ) : null}

            {credits !== null && credits === 0 ? (
              <Link href="/credits" className="btn-primary mt-5 w-full !py-2.5">
                {t("dashboardBuyCredits")}
              </Link>
            ) : credits !== null && credits <= 2 ? (
              <Link href="/credits" className="btn-secondary mt-5 w-full !py-2.5 !text-xs">
                {t("dashboardTopUp")}
              </Link>
            ) : (
              <Link href="/credits" className="btn-ghost mt-5 w-full !justify-center !text-xs">
                {t("navCredits")} →
              </Link>
            )}
          </div>
        </div>
      </section>

      {!stats ? (
        <div className="mt-14 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" aria-hidden="true" />
          <p className="mt-4 text-sm text-ink-500">{t("dashboardLoading")}</p>
        </div>
      ) : stats.total_audits === 0 ? (
        <div className="glass mt-10 p-12 text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500/15 to-cyan-400/15 ring-1 ring-inset ring-accent-500/25">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7 text-accent-600 dark:text-accent-300">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinejoin="round" />
            </svg>
          </span>
          <h2 className="mt-5 text-xl font-bold">{t("dashboardEmptyTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600 dark:text-ink-300">{t("dashboardEmptyText")}</p>
        </div>
      ) : (
        <>
          {/* ---------- Stats ---------- */}
          <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: "total", label: t("dashboardStatTotal"), value: String(stats.total_audits) },
              { icon: "done", label: t("dashboardStatCompleted"), value: String(stats.completed_audits) },
              { icon: "avg", label: t("dashboardStatAverage"), value: stats.average_score !== null ? `${stats.average_score}` : "—" },
              { icon: "best", label: t("dashboardStatBest"), value: stats.best_score !== null ? `${stats.best_score}` : "—" },
            ].map((item) => (
              <div key={item.label} className="card card-hover p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500/15 to-brand-500/10 ring-1 ring-inset ring-accent-500/20 text-accent-600 dark:text-accent-300">
                    <StatIcon name={item.icon as "total"} />
                  </span>
                  <p className="truncate text-xs font-medium uppercase tracking-wider text-ink-400">{item.label}</p>
                </div>
                <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight">
                  {item.value}
                  {(item.icon === "avg" || item.icon === "best") && item.value !== "—" ? (
                    <span className="ml-1 text-sm font-semibold text-ink-400">/100</span>
                  ) : null}
                </p>
              </div>
            ))}
          </section>

          {/* ---------- Recent audits ---------- */}
          <section className="mt-12">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("dashboardRecent")}</h2>
              <Link href="/history" className="btn-ghost !text-xs">{t("dashboardViewHistory")} →</Link>
            </div>
            <div className="mt-4 space-y-3">
              {stats.recent_audits.map((audit) => (
                <div key={audit.public_id} className="card group flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand-300/60 dark:hover:border-accent-500/30 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/audit/${audit.public_id}`} className="block truncate font-semibold transition group-hover:text-brand-600 dark:group-hover:text-accent-300">
                      {audit.url.replace(/^https?:\/\//, "")}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                      <span>{new Date(audit.started_at).toLocaleString()}</span>
                      {audit.partial ? (
                        <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{t("dashboardPartial")}</span>
                      ) : null}
                      {audit.status === "failed" ? (
                        <span className="badge bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">{t("dashboardFailed")}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {audit.overall_score !== null ? (
                      <p className={`text-2xl font-extrabold tabular-nums ${scoreTone(audit.overall_score)}`}>
                        {audit.overall_score}
                        <span className="text-sm font-semibold text-ink-400">/100</span>
                      </p>
                    ) : (
                      <p className="text-sm capitalize text-ink-500">{audit.status}</p>
                    )}
                    <Link href={`/report/${audit.public_id}`} className="btn-secondary !px-3 !py-1.5 !text-xs">{t("dashboardReport")}</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
