"""Programmatic Alembic migration runner used at application startup."""
from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/


def run_migrations() -> None:
    """Apply all pending Alembic migrations to the configured database."""
    ini_path = _BACKEND_DIR / "alembic.ini"
    cfg = Config(str(ini_path))
    cfg.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
    logger.info("Running database migrations (alembic upgrade head)")
    command.upgrade(cfg, "head")
    logger.info("Database migrations applied")
