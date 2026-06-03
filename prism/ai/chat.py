"""Conversational Q&A over a company's Prism data.

`stream_answer()` assembles a company's recent alternative-data context —
signals, anomaly alerts, and the latest AI research brief — and streams a
grounded, analyst-style answer to a user's question via Claude.

The heavy, stable instruction block is sent as a cached system prompt
(`cache_control: ephemeral`) so repeated questions reuse the prefix; the
per-question context goes in the user turn, after the cache breakpoint.
"""
from __future__ import annotations

import logging
from typing import Any, Iterator

from prism.common.companies import COMPANIES
from prism.common.config import settings

log = logging.getLogger(__name__)

# Static instructions — kept byte-stable so they cache across questions.
CHAT_SYSTEM = """\
You are a senior equity research analyst at Prism, an alternative-data platform \
covering fintech companies. A user asks you a question about one company. You \
are given that company's recent alternative-data context: normalised signals \
(Reddit/StockTwits sentiment, hiring, Google Trends, App Store reviews, SEC \
filings), anomaly alerts, and the latest AI-generated research brief.

Answer the user's question using ONLY the provided context. Rules:
- Ground every claim in the supplied signals, alerts, or brief. Never invent data.
- If the context does not contain enough information to answer, say so plainly \
and point to what data would be needed.
- Be concise and decision-useful. Lead with the direct answer, then the \
supporting evidence (cite the source/category, e.g. "App Store reviews" or \
"a >1σ sentiment alert on 2026-06-01").
- Where relevant, note sentiment direction and any cross-source corroboration.
- Do not give personalised financial advice or price targets.\
"""


def _resolve_company(ticker_or_name: str):
    t = ticker_or_name.strip()
    return next(
        (c for c in COMPANIES
         if (c.ticker and c.ticker.upper() == t.upper())
         or c.name.lower() == t.lower()),
        None,
    )


def _format_signals(signals: list[dict[str, Any]]) -> str:
    if not signals:
        return "No signals in the recent window."
    lines = []
    for s in signals:
        ts = s.get("event_timestamp")
        ts_str = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        sentiment = s.get("sentiment")
        sent = f" [sentiment={sentiment:+.2f}]" if sentiment is not None else ""
        summary = s.get("summary_text") or s.get("title") or ""
        lines.append(f"- ({s.get('category')}/{s.get('source')}) "
                     f"{ts_str}{sent}: {summary}")
    return "\n".join(lines)


def _format_alerts(alerts: list[dict[str, Any]]) -> str:
    if not alerts:
        return "No anomaly alerts in the recent window."
    lines = []
    for a in alerts:
        ts = a.get("created_at")
        ts_str = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        msg = a.get("summary_text") or ""
        direction = a.get("direction") or ""
        lines.append(f"- ({a.get('category')}) {ts_str} {direction}: {msg}")
    return "\n".join(lines)


def _build_context(company_name: str) -> str:
    """Assemble the per-question context block from the database.

    Falls back to clearly-labelled empty sections if Postgres is unreachable,
    so the endpoint degrades gracefully rather than 500-ing.
    """
    from prism.common.db import (
        get_latest_brief,
        query_alerts,
        recent_signals_for_company,
    )

    try:
        signals = recent_signals_for_company(
            company_name, hours=settings.brief_lookback_hours * 7,
            limit=settings.brief_max_signals,
        )
    except Exception:  # noqa: BLE001 - DB not up
        log.exception("chat: signal fetch failed for %s", company_name)
        signals = []

    try:
        alerts = query_alerts(company=company_name, days=7, limit=50)
    except Exception:  # noqa: BLE001
        log.exception("chat: alert fetch failed for %s", company_name)
        alerts = []

    try:
        brief = get_latest_brief(company_name)
    except Exception:  # noqa: BLE001
        log.exception("chat: brief fetch failed for %s", company_name)
        brief = None

    brief_text = (brief or {}).get("brief_text") or "No research brief available."

    return (
        f"## Recent signals ({len(signals)})\n{_format_signals(signals)}\n\n"
        f"## Anomaly alerts ({len(alerts)})\n{_format_alerts(alerts)}\n\n"
        f"## Latest research brief\n{brief_text}"
    )


def stream_answer(question: str, company: str) -> Iterator[str]:
    """Yield the answer text incrementally for a question about one company.

    Raises ValueError for an unknown company so the API can return 400.
    """
    matched = _resolve_company(company)
    if matched is None:
        raise ValueError(f"Unknown company: {company!r}")

    from prism.ai.claude_client import get_client, is_configured

    who = f"{matched.name} ({matched.ticker})" if matched.ticker else matched.name

    if not is_configured():
        yield ("Claude is not configured (ANTHROPIC_API_KEY missing), so I "
               "can't generate a data-grounded answer right now. Once a key is "
               "set, this endpoint will answer from Prism's live signals, "
               "alerts, and research brief.")
        return

    context = _build_context(matched.name)
    user_turn = (
        f"Company: {who}\n\n"
        f"=== CONTEXT ===\n{context}\n=== END CONTEXT ===\n\n"
        f"User question: {question}"
    )

    with get_client().messages.stream(
        model=settings.claude_model,
        max_tokens=1024,
        system=[
            {"type": "text", "text": CHAT_SYSTEM,
             "cache_control": {"type": "ephemeral"}}
        ],
        messages=[{"role": "user", "content": user_turn}],
    ) as stream:
        for text in stream.text_stream:
            yield text
