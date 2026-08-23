"use client";

import { useState } from "react";
import { useI18n } from "@/i18n";
import type { CategoryScore } from "@/lib/types";

const colorFor = (score: number) =>
  score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";

const categoryLabelKey: Record<string, string> = {
  seo: "featureSeo",
  performance: "featurePerf",
  security: "featureSecurity",
  accessibility: "featureA11y",
  mobile: "featureMobile",
  technical: "featureTech",
};

export function CategoryCard({ name, data }: { name: string; data: CategoryScore }) {
  const { t, tc } = useI18n();
  const [open, setOpen] = useState(false);
  const labelKey = categoryLabelKey[name] || "";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-200">{labelKey ? t(labelKey) : data.label}</h3>
        <span className="text-2xl font-extrabold tabular-nums">{data.score}</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
        <div
          className={`h-full rounded-full ${colorFor(data.score)}`}
          style={{ width: `${data.score}%` }}
          role="progressbar"
          aria-valuenow={data.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${data.label} score ${data.score}`}
        />
      </div>
      <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
        {data.passed} {t("categoryPassed")} · {data.warnings} {t("categoryWarnings")} · {data.failed} {t("categoryFailed")}
      </p>

      <button
        onClick={() => setOpen(!open)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
        aria-expanded={open}
      >
        {open ? t("categoryHide") : t("categoryHowCalculated")}
        <svg className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-ink-100 pt-3 text-xs dark:border-ink-800">
          <p className="text-ink-600 dark:text-ink-300">{data.explanation}</p>
          <p className="text-ink-500 dark:text-ink-400">
            {t("categoryWeightedAvg")}: {data.weighted_average} · {t("categoryTotalWeight")}: {data.total_weight} · {t("categoryCategoryWeight")}: {Math.round(data.weight * 100)}%
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
            {data.checks.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-ink-600 dark:text-ink-300">{tc(c.id, c.title)}</span>
                <span className="shrink-0 tabular-nums text-ink-400">
                  {c.score}/100 × {c.weight} = {c.contribution} {t("categoryPoints")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
