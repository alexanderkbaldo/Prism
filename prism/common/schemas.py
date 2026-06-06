"""Shared data contracts that flow through the pipeline.

`RawEvent`  -> what every scraper emits onto the Redis Stream.
`Signal`    -> the normalised, company-tagged record the worker persists.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Source categories shared across the platform.
CATEGORY_SENTIMENT = "sentiment"
CATEGORY_HIRING = "hiring"
CATEGORY_TRENDS = "trends"
CATEGORY_REVIEWS = "reviews"
CATEGORY_FILINGS = "filings"


class RawEvent(BaseModel):
    """A single unit of work produced by a scraper.

    `external_id` must be stable for a given logical item at a given source so
    that re-running a scraper does not create duplicate signals downstream.
    """

    source: str  # e.g. "reddit", "stocktwits", "indeed", "edgar"
    category: str  # one of the CATEGORY_* constants
    external_id: str
    title: str | None = None
    body: str | None = None
    url: str | None = None
    author: str | None = None
    # The timestamp as reported by the source, in whatever format it arrived.
    raw_timestamp: str | None = None
    # Numeric/structured metrics specific to the source (score, rating, etc.).
    metrics: dict[str, Any] = Field(default_factory=dict)
    # The complete original payload, retained for auditing / reprocessing.
    payload: dict[str, Any] = Field(default_factory=dict)
    fetched_at: datetime = Field(default_factory=utcnow)

    def to_json(self) -> str:
        return self.model_dump_json()

    @classmethod
    def from_json(cls, data: str) -> "RawEvent":
        return cls.model_validate_json(data)

    def dedup_hash(self) -> str:
        """Stable fingerprint used to suppress duplicates.

        Keyed on source + external_id (identity) rather than body so that an
        edited item is still treated as the same logical event.
        """
        key = f"{self.source}::{self.external_id}"
        return hashlib.sha256(key.encode("utf-8")).hexdigest()


class Signal(BaseModel):
    """A normalised, company-attributed observation ready for storage."""

    raw_event_id: int | None = None
    source: str
    category: str
    company: str  # canonical company name, e.g. "Robinhood"
    ticker: str | None = None
    title: str | None = None
    body: str | None = None
    sentiment: float | None = None  # [-1, 1] when applicable
    url: str | None = None
    event_timestamp: datetime  # always UTC
    # Plain-English description of the signal, built at normalisation time and
    # safe to pass straight to the Claude API in Phase 2 (no further shaping).
    summary_text: str | None = None
    # Source-based relevance/quality weight (1.0 = baseline). Higher = more
    # reliable (verified StockTwits, licensed hiring data, SEC filings); lower =
    # generic (Reddit). Factored into brief generation.
    weight: float = 1.0
    metrics: dict[str, Any] = Field(default_factory=dict)
    dedup_hash: str = ""
    created_at: datetime = Field(default_factory=utcnow)

    def compute_dedup_hash(self) -> str:
        payload = json.dumps(
            {
                "source": self.source,
                "company": self.company,
                "title": self.title,
                "ts": self.event_timestamp.isoformat(),
            },
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
