"""Lightweight in-process audit queue.

The MVP deliberately avoids Celery/Redis: a small thread pool processes
audits with a concurrency cap and a short backlog. This keeps the product
simple to run locally while remaining a clean seam to swap for Celery later.
"""
from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict

from app.core.config import settings

logger = logging.getLogger(__name__)

_MAX_WORKERS = max(1, settings.MAX_CONCURRENT_AUDITS)
_MAX_IN_FLIGHT = _MAX_WORKERS + 4  # small backlog tolerance

_executor = ThreadPoolExecutor(max_workers=_MAX_WORKERS, thread_name_prefix="audit")
_in_flight: Dict[int, object] = {}
_lock = threading.Lock()


def enqueue_audit(audit_id: int) -> bool:
    """Queue an audit for background execution. Returns False when the queue is full."""
    with _lock:
        if len(_in_flight) >= _MAX_IN_FLIGHT:
            return False
        future = _executor.submit(_run, audit_id)
        _in_flight[audit_id] = future

    def _cleanup(fut: object) -> None:
        with _lock:
            _in_flight.pop(audit_id, None)

    future.add_done_callback(_cleanup)
    return True


def queue_depth() -> int:
    with _lock:
        return len(_in_flight)


def _run(audit_id: int) -> None:
    from app.services.audit_runner import run_audit

    try:
        run_audit(audit_id)
    except Exception:
        logger.exception("Unhandled error in audit worker for audit %s", audit_id)
