"""SQLAlchemy models: User, Website, Audit, AuditResult, Recommendation, Subscription, WebhookEvent."""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    audits: Mapped[List["Audit"]] = relationship(back_populates="user")
    subscription: Mapped[Optional["Subscription"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class Website(Base):
    __tablename__ = "websites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    domain: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_audited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    audits: Mapped[List["Audit"]] = relationship(back_populates="website")


class Audit(Base):
    __tablename__ = "audits"
    __table_args__ = (UniqueConstraint("website_id", "started_at", name="uq_website_started"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    website_id: Mapped[Optional[int]] = mapped_column(ForeignKey("websites.id"), nullable=True, index=True)

    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="queued", nullable=False)  # queued|running|completed|failed
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stage: Mapped[str] = mapped_column(String(120), default="Queued", nullable=False)
    max_pages: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # per-plan crawl limit
    language: Mapped[str] = mapped_column(String(8), default="en", nullable=False)

    overall_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    category_scores: Mapped[Optional[Dict]] = mapped_column(JSON, nullable=True)
    summary: Mapped[Optional[Dict]] = mapped_column(JSON, nullable=True)
    results: Mapped[Optional[Dict]] = mapped_column(JSON, nullable=True)  # full structured check results
    ai_recommendations: Mapped[Optional[Dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[Optional["User"]] = relationship(back_populates="audits")
    website: Mapped[Optional["Website"]] = relationship(back_populates="audits")
    recommendations: Mapped[List["Recommendation"]] = relationship(
        back_populates="audit", cascade="all, delete-orphan"
    )
    result_rows: Mapped[List["AuditResult"]] = relationship(
        back_populates="audit", cascade="all, delete-orphan"
    )


class AuditResult(Base):
    """Denormalized per-check rows kept for queryability/extensibility."""

    __tablename__ = "audit_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    audit_id: Mapped[int] = mapped_column(ForeignKey("audits.id"), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    check_id: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)  # pass|warning|fail
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0)

    audit: Mapped["Audit"] = relationship(back_populates="result_rows")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    audit_id: Mapped[int] = mapped_column(ForeignKey("audits.id"), index=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False)  # HIGH|MEDIUM|LOW
    difficulty: Mapped[str] = mapped_column(String(16), nullable=False)  # EASY|MEDIUM|HARD
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    problem: Mapped[str] = mapped_column(Text, nullable=False)
    why_it_matters: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_fix: Mapped[str] = mapped_column(Text, nullable=False)

    audit: Mapped["Audit"] = relationship(back_populates="recommendations")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(16), default="free", nullable=False)  # free|pro
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="subscription")


class WebhookEvent(Base):
    """Idempotency ledger for Stripe webhook events."""

    __tablename__ = "webhook_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
