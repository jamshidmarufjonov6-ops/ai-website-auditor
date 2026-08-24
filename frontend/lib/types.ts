export type CheckStatus = "pass" | "warning" | "fail";
export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASS";

export interface CheckResult {
  id: string;
  category: string;
  status: CheckStatus;
  score: number;
  title: string;
  description: string; // legacy alias of why_it_matters
  recommendation: string; // legacy alias of how_to_fix
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

export interface Audit {
  public_id: string;
  share_id: string;
  url: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  stage: string;
  overall_score: number | null;
  category_scores: Record<string, CategoryScore> | null;
  summary: AuditSummary | null;
  max_pages?: number | null;
  language?: string;
  results: {
    checks: CheckResult[];
    pages_crawled: number;
    crawl_limited: boolean;
    broken_links: { url: string; status_code: number }[];
    fetch_errors: { url: string; kind: string; message: string; status_code?: number }[];
    analyzer_errors: string[];
    partial: boolean;
  } | null;
  ai_recommendations: {
    provider: string;
    actions: AIAction[];
  } | null;
  error_message: string | null;
  error_code: string | null;
  started_at: string;
  completed_at: string | null;
  previous_score: number | null;
  score_change: number | null;
}

export interface AuditListItem {
  public_id: string;
  share_id?: string;
  url: string;
  status: string;
  overall_score: number | null;
  started_at: string;
  score_change: number | null;
  partial?: boolean | null;
  error_code?: string | null;
  error_message?: string | null;
}

export interface DashboardStats {
  total_audits: number;
  completed_audits: number;
  average_score: number | null;
  best_score: number | null;
  recent_audits: {
    public_id: string;
    url: string;
    status: string;
    overall_score: number | null;
    started_at: string;
    partial: boolean;
    error_code: string | null;
  }[];
}

export interface User {
  id: string;
  email: string;
  created_at: string;
  credits: number;
  is_admin?: boolean;
}

export type MessageStatus = "new" | "read" | "replied";

export interface Message {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  subject: string;
  body: string;
  status: MessageStatus;
  email_forwarded: boolean;
  forward_error: string | null;
  created_at: string;
}

export interface AdminMessagesResponse {
  total: number;
  unread: number;
  mail_configured: boolean;
  messages: Message[];
}

export interface CreditsInfo {
  credits: number;
  payments_configured: boolean;
  pack: {
    size: number;
    price_usd: number;
    price_id: string;
  };
}
