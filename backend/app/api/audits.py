"""Audit endpoints: create, poll, stats, history, delete, report.

Privacy model:
  * Anonymous audits (user_id is NULL) are shareable by UUID — this powers
    the "no signup required" flow and copied share links.
  * User-owned audits are private: only the owning user may view, report,
    or delete them. Accessing another user's audit returns 403.
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.core.rate_limit import audit_per_hour, audit_per_minute, client_key
from app.models import Audit, User
from app.schemas import AuditCreate, AuditListItem, AuditOut
from app.workers.queue import enqueue_audit

router = APIRouter(prefix="/audits", tags=["audits"])


def _serialize_audit(audit: Audit, previous_score: Optional[int] = None) -> dict:
    data = {
        "public_id": audit.public_id,
        "url": audit.url,
        "status": audit.status,
        "progress": audit.progress,
        "stage": audit.stage,
        "max_pages": audit.max_pages,
        "language": audit.language,
        "overall_score": audit.overall_score,
        "category_scores": audit.category_scores,
        "summary": audit.summary,
        "results": audit.results,
        "ai_recommendations": audit.ai_recommendations,
        "error_message": audit.error_message,
        "error_code": audit.error_code,
        "started_at": audit.started_at,
        "completed_at": audit.completed_at,
        "previous_score": previous_score,
        "score_change": (audit.overall_score - previous_score) if (audit.overall_score is not None and previous_score is not None) else None,
    }
    return data


def _get_previous_score(db: Session, audit: Audit) -> Optional[int]:
    if audit.website_id is None:
        return None
    prev = (
        db.query(Audit)
        .filter(
            Audit.website_id == audit.website_id,
            Audit.id != audit.id,
            Audit.status == "completed",
            Audit.overall_score.isnot(None),
        )
        .order_by(Audit.completed_at.desc())
        .first()
    )
    return prev.overall_score if prev else None


def _get_audit_for_access(db: Session, public_id: str, user: Optional[User]) -> Audit:
    """Return an audit the current user may access, or raise 404/403."""
    audit = db.query(Audit).filter(Audit.public_id == public_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found.")
    # User-owned audits are private. Anonymous audits remain shareable by UUID.
    if audit.user_id is not None and (user is None or user.id != audit.user_id):
        raise HTTPException(status_code=403, detail="You do not have access to this audit.")
    return audit


@router.post("", response_model=AuditOut, status_code=status.HTTP_201_CREATED)
def create_audit(
    payload: AuditCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    key = client_key(request)
    if not audit_per_minute.allow(key):
        raise HTTPException(status_code=429, detail="You are starting audits too quickly. Please wait a moment.")
    if not audit_per_hour.allow(key):
        raise HTTPException(status_code=429, detail="You have reached the hourly audit limit. Please try again later.")

    # Server-side monthly plan limit (database is the source of truth).
    max_pages = None
    if user is not None:
        from app.services.billing import get_monthly_usage, get_or_create_subscription, plan_limits

        sub = get_or_create_subscription(db, user)
        limits = plan_limits(sub.plan)
        used = get_monthly_usage(db, user)
        if used >= limits["monthly_audits"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "monthly_limit_reached",
                    "message": "You have reached your monthly audit limit. Upgrade to Pro to continue.",
                },
            )
        max_pages = limits["max_pages"]

    audit = Audit(
        public_id=str(uuid.uuid4()),
        user_id=user.id if user else None,
        url=payload.url.strip(),
        status="queued",
        progress=0,
        stage="Queued",
        max_pages=max_pages,
        language=payload.language,
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)

    if not enqueue_audit(audit.id):
        audit.status = "failed"
        audit.error_message = "Our auditors are busy right now. Please try again in a moment."
        audit.error_code = "crawl_failed"
        db.commit()
        db.refresh(audit)

    return _serialize_audit(audit)


@router.get("", response_model=List[AuditListItem])
def list_audits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    audits = (
        db.query(Audit)
        .filter(Audit.user_id == user.id)
        .order_by(Audit.started_at.desc())
        .limit(100)
        .all()
    )
    items = []
    for audit in audits:
        previous = _get_previous_score(db, audit)
        items.append(
            {
                "public_id": audit.public_id,
                "url": audit.url,
                "status": audit.status,
                "overall_score": audit.overall_score,
                "started_at": audit.started_at,
                "score_change": (audit.overall_score - previous) if (audit.overall_score is not None and previous is not None) else None,
                "partial": bool(audit.results and audit.results.get("partial")),
                "error_code": audit.error_code,
                "error_message": audit.error_message,
            }
        )
    return items


@router.get("/stats")
def audit_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Real statistics for the authenticated user's dashboard."""
    audits = db.query(Audit).filter(Audit.user_id == user.id).all()
    completed = [a for a in audits if a.status == "completed" and a.overall_score is not None]
    scores = [a.overall_score for a in completed]
    recent = sorted(audits, key=lambda a: a.started_at, reverse=True)[:5]
    return {
        "total_audits": len(audits),
        "completed_audits": len(completed),
        "average_score": round(sum(scores) / len(scores)) if scores else None,
        "best_score": max(scores) if scores else None,
        "recent_audits": [
            {
                "public_id": a.public_id,
                "url": a.url,
                "status": a.status,
                "overall_score": a.overall_score,
                "started_at": a.started_at,
                "partial": bool(a.results and a.results.get("partial")),
                "error_code": a.error_code,
            }
            for a in recent
        ],
    }


@router.get("/{public_id}", response_model=AuditOut)
def get_audit(
    public_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    audit = _get_audit_for_access(db, public_id, user)
    return _serialize_audit(audit, _get_previous_score(db, audit))


@router.get("/{public_id}/report", response_model=AuditOut)
def get_report(
    public_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    audit = _get_audit_for_access(db, public_id, user)
    if audit.status != "completed":
        raise HTTPException(status_code=409, detail="This audit has not finished yet.")
    return _serialize_audit(audit, _get_previous_score(db, audit))


@router.delete("/{public_id}")
def delete_audit(public_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    audit = _get_audit_for_access(db, public_id, user)
    if audit.user_id is None or audit.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own audits.")
    db.delete(audit)
    db.commit()
    return {"ok": True}
