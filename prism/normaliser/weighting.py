"""Per-signal relevance/quality weight based on source and author signals.

Not every signal is equally trustworthy: a SEC filing or a licensed hiring
posting is far more reliable than a generic Reddit comment. Each signal gets a
weight (1.0 = baseline) at normalisation time; it's stored on the signal and
factored into brief generation so the model gives more credence to high-quality
sources.
"""
from __future__ import annotations

from prism.common.schemas import RawEvent

# Base weight per source.
SOURCE_WEIGHTS = {
    "edgar": 1.5,         # authoritative SEC filings
    "linkedin": 1.4,      # licensed hiring data (SerpApi Google Jobs)
    "indeed": 1.4,
    "google_jobs": 1.4,
    "app_store": 1.1,     # identity-tied app reviews
    "stocktwits": 1.0,    # baseline; verified/large accounts bump up
    "play_store": 1.0,
    "google_trends": 1.0,
    "reddit": 0.7,        # generic social posts
}
DEFAULT_WEIGHT = 1.0
MIN_WEIGHT, MAX_WEIGHT = 0.5, 2.0


def weight_for(event: RawEvent) -> float:
    """Compute a relevance weight in [MIN_WEIGHT, MAX_WEIGHT] for a raw event."""
    w = SOURCE_WEIGHTS.get(event.source, DEFAULT_WEIGHT)
    m = event.metrics or {}

    if event.source == "stocktwits":
        # Verified / official accounts are markedly more credible.
        if m.get("official"):
            w = max(w, 1.5)
        # A large following is a softer credibility signal.
        followers = m.get("followers") or 0
        if isinstance(followers, (int, float)) and followers >= 1000:
            w += 0.2

    return round(min(MAX_WEIGHT, max(MIN_WEIGHT, w)), 2)
