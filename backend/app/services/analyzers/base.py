"""Analyzer base types and helpers.

Every check carries a transparent, four-part explanation:
  * what_was_checked — what the automated check inspected
  * actual_result    — what was actually found on the site
  * why_it_matters   — business/user impact in plain language
  * how_to_fix       — clear next step
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Dict, List, Optional

STATUS_PASS = "pass"
STATUS_WARNING = "warning"
STATUS_FAIL = "fail"

# Priority levels shown to users (passed checks use PASS internally).
PRIORITY_CRITICAL = "CRITICAL"
PRIORITY_HIGH = "HIGH"
PRIORITY_MEDIUM = "MEDIUM"
PRIORITY_LOW = "LOW"
PRIORITY_PASS = "PASS"

PRIORITIES = (PRIORITY_CRITICAL, PRIORITY_HIGH, PRIORITY_MEDIUM, PRIORITY_LOW)


def priority_for_status(status: str, score: int) -> str:
    """Map a check status/score to the 4-level user priority system."""
    if status == STATUS_FAIL:
        return PRIORITY_CRITICAL if score <= 25 else PRIORITY_HIGH
    if status == STATUS_WARNING:
        return PRIORITY_MEDIUM if score <= 50 else PRIORITY_LOW
    return PRIORITY_PASS


@dataclass
class CheckResult:
    id: str
    category: str
    status: str  # pass | warning | fail
    score: int  # 0-100
    title: str
    description: str  # legacy alias for why_it_matters
    recommendation: str  # legacy alias for how_to_fix
    weight: float = 1.0
    details: Optional[Dict] = None
    what_was_checked: str = ""
    actual_result: str = ""
    why_it_matters: str = ""
    how_to_fix: str = ""

    def to_dict(self) -> dict:
        data = asdict(self)
        if data.get("details") is None:
            data.pop("details", None)
        data["priority"] = priority_for_status(self.status, self.score)
        return data


def result(
    id: str,
    category: str,
    status: str,
    score: int,
    title: str,
    what_was_checked: str,
    actual_result: str,
    why_it_matters: str,
    how_to_fix: str,
    weight: float = 1.0,
    details: Optional[Dict] = None,
) -> CheckResult:
    return CheckResult(
        id=id,
        category=category,
        status=status,
        score=max(0, min(100, score)),
        title=title,
        description=why_it_matters,
        recommendation=how_to_fix,
        weight=weight,
        details=details,
        what_was_checked=what_was_checked,
        actual_result=actual_result,
        why_it_matters=why_it_matters,
        how_to_fix=how_to_fix,
    )


class BaseAnalyzer:
    category: str = "base"

    def analyze(self, ctx) -> List[CheckResult]:
        raise NotImplementedError
