"""Application configuration loaded from environment variables.

Never put real secrets in code. Copy .env.example to .env for local development.
"""
from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_NAME: str = "AI Website Auditor"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api"
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # --- CORS ---
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # --- Database ---
    # Local development defaults to SQLite so the app runs without extra services.
    # Production (or docker-compose) should use PostgreSQL, e.g.
    # DATABASE_URL=postgresql+psycopg://auditor:auditor@localhost:5432/auditor
    DATABASE_URL: str = "sqlite:///./auditor.db"

    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        """Accept Render's postgres:// URL and force the installed psycopg v3 driver."""
        if value.startswith("postgres://"):
            return "postgresql+psycopg://" + value[len("postgres://"):]
        if value.startswith("postgresql://"):
            return "postgresql+psycopg://" + value[len("postgresql://"):]
        return value

    # When true, the app runs `alembic upgrade head` on startup instead of
    # `Base.metadata.create_all`. Enable this in production deployments.
    RUN_MIGRATIONS_ON_STARTUP: bool = False

    # --- Redis (optional for MVP, reserved for future queue/cache work) ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Crawler limits ---
    MAX_PAGES: int = 5
    MAX_CRAWL_DEPTH: int = 1
    MAX_RESPONSE_BYTES: int = 5 * 1024 * 1024  # 5 MB per page
    REQUEST_TIMEOUT_SECONDS: float = 15.0
    USER_AGENT: str = "AIWebsiteAuditor/1.0 (+https://localhost; compliance@example.com)"
    CRAWLER_MAX_CONCURRENCY: int = 4

    # --- Rate limiting (simple in-memory sliding window) ---
    RATE_LIMIT_AUDIT_PER_HOUR: int = 20
    RATE_LIMIT_AUDIT_PER_MINUTE: int = 4
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10
    MAX_CONCURRENT_AUDITS: int = 2

    # --- AI provider ---
    # One of: none | deepseek | openai | anthropic
    # "none" uses the built-in rules engine so the product works without a key.
    AI_PROVIDER: str = "none"
    AI_API_KEY: str = ""
    AI_MODEL: str = ""
    AI_BASE_URL: str = ""
    AI_TIMEOUT_SECONDS: float = 45.0

    # --- Cookies ---
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # --- Plans / usage limits ---
    FREE_PLAN_MONTHLY_AUDITS: int = 3
    FREE_PLAN_MAX_PAGES: int = 5
    PRO_PLAN_MONTHLY_AUDITS: int = 30
    PRO_PLAN_MAX_PAGES: int = 20
    PRO_PLAN_MONTHLY_PRICE_USD: int = 19

    # --- Stripe (test mode; leave empty for local development without billing) ---
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRO_PRICE_ID: str = ""
    STRIPE_CURRENCY: str = "usd"
    STRIPE_BILLING_SUCCESS_URL: str = "http://localhost:3000/dashboard?billing=success"
    STRIPE_BILLING_CANCEL_URL: str = "http://localhost:3000/pricing?billing=cancelled"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_using_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.STRIPE_SECRET_KEY and self.STRIPE_PRO_PRICE_ID)


def validate_production_settings() -> None:
    """Refuse to start in production with unsafe defaults."""
    if not settings.is_production:
        return
    if settings.SECRET_KEY == "change-me-in-production-use-a-long-random-string":
        raise RuntimeError(
            "SECRET_KEY must be set to a strong random value when ENVIRONMENT=production."
        )
    if settings.is_using_sqlite:
        raise RuntimeError(
            "DATABASE_URL must point to PostgreSQL when ENVIRONMENT=production."
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
