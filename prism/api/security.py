"""API auth and rate limiting.

Two FastAPI dependencies:

* `require_api_key` — if `PRISM_API_KEY` is configured, require a matching
  `X-API-Key` header; otherwise it's a no-op (open, for local dev).
* `RateLimiter` — a per-IP fixed-window limiter backed by the Redis we already
  run. The public frontend is a SPA, so any key it carries is effectively public;
  rate limiting is the real protection against someone hammering the LLM-backed
  endpoints and burning API credits. Fails *open* if Redis is unavailable so a
  cache blip can't take the API down.
"""
from __future__ import annotations

import logging
import time

from fastapi import Header, HTTPException, Request, status

from prism.common.config import settings

log = logging.getLogger(__name__)


def require_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> None:
    expected = settings.prism_api_key
    if not expected:
        return  # auth disabled
    if not x_api_key or x_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )


def client_ip(request: Request) -> str:
    """Best-effort client IP, honouring a proxy's X-Forwarded-For when present."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def RateLimiter(limit: int, window_seconds: int, name: str):
    """Build a per-IP fixed-window rate-limit dependency.

    Returns a *function* (not a class instance) so FastAPI can resolve its
    `request: Request` annotation — a callable instance has no `__globals__`,
    which breaks annotation resolution under `from __future__ import annotations`
    and makes FastAPI treat `request` as a query param.

        Depends(RateLimiter(limit=60, window_seconds=60, name="default"))
    """

    def dependency(request: Request) -> None:
        if limit <= 0:
            return  # disabled
        ip = client_ip(request)
        bucket = int(time.time()) // window_seconds
        key = f"rl:{name}:{ip}:{bucket}"
        try:
            from prism.common.redis_client import get_client

            redis = get_client()
            count = redis.incr(key)
            if count == 1:
                redis.expire(key, window_seconds)
        except Exception:  # noqa: BLE001 - fail open; availability > strictness
            log.warning("rate limiter: Redis unavailable, allowing request",
                        exc_info=True)
            return
        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded ({limit} requests per "
                       f"{window_seconds}s). Please slow down.",
                headers={"Retry-After": str(window_seconds)},
            )

    return dependency
