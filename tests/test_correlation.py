"""Tests for the signal-correlation logic (pure, no DB)."""
from __future__ import annotations

from prism.api.correlation import compute


def test_three_signals_aligned_bearish():
    rows = [
        {"category": "sentiment", "sent_this": -0.4, "sent_last": 0.1},
        {"category": "hiring", "cnt_this": 5, "cnt_last": 10},      # -50%
        {"category": "trends", "int_this": 40, "int_last": 60},      # -33%
        {"category": "reviews", "sent_this": 0.5, "sent_last": 0.4}, # bullish
    ]
    out = compute(rows)
    assert out["aligned"] == {"direction": "bearish", "count": 3}
    assert out["insight"] == "3 signals aligned bearish this week"


def test_aligned_bullish():
    rows = [
        {"category": "sentiment", "sent_this": 0.5},
        {"category": "hiring", "cnt_this": 12, "cnt_last": 8},   # +50%
        {"category": "trends", "int_this": 70, "int_last": 55},  # +27%
    ]
    out = compute(rows)
    assert out["aligned"]["direction"] == "bullish"
    assert out["aligned"]["count"] == 3


def test_split_signals_are_mixed():
    rows = [
        {"category": "sentiment", "sent_this": 0.5},               # bullish
        {"category": "hiring", "cnt_this": 4, "cnt_last": 10},     # bearish
    ]
    out = compute(rows)
    assert out["aligned"]["direction"] == "mixed"


def test_no_movement_neutral():
    rows = [
        {"category": "sentiment", "sent_this": 0.02},              # neutral
        {"category": "trends", "int_this": 50, "int_last": 50},    # neutral
    ]
    out = compute(rows)
    assert out["aligned"]["direction"] == "none"


def test_missing_history_excluded():
    # last-week count is 0 → no direction; filings always excluded.
    rows = [
        {"category": "hiring", "cnt_this": 5, "cnt_last": 0},
        {"category": "filings", "cnt_this": 3, "cnt_last": 1},
        {"category": "sentiment", "sent_this": 0.4},
    ]
    out = compute(rows)
    cats = {s["category"] for s in out["signals"]}
    assert cats == {"sentiment"}  # hiring (no baseline) + filings excluded
