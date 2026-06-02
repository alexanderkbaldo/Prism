"""Two-layer deduplication.

Layer 1 (fast, in-memory of the cluster): a Redis SET of fingerprints we've
already seen, so repeated stream deliveries / overlapping scraper runs are
dropped without touching Postgres.

Layer 2 (authoritative): a UNIQUE constraint on `signals.dedup_hash` (see
`sql/init.sql`) so a duplicate that slips past Redis is still rejected at write
time. This module only owns layer 1.
"""
from __future__ import annotations

from prism.common.config import settings
from prism.common.redis_client import get_client


def is_new(fingerprint: str) -> bool:
    """Atomically record a fingerprint; return True the first time we see it."""
    added = get_client().sadd(settings.dedup_set_key, fingerprint)
    return bool(added)


def reset() -> None:
    """Clear the dedup set (test / maintenance helper)."""
    get_client().delete(settings.dedup_set_key)
