"""Tests for Stripe billing, subscriptions, webhooks, and usage limits."""
from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_file = tmp_path / "billing_test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-pytest")
    monkeypatch.setenv("AI_PROVIDER", "none")
    # Ensure Stripe is off by default for these tests unless enabled explicitly.
    monkeypatch.setenv("STRIPE_SECRET_KEY", "")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "")
    monkeypatch.setenv("STRIPE_PRO_PRICE_ID", "")

    from fastapi.testclient import TestClient

    from tests.testutil import build_test_app

    app = build_test_app(db_file, monkeypatch)
    with TestClient(app) as c:
        yield c


def _register(client, email):
    resp = client.post("/api/auth/register", json={"email": email, "password": "strongpass123"})
    assert resp.status_code == 201
    return resp.json()


def _sign_payload(payload: bytes, secret: str) -> str:
    timestamp = int(time.time())
    signed = f"{timestamp}.{payload.decode()}".encode()
    signature = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={signature}"


def _event_payload(event_id, event_type, obj, customer="cus_test", subscription="sub_test"):
    return json.dumps(
        {
            "id": event_id,
            "type": event_type,
            "data": {"object": obj},
            "object": "event",
        }
    ).encode()


def test_free_plan_default_and_billing_requires_auth(client):
    _register(client, "free@example.com")
    sub = client.get("/api/billing/subscription").json()
    assert sub["plan"] == "free"
    assert sub["status"] == "active"
    assert sub["payments_configured"] is False
    assert sub["usage"]["limit"] == settings.FREE_PLAN_MONTHLY_AUDITS

    # Unauthenticated billing access is blocked.
    client.post("/api/auth/logout")
    assert client.get("/api/billing/subscription").status_code == 401
    assert client.post("/api/billing/checkout").status_code == 401
    assert client.post("/api/billing/portal").status_code == 401


def test_stripe_not_configured_returns_clear_errors(client):
    _register(client, "noconfig@example.com")
    assert client.post("/api/billing/checkout").status_code == 503
    assert client.post("/api/billing/portal").status_code == 503
    assert client.post("/api/billing/webhook", content=b"{}").status_code == 503


def test_checkout_creates_session_when_configured(client, monkeypatch):
    _register(client, "checkout@example.com")

    import app.services.billing as billing

    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setattr(settings, "STRIPE_PRO_PRICE_ID", "price_test")

    def fake_session_create(**kwargs):
        assert kwargs["mode"] == "subscription"
        assert kwargs["customer_email"] == "checkout@example.com"
        return type("Session", (), {"url": "https://checkout.stripe.com/test"})

    monkeypatch.setattr(billing, "_stripe", lambda: type("Stripe", (), {"checkout": type("C", (), {"Session": type("S", (), {"create": staticmethod(fake_session_create)})})}))

    resp = client.post("/api/billing/checkout")
    assert resp.status_code == 200
    assert resp.json()["url"] == "https://checkout.stripe.com/test"


def test_webhook_signature_invalid_rejected(client, monkeypatch):
    _register(client, "webhook@example.com")
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setattr(settings, "STRIPE_PRO_PRICE_ID", "price_test")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test")

    payload = _event_payload("evt_invalid", "checkout.session.completed", {})
    resp = client.post(
        "/api/billing/webhook",
        content=payload,
        headers={"stripe-signature": "t=1,v1=badsignature"},
    )
    assert resp.status_code == 400


