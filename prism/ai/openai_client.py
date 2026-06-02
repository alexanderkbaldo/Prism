"""OpenAI GPT-4o client for Prism's secondary, fast structured scorer.

This is the non-Anthropic half of the multi-model scoring path: GPT-4o produces
a quick structured sentiment/confidence read per signal, which we compare against
Claude's nuanced read to surface model disagreements. Uses the official OpenAI
SDK with JSON-mode responses.
"""
from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from typing import Any

from prism.common.config import settings

log = logging.getLogger(__name__)

SCORE_PROMPT = (
    "You are a fast financial signal scorer. Given one alternative-data signal "
    "about a fintech company, respond with a JSON object containing exactly: "
    '"sentiment" (float in [-1,1]), "confidence" (float in [0,1]), and '
    '"label" (one of "positive","neutral","negative"). Return only JSON.'
)


@lru_cache
def get_client():
    from openai import OpenAI  # imported lazily so the dep is optional

    return OpenAI(api_key=settings.openai_api_key or None)


def is_configured() -> bool:
    return bool(settings.openai_api_key or os.environ.get("OPENAI_API_KEY"))


def score_signal(summary_text: str, category: str) -> dict[str, Any] | None:
    """GPT-4o's fast structured score for one signal."""
    try:
        response = get_client().chat.completions.create(
            model=settings.openai_model,
            max_tokens=200,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SCORE_PROMPT},
                {"role": "user", "content": f"[{category}] {summary_text}"},
            ],
        )
    except Exception:  # noqa: BLE001 - openai raises a family of errors; don't
        log.exception("gpt-4o scoring failed")          # block ingestion on them
        return None

    content = response.choices[0].message.content or ""
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        log.warning("could not parse gpt-4o JSON: %.120s", content)
        return None
