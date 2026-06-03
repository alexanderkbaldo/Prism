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
                   url, event_timestamp, summary_text, model_scores, metrics
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


def update_model_scores(signal_id: int, scores: dict) -> None:
    """Attach secondary AI scores to a signal row (Phase 2 scoring path)."""
    with get_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE signals SET model_scores = %s WHERE id = %s",
            (json.dumps(scores), signal_id),
        )


def unscored_signals(categories: list[str], limit: int) -> list[dict]:
    """Text-bearing signals that haven't been model-scored yet, newest first.

    Drives the background `scorer` worker. `model_scores = '{}'` means no scorer
    has touched the row.
    """
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, category, summary_text
            FROM signals
            WHERE model_scores = '{}'::jsonb
              AND summary_text IS NOT NULL
              AND category = ANY(%s)
            ORDER BY id DESC
            LIMIT %s
            """,
            (categories, limit),
        )
        return cur.fetchall()


def recent_signals_for_company(company: str, hours: int, limit: int) -> list[dict]:
    """Signals for one company over the trailing window, newest first.

    `company` matches either ticker or canonical name. Used to assemble the
    daily Claude brief, so it returns the Claude-ready `summary_text`.
    """
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, source, category, company, ticker, title, sentiment,
                   url, event_timestamp, summary_text, metrics
            FROM signals
            WHERE (upper(ticker) = upper(%(company)s)
                   OR lower(company) = lower(%(company)s))
              AND event_timestamp >= now() - (%(hours)s * interval '1 hour')
            ORDER BY event_timestamp DESC
            LIMIT %(limit)s
            """,
            {"company": company, "hours": hours, "limit": limit},
        )
        return cur.fetchall()


def insert_brief(
    company: str,
    ticker: str | None,
    model: str,
    signal_count: int,
    brief_text: str,
) -> int:
    """Persist a generated research brief; returns its row id."""
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO company_briefs
                (company, ticker, model, signal_count, brief_text)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (company, ticker, model, signal_count, brief_text),
        )
        return cur.fetchone()["id"]


def get_latest_brief(company: str) -> dict | None:
    """Most recent brief for a company (ticker or name match)."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, company, ticker, generated_at, model, signal_count,
                   brief_text
            FROM company_briefs
            WHERE upper(ticker) = upper(%(company)s)
               OR lower(company) = lower(%(company)s)
            ORDER BY generated_at DESC
            LIMIT 1
            """,
            {"company": company},
        )
        return cur.fetchone()
