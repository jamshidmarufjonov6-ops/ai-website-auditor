"""Tests for the scoring engine, AI parsing and API endpoints."""
from __future__ import annotations


import pytest
from fastapi.testclient import TestClient

from app.services.analyzers.base import CheckResult, priority_for_status
from app.services.ai.providers import parse_recommendations, RulesEngineProvider
from app.services.crawler.fetcher import FetchError
from app.services.scoring import CATEGORY_WEIGHTS, compute_scores


def check(category, status, score, weight=1.0):
    return CheckResult(
        id=f"{category}_check", category=category, status=status, score=score,
        title="t", description="d", recommendation="r", weight=weight,
    )


def test_scoring_is_weighted_average():
    all_checks = [
        check("seo", "pass", 100),
        check("seo", "fail", 0),
        check("security", "pass", 100),
        check("security", "warning", 60),
        check("performance", "pass", 80),
        check("performance", "fail", 20),
        check("accessibility", "pass", 90),
        check("mobile", "pass", 100),
        check("technical", "warning", 50),
    ]
    scores = compute_scores(all_checks)
    assert scores["overall_score"] == round(
        (100 + 0) / 2 * CATEGORY_WEIGHTS["seo"]
        + (100 + 60) / 2 * CATEGORY_WEIGHTS["security"]
        + (80 + 20) / 2 * CATEGORY_WEIGHTS["performance"]
        + 90 * CATEGORY_WEIGHTS["accessibility"]
        + 100 * CATEGORY_WEIGHTS["mobile"]
        + 50 * CATEGORY_WEIGHTS["technical"]
    )
    assert scores["category_scores"]["seo"]["passed"] == 1
    assert scores["category_scores"]["seo"]["failed"] == 1
    assert 0 <= scores["overall_score"] <= 100


def test_scoring_empty_category_defaults_zero():
    scores = compute_scores([check("seo", "pass", 100)])
    assert scores["category_scores"]["mobile"]["score"] == 0
    assert scores["category_scores"]["mobile"]["total"] == 0


def test_parse_recommendations_plain_json():
    text = '{"actions":[{"priority":"HIGH","difficulty":"MEDIUM","title":"Fix security headers","problem":"p","why_it_matters":"w","recommended_fix":"r"}]}'
    actions = parse_recommendations(text)
    assert len(actions) == 1
    assert actions[0]["priority"] == "HIGH"
    assert actions[0]["title"] == "Fix security headers"


def test_parse_recommendations_code_fence_and_prose():
    text = 'Sure! Here you go:\n```json\n{"actions":[{"priority":"LOW","difficulty":"EASY","title":"Add alt text","problem":"p","why_it_matters":"w","recommended_fix":"r"}]}\n```'
    actions = parse_recommendations(text)
    assert len(actions) == 1
    assert actions[0]["priority"] == "LOW"


def test_parse_recommendations_garbage_returns_empty():
    assert parse_recommendations("not json at all") == []


def test_parse_recommendations_sanitizes_priority():
    text = '{"actions":[{"priority":"EXTREME","difficulty":"IMPOSSIBLE","title":"X","problem":"p","why_it_matters":"w","recommended_fix":"r"}]}'
    actions = parse_recommendations(text)
    assert actions[0]["priority"] == "MEDIUM"
    assert actions[0]["difficulty"] == "MEDIUM"


def test_rules_engine_uses_only_real_findings():
    ctx = {
        "checks": [
            {"id": "security_https", "status": "fail", "score": 0, "title": "HTTPS missing",
             "description": "desc", "recommendation": "Enable HTTPS", "weight": 1.5},
            {"id": "seo_title_exists", "status": "pass", "score": 100, "title": "Title present",
             "description": "desc", "recommendation": "Keep", "weight": 1.0},
        ]
    }
    actions = RulesEngineProvider().generate(ctx)
    assert len(actions) == 1
    assert actions[0]["title"] == "HTTPS missing"
    assert actions[0]["priority"] == "CRITICAL"


