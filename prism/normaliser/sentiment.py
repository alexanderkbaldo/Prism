"""Lightweight sentiment scoring for text-bearing signals.

Phase 1 uses a small lexicon plus any explicit signal the source already gives
us (e.g. StockTwits Bullish/Bearish tags, app-store star ratings). This keeps
the normaliser dependency-free; a model-based scorer can be swapped in later
behind the same `score()` signature.
"""
from __future__ import annotations

import re

_POSITIVE = {
    "bullish", "buy", "long", "moon", "love", "great", "good", "strong",
    "beat", "growth", "up", "gain", "win", "best", "amazing", "early",
}
_NEGATIVE = {
    "bearish", "sell", "short", "dump", "hate", "bad", "weak", "miss",
    "decline", "down", "loss", "lose", "worst", "broken", "declined", "slow",
    "slowing", "bug", "crash", "scam",
}

_WORD = re.compile(r"[a-z']+")


def lexicon_score(text: str | None) -> float | None:
    if not text:
        return None
    tokens = _WORD.findall(text.lower())
    if not tokens:
        return None
    pos = sum(t in _POSITIVE for t in tokens)
    neg = sum(t in _NEGATIVE for t in tokens)
    if pos == neg == 0:
        return 0.0
    return (pos - neg) / (pos + neg)


def score(
    *,
    text: str | None,
    basic_sentiment: str | None = None,
    rating: int | None = None,
) -> float | None:
    """Return a sentiment in [-1, 1], preferring explicit source signals."""
    if basic_sentiment:
        normalized = basic_sentiment.strip().lower()
        if normalized == "bullish":
            return 1.0
        if normalized == "bearish":
            return -1.0
    if rating is not None:
        # Map a 1-5 star rating onto [-1, 1].
        try:
            return (int(rating) - 3) / 2
        except (TypeError, ValueError):
            pass
    return lexicon_score(text)
