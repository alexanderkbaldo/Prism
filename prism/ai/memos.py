"""Trade memos for the paper-trading agent.

For each closed paper trade (one net-positive flagged week, see
prism/analysis/paper.py), Claude writes a short plain-English memo explaining
what the signals showed that week and how the trade worked out. Memos are
written once, after the trade closed, and cached in `agent_memos` so the
published record never rewrites itself. The memo is explicitly retrospective:
it explains, it does not predict or recommend.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any

from prism.ai.claude_client import get_client, is_configured
from prism.common.config import settings

log = logging.getLogger(__name__)

MEMO_MAX_TOKENS = 400

# Static instructions, stable across memos so the prefix caches.
MEMO_SYSTEM = """\
You write short trade memos for Prism's paper-trading agent, an educational \
research project. The agent's rule is mechanical: when a week's search-interest \
and SEC-filing signals scored net-positive against their trailing pattern, it \
opened a fixed-size SIMULATED position and closed it five trading days later. \
You are writing AFTER the trade closed, explaining it to a smart college \
student.

Write ONE paragraph, under 120 words, plain English, no headers or bullets. \
Cover: what the two signals showed that week, what the simulated trade did \
versus the S&P 500 over the five days, and one honest caveat about reading too \
much into a single week. Never predict, never recommend, never imply real \
money was involved. No em dashes."""


def _fmt_week_signals(rows: list[dict[str, Any]], week_start: date) -> str:
    """The week's raw per-category aggregates, as plain lines for the prompt."""
    lines = []
    for r in rows:
        if r["week_start"] != week_start:
            continue
        bits = [f"{r['category']}: {r['n']} signals"]
        if r.get("avg_interest") is not None:
            bits.append(f"avg search interest {float(r['avg_interest']):.0f}")
        if r.get("avg_sentiment") is not None:
            bits.append(f"avg sentiment {float(r['avg_sentiment']):+.2f}")
        lines.append("  - " + ", ".join(bits))
    return "\n".join(lines) or "  - (no per-category rows recorded this week)"


def write_trade_memo(company: str, week_start: date) -> dict[str, Any]:
    """Return the memo for one paper trade, generating and caching on miss.

    Payload: {available, memo_text?, model?, created_at?, reason?}. Never
    raises on missing Claude config; the page shows the unavailable state.
    """
    from prism.common.db import (
        get_agent_memo,
        upsert_agent_memo,
        weekly_signal_aggregates,
    )
    from prism.analysis.backtest import _records_for_company

    cached = get_agent_memo(company, week_start)
    if cached:
        return {"available": True, **cached}

    if not is_configured():
        return {
            "available": False,
            "reason": "Memo generation needs ANTHROPIC_API_KEY on the API service.",
        }

    # The trade being explained (must be a real flagged week with a price window).
    matched, _weeks, records = _records_for_company(company)
    trade = next(
        (r for r in records if r["week_start"] == week_start and r["net_positive"]),
        None,
    )
    if trade is None:
        return {"available": False, "reason": "No closed paper trade for that week."}

    agg_rows = weekly_signal_aggregates(matched.name)
    context = (
        f"Company: {matched.name} ({matched.ticker or 'unlisted'})\n"
        f"Week of {week_start.isoformat()} signal aggregates:\n"
        f"{_fmt_week_signals(agg_rows, week_start)}\n\n"
        f"Simulated trade outcome over the next 5 trading days:\n"
        f"  - stock return {trade['stock_return'] * 100:+.2f}%\n"
        f"  - S&P 500 return {trade['sp_return'] * 100:+.2f}%\n"
        f"  - relative {trade['relative_return'] * 100:+.2f}% "
        f"({'beat' if trade['outperformed'] else 'trailed'} the index)\n"
    )

    response = get_client().messages.create(
        model=settings.claude_model,
        max_tokens=MEMO_MAX_TOKENS,
        system=[{
            "type": "text",
            "text": MEMO_SYSTEM,
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": context}],
    )
    memo_text = "".join(
        block.text for block in response.content if block.type == "text"
    ).strip()

    upsert_agent_memo(matched.name, week_start, memo_text, settings.claude_model)
    # Re-read so the payload matches the stored row (first write wins on races).
    stored = get_agent_memo(matched.name, week_start)
    return {"available": True, **(stored or {
        "company": matched.name, "week_start": week_start,
        "memo_text": memo_text, "model": settings.claude_model,
    })}
