"""Transparent scoring engine.

Every category score is a weighted average of its individual check scores.
The overall score is the weighted sum of category scores using fixed,
documented weights. Nothing is random.

The engine also returns per-check contributions and plain-language
explanations so users can see exactly how every score was calculated.
"""
from __future__ import annotations

from typing import Dict, List

from app.services.analyzers.base import STATUS_FAIL, STATUS_PASS, STATUS_WARNING, CheckResult

CATEGORY_WEIGHTS: Dict[str, float] = {
    "seo": 0.20,
    "performance": 0.20,
    "security": 0.20,
    "accessibility": 0.15,
    "mobile": 0.10,
    "technical": 0.15,
}

CATEGORY_LABELS: Dict[str, str] = {
    "seo": "SEO",
    "performance": "Performance",
    "security": "Security",
    "accessibility": "Accessibility",
    "mobile": "Mobile",
    "technical": "Technical Health",
}


def _weighted_average(checks: List[CheckResult]) -> float:
    total_weight = sum(c.weight for c in checks)
    if total_weight == 0:
        return 0.0
    return sum(c.score * c.weight for c in checks) / total_weight


def _explain_category(label: str, checks: List[CheckResult], average: float) -> str:
    issues = [c for c in checks if c.status in (STATUS_FAIL, STATUS_WARNING)]
    issues.sort(key=lambda c: c.score)
    opportunities = ", ".join(c.title for c in issues[:3])
    if not opportunities:
        opportunities = "no failed or warning checks — great work"
    return (
        f"{label} is the weighted average of {len(checks)} checks "
        f"(average {average:.1f}/100). "
        f"Biggest opportunities to improve: {opportunities}."
    )


def score_category(checks: List[CheckResult]) -> Dict:
    passed = sum(1 for c in checks if c.status == STATUS_PASS)
    warnings = sum(1 for c in checks if c.status == STATUS_WARNING)
    failed = sum(1 for c in checks if c.status == STATUS_FAIL)
    total_weight = sum(c.weight for c in checks) or 1.0
    average = _weighted_average(checks)
    contributions = [
        {
            "id": c.id,
            "title": c.title,
            "status": c.status,
            "score": c.score,
            "weight": c.weight,
            "contribution": round(c.score * c.weight / total_weight, 2),
        }
        for c in checks
    ]
    contributions.sort(key=lambda c: c["contribution"])
    return {
        "score": round(average),
        "raw_score": round(average, 2),
        "passed": passed,
        "warnings": warnings,
        "failed": failed,
        "total": len(checks),
        "total_weight": round(total_weight, 2),
        "weighted_average": round(average, 2),
        "checks": contributions,
        "explanation": _explain_category("This category", checks, average),
    }


def compute_scores(all_checks: List[CheckResult]) -> Dict:
    """Return {overall_score, category_scores, methodology, overall_explanation}."""
    by_category: Dict[str, List[CheckResult]] = {}
    for check in all_checks:
        by_category.setdefault(check.category, []).append(check)

    category_scores: Dict[str, Dict] = {}
    weighted_sum = 0.0
    weight_total = 0.0
    for category, weight in CATEGORY_WEIGHTS.items():
        checks = by_category.get(category, [])
        info = score_category(checks)
        info["label"] = CATEGORY_LABELS.get(category, category)
        info["weight"] = weight
        info["weighted_contribution"] = round(info["score"] * weight, 2)
        category_scores[category] = info
        weighted_sum += info["score"] * weight
        weight_total += weight

    overall = round(weighted_sum / weight_total) if weight_total else 0
    methodology = {
        "category_weights": CATEGORY_WEIGHTS,
        "category_labels": CATEGORY_LABELS,
        "formula": "overall = Σ(category_score × category_weight)",
    }
    worst = sorted(category_scores.items(), key=lambda kv: kv[1]["score"])[0]
    best = sorted(category_scores.items(), key=lambda kv: -kv[1]["score"])[0]
    overall_explanation = (
        f"Your overall score is the weighted average of six category scores. "
        f"Your strongest area is {best[1]['label']} ({best[1]['score']}/100), "
        f"and your biggest opportunity is {worst[1]['label']} ({worst[1]['score']}/100). "
        f"Weights: SEO 20%, Performance 20%, Security 20%, Accessibility 15%, Mobile 10%, Technical Health 15%."
    )
    return {
        "overall_score": overall,
        "category_scores": category_scores,
        "methodology": methodology,
        "overall_explanation": overall_explanation,
    }


def summarize(checks: List[CheckResult]) -> Dict:
    """Human-readable summary counts plus top issues."""
    passed = [c for c in checks if c.status == STATUS_PASS]
    warnings = [c for c in checks if c.status == STATUS_WARNING]
    failed = [c for c in checks if c.status == STATUS_FAIL]
    return {
        "total_checks": len(checks),
        "passed": len(passed),
        "warnings": len(warnings),
        "failed": len(failed),
        "top_issues": [c.to_dict() for c in sorted(failed + warnings, key=lambda c: c.score)[:10]],
    }
