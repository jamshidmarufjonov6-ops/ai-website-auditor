"""AI service abstraction.

Providers: OpenAI, Anthropic, DeepSeek, plus a built-in rules engine that
reasons directly from the structured audit checks when no API key is set.

The AI layer only receives structured, real audit results. It is instructed
never to invent findings. Priority levels: CRITICAL, HIGH, MEDIUM, LOW.
"""
from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import Dict, List

import httpx

from app.core.config import settings
from app.services.analyzers.base import (
    PRIORITY_CRITICAL,
    PRIORITY_HIGH,
    PRIORITY_LOW,
    PRIORITY_MEDIUM,
    priority_for_status,
)

PRIORITY_ORDER = {PRIORITY_CRITICAL: 0, PRIORITY_HIGH: 1, PRIORITY_MEDIUM: 2, PRIORITY_LOW: 3}

DIFFICULTY_BY_PREFIX = {
    "seo_meta": "EASY",
    "seo_title": "EASY",
    "seo_h1": "EASY",
    "seo_image_alt": "EASY",
    "seo_open_graph": "EASY",
    "a11y_language": "EASY",
    "a11y_image_alt": "EASY",
    "a11y_form_labels": "EASY",
    "a11y_buttons": "EASY",
    "a11y_links": "EASY",
    "tech_language": "EASY",
    "tech_favicon": "EASY",
    "mobile_viewport": "EASY",
    "perf_compression": "MEDIUM",
    "perf_caching": "MEDIUM",
    "perf_scripts": "MEDIUM",
    "perf_stylesheets": "MEDIUM",
    "perf_render_blocking": "MEDIUM",
    "security_header": "MEDIUM",
    "security_cookie_flags": "MEDIUM",
    "security_server_header": "MEDIUM",
    "security_mixed_content": "MEDIUM",
    "seo_canonical": "MEDIUM",
    "seo_robots": "MEDIUM",
    "seo_sitemap": "MEDIUM",
    "seo_broken_links": "MEDIUM",
    "seo_url_structure": "MEDIUM",
    "tech_canonical": "MEDIUM",
    "tech_robots_txt": "MEDIUM",
    "tech_sitemap": "MEDIUM",
    "tech_broken_links": "MEDIUM",
    "security_https": "HARD",
    "tech_https": "HARD",
    "perf_response_time": "HARD",
    "perf_page_size": "MEDIUM",
    "perf_resource_count": "MEDIUM",
}


def _priority_for(check: Dict) -> str:
    return priority_for_status(str(check.get("status", "warning")), int(check.get("score", 60)))


def _difficulty_for(check: Dict) -> str:
    check_id = check.get("id", "")
    for prefix, difficulty in DIFFICULTY_BY_PREFIX.items():
        if check_id.startswith(prefix):
            return difficulty
    return "MEDIUM"


def _action_from_check(check: Dict) -> Dict:
    """Build an action strictly from one real failed/warning check."""
    status = check.get("status")
    what = check.get("what_was_checked") or ""
    actual = check.get("actual_result") or ""
    why = check.get("why_it_matters") or check.get("description") or ""
    fix = check.get("how_to_fix") or check.get("recommendation") or ""
    problem = actual or what or why
    return {
        "priority": _priority_for(check),
        "difficulty": _difficulty_for(check),
        "title": check.get("title", "Untitled issue"),
        "problem": problem,
        "why_it_matters": why,
        "recommended_fix": fix,
    }


class AIService(ABC):
    name: str = "base"

    @abstractmethod
    def generate(self, audit_context: Dict, language: str = "en") -> List[Dict]:
        """Return up to 5 recommendations built ONLY from audit_context."""


class RulesEngineProvider(AIService):
    """Deterministic fallback that converts real failed/warning checks into actions."""

    name = "rules-engine"

    def generate(self, audit_context: Dict, language: str = "en") -> List[Dict]:
        checks = audit_context.get("checks", [])
        issues = [c for c in checks if c.get("status") in ("fail", "warning")]
        issues.sort(
            key=lambda c: (
                PRIORITY_ORDER[_priority_for(c)],
                c.get("score", 100),
                -(c.get("weight", 1.0)),
            )
        )
        actions: List[Dict] = []
        for check in issues[:5]:
            action = _action_from_check(check)
            action["check_id"] = check.get("id")
            actions.append(action)
        return actions


