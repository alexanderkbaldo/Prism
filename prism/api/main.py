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

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from prism.api.security import RateLimiter, require_api_key
from prism.common.companies import COMPANIES
from prism.common.config import settings

log = logging.getLogger(__name__)

app = FastAPI(
    title="Prism API",
    version="0.1.0",
    description="Alternative-data signals for fintech equity research.",
)

# Allow the configured browser origins to call the API. Defaults to the local
# Vite dev server; set CORS_ALLOW_ORIGINS to the deployed frontend URL in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_TYPES = ["sentiment", "hiring", "trends", "reviews", "filings"]

# Auth + per-IP rate limiting applied to data/chat routes (health check stays
# open). /chat gets a stricter limit since each call spends Claude credits.
PROTECTED = [Depends(require_api_key),
             Depends(RateLimiter(settings.rate_limit_per_minute, 60, "default"))]
CHAT_PROTECTED = [Depends(require_api_key),
                  Depends(RateLimiter(settings.chat_rate_limit_per_minute, 60,
                                      "chat"))]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/companies", dependencies=PROTECTED)
def companies() -> list[dict[str, str | None]]:
    return [{"name": c.name, "ticker": c.ticker} for c in COMPANIES]


@app.get("/signals", dependencies=PROTECTED)
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


@app.get("/alerts", dependencies=PROTECTED)
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


@app.get("/brief", dependencies=PROTECTED)
def get_brief(
    company: str = Query(..., description="Ticker (HOOD) or name (Robinhood)"),
) -> dict[str, Any]:
    """Return the latest AI-generated research brief for a company."""
    try:
        from prism.common.db import get_latest_brief

        row = get_latest_brief(company)
        if row:
            return {"source": "db", "brief": _serialise(row)}
        return {"source": "db", "brief": None,
                "message": f"No brief yet for {company}."}
    except Exception:  # noqa: BLE001 - DB not up; serve a mock brief
        log.exception("brief query failed; returning mock data")
        return {"source": "mock", "brief": _mock_brief(company)}


@app.get("/series", dependencies=PROTECTED)
def get_series(
    company: str = Query(..., description="Ticker (HOOD) or name (Robinhood)"),
    days: int = Query(30, ge=1, le=365, description="Trailing window in days"),
) -> dict[str, Any]:
    """Daily per-category aggregates for the dashboard's historical charts.

    Each point carries `count`, `avg_sentiment`, and `avg_interest`; the chart
    for each signal plots the field that fits it.
    """
    try:
        from prism.common.db import daily_series

        rows = daily_series(company, days)
        series: dict[str, list] = {}
        for r in rows:
            series.setdefault(r["category"], []).append(_serialise(r))
        return {"source": "db", "company": company, "days": days, "series": series}
    except Exception:  # noqa: BLE001 - DB not up; serve mock so charts render
        log.exception("series query failed; returning mock data")
        return {"source": "mock", "company": company, "days": days,
                "series": _mock_series(days)}


@app.get("/correlation", dependencies=PROTECTED)
def get_correlation(
    company: str = Query(..., description="Ticker (HOOD) or name (Robinhood)"),
) -> dict[str, Any]:
    """Detect signals moving the same direction this week → a combined insight."""
    try:
        from prism.api.correlation import compute
        from prism.common.db import weekly_aggregates

        result = compute(weekly_aggregates(company))
        return {"source": "db", "company": company, **result}
    except Exception:  # noqa: BLE001 - DB not up; serve a mock insight
        log.exception("correlation query failed; returning mock data")
        return {"source": "mock", "company": company,
                "signals": [
                    {"category": "sentiment", "label": "Sentiment",
                     "direction": "bullish", "detail": "avg +0.30 this week"},
                    {"category": "hiring", "label": "Hiring",
                     "direction": "bullish", "detail": "+20% postings vs last week"},
                    {"category": "trends", "label": "Search interest",
                     "direction": "bullish", "detail": "+18% search vs last week"},
                ],
                "aligned": {"direction": "bullish", "count": 3},
                "insight": "3 signals aligned bullish this week"}


