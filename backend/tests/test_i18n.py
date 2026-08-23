"""Localization tests: verify en/uz/ru translation dictionaries stay complete.

The dictionaries live in frontend/i18n/*.ts. These tests parse them without
needing a JS test runner and ensure no important UI key is missing a
translation (the app falls back to English for any missing key, but we want
important UI fully covered).
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

FRONTEND_I18N = Path(__file__).resolve().parents[2] / "frontend" / "i18n"


def _extract_keys(path: Path):
    text = path.read_text(encoding="utf-8")
    return set(re.findall(r'^\s{2}(?:["\']?)([A-Za-z0-9_.]+)(?:["\']?)\s*:', text, re.M))


def _extract_check_title_keys(path: Path):
    text = path.read_text(encoding="utf-8")
    return set(re.findall(r'^\s{2}(?:["\']?)([A-Za-z0-9_\-]+)(?:["\']?)\s*:', text, re.M))


EN = FRONTEND_I18N / "en.ts"
UZ = FRONTEND_I18N / "uz.ts"
RU = FRONTEND_I18N / "ru.ts"
CHECK = FRONTEND_I18N / "checkTitles.ts"


def test_all_three_language_files_exist():
    assert EN.exists()
    assert UZ.exists()
    assert RU.exists()
    assert CHECK.exists()


def test_uzbek_and_russian_cover_all_english_keys():
    en_keys = _extract_keys(EN)
    uz_keys = _extract_keys(UZ)
    ru_keys = _extract_keys(RU)

    assert en_keys, "English dictionary should not be empty"
    missing_uz = en_keys - uz_keys
    missing_ru = en_keys - ru_keys
    assert not missing_uz, f"Uzbek is missing keys: {sorted(missing_uz)}"
    assert not missing_ru, f"Russian is missing keys: {sorted(missing_ru)}"


def test_important_ui_keys_are_translated_in_all_languages():
    important = {
        "navDashboard",
        "navHistory",
        "navPricing",
        "heroTitle",
        "heroCta",
        "urlStartFreeAudit",
        "loginTitle",
        "registerTitle",
        "dashboardTitle",
        "historyTitle",
        "auditCategoryScores",
        "auditAiPlan",
        "auditAllChecks",
        "issuesWhatChecked",
        "issuesActualResult",
        "issuesWhyMatters",
        "issuesHowFix",
        "priorityCritical",
        "priorityHigh",
        "priorityMedium",
        "priorityLow",
        "pricingTitle",
        "pricingUpgrade",
        "billingCurrentPlan",
        "reportTitle",
        "reportSummary",
        "reportScoringTitle",
    }
    en_keys = _extract_keys(EN)
    for key in important:
        assert key in en_keys, f"Missing English key: {key}"
    uz_keys = _extract_keys(UZ)
    ru_keys = _extract_keys(RU)
    for key in important:
        assert key in uz_keys, f"Missing Uzbek key: {key}"
        assert key in ru_keys, f"Missing Russian key: {key}"


def test_check_titles_have_same_coverage_in_all_languages():
    en_titles = _extract_check_title_keys(CHECK)
    # The English map is in the same file; split per-export block for exactness.
    text = CHECK.read_text(encoding="utf-8")
    en_block = text.split("CHECK_TITLES_EN")[1].split("CHECK_TITLES_UZ")[0]
    uz_block = text.split("CHECK_TITLES_UZ")[1].split("CHECK_TITLES_RU")[0]
    ru_block = text.split("CHECK_TITLES_RU")[1]

    en = set(re.findall(r'^\s{2}(?:["\']?)([A-Za-z0-9_\-]+)(?:["\']?)\s*:', en_block, re.M))
    uz = set(re.findall(r'^\s{2}(?:["\']?)([A-Za-z0-9_\-]+)(?:["\']?)\s*:', uz_block, re.M))
    ru = set(re.findall(r'^\s{2}(?:["\']?)([A-Za-z0-9_\-]+)(?:["\']?)\s*:', ru_block, re.M))

    assert en, "English check titles should not be empty"
    assert uz == en, f"Uzbek check title keys differ: missing {sorted(en - uz)} extra {sorted(uz - en)}"
    assert ru == en, f"Russian check title keys differ: missing {sorted(en - ru)} extra {sorted(ru - en)}"
