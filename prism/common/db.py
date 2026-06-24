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
                 sentiment, url, event_timestamp, summary_text, weight, metrics,
                 dedup_hash, created_at)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                signal.weight,
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
                   url, event_timestamp, summary_text, weight, model_scores,
                   metrics
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


def recent_signals_for_company(
    company: str, hours: int, limit: int, per_category: int = 30
) -> list[dict]:
    """Signals for one company over the trailing window, newest first.

    `company` matches either ticker or canonical name. Used to assemble the
    daily Claude brief, so it returns the Claude-ready `summary_text`.

    Caps each category at `per_category` before applying the overall `limit`,
    so a high-volume category (e.g. social sentiment) can't crowd out sparse
    but important ones (e.g. SEC filings) — every category that has signals in
    the window stays represented in the brief.
    """
    with get_cursor() as cur:
        cur.execute(
            """
            WITH ranked AS (
                SELECT id, source, category, company, ticker, title, sentiment,
                       url, event_timestamp, summary_text, weight, metrics,
                       row_number() OVER (
                           PARTITION BY category
                           ORDER BY weight DESC, event_timestamp DESC
                       ) AS rn
                FROM signals
                WHERE (upper(ticker) = upper(%(company)s)
                       OR lower(company) = lower(%(company)s))
                  AND event_timestamp >= now() - (%(hours)s * interval '1 hour')
            )
            SELECT id, source, category, company, ticker, title, sentiment,
                   url, event_timestamp, summary_text, weight, metrics
            FROM ranked
            WHERE rn <= %(per_category)s
            ORDER BY weight DESC, event_timestamp DESC
            LIMIT %(limit)s
            """,
            {"company": company, "hours": hours, "limit": limit,
             "per_category": per_category},
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


def daily_series(company: str, days: int) -> list[dict]:
    """Per-category daily aggregates for one company over the trailing window.

    Powers the dashboard's 30-day charts. Each row carries the values a chart
    might plot: `count` (volume), `avg_sentiment` (sentiment/reviews), and
    `avg_interest` (Google Trends 0-100). The frontend picks the field per chart.
    """
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT category,
                   date_trunc('day', event_timestamp)::date AS day,
                   count(*) AS count,
                   avg(sentiment) AS avg_sentiment,
                   avg((metrics->>'interest')::float)
                       FILTER (WHERE metrics ? 'interest') AS avg_interest
            FROM signals
            WHERE (upper(ticker) = upper(%(company)s)
                   OR lower(company) = lower(%(company)s))
              AND event_timestamp >= now() - (%(days)s * interval '1 day')
            GROUP BY category, day
            ORDER BY day
            """,
            {"company": company, "days": days},
        )
        return cur.fetchall()


def unnotified_alerts(limit: int) -> list[dict]:
    """Alerts that haven't been included in an emailed digest yet, newest first."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, company, ticker, category, metric, value, deviation,
                   direction, summary_text, created_at
            FROM alerts
            WHERE notified_at IS NULL
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def mark_alerts_notified(alert_ids: list[int]) -> None:
    if not alert_ids:
        return
    with get_cursor(commit=True) as cur:
        cur.execute(
            "UPDATE alerts SET notified_at = now() WHERE id = ANY(%s)",
            (alert_ids,),
        )


def weekly_aggregates(company: str) -> list[dict]:
    """This-week vs last-week aggregates per category for correlation analysis."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
              category,
              avg(sentiment) FILTER (
                WHERE event_timestamp >= now() - interval '7 days') AS sent_this,
              avg(sentiment) FILTER (
                WHERE event_timestamp >= now() - interval '14 days'
                  AND event_timestamp <  now() - interval '7 days') AS sent_last,
              count(*) FILTER (
                WHERE event_timestamp >= now() - interval '7 days') AS cnt_this,
              count(*) FILTER (
                WHERE event_timestamp >= now() - interval '14 days'
                  AND event_timestamp <  now() - interval '7 days') AS cnt_last,
              avg((metrics->>'interest')::float) FILTER (
                WHERE event_timestamp >= now() - interval '7 days'
                  AND metrics ? 'interest') AS int_this,
              avg((metrics->>'interest')::float) FILTER (
                WHERE event_timestamp >= now() - interval '14 days'
                  AND event_timestamp <  now() - interval '7 days'
                  AND metrics ? 'interest') AS int_last
            FROM signals
            WHERE (upper(ticker) = upper(%(company)s)
                   OR lower(company) = lower(%(company)s))
              AND event_timestamp >= now() - interval '14 days'
            GROUP BY category
            """,
            {"company": company},
        )
        return cur.fetchall()


def get_cached_earnings(company: str) -> dict | None:
    """Most recent cached earnings row for a company (ticker or name match)."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT company, ticker, next_earnings_date, source_searched_at, note
            FROM company_earnings
            WHERE upper(ticker) = upper(%(company)s)
               OR lower(company) = lower(%(company)s)
            LIMIT 1
            """,
            {"company": company},
        )
        return cur.fetchone()


