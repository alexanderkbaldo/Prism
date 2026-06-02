"""Prism query API (Phase 2 surface, scaffolded in Phase 1).

A thin FastAPI layer over the `signals` and `alerts` tables. The headline
endpoint is:

    GET /signals?company=HOOD&type=sentiment&days=7

`company` matches either a ticker (HOOD) or a canonical name (Robinhood); `type`
maps to a signal category. If Postgres is unreachable the endpoints return
clearly-labelled mock data so the API is demoable on its own.

Run:  uvicorn prism.api.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, Query

from prism.common.companies import COMPANIES

log = logging.getLogger(__name__)

app = FastAPI(
    title="Prism API",
    version="0.1.0",
    description="Alternative-data signals for fintech equity research.",
)

VALID_TYPES = ["sentiment", "hiring", "trends", "reviews", "filings"]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/companies")
def companies() -> list[dict[str, str | None]]:
    return [{"name": c.name, "ticker": c.ticker} for c in COMPANIES]


@app.get("/signals")
def get_signals(
    company: str | None = Query(None, description="Ticker (HOOD) or name (Robinhood)"),
    type: str | None = Query(None, description=f"Signal category: {VALID_TYPES}"),
    days: int = Query(7, ge=1, le=90, description="Trailing window in days"),
    limit: int = Query(200, ge=1, le=1000),
) -> dict[str, Any]:
    """Return normalised signals filtered by company, type, and time window."""
    try:
        from prism.common.db import query_signals

        rows = query_signals(company=company, category=type, days=days, limit=limit)
        return {"source": "db", "count": len(rows),
                "filters": {"company": company, "type": type, "days": days},
                "signals": [_serialise(r) for r in rows]}
    except Exception:  # noqa: BLE001 - DB not up; serve mock so API is demoable
        log.exception("signals query failed; returning mock data")
        rows = _mock_signals(company, type)
        return {"source": "mock", "count": len(rows),
                "filters": {"company": company, "type": type, "days": days},
                "signals": rows}


@app.get("/alerts")
def get_alerts(
    company: str | None = Query(None),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """Return anomaly alerts (>1σ moves) filtered by company and window."""
    try:
        from prism.common.db import query_alerts

        rows = query_alerts(company=company, days=days, limit=limit)
        return {"source": "db", "count": len(rows),
                "alerts": [_serialise(r) for r in rows]}
    except Exception:  # noqa: BLE001
        log.exception("alerts query failed; returning mock data")
        return {"source": "mock", "count": 0, "alerts": []}


def _serialise(row: dict) -> dict:
    """Make a DB row JSON-safe (datetimes -> ISO strings)."""
    out = dict(row)
    for key, value in out.items():
        if isinstance(value, datetime):
            out[key] = value.isoformat()
    return out


def _mock_signals(company: str | None, category: str | None) -> list[dict]:
    now = datetime.now(timezone.utc)
    samples = [
        {"company": "Robinhood", "ticker": "HOOD", "category": "sentiment",
         "sentiment": 0.8, "source": "reddit",
         "summary_text": "Robinhood (HOOD): positive reddit chatter — "
                         "\"DD: $HOOD crushing it on options revenue\""},
        {"company": "Affirm", "ticker": "AFRM", "category": "hiring",
         "sentiment": None, "source": "linkedin",
         "summary_text": "Affirm (AFRM): new LinkedIn job posting (Remote) — "
                         "Risk Data Scientist"},
    ]
    out = []
    for i, s in enumerate(samples):
        if company and company.upper() not in (s["ticker"], s["company"].upper()):
            continue
        if category and category != s["category"]:
            continue
        out.append({**s, "id": i + 1,
                    "event_timestamp": (now - timedelta(hours=i)).isoformat()})
    return out


def serve() -> None:
    """Console-script entry point: run the API with uvicorn."""
    import os

    import uvicorn

    uvicorn.run(
        "prism.api.main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "8000")),
    )