def test_checkout_completion_and_subscription_lifecycle(client, monkeypatch):
    from app.core.database import SessionLocal
    from app.models import User

    _register(client, "lifecycle@example.com")
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setattr(settings, "STRIPE_PRO_PRICE_ID", "price_pro")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test")

    db = SessionLocal()
    user = db.query(User).filter_by(email="lifecycle@example.com").first()
    user_id = user.id
    db.close()

    # checkout.session.completed stores Stripe ids.
    payload = _event_payload(
        "evt_checkout",
        "checkout.session.completed",
        {"mode": "subscription", "customer": "cus_1", "subscription": "sub_1", "metadata": {"user_id": str(user_id)}},
    )
    resp = client.post("/api/billing/webhook", content=payload, headers={"stripe-signature": _sign_payload(payload, "whsec_test")})
    assert resp.status_code == 200

    # customer.subscription.created upgrades to Pro with period.
    payload = _event_payload(
        "evt_sub_created",
        "customer.subscription.created",
        {
            "id": "sub_1",
            "customer": "cus_1",
            "status": "active",
            "cancel_at_period_end": False,
            "current_period_start": 1700000000,
            "current_period_end": 1702592000,
            "items": {"data": [{"price": {"id": "price_pro"}}]},
        },
    )
    resp = client.post("/api/billing/webhook", content=payload, headers={"stripe-signature": _sign_payload(payload, "whsec_test")})
    assert resp.status_code == 200

    sub = client.get("/api/billing/subscription").json()
    assert sub["plan"] == "pro"
    assert sub["status"] == "active"
    assert sub["stripe_customer_id"] == "cus_1"
    assert sub["stripe_subscription_id"] == "sub_1"
    assert sub["usage"]["limit"] == settings.PRO_PLAN_MONTHLY_AUDITS
    assert sub["cancel_at_period_end"] is False

    # Idempotency: replaying the same event does not change anything.
    before = client.get("/api/billing/subscription").json()
    resp = client.post("/api/billing/webhook", content=payload, headers={"stripe-signature": _sign_payload(payload, "whsec_test")})
    assert resp.status_code == 200
    assert resp.json()["idempotent"] is True
    after = client.get("/api/billing/subscription").json()
    assert before == after

    # customer.subscription.updated: cancel_at_period_end becomes true.
    payload = _event_payload(
        "evt_sub_updated",
        "customer.subscription.updated",
        {
            "id": "sub_1",
            "customer": "cus_1",
            "status": "active",
            "cancel_at_period_end": True,
            "current_period_start": 1700000000,
            "current_period_end": 1702592000,
            "items": {"data": [{"price": {"id": "price_pro"}}]},
        },
    )
    client.post("/api/billing/webhook", content=payload, headers={"stripe-signature": _sign_payload(payload, "whsec_test")})
    assert client.get("/api/billing/subscription").json()["cancel_at_period_end"] is True

    # invoice.payment_failed marks past_due.
    payload = _event_payload(
        "evt_payment_failed",
        "invoice.payment_failed",
        {"customer": "cus_1", "subscription": "sub_1"},
    )
    client.post("/api/billing/webhook", content=payload, headers={"stripe-signature": _sign_payload(payload, "whsec_test")})
    assert client.get("/api/billing/subscription").json()["status"] == "past_due"

    # customer.subscription.deleted downgrades to Free.
    payload = _event_payload(
        "evt_sub_deleted",
        "customer.subscription.deleted",
        {"id": "sub_1", "customer": "cus_1", "status": "canceled", "cancel_at_period_end": True, "items": {"data": []}},
    )
    client.post("/api/billing/webhook", content=payload, headers={"stripe-signature": _sign_payload(payload, "whsec_test")})
    sub = client.get("/api/billing/subscription").json()
    assert sub["plan"] == "free"
    assert sub["status"] == "canceled"


def test_billing_ownership_is_isolated(client):
    _register(client, "owner_a@example.com")
    a_sub = client.get("/api/billing/subscription").json()
    client.post("/api/auth/logout")
    _register(client, "owner_b@example.com")
    b_sub = client.get("/api/billing/subscription").json()
    # Each user only sees their own subscription; no cross-user data is exposed.
    assert a_sub["stripe_customer_id"] is None
    assert b_sub["stripe_customer_id"] is None
    assert a_sub["plan"] == "free" and b_sub["plan"] == "free"


def test_free_plan_usage_limit_blocks_extra_audits(client, monkeypatch):
    from app.core.rate_limit import audit_per_minute

    _register(client, "limited@example.com")
    audit_per_minute.reset("testclient")
    # Prevent background crawls; usage counts DB records, not crawl results.
    monkeypatch.setattr("app.workers.queue.enqueue_audit", lambda audit_id: True)

    for i in range(settings.FREE_PLAN_MONTHLY_AUDITS):
        resp = client.post("/api/audits", json={"url": "https://example.com"})
        assert resp.status_code == 201

    resp = client.post("/api/audits", json={"url": "https://example.com"})
    assert resp.status_code == 403
    detail = resp.json()["detail"]
    assert detail["code"] == "monthly_limit_reached"
    assert "monthly audit limit" in detail["message"]


def test_pro_plan_allows_more_audits(client, monkeypatch):
    from app.core.database import SessionLocal
    from app.core.rate_limit import audit_per_minute
    from app.models import Audit, User

    _register(client, "pro@example.com")
    audit_per_minute.reset("testclient")
    monkeypatch.setattr("app.workers.queue.enqueue_audit", lambda audit_id: True)

    db = SessionLocal()
    user = db.query(User).filter_by(email="pro@example.com").first()
    # Grant Pro directly (webhook path is covered separately).
    sub = user.subscription
    sub.plan = "pro"
    sub.status = "active"
    db.commit()

    # Create 30 audits directly in the DB (real records for usage counting).
    for i in range(settings.PRO_PLAN_MONTHLY_AUDITS):
        db.add(Audit(public_id=str(uuid.uuid4()), user_id=user.id, url="https://example.com", status="queued"))
    db.commit()
    db.close()

    resp = client.post("/api/audits", json={"url": "https://example.com"})
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "monthly_limit_reached"

    # Pro max_pages is applied to new audits before the limit is hit.
    db = SessionLocal()
    user = db.query(User).filter_by(email="pro@example.com").first()
    sub = user.subscription
    sub.plan = "free"
    sub.status = "active"
    db.commit()
    db.close()
    # Free limit is 3; delete direct records down to 2 to free a slot.
    db = SessionLocal()
    audits = db.query(Audit).filter(Audit.user_id == user.id).order_by(Audit.id.desc()).all()
    for a in audits[2:]:
        db.delete(a)
    db.commit()
    db.close()
    resp = client.post("/api/audits", json={"url": "https://example.com"})
    assert resp.status_code == 201
    assert resp.json()["max_pages"] == settings.FREE_PLAN_MAX_PAGES
