"""Billing endpoints: checkout, subscription status, portal, webhook."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.services.billing import (
    BillingNotConfigured,
    create_checkout_session,
    create_portal_session,
    handle_webhook_event,
    subscription_payload,
)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/subscription")
def get_subscription(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return subscription_payload(db, user)


@router.post("/checkout")
def checkout(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        url = create_checkout_session(db, user)
    except BillingNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"url": url}


@router.post("/portal")
def portal(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        url = create_portal_session(db, user)
    except BillingNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"url": url}


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    signature = request.headers.get("stripe-signature", "")
    payload = await request.body()
    try:
        result = handle_webhook_event(db, payload, signature)
    except BillingNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # signature failures / Stripe errors must be explicit
        raise HTTPException(status_code=400, detail="Invalid webhook payload or signature.")
    return result
