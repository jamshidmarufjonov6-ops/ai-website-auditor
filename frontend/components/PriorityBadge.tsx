"use client";

import { useI18n } from "@/i18n";
import type { Priority } from "@/lib/types";

export function PriorityBadge({ priority }: { priority: Priority | string }) {
  const { t } = useI18n();
  const key = (priority || "MEDIUM").toUpperCase();
  const classes: Record<string, string> = {
    CRITICAL: "bg-red-600 text-white dark:bg-red-600",
    HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
    MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300",
    LOW: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
    PASS: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
  };
  const labelKey =
    key === "CRITICAL" ? "priorityCritical" : key === "HIGH" ? "priorityHigh" : key === "MEDIUM" ? "priorityMedium" : key === "LOW" ? "priorityLow" : "priorityPassed";
  return <span className={`badge ${classes[key] || classes.MEDIUM}`}>{t(labelKey)}</span>;
}
