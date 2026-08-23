"""Tests for Alembic migrations and production startup guards."""
from __future__ import annotations

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import settings, validate_production_settings

EXPECTED_TABLES = {
    "users",
    "websites",
    "audits",
    "audit_results",
    "recommendations",
    "subscriptions",
    "webhook_events",
}


def _alembic_config() -> Config:
    from app.core.migrations import _BACKEND_DIR

    cfg = Config(str(_BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
    return cfg


def test_alembic_upgrade_creates_schema(tmp_path, monkeypatch):
    db_path = tmp_path / "migrated.db"
    url = f"sqlite:///{db_path}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)

    from app.core.migrations import run_migrations

    run_migrations()

    engine = create_engine(url)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        columns = {c["name"] for c in inspector.get_columns("audits")}
    finally:
        engine.dispose()
    assert EXPECTED_TABLES.issubset(tables)
    assert "error_code" in columns
    assert "max_pages" in columns
    assert "language" in columns


def test_alembic_downgrade_drops_schema(tmp_path, monkeypatch):
    db_path = tmp_path / "downgrade.db"
    url = f"sqlite:///{db_path}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)

    from app.core.migrations import run_migrations

    run_migrations()
    command.downgrade(_alembic_config(), "base")

    engine = create_engine(url)
    try:
        tables = set(inspect(engine).get_table_names())
    finally:
        engine.dispose()
    assert EXPECTED_TABLES.isdisjoint(tables)


def test_production_guard_rejects_default_secret(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "SECRET_KEY", "change-me-in-production-use-a-long-random-string")
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+psycopg://user:pass@localhost/db")
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        validate_production_settings()


def test_production_guard_rejects_sqlite(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "SECRET_KEY", "a-strong-random-secret")
    monkeypatch.setattr(settings, "DATABASE_URL", "sqlite:///./auditor.db")
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        validate_production_settings()


def test_production_guard_passes_with_safe_settings(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "SECRET_KEY", "a-strong-random-secret")
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+psycopg://user:pass@localhost/db")
    validate_production_settings()  # should not raise
