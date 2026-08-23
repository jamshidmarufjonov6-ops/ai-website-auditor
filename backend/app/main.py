"""FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import audits, auth, billing
from app.core.config import settings, validate_production_settings
from app.core.database import Base, engine
from app.core.migrations import run_migrations
from app.services.crawler.url_validator import URLValidationError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast in production with unsafe defaults (default SECRET_KEY / SQLite).
    validate_production_settings()

    if settings.RUN_MIGRATIONS_ON_STARTUP:
        run_migrations()
    else:
        # Dev convenience: keep existing behavior for local SQLite databases.
        # Production deployments should set RUN_MIGRATIONS_ON_STARTUP=true.
        Base.metadata.create_all(bind=engine)
    logger.info("Database ready (%s)", "sqlite" if settings.is_using_sqlite else "postgresql")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="AI-powered website auditing for SEO, performance, accessibility, security and technical health.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(URLValidationError)
async def url_validation_handler(request: Request, exc: URLValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.safe_message})


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    # Surface the first, human-safe validation message.
    first = exc.errors()[0] if exc.errors() else {}
    message = first.get("msg", "Invalid request.")
    if "Value error," in message:
        message = message.split("Value error,", 1)[1].strip()
    return JSONResponse(status_code=422, content={"detail": message})


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "environment": settings.ENVIRONMENT}


app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(audits.router, prefix=settings.API_PREFIX)
app.include_router(billing.router, prefix=settings.API_PREFIX)