def test_rules_engine_uses_structured_fields_for_distinct_problem_and_why():
    ctx = {
        "checks": [
            {
                "id": "security_https", "status": "fail", "score": 0, "title": "HTTPS missing",
                "what_was_checked": "We checked whether the site is served over HTTPS.",
                "actual_result": "The site is served over plain HTTP.",
                "why_it_matters": "Visitor data can be intercepted.",
                "how_to_fix": "Install an SSL certificate and redirect to HTTPS.",
                "weight": 1.5,
            }
        ]
    }
    actions = RulesEngineProvider().generate(ctx)
    assert len(actions) == 1
    assert actions[0]["problem"] == "The site is served over plain HTTP."
    assert actions[0]["why_it_matters"] == "Visitor data can be intercepted."
    assert actions[0]["recommended_fix"] == "Install an SSL certificate and redirect to HTTPS."
    assert actions[0]["problem"] != actions[0]["why_it_matters"]


def test_priority_system_has_four_levels():
    assert priority_for_status("fail", 10) == "CRITICAL"
    assert priority_for_status("fail", 60) == "HIGH"
    assert priority_for_status("warning", 40) == "MEDIUM"
    assert priority_for_status("warning", 70) == "LOW"
    assert priority_for_status("pass", 100) == "PASS"


def test_scoring_transparency_includes_contributions_and_explanation():
    scores = compute_scores(
        [
            check("seo", "pass", 100, weight=2.0),
            check("seo", "fail", 0, weight=1.0),
        ]
    )
    seo = scores["category_scores"]["seo"]
    assert "raw_score" in seo
    assert "weighted_average" in seo
    assert "total_weight" in seo
    assert len(seo["checks"]) == 2
    assert seo["checks"][0]["contribution"] == 0.0
    assert "explanation" in seo
    assert "methodology" in scores
    assert "overall_explanation" in scores
    assert seo["weighted_contribution"] == round(seo["score"] * seo["weight"], 2)


def test_error_code_mapping_from_fetch_errors():
    from app.services.audit_runner import error_code_from_exception

    assert error_code_from_exception(FetchError("t", "safe", kind="timeout")) == "timeout"
    assert error_code_from_exception(FetchError("t", "safe", kind="ssl_error")) == "ssl_error"
    assert error_code_from_exception(FetchError("t", "safe", kind="too_large")) == "page_too_large"
    assert error_code_from_exception(FetchError("t", "safe", kind="http_5xx")) == "server_error"


def test_failed_audit_persists_error_code(client, monkeypatch):
    """A crawl timeout must mark the audit failed with a stable error_code."""
    import uuid as uuid_mod

    from app.core.database import SessionLocal
    from app.models import Audit
    from app.services.audit_runner import run_audit
    from app.services.crawler.fetcher import FetchError

    def _raise_timeout(*args, **kwargs):
        raise FetchError("timeout", "The website took too long to respond.", kind="timeout")

    monkeypatch.setattr("app.services.audit_runner.crawl", _raise_timeout)

    db = SessionLocal()
    audit = Audit(public_id=str(uuid_mod.uuid4()), url="https://example.com", status="queued")
    db.add(audit)
    db.commit()
    db.refresh(audit)
    audit_id = audit.id
    db.close()

    run_audit(audit_id)

    db = SessionLocal()
    row = db.get(Audit, audit_id)
    assert row.status == "failed"
    assert row.error_code == "timeout"
    assert "too long" in row.error_message
    db.close()


# --- API tests (isolated SQLite database) ---


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-pytest")
    monkeypatch.setenv("AI_PROVIDER", "none")
    from fastapi.testclient import TestClient

    from tests.testutil import build_test_app

    app = build_test_app(db_file, monkeypatch)
    with TestClient(app) as c:
        yield c


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_invalid_audit_url_rejected_safely(client):
    resp = client.post("/api/audits", json={"url": "http://localhost"})
    assert resp.status_code == 422
    assert "not allowed" in resp.json()["detail"].lower()


def test_register_login_logout_me_flow(client):
    resp = client.post("/api/auth/register", json={"email": "user@example.com", "password": "strongpass123"})
    assert resp.status_code == 201
    assert resp.json()["email"] == "user@example.com"

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "user@example.com"

    resp = client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert client.get("/api/auth/me").status_code == 401

    resp = client.post("/api/auth/login", json={"email": "user@example.com", "password": "strongpass123"})
    assert resp.status_code == 200


def test_register_duplicate_rejected(client):
    client.post("/api/auth/register", json={"email": "dup@example.com", "password": "strongpass123"})
    resp = client.post("/api/auth/register", json={"email": "dup@example.com", "password": "strongpass123"})
    assert resp.status_code == 409


def test_history_requires_auth(client):
    assert client.get("/api/audits").status_code == 401


