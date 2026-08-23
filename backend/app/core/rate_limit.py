"""In-memory sliding-window rate limiting.

Good enough for a single-instance MVP; swap for Redis in multi-instance
deployments (REDIS_URL is already available in config).
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from app.core.config import settings


class SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._events: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            events = self._events[key]
            while events and now - events[0] > self.window_seconds:
                events.popleft()
            if len(events) >= self.max_requests:
                return False
            events.append(now)
            return True

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)


audit_per_hour = SlidingWindowLimiter(settings.RATE_LIMIT_AUDIT_PER_HOUR, 3600)
audit_per_minute = SlidingWindowLimiter(settings.RATE_LIMIT_AUDIT_PER_MINUTE, 60)
auth_per_minute = SlidingWindowLimiter(settings.RATE_LIMIT_AUTH_PER_MINUTE, 60)


def client_key(request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
