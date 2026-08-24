import type { CategoryScore, CheckResult } from "../types.js";
import { STATUS_FAIL, STATUS_PASS, STATUS_WARNING } from "./analyzers/base.js";

export const CATEGORY_WEIGHTS: Record<string, number> = {
  seo: 0.2,
  performance: 0.2,
  security: 0.2,
  accessibility: 0.15,
  mobile: 0.1,
  technical: 0.15,
};

export const CATEGORY_LABELS: Record<string, string> = {
  seo: "SEO",
  performance: "Performance",
  security: "Security",
  accessibility: "Accessibility",
  mobile: "Mobile",
  technical: "Technical Health",
};

function weightedAverage(checks: CheckResult[]): number {
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return 0;
  return checks.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight;
}

function explainCategory(label: string, checks: CheckResult[], average: number): string {
  const issues = checks
    .filter((c) => c.status === STATUS_FAIL || c.status === STATUS_WARNING)
    .sort((a, b) => a.score - b.score);
  let opportunities = issues.slice(0, 3).map((c) => c.title).join(", ");
  if (!opportunities) opportunities = "no failed or warning checks — great work";
  return `${label} is the weighted average of ${checks.length} checks (average ${average.toFixed(1)}/100). Biggest opportunities to improve: ${opportunities}.`;
}

export function scoreCategory(checks: CheckResult[]): Omit<CategoryScore, "label" | "weight" | "weighted_contribution"> {
  const passed = checks.filter((c) => c.status === STATUS_PASS).length;
  const warnings = checks.filter((c) => c.status === STATUS_WARNING).length;
  const failed = checks.filter((c) => c.status === STATUS_FAIL).length;
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0) || 1;
  const average = weightedAverage(checks);
  const contributions = checks.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    score: c.score,
    weight: c.weight,
    contribution: Math.round((c.score * c.weight) / totalWeight * 100) / 100,
  }));
  contributions.sort((a, b) => a.contribution - b.contribution);
  return {
    score: Math.round(average),
    raw_score: Math.round(average * 100) / 100,
    passed,
    warnings,
    failed,
    total: checks.length,
    total_weight: Math.round(totalWeight * 100) / 100,
    weighted_average: Math.round(average * 100) / 100,
    checks: contributions,
    explanation: explainCategory("This category", checks, average),
  };
}

export interface ScoreResult {
  overall_score: number;
  category_scores: Record<string, CategoryScore>;
  methodology: {
    category_weights: Record<string, number>;
    category_labels: Record<string, string>;
    formula: string;
  };
  overall_explanation: string;
}

export function computeScores(allChecks: CheckResult[]): ScoreResult {
  const byCategory: Record<string, CheckResult[]> = {};
  for (const check of allChecks) {
    (byCategory[check.category] ||= []).push(check);
  }

  const categoryScores: Record<string, CategoryScore> = {};
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const checks = byCategory[category] || [];
    const info = scoreCategory(checks) as CategoryScore;
    info.label = CATEGORY_LABELS[category] || category;
    info.weight = weight;
    info.weighted_contribution = Math.round(info.score * weight * 100) / 100;
    categoryScores[category] = info;
    weightedSum += info.score * weight;
    weightTotal += weight;
  }

  const overall = weightTotal ? Math.round(weightedSum / weightTotal) : 0;
  const methodology = {
    category_weights: CATEGORY_WEIGHTS,
    category_labels: CATEGORY_LABELS,
    formula: "overall = Σ(category_score × category_weight)",
  };
  const entries = Object.entries(categoryScores);
  entries.sort((a, b) => a[1].score - b[1].score);
  const worst = entries[0];
  const best = entries[entries.length - 1];
  const overallExplanation = `Your overall score is the weighted average of six category scores. Your strongest area is ${best[1].label} (${best[1].score}/100), and your biggest opportunity is ${worst[1].label} (${worst[1].score}/100). Weights: SEO 20%, Performance 20%, Security 20%, Accessibility 15%, Mobile 10%, Technical Health 15%.`;

  return {
    overall_score: overall,
    category_scores: categoryScores,
    methodology,
    overall_explanation: overallExplanation,
  };
}

export function summarize(checks: CheckResult[]): {
  total_checks: number;
  passed: number;
  warnings: number;
  failed: number;
  top_issues: CheckResult[];
} {
  const passed = checks.filter((c) => c.status === STATUS_PASS);
  const warnings = checks.filter((c) => c.status === STATUS_WARNING);
  const failed = checks.filter((c) => c.status === STATUS_FAIL);
  const topIssues = [...failed, ...warnings].sort((a, b) => a.score - b.score).slice(0, 10);
  return {
    total_checks: checks.length,
    passed: passed.length,
    warnings: warnings.length,
    failed: failed.length,
    top_issues: topIssues,
  };
}