def _create_owned_audit(db, user_id, public_id, status="completed", score=70):
    from app.models import Audit

    audit = Audit(
        public_id=public_id,
        user_id=user_id,
        url="https://example.com",
        status=status,
        overall_score=score if status == "completed" else None,
        results={"partial": False, "checks": []} if status == "completed" else None,
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    return audit


def test_cross_user_audit_access_is_blocked(client):
    """User B must never be able to view or delete user A's audit."""
    from app.core.database import SessionLocal
    from app.models import User

    client.post("/api/auth/register", json={"email": "alice@example.com", "password": "strongpass123"})
    db = SessionLocal()
    alice = db.query(User).filter_by(email="alice@example.com").first()
    _create_owned_audit(db, alice.id, "private-audit-0001", status="completed", score=82)
    db.close()

    client.post("/api/auth/logout")
    client.post("/api/auth/register", json={"email": "bob@example.com", "password": "strongpass123"})

    assert client.get("/api/audits/private-audit-0001").status_code == 403
    assert client.get("/api/audits/private-audit-0001/report").status_code == 403
    assert client.delete("/api/audits/private-audit-0001").status_code == 403
    assert client.get("/api/audits").json() == []

    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"email": "alice@example.com", "password": "strongpass123"})
    assert client.get("/api/audits/private-audit-0001").status_code == 200
    assert client.get("/api/audits/private-audit-0001/report").status_code == 200
    assert client.delete("/api/audits/private-audit-0001").status_code == 200


def test_anonymous_audit_remains_shareable(client):
    from app.core.database import SessionLocal

    db = SessionLocal()
    _create_owned_audit(db, None, "anonymous-audit-0001", status="completed", score=64)
    db.close()

    resp = client.get("/api/audits/anonymous-audit-0001")
    assert resp.status_code == 200
    assert resp.json()["url"] == "https://example.com"

    client.post("/api/auth/register", json={"email": "carol@example.com", "password": "strongpass123"})
    assert client.delete("/api/audits/anonymous-audit-0001").status_code == 403


def test_dashboard_stats_are_real(client):
    from app.core.database import SessionLocal
    from app.models import User

    client.post("/api/auth/register", json={"email": "dave@example.com", "password": "strongpass123"})
    db = SessionLocal()
    dave = db.query(User).filter_by(email="dave@example.com").first()
    _create_owned_audit(db, dave.id, "dave-audit-1", status="completed", score=90)
    _create_owned_audit(db, dave.id, "dave-audit-2", status="completed", score=70)
    _create_owned_audit(db, dave.id, "dave-audit-3", status="queued", score=None)
    db.close()

    stats = client.get("/api/audits/stats").json()
    assert stats["total_audits"] == 3
    assert stats["completed_audits"] == 2
    assert stats["average_score"] == 80
    assert stats["best_score"] == 90
    assert len(stats["recent_audits"]) == 3


def test_partial_audit_is_marked(client, monkeypatch):
    import uuid as uuid_mod

    from app.core.database import SessionLocal
    from app.models import Audit
    from app.services.audit_runner import run_audit
    from app.services.crawler.crawler import CrawlContext

    def _fake_crawl(*args, **kwargs):
        ctx = CrawlContext(start_url="https://example.com", domain="example.com")
        ctx.fetch_errors = [{"url": "https://example.com/about", "kind": "timeout", "message": "safe"}]
        return ctx

    def _raise_analyzer(*args, **kwargs):
        raise RuntimeError("boom")

    from app.services import audit_runner

    monkeypatch.setattr("app.services.audit_runner.crawl", _fake_crawl)
    monkeypatch.setattr(audit_runner.ANALYZERS[0], "analyze", _raise_analyzer)

    db = SessionLocal()
    audit = Audit(public_id=str(uuid_mod.uuid4()), url="https://example.com", status="queued")
    db.add(audit)
    db.commit()
    db.refresh(audit)
    audit_id = audit.id
    db.close()

    run_audit(audit_id)

    db = SessionLocal()
    row = db.get(Audit, audit_id)
    assert row.status == "completed"
    assert row.results["partial"] is True
    assert len(row.results["fetch_errors"]) == 1
    assert row.results["fetch_errors"][0]["kind"] == "timeout"
    assert len(row.results["analyzer_errors"]) == 1
    db.close()


def test_short_password_rejected(client):
    resp = client.post("/api/auth/register", json={"email": "x@example.com", "password": "short"})
    assert resp.status_code == 422
