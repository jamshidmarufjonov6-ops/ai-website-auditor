"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import type { AuditListItem } from "@/lib/types";

export default function HistoryPage() {
  const { t } = useI18n();
  const [audits, setAudits] = useState<AuditListItem[] | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    api
      .listAudits()
      .then(setAudits)
      .catch((err) => setError(err instanceof Error ? err.message : ""));
  };

  useEffect(load, []);

  const remove = async (publicId: string) => {
    if (!window.confirm(t("historyDeleteConfirm"))) return;
    try {
      await api.deleteAudit(publicId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "");
    }
  };

  if (error) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <h1 className="text-xl font-bold">{t("historyTitle")}</h1>
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">{error}</p>
          <Link href="/login" className="btn-primary mt-6">{t("navLogin")}</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="container-page py-10 sm:py-16">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("historyTitle")}</h1>
          <p className="mt-2 text-ink-600 dark:text-ink-300">{t("historySubtitle")}</p>
        </div>
        <Link href="/dashboard" className="btn-secondary !py-2">{t("historyBackDashboard")}</Link>
      </div>

      {!audits ? (
        <div className="mt-10 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" aria-hidden="true" />
          <p className="mt-4 text-sm text-ink-500">{t("historyLoading")}</p>
        </div>
      ) : audits.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <h2 className="text-lg font-bold">{t("historyEmptyTitle")}</h2>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{t("historyEmptyText")}</p>
          <Link href="/" className="btn-primary mt-6">{t("historyRunFirst")}</Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {audits.map((audit) => (
            <div key={audit.public_id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/audit/${audit.public_id}`} className="truncate font-semibold hover:text-brand-600">
                  {audit.url.replace(/^https?:\/\//, "")}
                </Link>
                <p className="mt-1 text-sm text-ink-500">{new Date(audit.started_at).toLocaleString()}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {audit.partial && (
                    <span className="badge bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300">{t("historyPartial")}</span>
                  )}
                  {audit.status === "failed" && (
                    <span className="badge bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                      {t("historyFailed")}{audit.error_code ? ` · ${audit.error_code.replace(/_/g, " ")}` : ""}
                    </span>
                  )}
                  {audit.status === "queued" && <span className="badge bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">{t("historyQueued")}</span>}
                  {audit.status === "running" && <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">{t("historyRunning")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  {audit.overall_score !== null ? (
                    <p className="text-2xl font-extrabold tabular-nums">{audit.overall_score}<span className="text-sm font-semibold text-ink-400">/100</span></p>
                  ) : (
                    <p className="text-sm text-ink-500">{audit.status}</p>
                  )}
                  {audit.score_change !== null && audit.score_change !== undefined && (
                    <p className={`text-xs font-semibold ${audit.score_change >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {audit.score_change >= 0 ? "+" : ""}{audit.score_change} {t("historyPoints")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {audit.overall_score !== null && (
                    <Link href={`/report/${audit.public_id}`} className="btn-secondary !px-3 !py-1.5 text-xs">{t("historyReport")}</Link>
                  )}
                  <button onClick={() => remove(audit.public_id)} className="btn-secondary !px-3 !py-1.5 text-xs">
                    {t("historyDelete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