@app.get("/earnings", dependencies=PROTECTED)
def get_earnings(
    company: str = Query(..., description="Ticker (HOOD) or name (Robinhood)"),
) -> dict[str, Any]:
    """Next scheduled earnings date for a company (Claude web search, 24h cache).

    Returns {company, next_earnings_date, days_until, source_searched_at}. If
    the lookup yields nothing (no key, DB down, or not found) a clearly-labelled
    mock date is returned so the dashboard indicator still renders.
    """
    try:
        from prism.ai.earnings import get_next_earnings

        res = get_next_earnings(company)
        if res.get("next_earnings_date"):
            return {"source": "db", **res}
    except Exception:  # noqa: BLE001
        log.exception("earnings lookup failed; returning mock data")

    return {"source": "mock", **_mock_earnings(company)}


class ChatTurn(BaseModel):
    role: str  # "user" or "assistant"
    text: str = ""


class ChatRequest(BaseModel):
    question: str
    company: str  # ticker (HOOD) or canonical name (Robinhood)
    # Prior turns in this conversation, oldest first. Lets follow-ups like
    # "why?" resolve against earlier context. Server caps the length.
    history: list[ChatTurn] = []


@app.post("/chat", dependencies=CHAT_PROTECTED)
def chat(req: ChatRequest) -> StreamingResponse:
    """Answer a question about one company, grounded in its Prism data.

    Fetches the company's recent signals, alerts, and latest research brief,
    passes them to Claude as context, and streams the answer back as
    text/plain chunks (consume incrementally on the client).
    """
    from prism.ai.chat import stream_answer

    history = [{"role": t.role, "text": t.text} for t in req.history]

    def generate():
        try:
            yield from stream_answer(req.question, req.company, history=history)
        except ValueError as e:
            yield f"[error] {e}"
        except Exception:  # noqa: BLE001
            log.exception("chat failed")
            yield "[error] Something went wrong generating the answer."

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")


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


def _mock_brief(company: str) -> dict:
    ticker = company.upper()
    match = next((c for c in COMPANIES
                  if c.ticker == ticker or c.name.lower() == company.lower()), None)
    return {
        "company": match.name if match else company,
        "ticker": match.ticker if match else ticker,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": "mock",
        "signal_count": 3,
        "brief_text": (
            f"## Sentiment Trend\nRetail sentiment on {ticker} is mildly "
            "positive, led by options-revenue chatter.\n\n"
            "## Hiring Signal\nActive senior engineering postings suggest "
            "continued investment.\n\n"
            "## Search Momentum\nSearch interest is steady week-over-week.\n\n"
            "## App Store Signal\nApp ratings remain high (~4.5★).\n\n"
            "## Regulatory Activity\nNo material SEC filings in the window.\n\n"
            "**Bottom line:** constructive across data sources; no red flags. "
            "(mock data — Postgres not reachable)"
        ),
    }


def _mock_earnings(company: str) -> dict:
    """A plausible upcoming earnings date so the indicator renders standalone."""
    match = next((c for c in COMPANIES
                  if c.ticker == company.upper()
                  or c.name.lower() == company.lower()), None)
    days_until = 46
    next_date = (datetime.now(timezone.utc).date() + timedelta(days=days_until))
    return {
        "company": match.name if match else company,
        "ticker": match.ticker if match else company.upper(),
        "next_earnings_date": next_date.isoformat(),
        "days_until": days_until,
        "source_searched_at": datetime.now(timezone.utc).isoformat(),
    }


def _mock_series(days: int) -> dict[str, list]:
    """Deterministic sample time series so the charts render without Postgres."""
    import math

    today = datetime.now(timezone.utc).date()
    n = min(days, 14)
    out: dict[str, list] = {}
    for idx, cat in enumerate(["sentiment", "hiring", "trends", "reviews"]):
        points = []
        for i in range(n):
            day = (today - timedelta(days=(n - 1 - i))).isoformat()
            wave = math.sin((i + idx) / 2)
            points.append({
                "day": day,
                "count": 2 + (i + idx) % 5,
                "avg_sentiment": round(wave * 0.6, 2),
                "avg_interest": 55 + round(wave * 20),
            })
        out[cat] = points
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
