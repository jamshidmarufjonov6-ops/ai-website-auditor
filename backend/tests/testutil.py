"""Shared test helper: build a FastAPI app bound to an isolated SQLite DB."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def build_test_app(db_path, monkeypatch):
    """Rebind the application to a fresh SQLite database for one test."""
    from app.core.config import settings
    from app.core.database import Base
    from app.core.rate_limit import audit_per_hour, audit_per_minute, auth_per_minute
    import app.core.database as database
    import app.main as main

    # In-memory rate limiters are process-global; reset for the shared TestClient key.
    audit_per_minute.reset("testclient")
    audit_per_hour.reset("testclient")
    auth_per_minute.reset("testclient")

    url = f"sqlite:///{db_path}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)

    engine = create_engine(url, connect_args={"check_same_thread": False})
    database.engine = engine
    database.SessionLocal = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
    )
    main.engine = engine

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return main.app
