"""Audit orchestration: crawl → analyze → score → AI → persist."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List

from sqlalchemy.orm import Session

from app.models import Audit, AuditResult, Recommendation, Website
from app.services.analyzers.accessibility import AccessibilityAnalyzer
from app.services.analyzers.base import CheckResult
from app.services.analyzers.mobile import MobileAnalyzer
from app.services.analyzers.performance import PerformanceAnalyzer
from app.services.analyzers.security import SecurityAnalyzer
from app.services.analyzers.seo import SEOAnalyzer
from app.services.analyzers.technical import TechnicalAnalyzer
from app.services.ai.providers import get_ai_service
from app.services.crawler.crawler import crawl
from app.services.crawler.fetcher import FetchError
from app.services.crawler.url_validator import URLValidationError, get_domain
from app.services.scoring import CATEGORY_LABELS, compute_scores, summarize

logger = logging.getLogger(__name__)

ANALYZERS = [
    SEOAnalyzer(),
    SecurityAnalyzer(),
    PerformanceAnalyzer(),
    AccessibilityAnalyzer(),
    MobileAnalyzer(),
    TechnicalAnalyzer(),
]

# Map FetchError kinds to stable, machine-readable error codes used by the UI.
FETCH_ERROR_CODES = {
    "timeout": "timeout",
    "ssl_error": "ssl_error",
    "connection_error": "connection_error",
    "too_large": "page_too_large",
    "http_5xx": "server_error",
    "unsafe_redirect": "unsafe_redirect",
    "too_many_redirects": "too_many_redirects",
    "request_error": "request_error",
    "fetch_error": "fetch_error",
}


def error_code_from_exception(exc: Exception) -> str:
    if isinstance(exc, URLValidationError):
        return "invalid_url"
    if isinstance(exc, FetchError):
        return FETCH_ERROR_CODES.get(exc.kind, "fetch_error")
    return "internal_error"


def _stage(db: Session, audit_id: int, progress: int, stage: str) -> None:
    audit = db.get(Audit, audit_id)
    if audit:
        audit.progress = progress
        audit.stage = stage
        db.commit()


def _fail(audit: Audit, db: Session, message: str, error_code: str) -> None:
    audit.status = "failed"
    audit.error_message = message
    audit.error_code = error_code
    audit.completed_at = datetime.now(timezone.utc)
    db.commit()


def run_audit(audit_id: int) -> None:
    """Execute a full audit. Runs inside a worker thread with its own session."""
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        audit = db.get(Audit, audit_id)
        if audit is None:
            return
        audit.status = "running"
        audit.progress = 5
        audit.stage = "Validating URL"
        db.commit()

        # 1. Validate URL (fail fast with a safe message)
        try:
            _stage(db, audit_id, 6, "Validating URL")
            from app.services.crawler.url_validator import validate_url
            validated = validate_url(audit.url)
            domain = get_domain(validated.url)
        except URLValidationError as exc:
            _fail(audit, db, exc.safe_message, "invalid_url")
            return

        # 2. Crawl
        def progress_cb(progress: int, stage: str) -> None:
            _stage(db, audit_id, progress, stage)

        try:
            ctx = crawl(audit.url, progress_cb, max_pages=audit.max_pages)
        except FetchError as exc:
            _fail(audit, db, exc.safe_message, error_code_from_exception(exc))
            return
        except Exception:  # defensive: never leak internals
            logger.exception("Crawl failed for audit %s", audit_id)
            _fail(audit, db, "We could not analyze this website. It may be blocking automated audits.", "crawl_failed")
            return

        # 3. Analyze
        _stage(db, audit_id, 68, "Running SEO checks")
        all_checks: List[CheckResult] = []
        analyzer_errors: List[str] = []
        for analyzer in ANALYZERS:
            _stage(db, audit_id, min(70 + 4 * ANALYZERS.index(analyzer), 86), f"Analyzing {CATEGORY_LABELS.get(analyzer.category, analyzer.category)}")
            try:
                all_checks.extend(analyzer.analyze(ctx))
            except Exception:
                logger.exception("Analyzer %s failed", analyzer.category)
                analyzer_errors.append(analyzer.category)

        check_dicts = [c.to_dict() for c in all_checks]

        # 4. Score
        _stage(db, audit_id, 88, "Calculating scores")
        scores = compute_scores(all_checks)
        summary = summarize(all_checks)
        summary["methodology"] = scores["methodology"]
        summary["overall_explanation"] = scores["overall_explanation"]

        # 5. AI recommendations (only from real check data)
        _stage(db, audit_id, 92, "Generating AI recommendations")
        ai_service = get_ai_service()
        language = audit.language or "en"
        ai_context = {
            "website": audit.url,
            "overall_score": scores["overall_score"],
            "category_scores": {k: v["score"] for k, v in scores["category_scores"].items()},
            "checks": check_dicts,
        }
        try:
            recommendations = ai_service.generate(ai_context, language=language)
        except Exception:
            logger.exception("AI generation failed, using rules engine")
            from app.services.ai.providers import RulesEngineProvider
            recommendations = RulesEngineProvider().generate(ai_context, language=language)

        # 6. Persist
        _stage(db, audit_id, 96, "Saving results")
        audit = db.get(Audit, audit_id)
        partial = bool(analyzer_errors or ctx.fetch_errors)
        audit.overall_score = scores["overall_score"]
        audit.category_scores = scores["category_scores"]
        audit.summary = summary
        audit.results = {
            "checks": check_dicts,
            "pages_crawled": len(ctx.pages),
            "crawl_limited": ctx.crawl_limited,
            "broken_links": ctx.broken_links,
            "fetch_errors": ctx.fetch_errors,
            "analyzer_errors": analyzer_errors,
            "partial": partial,
        }
        audit.ai_recommendations = {"provider": ai_service.name, "actions": recommendations}
        audit.status = "completed"
        audit.progress = 100
        audit.stage = "Complete"
        audit.completed_at = datetime.now(timezone.utc)

        # Denormalized rows
        audit.result_rows.clear()
        for check in all_checks:
            audit.result_rows.append(
                AuditResult(
                    category=check.category,
                    check_id=check.id,
                    status=check.status,
                    score=check.score,
                    title=check.title,
                    description=check.description,
                    recommendation=check.recommendation,
                    weight=check.weight,
                )
            )
        audit.recommendations.clear()
        for idx, rec in enumerate(recommendations, start=1):
            audit.recommendations.append(
                Recommendation(
                    position=idx,
                    priority=rec.get("priority", "MEDIUM"),
                    difficulty=rec.get("difficulty", "MEDIUM"),
                    title=rec.get("title", ""),
                    problem=rec.get("problem", ""),
                    why_it_matters=rec.get("why_it_matters", ""),
                    recommended_fix=rec.get("recommended_fix", ""),
                )
            )

        # Website bookkeeping
        website = db.query(Website).filter(Website.domain == domain).first()
        if website is None:
            website = Website(domain=domain)
            db.add(website)
            db.flush()
        website.last_audited_at = datetime.now(timezone.utc)
        audit.website_id = website.id

        db.commit()
    except Exception:
        logger.exception("Audit %s failed unexpectedly", audit_id)
        db.rollback()
        try:
            audit = db.get(Audit, audit_id)
            if audit and audit.status != "failed":
                audit.status = "failed"
                audit.error_code = "internal_error"
                audit.error_message = "Something went wrong during the audit. Please try again."
                audit.completed_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            logger.exception("Could not mark audit %s as failed", audit_id)
    finally:
        db.close()
