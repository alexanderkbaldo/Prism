"""Postgres access layer.

Intentionally small: a connection pool plus two persistence helpers used by the
normaliser. SQL lives in `sql/init.sql`; this module only writes rows.
"""
from __future__ import annotations

import json
import logging
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

from prism.common.config import settings
from prism.common.schemas import RawEvent, Signal

log = logging.getLogger(__name__)

_pool: ThreadedConnectionPool | None = None


def get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(1, 10, dsn=settings.database_url)
    return _pool


@contextmanager
def get_cursor(commit: bool = False):
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def insert_raw_event(event: RawEvent) -> int:
    """Persist a raw event idempotently and return its row id.

    Uniqueness is on (source, external_id); a conflict returns the existing id
    so the same logical item is never stored twice.
    """
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO raw_events
                (source, category, external_id, title, body, url, author,
                 raw_timestamp, metrics, payload, fetched_at)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (source, external_id) DO UPDATE
                SET fetched_at = EXCLUDED.fetched_at
            RETURNING id
            """,
            (
                event.source,
                event.category,
                event.external_id,
                event.title,
                event.body,
                event.url,
                event.author,
                event.raw_timestamp,
                json.dumps(event.metrics),
                json.dumps(event.payload),
                event.fetched_at,
            ),
        )
        return cur.fetchone()["id"]


def insert_signal(signal: Signal) -> int | None:
    """Persist a normalised signal. Returns the row id, or None if it was a
    duplicate (suppressed by the unique dedup_hash constraint)."""
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO signals
                (raw_event_id, source, category, company, ticker, title, body,
                 sentiment, url, event_timestamp, summary_text, metrics,
                 dedup_hash, created_at)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (dedup_hash) DO NOTHING
            RETURNING id
            """,
            (
                signal.raw_event_id,
                signal.source,
                signal.category,
                signal.company,
                signal.ticker,
                signal.title,
                signal.body,
                signal.sentiment,
                signal.url,
                signal.event_timestamp,
                signal.summary_text,
                json.dumps(signal.metrics),
                signal.dedup_hash,
                signal.created_at,
            ),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def rolling_sentiment_stats(company: str, days: int, exclude_id: int) -> dict:
    """Mean/stddev/count of a company's sentiment over the trailing window,
    excluding the row we are currently evaluating."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT count(*)            AS n,
                   avg(sentiment)      AS mean,
                   stddev_samp(sentiment) AS std
            FROM signals
            WHERE company = %s
              AND sentiment IS NOT NULL
              AND id <> %s
              AND event_timestamp >= now() - (%s * interval '1 day')
            """,
            (company, exclude_id, days),
        )
        return cur.fetchone()


def insert_alert(alert: dict) -> int | None:
    """Persist an anomaly alert. Idempotent per signal via a unique constraint."""
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO alerts
                (signal_id, company, ticker, category, metric, value,
                 rolling_avg, rolling_std, deviation, direction, summary_text)
            VALUES
                (%(signal_id)s, %(company)s, %(ticker)s, %(category)s,
                 %(metric)s, %(value)s, %(rolling_avg)s, %(rolling_std)s,
                 %(deviation)s, %(direction)s, %(summary_text)s)
            ON CONFLICT (signal_id, metric) DO NOTHING
            RETURNING id
            """,
            alert,
        )
        row = cur.fetchone()
        return row["id"] if row else None


def query_signals(
    company: str | None = None,
    category: str | None = None,
    days: int = 7,
    limit: int = 200,
) -> list[dict]:
    """Read signals for the API layer. `company` matches ticker or name."""
    clauses = ["event_timestamp >= now() - (%(days)s * interval '1 day')"]
    params: dict = {"days": days, "limit": limit}
    if company:
        clauses.append("(upper(ticker) = upper(%(company)s) "
                       "OR lower(company) = lower(%(company)s))")
        params["company"] = company
    if category:
        clauses.append("category = %(category)s")
        params["category"] = category
    where = " AND ".join(clauses)
    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT id, source, category, company, ticker, title, sentiment,
                   url, event_timestamp, summary_text, metrics
            FROM signals
            WHERE {where}
            ORDER BY event_timestamp DESC
            LIMIT %(limit)s
            """,
            params,
        )
        return cur.fetchall()


def query_alerts(company: str | None = None, days: int = 7,
                 limit: int = 100) -> list[dict]:
    clauses = ["created_at >= now() - (%(days)s * interval '1 day')"]
    params: dict = {"days": days, "limit": limit}
    if company:
        clauses.append("(upper(ticker) = upper(%(company)s) "
                       "OR lower(company) = lower(%(company)s))")
        params["company"] = company
    where = " AND ".join(clauses)
    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT id, signal_id, company, ticker, category, metric, value,
                   rolling_avg, rolling_std, deviation, direction,
                   summary_text, created_at
            FROM alerts
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT %(limit)s
            """,
            params,
        )
        return cur.fetchall()
