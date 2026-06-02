"""On-ingestion anomaly detection.

For each newly written sentiment-bearing signal we compare its score against the
company's trailing 7-day rolling mean. If it deviates by more than one standard
deviation, we write a row to the `alerts` table. This is intentionally simple and
runs inline in the normaliser (no separate service); the threshold and window are
configurable so they can be tuned without code changes.
"""
from __future__ import annotations

import logging

from prism.common.db import insert_alert, rolling_sentiment_stats
from prism.common.schemas import Signal

log = logging.getLogger(__name__)

# Window and sensitivity for the rolling baseline.
ROLLING_WINDOW_DAYS = 7
STDDEV_THRESHOLD = 1.0
# Need a minimum baseline before a deviation is meaningful.
MIN_SAMPLES = 4


def check(signal: Signal, signal_id: int) -> int | None:
    """Flag `signal` if its sentiment is a >1σ move vs. the 7-day average.

    Returns the new alert id, or None when no alert was raised.
    """
    if signal.sentiment is None:
        return None

    stats = rolling_sentiment_stats(
        signal.company, ROLLING_WINDOW_DAYS, exclude_id=signal_id
    )
    n = stats["n"] or 0
    mean = stats["mean"]
    std = stats["std"]
    if n < MIN_SAMPLES or mean is None or not std:
        # Not enough history (or zero variance) to judge an anomaly yet.
        return None

    deviation = (signal.sentiment - float(mean)) / float(std)
    if abs(deviation) <= STDDEV_THRESHOLD:
        return None

    direction = "spike" if deviation > 0 else "drop"
    alert = {
        "signal_id": signal_id,
        "company": signal.company,
        "ticker": signal.ticker,
        "category": signal.category,
        "metric": "sentiment",
        "value": signal.sentiment,
        "rolling_avg": float(mean),
        "rolling_std": float(std),
        "deviation": deviation,
        "direction": direction,
        "summary_text": (
            f"{signal.company} sentiment {direction}: {signal.sentiment:+.2f} vs "
            f"7-day avg {float(mean):+.2f} ({deviation:+.1f}σ). "
            f"{signal.summary_text or ''}".strip()
        ),
    }
    alert_id = insert_alert(alert)
    if alert_id:
        log.info("ALERT %s %s %.1fσ (signal %s)",
                 signal.company, direction, deviation, signal_id)
    return alert_id
