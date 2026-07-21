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
    # Distress and fraud vocabulary. Search interest and SEC filings both spike
    # during a scandal, so the sentiment gate (prism/analysis/composite.py) is
    # what stops a collapse reading as a company's best week ever. That gate is
    # only as good as this list: without these words, posts about an indictment
    # score neutral and the veto never fires.
    "fraud", "fraudulent", "scandal", "ponzi", "laundering", "embezzlement",
    "arrested", "indicted", "indictment", "charged", "probe", "subpoena",
    "investigation", "lawsuit", "sued", "settlement", "fine", "fined",
    "bankrupt", "bankruptcy", "insolvent", "collapse", "collapsed", "halted",
    "delisted", "plunge", "plunged", "tanked", "resign", "resigned",
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
