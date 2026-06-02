"""Multi-model per-signal scoring.

Runs two independent scorers over a signal — Claude (nuanced sentiment +
regulatory read) and GPT-4o (fast structured score) — then records both plus a
divergence flag when their sentiment reads differ by more than the configured
threshold. The combined object is written to `signals.model_scores`.

Called inline from the normaliser after a signal is persisted. It is a no-op
unless `enable_model_scoring` is on AND the relevant API key is present, so the
ingestion path stays fast and free when AI scoring isn't configured.
"""
from __future__ import annotations

import logging
from typing import Any

from prism.ai import claude_client, openai_client
from prism.common.config import settings
from prism.common.db import update_model_scores

log = logging.getLogger(__name__)

# Categories where a secondary AI read adds value (text-bearing / regulatory).
SCORABLE_CATEGORIES = {"sentiment", "reviews", "filings"}


def enabled() -> bool:
    return settings.enable_model_scoring and (
        claude_client.is_configured() or openai_client.is_configured()
    )


def should_score(category: str, summary_text: str | None) -> bool:
    return bool(summary_text) and category in SCORABLE_CATEGORIES and enabled()


def score(signal_id: int, category: str, summary_text: str) -> dict[str, Any] | None:
    """Score one signal with both models and persist to model_scores.

    Returns the stored scores dict, or None if nothing was scored.
    """
    scores: dict[str, Any] = {}

    if claude_client.is_configured():
        claude = claude_client.score_signal(summary_text, category)
        if claude is not None:
            scores["claude"] = claude

    if openai_client.is_configured():
        gpt = openai_client.score_signal(summary_text, category)
        if gpt is not None:
            scores["gpt4o"] = gpt

    if not scores:
        return None

    scores["divergence"] = _divergence(scores.get("claude"), scores.get("gpt4o"))
    update_model_scores(signal_id, scores)
    if scores["divergence"].get("flagged"):
        log.info("model disagreement on signal %s: Δsentiment=%.2f",
                 signal_id, scores["divergence"]["sentiment_delta"])
    return scores


def _divergence(claude: dict | None, gpt: dict | None) -> dict[str, Any]:
    """Compare the two models' sentiment reads."""
    if not claude or not gpt:
        return {"flagged": False, "reason": "single_model"}
    try:
        delta = abs(float(claude.get("sentiment")) - float(gpt.get("sentiment")))
    except (TypeError, ValueError):
        return {"flagged": False, "reason": "unscored"}
    return {
        "sentiment_delta": round(delta, 3),
        "threshold": settings.model_divergence_threshold,
        "flagged": delta > settings.model_divergence_threshold,
    }
