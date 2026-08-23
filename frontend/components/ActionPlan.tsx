"use client";

import { useI18n } from "@/i18n";
import type { AIAction } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";

const difficultyKey: Record<string, string> = {
  EASY: "difficultyEasy",
  MEDIUM: "difficultyMedium",
  HARD: "difficultyHard",
};

const difficultyClasses: Record<string, string> = {
  EASY: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300",
  HARD: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
};

export function ActionPlan({ actions, provider }: { actions: AIAction[]; provider: string }) {
  const { t, tc } = useI18n();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-500 dark:text-ink-400">
          {provider === "rules-engine" ? t("actionPlanGeneratedByRules") : t("actionPlanGeneratedByAI").replace("{provider}", provider)}
        </p>
      </div>
      <ol className="space-y-4">
        {actions.map((action, i) => {
          const difficulty = difficultyClasses[action.difficulty] || difficultyClasses.MEDIUM;
          const diffKey = difficultyKey[action.difficulty] || "difficultyMedium";
          const checkId = (action as AIAction & { check_id?: string }).check_id;
          return (
            <li key={i} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h4 className="font-semibold">{checkId ? tc(checkId, action.title) : action.title}</h4>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <PriorityBadge priority={action.priority} />
                      <span className={`badge ${difficulty}`}>{t("difficultyLabel")}: {t(diffKey)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-ink-700 dark:text-ink-200">{t("actionPlanProblem")}</p>
                  <p className="mt-1 text-ink-600 dark:text-ink-300">{action.problem}</p>
                </div>
                <div>
                  <p className="font-semibold text-ink-700 dark:text-ink-200">{t("actionPlanWhyMatters")}</p>
                  <p className="mt-1 text-ink-600 dark:text-ink-300">{action.why_it_matters}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="font-semibold text-ink-700 dark:text-ink-200">{t("actionPlanRecommendedFix")}</p>
                  <p className="mt-1 rounded-lg bg-ink-50 p-3 text-ink-700 dark:bg-ink-800 dark:text-ink-200">{action.recommended_fix}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
