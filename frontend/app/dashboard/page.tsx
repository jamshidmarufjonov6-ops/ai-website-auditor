"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UrlForm } from "@/components/UrlForm";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { DashboardStats, SubscriptionInfo } from "@/lib/types";

export default function DashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    api.getDashboardStats().then(setStats).catch((err) => setError(err instanceof Error ? err.message : ""));
    api.getSubscription().then(setSub).catch(() => setSub(null));
  };

  useEffect(load, []);

  const upgrade = async () => {
    setBillingBusy(true);
    setBillingError("");
    try {
      const res = await api.checkout();
      window.location.href = res.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : t("billingNotConfigured"));
      setBillingBusy(false);
    }
  };

  const manage = async () => {
    setBillingBusy(true);
    setBillingError("");
    try {
      const res = await api.portal();
      window.location.href = res.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : t("billingNotConfigured"));
      setBillingBusy(false);
    }
  };

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

  return (
    <main className="container-page py-10 sm:py-16">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("dashboardTitle")}</h1>
          <p className="mt-2 text-ink-600 dark:text-ink-300">{t("dashboardSubtitle")}</p>
        </div>
        <Link href="/history" className="btn-secondary !py-2">{t("dashboardViewHistory")}</Link>
      </div>

      {/* Audit CTA */}
      <section className="card mt-8 border-brand-200 bg-brand-50/50 p-6 dark:border-brand-900 dark:bg-brand-950/30 sm:p-8">
        <h2 className="text-lg font-bold">{t("dashboardAuditCta")}</h2>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{t("dashboardAuditCtaText")}</p>
        <div className="mt-4 max-w-xl">
          <UrlForm ctaLabel={t("urlAuditMyWebsite")} />
        </div>
      </section>

      {/* Billing */}
      {sub && (
        <section className="card mt-8 p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">{t("billingTitle")}</h2>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                {t("billingCurrentPlan")}: {sub.plan === "pro" ? t("billingPlanPro") : t("billingPlanFree")}
              </p>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                {t("billingStatus")}: {sub.status === "active" ? t("billingStatusActive") : sub.status === "past_due" ? t("billingStatusPastDue") : sub.status === "canceled" ? t("billingStatusCanceled") : sub.status}
              </p>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                {t("billingUsage")}: {t("billingUsedOf").replace("{used}", String(sub.usage.used)).replace("{limit}", String(sub.usage.limit))}
              </p>
              {sub.cancel_at_period_end && sub.current_period_end && (
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  {t("billingCancelAtPeriodEnd").replace("{date}", new Date(sub.current_period_end).toLocaleDateString())}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {sub.plan === "free" ? (
                <button onClick={upgrade} disabled={billingBusy} className="btn-primary">
                  {billingBusy ? t("urlStarting") : t("billingUpgrade")}
                </button>
              ) : (
                <button onClick={manage} disabled={billingBusy} className="btn-secondary">
                  {billingBusy ? t("urlStarting") : t("billingManage")}
                </button>
              )}
              {!sub.payments_configured && (
                <p className="text-xs text-ink-500">{t("billingNotConfigured")}</p>
              )}
            </div>
          </div>
          {billingError && (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200" role="alert">
              {billingError}
            </p>
          )}
        </section>
      )}

      {!stats ? (
        <div className="mt-10 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" aria-hidden="true" />
          <p className="mt-4 text-sm text-ink-500">{t("dashboardLoading")}</p>
        </div>
      ) : stats.total_audits === 0 ? (
        <div className="card mt-10 p-10 text-center">
          <h2 className="text-xl font-bold">{t("dashboardEmptyTitle")}</h2>
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">{t("dashboardEmptyText")}</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t("dashboardStatTotal"), value: stats.total_audits },
              { label: t("dashboardStatCompleted"), value: stats.completed_audits },
              { label: t("dashboardStatAverage"), value: stats.average_score !== null ? `${stats.average_score}/100` : "—" },
              { label: t("dashboardStatBest"), value: stats.best_score !== null ? `${stats.best_score}/100` : "—" },
            ].map((item) => (
              <div key={item.label} className="card p-5 text-center">
                <p className="text-3xl font-extrabold tabular-nums">{item.value}</p>
                <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{item.label}</p>
              </div>
            ))}
          </section>

          {/* Recent audits */}
          <section className="mt-10">
            <h2 className="text-lg font-bold">{t("dashboardRecent")}</h2>
            <div className="mt-4 space-y-3">
              {stats.recent_audits.map((audit) => (
                <div key={audit.public_id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/audit/${audit.public_id}`} className="truncate font-semibold hover:text-brand-600">
                      {audit.url.replace(/^https?:\/\//, "")}
                    </Link>
                    <p className="mt-1 text-sm text-ink-500">
                      {new Date(audit.started_at).toLocaleString()}
                      {audit.partial ? ` · ${t("dashboardPartial")}` : ""}
                      {audit.status === "failed" ? ` · ${t("dashboardFailed")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {audit.overall_score !== null ? (
                      <p className="text-2xl font-extrabold tabular-nums">{audit.overall_score}<span className="text-sm font-semibold text-ink-400">/100</span></p>
                    ) : (
                      <p className="text-sm text-ink-500">{audit.status}</p>
                    )}
                    <Link href={`/report/${audit.public_id}`} className="btn-secondary !px-3 !py-1.5 text-xs">{t("dashboardReport")}</Link>
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
