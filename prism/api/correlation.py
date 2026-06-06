"""Signal correlation: detect when multiple signals move the same way this week.

Given this-week vs last-week aggregates per category (`db.weekly_aggregates`),
assign each signal a direction (bullish / bearish / neutral) and surface a
combined insight, e.g. "3 signals aligned bearish this week".

Pure functions (no DB) so the logic is unit-testable.
"""
from __future__ import annotations

from typing import Any

SENTIMENT_THRESHOLD = 0.1   # |avg sentiment| above this is directional
CHANGE_THRESHOLD = 0.15     # ±15% week-over-week is directional
ALIGN_MIN = 2               # this many in one direction → a combined insight

# How each category derives its direction.
CATEGORY_LABELS = {
    "sentiment": "Sentiment",
    "reviews": "App reviews",
    "hiring": "Hiring",
    "trends": "Search interest",
}


def _sentiment_dir(avg: float | None) -> str | None:
    if avg is None:
        return None
    if avg > SENTIMENT_THRESHOLD:
        return "bullish"
    if avg < -SENTIMENT_THRESHOLD:
        return "bearish"
    return "neutral"


def _change_dir(this: float | None, last: float | None) -> tuple[str | None, float | None]:
    """Direction from a week-over-week change; returns (direction, pct_change)."""
    if this is None or last is None or last == 0:
        return None, None
    change = (this - last) / abs(last)
    if change > CHANGE_THRESHOLD:
        return "bullish", change
    if change < -CHANGE_THRESHOLD:
        return "bearish", change
    return "neutral", change


def _signal_for(row: dict) -> dict | None:
    cat = row["category"]
    if cat in ("sentiment", "reviews"):
        avg = row.get("sent_this")
        direction = _sentiment_dir(avg)
        if direction is None:
            return None
        detail = f"avg {avg:+.2f} this week"
    elif cat == "hiring":
        direction, change = _change_dir(row.get("cnt_this"), row.get("cnt_last"))
        if direction is None:
            return None
        detail = f"{change:+.0%} postings vs last week"
    elif cat == "trends":
        direction, change = _change_dir(row.get("int_this"), row.get("int_last"))
        if direction is None:
            return None
        detail = f"{change:+.0%} search interest vs last week"
    else:
        return None  # filings have no clear weekly direction
    return {"category": cat, "label": CATEGORY_LABELS.get(cat, cat),
            "direction": direction, "detail": detail}


def compute(rows: list[dict]) -> dict[str, Any]:
    """Build the correlation insight from weekly aggregate rows."""
    signals = [s for s in (_signal_for(r) for r in rows) if s]
    bullish = [s for s in signals if s["direction"] == "bullish"]
    bearish = [s for s in signals if s["direction"] == "bearish"]

    if bullish and len(bullish) > len(bearish) and len(bullish) >= ALIGN_MIN:
        aligned = {"direction": "bullish", "count": len(bullish)}
        insight = f"{len(bullish)} signals aligned bullish this week"
    elif bearish and len(bearish) > len(bullish) and len(bearish) >= ALIGN_MIN:
        aligned = {"direction": "bearish", "count": len(bearish)}
        insight = f"{len(bearish)} signals aligned bearish this week"
    elif bullish and bearish:
        aligned = {"direction": "mixed", "count": 0}
        insight = "Signals are split this week — no clear alignment"
    else:
        aligned = {"direction": "none", "count": 0}
        insight = "Not enough signal movement to call a direction this week"

    return {"signals": signals, "aligned": aligned, "insight": insight}
