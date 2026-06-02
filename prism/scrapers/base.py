"""Base class for all scrapers.

A scraper's job is narrow: pull items from a source and emit `RawEvent`s. It
does NOT normalise, dedup against the DB, or tag companies — that is the
normaliser's responsibility. Each subclass implements `fetch()`.
"""
from __future__ import annotations

import abc
import logging

import httpx

from prism.common.config import settings
from prism.common.redis_client import publish_many
from prism.common.schemas import RawEvent

log = logging.getLogger(__name__)


class BaseScraper(abc.ABC):
    #: short stable identifier, e.g. "reddit"
    source: str = "base"
    #: one of the CATEGORY_* constants
    category: str = "uncategorised"

    def __init__(self) -> None:
        self.client = httpx.Client(
            timeout=settings.http_timeout,
            headers={"User-Agent": settings.user_agent},
            follow_redirects=True,
        )

    @abc.abstractmethod
    def fetch(self) -> list[RawEvent]:
        """Pull from the source and return raw events. No side effects."""
        raise NotImplementedError

    def has_credentials(self) -> bool:
        """Override when a source needs keys. Controls sample-data fallback."""
        return True

    def run(self) -> int:
        """Fetch and publish to Redis. Returns the number published."""
        if not self.has_credentials() and not settings.allow_sample_data:
            log.warning("%s: no credentials and sample data disabled; skipping",
                        self.source)
            return 0
        events = self.fetch()
        for event in events:
            event.source = event.source or self.source
            event.category = self.category
        published = publish_many(events)
        return published

    def close(self) -> None:
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
