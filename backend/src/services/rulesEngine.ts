import type { AIAction, CheckResult, Priority } from "../types.js";
import { PRIORITY_CRITICAL, PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_MEDIUM, priorityForStatus } from "./analyzers/base.js";

const PRIORITY_ORDER: Record<string, number> = {
  [PRIORITY_CRITICAL]: 0,
  [PRIORITY_HIGH]: 1,
  [PRIORITY_MEDIUM]: 2,
  [PRIORITY_LOW]: 3,
};

const DIFFICULTY_BY_PREFIX: Record<string, "EASY" | "MEDIUM" | "HARD"> = {
  seo_meta: "EASY",
  seo_title: "EASY",
  seo_h1: "EASY",
  seo_image_alt: "EASY",
  seo_open_graph: "EASY",
  a11y_language: "EASY",
  a11y_image_alt: "EASY",
  a11y_form_labels: "EASY",
  a11y_buttons: "EASY",
  a11y_links: "EASY",
  tech_language: "EASY",
  tech_favicon: "EASY",
  mobile_viewport: "EASY",
  perf_compression: "MEDIUM",
  perf_caching: "MEDIUM",
  perf_scripts: "MEDIUM",
  perf_stylesheets: "MEDIUM",
  perf_render_blocking: "MEDIUM",
  security_header: "MEDIUM",
  security_cookie_flags: "MEDIUM",
  security_server_header: "MEDIUM",
  security_mixed_content: "MEDIUM",
  seo_canonical: "MEDIUM",
  seo_robots: "MEDIUM",
  seo_sitemap: "MEDIUM",
  seo_broken_links: "MEDIUM",
  seo_url_structure: "MEDIUM",
  tech_canonical: "MEDIUM",
  tech_robots_txt: "MEDIUM",
  tech_sitemap: "MEDIUM",
  tech_broken_links: "MEDIUM",
  security_https: "HARD",
  tech_https: "HARD",
  perf_response_time: "HARD",
  perf_page_size: "MEDIUM",
  perf_resource_count: "MEDIUM",
};

function priorityFor(check: CheckResult): Priority {
  return priorityForStatus(check.status, check.score);
}

function difficultyFor(check: CheckResult): "EASY" | "MEDIUM" | "HARD" {
  for (const [prefix, difficulty] of Object.entries(DIFFICULTY_BY_PREFIX)) {
    if (check.id.startsWith(prefix)) return difficulty;
  }
  return "MEDIUM";
}

function actionFromCheck(check: CheckResult): AIAction {
  const problem = check.actual_result || check.what_was_checked || check.why_it_matters;
  return {
    priority: priorityFor(check) as AIAction["priority"],
    difficulty: difficultyFor(check),
    title: check.title || "Untitled issue",
    problem,
    why_it_matters: check.why_it_matters,
    recommended_fix: check.how_to_fix,
  };
}

export function generateRecommendations(checks: CheckResult[], _language = "en"): AIAction[] {
  const issues = checks.filter((c) => c.status === "fail" || c.status === "warning");
  issues.sort((a, b) => {
    const pa = PRIORITY_ORDER[priorityFor(a)];
    const pb = PRIORITY_ORDER[priorityFor(b)];
    if (pa !== pb) return pa - pb;
    if (a.score !== b.score) return a.score - b.score;
    return b.weight - a.weight;
  });
  return issues.slice(0, 5).map((check) => ({
    ...actionFromCheck(check),
    check_id: check.id,
  }));
}
