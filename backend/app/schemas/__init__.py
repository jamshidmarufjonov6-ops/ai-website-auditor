"""Pydantic request/response schemas."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UserRegister(BaseModel):
    email: str = Field(..., max_length=320)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v) or len(v) > 320:
            raise ValueError("Please enter a valid email address.")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditCreate(BaseModel):
    url: str = Field(..., max_length=2048)
    language: str = Field(default="en", max_length=8)

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("en", "uz", "ru"):
            raise ValueError("Unsupported language.")
        return v

    @field_validator("url")
    @classmethod
    def validate_url_field(cls, v: str) -> str:
        from app.services.crawler.url_validator import URLValidationError, validate_url

        try:
            validated = validate_url(v)
        except URLValidationError as exc:
            raise ValueError(exc.safe_message)
        return validated.url


class AuditOut(BaseModel):
    public_id: str
    url: str
    status: str
    progress: int
    stage: str
    max_pages: Optional[int] = None
    language: str = "en"
    overall_score: Optional[int] = None
    category_scores: Optional[dict] = None
    summary: Optional[dict] = None
    results: Optional[dict] = None
    ai_recommendations: Optional[dict] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    previous_score: Optional[int] = None
    score_change: Optional[int] = None

    model_config = {"from_attributes": True}


class AuditListItem(BaseModel):
    public_id: str
    url: str
    status: str
    overall_score: Optional[int] = None
    started_at: datetime
    score_change: Optional[int] = None
    partial: Optional[bool] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
