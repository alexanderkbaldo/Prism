"""Thin Redis Streams helpers shared by producers and the consumer.

Scrapers call `publish()`; the normaliser uses `ensure_group()` + `read_group()`
+ `ack()` to consume with at-least-once semantics via a consumer group.
"""
from __future__ import annotations

import logging
from typing import Iterable

import redis

from prism.common.config import settings
from prism.common.schemas import RawEvent

log = logging.getLogger(__name__)

_client: redis.Redis | None = None


def get_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    return _client


def publish(event: RawEvent) -> str:
    """Append a raw event to the stream. Returns the generated stream ID."""
    client = get_client()
    return client.xadd(settings.raw_stream, {"event": event.to_json()})


def publish_many(events: Iterable[RawEvent]) -> int:
    count = 0
    for event in events:
        publish(event)
        count += 1
    log.info("published %d events to %s", count, settings.raw_stream)
    return count


def ensure_group() -> None:
    """Create the consumer group (and stream) if it does not yet exist."""
    client = get_client()
    try:
        client.xgroup_create(
            settings.raw_stream, settings.consumer_group, id="0", mkstream=True
        )
        log.info("created consumer group %s", settings.consumer_group)
    except redis.ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


def read_group(consumer: str, count: int = 50, block_ms: int = 5000):
    """Read a batch of new messages for this consumer.

    Returns a list of (message_id, RawEvent) tuples.
    """
    client = get_client()
    response = client.xreadgroup(
        settings.consumer_group,
        consumer,
        {settings.raw_stream: ">"},
        count=count,
        block=block_ms,
    )
    results: list[tuple[str, RawEvent]] = []
    for _stream, messages in response or []:
        for message_id, fields in messages:
            try:
                results.append((message_id, RawEvent.from_json(fields["event"])))
            except Exception:  # noqa: BLE001 - poison message, ack & drop
                log.exception("failed to decode message %s; acking", message_id)
                ack(message_id)
    return results


def ack(message_id: str) -> None:
    get_client().xack(settings.raw_stream, settings.consumer_group, message_id)
