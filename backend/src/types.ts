import type { ObjectId } from "mongodb";

export type CheckStatus = "pass" | "warning" | "fail";
export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASS";

export interface CheckResult {
  id: string;
  category: string;
  status: CheckStatus;
  score: number;
  title: string;
  description: string;
  recommendation: string;
  weight: number;
  details?: Record<string, unknown>;
  what_was_checked: string;
  actual_result: string;
  why_it_matters: string;
  how_to_fix: string;
  priority: Priority;
}

export interface CheckContribution {
  id: string;
  title: string;
  status: CheckStatus;
  score: number;
  weight: number;
  contribution: number;
}

export interface CategoryScore {
  score: number;
  raw_score: number;
  passed: number;
  warnings: number;
  failed: number;
  total: number;
  total_weight: number;
  weighted_average: number;
  checks: CheckContribution[];
  explanation: string;
  label: string;
  weight: number;
  weighted_contribution: number;
}

export interface AIAction {
  priority: Exclude<Priority, "PASS">;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  title: string;
  problem: string;
  why_it_matters: string;
  recommended_fix: string;
  check_id?: string;
}

export interface AuditSummary {
  total_checks: number;
  passed: number;
  warnings: number;
  failed: number;
  top_issues: CheckResult[];
  methodology?: {
    category_weights: Record<string, number>;
    category_labels: Record<string, string>;
    formula: string;
  };
  overall_explanation?: string;
}

export interface AuditResults {
  checks: CheckResult[];
  pages_crawled: number;
  crawl_limited: boolean;
  broken_links: { url: string; status_code: number }[];
  fetch_errors: { url: string; kind: string; message: string; status_code?: number }[];
  analyzer_errors: string[];
  partial: boolean;
}

export interface AuditRecord {
  _id: ObjectId;
  publicId: string;
  userId: ObjectId | null;
  websiteId: ObjectId | null;
  url: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  stage: string;
  maxPages: number;
  language: string;
  overallScore: number | null;
  categoryScores: Record<string, CategoryScore> | null;
  summary: AuditSummary | null;
  results: AuditResults | null;
  aiRecommendations: { provider: string; actions: AIAction[] } | null;
  errorMessage: string | null;
  errorCode: string | null;
  startedAt: Date;
  completedAt: Date | null;
}
