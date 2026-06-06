"""Anthropic Claude client for Prism's Phase 2 AI layer.

Two entry points:
  * `generate_brief()` — synthesise one company's last-24h signals into a
    structured research brief (the core of Phase 2).
  * `score_signal()`   — a secondary per-signal scorer (nuanced sentiment +
    regulatory read) for the multi-model scoring path.

Design notes (per Anthropic SDK best practices):
  * The client is created via `anthropic.Anthropic()`, which resolves
    ANTHROPIC_API_KEY from the environment; we pass the key explicitly only
    when configured through pydantic settings.
  * The brief's large, static instruction block is sent as a cached system
    prompt (`cache_control: ephemeral`) so repeated daily runs reuse the
    prefix; the volatile per-company signals go in the user turn, after the
    cache breakpoint, so they never invalidate the cache.
  * The SDK auto-retries 429/5xx with backoff; we add typed-exception handling
    on top so a single company's failure never aborts the whole run.
"""
from __future__ import annotations

import json
import logging
import re
from functools import lru_cache
from typing import Any

from prism.common.config import settings

log = logging.getLogger(__name__)


@lru_cache
def get_client():
    import anthropic  # imported lazily so the dep is optional at runtime

    # api_key=None lets the SDK resolve ANTHROPIC_API_KEY from the environment.
    return anthropic.Anthropic(api_key=settings.anthropic_api_key or None)


def is_configured() -> bool:
    import os

    return bool(settings.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY"))


# --- Daily research brief ------------------------------------------------

# Static instructions: kept stable so they cache across companies/days.
BRIEF_SYSTEM = """\
You are a senior equity research analyst at Prism, an alternative-data platform \
covering fintech companies. You receive a batch of normalised alternative-data \
signals collected over the last 24 hours for a single company and write a tight, \
decision-useful research brief for a portfolio manager.

Write the brief in Markdown with exactly these five sections, in this order, \
each as a `##` header:

## Sentiment Trend
How retail/social sentiment (Reddit, StockTwits) is trending and why.

## Hiring Signal
What job postings (LinkedIn/Indeed) imply about growth, focus areas, or pullback.

## Search Momentum
What Google Trends search interest implies about consumer attention.

## App Store Signal
What App Store / Play Store reviews and ratings say about product health.

## Regulatory Activity
Any SEC filings (10-K, 10-Q, 8-K, S-1, etc.) and their likely significance.

Rules:
- Ground every claim in the provided signals; never invent data.
- Each signal carries a `[weight=N]` relevance score (1.0 = baseline). Give more \
credence to higher-weighted signals (verified StockTwits accounts, licensed \
hiring data, SEC filings) than to lower-weighted, generic ones (e.g. Reddit). \
When signals conflict, lead with the higher-weighted read.
- If a section has no signals, write "No signals in the last 24 hours." — do \
not speculate.
- Be concise: 1-3 sentences per section. Lead with the takeaway.
- Where useful, note net sentiment direction (positive/negative/mixed).
- End with a one-line `**Bottom line:**` synthesis across the five dimensions.
"""

# Static instructions for the per-signal scorer.
SCORE_SYSTEM = """\
You are a financial signal scorer. Given one alternative-data signal about a \
fintech company, return a JSON object (and nothing else) with exactly these keys:
  "sentiment": a float in [-1, 1] — your nuanced read of sentiment toward the \
company (negative to positive).
  "regulatory_risk": a float in [0, 1] — how much the signal implies regulatory \
or compliance risk (0 = none, 1 = severe).
  "rationale": a one-sentence string explaining the scores.
Return only the JSON object.\
"""


def _format_signals(signals: list[dict[str, Any]]) -> str:
    """Render signals as a compact, grouped text block for the model."""
    lines: list[str] = []
    for sig in signals:
        ts = sig.get("event_timestamp")
        ts_str = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        summary = sig.get("summary_text") or sig.get("title") or ""
        sentiment = sig.get("sentiment")
        sent_str = f" [sentiment={sentiment:+.2f}]" if sentiment is not None else ""
        weight = sig.get("weight")
        weight_str = f" [weight={weight:.1f}]" if weight is not None else ""
        lines.append(f"- ({sig.get('category')}/{sig.get('source')}) "
                     f"{ts_str}{sent_str}{weight_str}: {summary}")
    return "\n".join(lines)


def generate_brief(company: str, ticker: str | None,
                   signals: list[dict[str, Any]]) -> str:
    """Synthesise a research brief for one company. Returns Markdown text."""
    import anthropic

    who = f"{company} ({ticker})" if ticker else company
    if not signals:
        user = (f"No alternative-data signals were collected for {who} in the "
                "last 24 hours. Produce the brief with each section noting no "
                "signals.")
    else:
        user = (f"Company: {who}\n"
                f"Signals from the last 24 hours ({len(signals)} total):\n\n"
                f"{_format_signals(signals)}")

    try:
        response = get_client().messages.create(
            model=settings.claude_model,
            max_tokens=1500,
            system=[
                {
                    "type": "text",
                    "text": BRIEF_SYSTEM,
                    # Cache the stable instruction prefix across companies/days.
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user}],
        )
    except anthropic.APIError:
        log.exception("brief generation failed for %s", company)
        raise

    usage = response.usage
    log.info("brief %s: in=%s cache_read=%s out=%s", company,
             usage.input_tokens, usage.cache_read_input_tokens,
             usage.output_tokens)
    return "".join(b.text for b in response.content if b.type == "text").strip()


def score_signal(summary_text: str, category: str) -> dict[str, Any] | None:
    """Claude's nuanced sentiment + regulatory read for one signal."""
    import anthropic

    try:
        response = get_client().messages.create(
            model=settings.claude_scoring_model,
            max_tokens=300,
            system=[
                {"type": "text", "text": SCORE_SYSTEM,
                 "cache_control": {"type": "ephemeral"}}
            ],
            messages=[{"role": "user",
                       "content": f"[{category}] {summary_text}"}],
        )
    except anthropic.APIError:
        log.exception("claude scoring failed")
        return None

    text = "".join(b.text for b in response.content if b.type == "text")
    return _parse_json(text)


def _parse_json(text: str) -> dict[str, Any] | None:
    """Extract the first JSON object from a model response."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    log.warning("could not parse JSON from model output: %.120s", text)
    return None