def upsert_earnings(
    company: str,
    ticker: str | None,
    next_earnings_date,
    note: str | None = None,
) -> None:
    """Cache a company's next earnings date, stamping the search time to now()."""
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO company_earnings
                (company, ticker, next_earnings_date, source_searched_at, note)
            VALUES (%s, %s, %s, now(), %s)
            ON CONFLICT (company) DO UPDATE
                SET ticker             = EXCLUDED.ticker,
                    next_earnings_date = EXCLUDED.next_earnings_date,
                    source_searched_at = now(),
                    note               = EXCLUDED.note
            """,
            (company, ticker, next_earnings_date, note),
        )


def weekly_signal_aggregates(company: str) -> list[dict]:
    """Per-(week, category) aggregates across ALL weeks of a company's signals.

    `week_start` is the Monday of each ISO week (UTC). For each category present
    in a week it returns the row count plus the average sentiment and average
    search-interest where applicable. The composite engine
    (`prism/analysis/composite.py`) normalises and combines these. A category
    only appears for a week if it has at least one signal that week — so a
    missing category means "no data", which the engine treats as absent.
    """
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                date_trunc('week', event_timestamp)::date AS week_start,
                category,
                count(*) AS n,
                avg(sentiment) AS avg_sentiment,
                avg((metrics->>'interest')::float)
                    FILTER (WHERE metrics ? 'interest') AS avg_interest
            FROM signals
            WHERE upper(ticker) = upper(%(company)s)
               OR lower(company) = lower(%(company)s)
            GROUP BY week_start, category
            ORDER BY week_start, category
            """,
            {"company": company},
        )
        return cur.fetchall()


def upsert_weekly_score(
    company: str,
    week_start,
    composite_score: float | None,
    net_positive: bool | None,
    signals_present: int,
) -> None:
    """Persist one company-week composite score idempotently."""
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO weekly_scores
                (company, week_start, composite_score, net_positive,
                 signals_present, computed_at)
            VALUES (%s, %s, %s, %s, %s, now())
            ON CONFLICT (company, week_start) DO UPDATE
                SET composite_score = EXCLUDED.composite_score,
                    net_positive    = EXCLUDED.net_positive,
                    signals_present = EXCLUDED.signals_present,
                    computed_at     = now()
            """,
            (company, week_start, composite_score, net_positive, signals_present),
        )


def get_weekly_scores(company: str) -> list[dict]:
    """All stored weekly scores for a company, oldest week first."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT company, week_start, composite_score, net_positive,
                   signals_present, computed_at
            FROM weekly_scores
            WHERE lower(company) = lower(%(company)s)
               OR upper(company) = upper(%(company)s)
            ORDER BY week_start
            """,
            {"company": company},
        )
        return cur.fetchall()


def upsert_prices(ticker: str, rows: list[tuple]) -> int:
    """Idempotently store (date, close) pairs for a ticker. Returns row count."""
    if not rows:
        return 0
    with get_cursor(commit=True) as cur:
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO daily_prices (ticker, date, close_price)
            VALUES %s
            ON CONFLICT (ticker, date) DO UPDATE
                SET close_price = EXCLUDED.close_price
            """,
            [(ticker, d, c) for d, c in rows],
        )
    return len(rows)


def get_prices(ticker: str) -> list[dict]:
    """All stored daily closes for a ticker, oldest first."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT date, close_price
            FROM daily_prices
            WHERE ticker = %s
            ORDER BY date
            """,
            (ticker,),
        )
        return cur.fetchall()


def upsert_backtest_result(result: dict) -> None:
    """Persist one company's backtest summary idempotently."""
    with get_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO backtest_results
                (company, ticker, total_weeks_tested, net_positive_weeks,
                 hit_rate, base_rate, avg_relative_return, weeks_available,
                 small_sample, data_quality, computed_at)
            VALUES
                (%(company)s, %(ticker)s, %(total_weeks_tested)s,
                 %(net_positive_weeks)s, %(hit_rate)s, %(base_rate)s,
                 %(avg_relative_return)s, %(weeks_available)s, %(small_sample)s,
                 %(data_quality)s, now())
            ON CONFLICT (company) DO UPDATE SET
                ticker              = EXCLUDED.ticker,
                total_weeks_tested  = EXCLUDED.total_weeks_tested,
                net_positive_weeks  = EXCLUDED.net_positive_weeks,
                hit_rate            = EXCLUDED.hit_rate,
                base_rate           = EXCLUDED.base_rate,
                avg_relative_return = EXCLUDED.avg_relative_return,
                weeks_available     = EXCLUDED.weeks_available,
                small_sample        = EXCLUDED.small_sample,
                data_quality        = EXCLUDED.data_quality,
                computed_at         = now()
            """,
            result,
        )


def get_backtest_results(company: str | None = None) -> list[dict]:
    """Stored backtest summaries — one company, or all (alphabetical)."""
    with get_cursor() as cur:
        if company:
            cur.execute(
                "SELECT * FROM backtest_results WHERE lower(company) = lower(%s)",
                (company,),
            )
        else:
            cur.execute("SELECT * FROM backtest_results ORDER BY company")
        return cur.fetchall()
