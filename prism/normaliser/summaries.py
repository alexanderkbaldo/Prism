"""Build the plain-English `summary_text` carried on every normalised signal.

This string is the unit Phase 2 hands to the Claude API, so it must be
self-contained: who (company + ticker), what (category + source), the salient
metric, and a short quote of the underlying text. Kept deterministic and
dependency-free; a richer LLM-written summary can replace this later behind the
same `build()` signature.
"""
from __future__ import annotations

from prism.common.schemas import (
    CATEGORY_FILINGS,
    CATEGORY_HIRING,
    CATEGORY_REVIEWS,
    CATEGORY_SENTIMENT,
    CATEGORY_TRENDS,
    RawEvent,
)
from prism.common.companies import Company


def _sentiment_word(score: float | None) -> str:
    if score is None:
        return "neutral"
    if score > 0.15:
        return "positive"
    if score < -0.15:
        return "negative"
    return "neutral"


def _clip(text: str | None, limit: int = 180) -> str | None:
    if not text:
        return None
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def build(event: RawEvent, company: Company, sentiment: float | None) -> str:
    """Return a one-or-two sentence description of this signal."""
    who = f"{company.name} ({company.ticker})" if company.ticker else company.name
    quote = _clip(event.body or event.title)
    metrics = event.metrics or {}

    if event.category == CATEGORY_SENTIMENT:
        mood = _sentiment_word(sentiment)
        base = f"{who}: {mood} {event.source} chatter"
        return f"{base} — \"{quote}\"" if quote else base

    if event.category == CATEGORY_REVIEWS:
        rating = metrics.get("rating")
        store = "App Store" if event.source == "app_store" else "Play Store"
        stars = f"{rating}★ " if rating is not None else ""
        base = f"{who}: {stars}{store} review"
        return f"{base} — \"{quote}\"" if quote else base

    if event.category == CATEGORY_HIRING:
        board = metrics.get("board") or event.source
        loc = metrics.get("location")
        where = f" ({loc})" if loc else ""
        return f"{who}: new {board} job posting{where} — {event.title}"

    if event.category == CATEGORY_TRENDS:
        interest = metrics.get("interest")
        geo = metrics.get("geo", "")
        val = f" at {interest}/100" if interest is not None else ""
        return f"{who}: Google search interest{val} ({geo})".strip()

    if event.category == CATEGORY_FILINGS:
        form = metrics.get("form", "filing")
        return f"{who}: filed a {form} with the SEC ({event.title})"

    # Fallback for any future category.
    base = f"{who}: {event.category} signal from {event.source}"
    return f"{base} — \"{quote}\"" if quote else base
