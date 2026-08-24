import type { CheckResult, CheckStatus, Priority } from "../../types.js";

export const STATUS_PASS = "pass";
export const STATUS_WARNING = "warning";
export const STATUS_FAIL = "fail";

export const PRIORITY_CRITICAL = "CRITICAL";
export const PRIORITY_HIGH = "HIGH";
export const PRIORITY_MEDIUM = "MEDIUM";
export const PRIORITY_LOW = "LOW";
export const PRIORITY_PASS = "PASS";

export function priorityForStatus(status: CheckStatus, score: number): Priority {
  if (status === STATUS_FAIL) return score <= 25 ? PRIORITY_CRITICAL : PRIORITY_HIGH;
  if (status === STATUS_WARNING) return score <= 50 ? PRIORITY_MEDIUM : PRIORITY_LOW;
  return PRIORITY_PASS;
}

export interface CheckResultInput {
  id: string;
  category: string;
  status: CheckStatus;
  score: number;
  title: string;
  whatWasChecked: string;
  actualResult: string;
  whyItMatters: string;
  howToFix: string;
  weight?: number;
  details?: Record<string, unknown>;
}

export function result(input: CheckResultInput): CheckResult {
  const score = Math.max(0, Math.min(100, input.score));
  const check: CheckResult = {
    id: input.id,
    category: input.category,
    status: input.status,
    score,
    title: input.title,
    description: input.whyItMatters,
    recommendation: input.howToFix,
    weight: input.weight ?? 1.0,
    what_was_checked: input.whatWasChecked,
    actual_result: input.actualResult,
    why_it_matters: input.whyItMatters,
    how_to_fix: input.howToFix,
    priority: priorityForStatus(input.status, score),
  };
  if (input.details) check.details = input.details;
  return check;
}

export abstract class BaseAnalyzer {
  abstract category: string;
  abstract analyze(ctx: unknown): CheckResult[] | Promise<CheckResult[]>;
}
