"""The normaliser worker.

Consumes `RawEvent`s from the Redis Stream consumer group and, for each:
  1. persists the raw event (idempotent, by source + external_id);
  2. drops cluster-level duplicates via the Redis dedup set;
  3. tags every company mentioned (a single raw event can mention several);
  4. converts the source timestamp to UTC;
  5. scores sentiment for text-bearing categories;
  6. writes one normalised `Signal` per (raw event, company), with a final
     DB-level dedup guard on `dedup_hash`.

Runs as a long-lived loop; designed to scale horizontally — start N replicas and
the consumer group load-balances the stream across them.
"""
from __future__ import annotations

import logging
import os
import signal as signal_module
import socket
import time

from prism.common.companies import tag_companies
from prism.common.db import insert_raw_event, insert_signal
from prism.common.redis_client import ack, ensure_group, read_group
from prism.common.schemas import (
    CATEGORY_REVIEWS,
    CATEGORY_SENTIMENT,
    RawEvent,
    Signal,
)
from prism.ai import scoring
from prism.normaliser import anomaly, dedup
from prism.normaliser.sentiment import score
from prism.normaliser.summaries import build as build_summary
from prism.normaliser.timestamps import to_utc

log = logging.getLogger(__name__)

_SENTIMENT_CATEGORIES = {CATEGORY_SENTIMENT, CATEGORY_REVIEWS}


class Normaliser:
    def __init__(self, consumer_name: str | None = None) -> None:
        self.consumer_name = consumer_name or f"{socket.gethostname()}-{os.getpid()}"
        self._running = True

    def stop(self, *_args) -> None:
        log.info("shutdown requested")
        self._running = False

    def process_event(self, event: RawEvent) -> int:
        """Normalise a single raw event into 0..N signals. Returns # written."""
        # Layer-1 dedup: skip raw events we've already fully processed.
        if not dedup.is_new(event.dedup_hash()):
            log.debug("duplicate raw event %s; skipping", event.external_id)
            return 0

        raw_event_id = insert_raw_event(event)

        companies = tag_companies(event.title, event.body, event.author)
        if not companies:
            log.debug("no company tagged for %s; raw stored only",
                      event.external_id)
            return 0

        written = 0
        for company in companies:
            sentiment = None
            if event.category in _SENTIMENT_CATEGORIES:
                sentiment = score(
                    text=" ".join(filter(None, [event.title, event.body])),
                    basic_sentiment=event.metrics.get("basic_sentiment"),
                    rating=event.metrics.get("rating"),
                )

            sig = Signal(
                raw_event_id=raw_event_id,
                source=event.source,
                category=event.category,
                company=company.name,
                ticker=company.ticker,
                title=event.title,
                body=event.body,
                sentiment=sentiment,
                url=event.url,
                event_timestamp=to_utc(event.raw_timestamp),
                summary_text=build_summary(event, company, sentiment),
                metrics=event.metrics,
            )
            sig.dedup_hash = sig.compute_dedup_hash()
            signal_id = insert_signal(sig)
            if signal_id is not None:
                written += 1
                # Anomaly detection runs inline on each freshly stored signal.
                anomaly.check(sig, signal_id)
                # Secondary AI scoring (Claude + GPT-4o) — no-op unless enabled
                # and keys are configured.
                if scoring.should_score(sig.category, sig.summary_text):
                    try:
                        scoring.score(signal_id, sig.category, sig.summary_text)
                    except Exception:  # noqa: BLE001 - never block ingestion
                        log.exception("model scoring failed for signal %s",
                                      signal_id)
        return written

    def run(self) -> None:
        signal_module.signal(signal_module.SIGINT, self.stop)
        signal_module.signal(signal_module.SIGTERM, self.stop)
        ensure_group()
        log.info("normaliser %s started", self.consumer_name)

        while self._running:
            try:
                batch = read_group(self.consumer_name, count=100, block_ms=5000)
            except Exception:  # noqa: BLE001 - keep the worker alive on blips
                log.exception("read_group failed; backing off")
                time.sleep(2)
                continue

            for message_id, event in batch:
                try:
                    written = self.process_event(event)
                    ack(message_id)
                    if written:
                        log.info("%s -> %d signal(s)", event.external_id, written)
                except Exception:  # noqa: BLE001
                    # Leave unacked so it is redelivered to another consumer.
                    log.exception("failed processing %s", message_id)

        log.info("normaliser %s stopped", self.consumer_name)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    Normaliser().run()


if __name__ == "__main__":
    main()
