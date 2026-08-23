"""Stripe billing and subscription management.

The application must keep working when Stripe is not configured. In that case
checkout/portal endpoints return a clear "not configured" error and users
remain on the Free plan.

Only the backend talks to Stripe. Payment status is never trusted from the
browser; the database Subscription row is the source of truth.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Subscription, User, WebhookEvent

logger = logging.getLogger(__name__)


class BillingNotConfigured(Exception):
    """Raised when Stripe is not configured in the environment."""


def _stripe():
    if not settings.stripe_enabled:
        raise BillingNotConfigured("Payments are not configured in this environment.")
    import stripe

    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def get_or_create_subscription(db: Session, user: User) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    if sub is None:
        sub = Subscription(user_id=user.id, plan="free", status="active")
        db.add(sub)
        db.commit()
        db.refresh(sub)
    return sub


def plan_limits(plan: str) -> Dict:
    if plan == "pro":
        return {
            "plan": "pro",
            "monthly_audits": settings.PRO_PLAN_MONTHLY_AUDITS,
            "max_pages": settings.PRO_PLAN_MAX_PAGES,
        }
    return {
        "plan": "free",
        "monthly_audits": settings.FREE_PLAN_MONTHLY_AUDITS,
        "max_pages": settings.FREE_PLAN_MAX_PAGES,
    }


def get_monthly_usage(db: Session, user: User) -> int:
    """Count real audit records created by the user in the current UTC month."""
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    from app.models import Audit

    return (
        db.query(Audit)
        .filter(Audit.user_id == user.id, Audit.started_at >= start_of_month)
        .count()
    )


def subscription_payload(db: Session, user: User) -> Dict:
    sub = get_or_create_subscription(db, user)
    limits = plan_limits(sub.plan)
    usage = get_monthly_usage(db, user)
    return {
        "plan": sub.plan,
        "status": sub.status,
        "stripe_customer_id": sub.stripe_customer_id,
        "stripe_subscription_id": sub.stripe_subscription_id,
        "current_period_start": sub.current_period_start,
        "current_period_end": sub.current_period_end,
        "cancel_at_period_end": sub.cancel_at_period_end,
        "usage": {"used": usage, "limit": limits["monthly_audits"]},
        "max_pages": limits["max_pages"],
        "payments_configured": settings.stripe_enabled,
        "pro_price_display": f"${settings.PRO_PLAN_MONTHLY_PRICE_USD}/month",
    }


def create_checkout_session(db: Session, user: User) -> str:
    if not settings.stripe_enabled:
        raise BillingNotConfigured("Payments are not configured in this environment.")
    stripe = _stripe()
    sub = get_or_create_subscription(db, user)

    customer = sub.stripe_customer_id
    checkout_params = {
        "mode": "subscription",
        "line_items": [{"price": settings.STRIPE_PRO_PRICE_ID, "quantity": 1}],
        "success_url": settings.STRIPE_BILLING_SUCCESS_URL,
        "cancel_url": settings.STRIPE_BILLING_CANCEL_URL,
        "metadata": {"user_id": str(user.id)},
        "client_reference_id": str(user.id),
        "allow_promotion_codes": True,
    }
    if customer:
        checkout_params["customer"] = customer
    else:
        checkout_params["customer_email"] = user.email

    session = stripe.checkout.Session.create(**checkout_params)
    return session.url or ""


def create_portal_session(db: Session, user: User) -> str:
    if not settings.stripe_enabled:
        raise BillingNotConfigured("Payments are not configured in this environment.")
    stripe = _stripe()
    sub = get_or_create_subscription(db, user)
    if not sub.stripe_customer_id:
        raise BillingNotConfigured("No Stripe customer exists for this account yet.")
    portal = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=settings.STRIPE_BILLING_SUCCESS_URL,
    )
    return portal.url or ""


def _find_user_by_customer(db: Session, customer_id: Optional[str]) -> Optional[User]:
    if not customer_id:
        return None
    sub = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first()
    if sub:
        return db.get(User, sub.user_id)
    return None


def _apply_subscription_object(db: Session, sub_data: Dict, event_type: str) -> None:
    """Apply a Stripe subscription object to the database (idempotent by event)."""
    customer_id = sub_data.get("customer")
    subscription_id = sub_data.get("id")
    status = sub_data.get("status", "active")
    cancel_at_period_end = bool(sub_data.get("cancel_at_period_end", False))

    # Map Stripe statuses to our stored status values.
    if status in ("canceled", "unpaid", "incomplete_expired"):
        stored_status = "canceled"
    elif status in ("past_due", "unpaid") or event_type == "invoice.payment_failed":
        stored_status = "past_due"
    else:
        stored_status = status  # active, trialing, incomplete, etc.

    plan = "free"
    if status in ("active", "trialing", "past_due", "incomplete"):
        items = sub_data.get("items", {}).get("data", [])
        for item in items:
            price_id = item.get("price", {}).get("id")
            if price_id == settings.STRIPE_PRO_PRICE_ID:
                plan = "pro"

    period_start = sub_data.get("current_period_start")
    period_end = sub_data.get("current_period_end")
    start_dt = datetime.fromtimestamp(period_start, tz=timezone.utc) if period_start else None
    end_dt = datetime.fromtimestamp(period_end, tz=timezone.utc) if period_end else None

    sub = None
    if subscription_id:
        sub = db.query(Subscription).filter(Subscription.stripe_subscription_id == subscription_id).first()
    if sub is None:
        user = _find_user_by_customer(db, customer_id)
        if user is None:
            logger.warning("Stripe webhook: no local user for customer %s", customer_id)
            return
        sub = get_or_create_subscription(db, user)

    sub.plan = plan
    sub.status = stored_status
    sub.stripe_customer_id = customer_id
    sub.stripe_subscription_id = subscription_id
    sub.current_period_start = start_dt
    sub.current_period_end = end_dt
    sub.cancel_at_period_end = cancel_at_period_end
    db.commit()


def _handle_checkout_completed(db: Session, session: Dict) -> None:
    if session.get("mode") != "subscription":
        return
    user_id = session.get("metadata", {}).get("user_id") or session.get("client_reference_id")
    if not user_id:
        return
    user = db.get(User, int(user_id))
    if user is None:
        return
    sub = get_or_create_subscription(db, user)
    sub.stripe_customer_id = session.get("customer")
    sub.stripe_subscription_id = session.get("subscription")
    db.commit()


def handle_webhook_event(db: Session, payload: bytes, signature: str) -> Dict:
    """Verify and process a Stripe webhook event (idempotent)."""
    if not settings.stripe_enabled or not settings.STRIPE_WEBHOOK_SECRET:
        raise BillingNotConfigured("Payments are not configured in this environment.")
    stripe = _stripe()
    event = stripe.Webhook.construct_event(
        payload, signature, settings.STRIPE_WEBHOOK_SECRET
    )
    event_id = event["id"]
    event_type = event["type"]

    # Idempotency ledger.
    existing = db.query(WebhookEvent).filter(WebhookEvent.event_id == event_id).first()
    if existing:
        return {"received": True, "idempotent": True, "event": event_id}

    data = event["data"]["object"]
    if event_type == "checkout.session.completed":
        _handle_checkout_completed(db, data)
    elif event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        _apply_subscription_object(db, data, event_type)
    elif event_type == "invoice.payment_failed":
        sub_data = data.get("subscription")
        if sub_data:
            _apply_subscription_object(db, {"id": sub_data, "status": "past_due"}, event_type)
        else:
            # Mark subscriptions for this customer as past_due.
            customer_id = data.get("customer")
            sub = db.query(Subscription).filter(Subscription.stripe_customer_id == customer_id).first()
            if sub:
                sub.status = "past_due"
                db.commit()

    try:
        db.add(WebhookEvent(event_id=event_id, event_type=event_type))
        db.commit()
    except IntegrityError:
        db.rollback()  # Already processed concurrently.
    return {"received": True, "idempotent": False, "event": event_id}