class _OpenAICompatibleProvider(AIService):
    """Shared logic for OpenAI-style /chat/completions APIs (OpenAI, DeepSeek)."""

    def __init__(self, name: str, base_url: str, model: str, api_key: str):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key

    def generate(self, audit_context: Dict, language: str = "en") -> List[Dict]:
        prompt = _build_prompt(audit_context, language)
        with httpx.Client(timeout=settings.AI_TIMEOUT_SECONDS) as client:
            resp = client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={
                    "model": self.model,
                    "temperature": 0.2,
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            resp.raise_for_status()
            data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return parse_recommendations(content)


class OpenAIProvider(_OpenAICompatibleProvider):
    def __init__(self, api_key: str, model: str):
        super().__init__(
            "openai",
            "https://api.openai.com/v1",
            model or "gpt-4o-mini",
            api_key,
        )


class DeepSeekProvider(_OpenAICompatibleProvider):
    def __init__(self, api_key: str, model: str, base_url: str):
        super().__init__(
            "deepseek",
            base_url or "https://api.deepseek.com",
            model or "deepseek-chat",
            api_key,
        )


class AnthropicProvider(AIService):
    name = "anthropic"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model or "claude-3-5-haiku-latest"

    def generate(self, audit_context: Dict, language: str = "en") -> List[Dict]:
        prompt = _build_prompt(audit_context, language)
        with httpx.Client(timeout=settings.AI_TIMEOUT_SECONDS) as client:
            resp = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": 1500,
                    "temperature": 0.2,
                    "system": _SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
        content = "".join(b.get("text", "") for b in data.get("content", []))
        return parse_recommendations(content)


_SYSTEM_PROMPT = (
    "You are a website audit assistant. You receive structured, real audit findings for a website. "
    "Your ONLY job is to turn the most important FAILED or WARNING findings into a prioritized action plan. "
    "Never invent findings that are not in the provided data. Never claim the site is secure. "
    "Use the exact four-level priority system: CRITICAL, HIGH, MEDIUM, LOW. "
    "Respond with JSON only, in this exact shape: "
    '{"actions":[{"priority":"CRITICAL|HIGH|MEDIUM|LOW","difficulty":"EASY|MEDIUM|HARD","title":"short title",'
    '"problem":"what the check found","why_it_matters":"impact in plain language","recommended_fix":"1-2 sentences"}]} '
    "Provide at most 5 actions, ordered by priority."
)


def _build_prompt(audit_context: Dict, language: str = "en") -> str:
    checks = audit_context.get("checks", [])
    issues = [c for c in checks if c.get("status") in ("fail", "warning")]
    compact = []
    for c in issues:
        compact.append(
            {
                "id": c.get("id"),
                "status": c.get("status"),
                "score": c.get("score"),
                "title": c.get("title"),
                "what_was_checked": c.get("what_was_checked"),
                "actual_result": c.get("actual_result"),
                "why_it_matters": c.get("why_it_matters") or c.get("description"),
                "recommended_fix": c.get("how_to_fix") or c.get("recommendation"),
            }
        )
    payload = {
        "website": audit_context.get("website"),
        "overall_score": audit_context.get("overall_score"),
        "category_scores": audit_context.get("category_scores"),
        "findings": compact,
    }
    language_names = {"en": "English", "uz": "Uzbek (O'zbekcha)", "ru": "Russian (Русский)"}
    lang_name = language_names.get(language, "English")
    return (
        f"Write all recommendation text in {lang_name}.\n"
        "Audit data:\n" + json.dumps(payload, ensure_ascii=False)[:12000]
    )


def parse_recommendations(text: str) -> List[Dict]:
    """Parse AI JSON output robustly (handles code fences and stray prose)."""
    if not text:
        return []
    cleaned = text.strip()
    # Strip markdown code fences.
    fence = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find the first JSON object/array in the text.
        start = cleaned.find("{")
        if start == -1:
            start = cleaned.find("[")
        if start == -1:
            return []
        end = max(cleaned.rfind("}"), cleaned.rfind("]"))
        if end <= start:
            return []
        try:
            data = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            return []

    raw_actions = data.get("actions") if isinstance(data, dict) else data
    if not isinstance(raw_actions, list):
        return []

    actions: List[Dict] = []
    for item in raw_actions[:5]:
        if not isinstance(item, dict):
            continue
        priority = str(item.get("priority", "MEDIUM")).upper()
        if priority not in PRIORITY_ORDER:
            priority = "MEDIUM"
        difficulty = str(item.get("difficulty", "MEDIUM")).upper()
        if difficulty not in ("EASY", "MEDIUM", "HARD"):
            difficulty = "MEDIUM"
        title = str(item.get("title") or "Improvement needed")[:255]
        actions.append(
            {
                "priority": priority,
                "difficulty": difficulty,
                "title": title,
                "problem": str(item.get("problem") or "")[:2000],
                "why_it_matters": str(item.get("why_it_matters") or "")[:2000],
                "recommended_fix": str(item.get("recommended_fix") or "")[:2000],
            }
        )
    return actions


def get_ai_service() -> AIService:
    provider = settings.AI_PROVIDER.lower()
    key = settings.AI_API_KEY.strip()
    if provider == "openai" and key:
        return OpenAIProvider(key, settings.AI_MODEL)
    if provider == "anthropic" and key:
        return AnthropicProvider(key, settings.AI_MODEL)
    if provider == "deepseek" and key:
        return DeepSeekProvider(key, settings.AI_MODEL, settings.AI_BASE_URL)
    return RulesEngineProvider()
