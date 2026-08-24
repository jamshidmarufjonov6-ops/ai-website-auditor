"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import type { CheckResult } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";

type Filter = "all" | "critical" | "high" | "medium" | "low" | "passed";

export function IssueList({ checks }: { checks: CheckResult[] }) {
  const { t, tc } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: checks.length,
      critical: checks.filter((c) => c.priority === "CRITICAL").length,
      high: checks.filter((c) => c.priority === "HIGH").length,
      medium: checks.filter((c) => c.priority === "MEDIUM").length,
      low: checks.filter((c) => c.priority === "LOW").length,
      passed: checks.filter((c) => c.status === "pass").length,
    }),
    [checks]
  );

  const visible = checks.filter((c) => {
    if (filter === "critical") return c.priority === "CRITICAL";
    if (filter === "high") return c.priority === "HIGH";
    if (filter === "medium") return c.priority === "MEDIUM";
    if (filter === "low") return c.priority === "LOW";
    if (filter === "passed") return c.status === "pass";
    return true;
  });

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("issuesFilterAll"), count: counts.all },
    { key: "critical", label: t("issuesFilterCritical"), count: counts.critical },
    { key: "high", label: t("issuesFilterHigh"), count: counts.high },
    { key: "medium", label: t("issuesFilterMedium"), count: counts.medium },
    { key: "low", label: t("issuesFilterLow"), count: counts.low },
    { key: "passed", label: t("issuesFilterPassed"), count: counts.passed },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("issuesFilterAll")}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={filter === tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              filter === tab.key
                ? "bg-brand-600 text-white"
                : "border border-ink-300 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            }`}
          >
            {tab.label} <span className="opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {visible.length === 0 && (
          <p className="text-sm text-ink-500 dark:text-ink-400">{t("issuesEmpty")}</p>
        )}
        {visible.map((check) => (
          <details key={check.id} className="card group p-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={check.priority} />
                  <span className="text-xs font-medium text-ink-400 dark:text-ink-500">
                    {check.category.toUpperCase()} · {check.score}/100
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-semibold sm:text-base">{tc(check.id, check.title)}</h4>
              </div>
              <svg className="mt-1 h-4 w-4 shrink-0 text-ink-400 transition group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="font-semibold text-ink-700 dark:text-ink-200">{t("issuesWhatChecked")}</p>
                <p className="mt-1 text-ink-600 dark:text-ink-300">{check.what_was_checked || check.description}</p>
              </div>
              <div>
                <p className="font-semibold text-ink-700 dark:text-ink-200">{t("issuesActualResult")}</p>
                <p className="mt-1 text-ink-600 dark:text-ink-300">{check.actual_result || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-ink-700 dark:text-ink-200">{t("issuesWhyMatters")}</p>
                <p className="mt-1 text-ink-600 dark:text-ink-300">{check.why_it_matters || check.description}</p>
              </div>
              <div>
                <p className="font-semibold text-ink-700 dark:text-ink-200">{t("issuesHowFix")}</p>
                <p className="mt-1 rounded-lg bg-ink-50 p-3 text-ink-700 dark:bg-ink-800 dark:text-ink-200">{check.how_to_fix || check.recommendation}</p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
