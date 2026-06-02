"""Tests for the Phase 2 AI layer: scoring gating/divergence, synthesis
guarding, and the /brief endpoint. No API keys or live services required —
the AI calls are gated off when keys are absent."""
from __future__ import annotations

from fastapi.testclient import TestClient

from prism.ai import claude_client, scoring, synthesis
from prism.api.main import app

client = TestClient(app)


def test_scoring_disabled_without_keys(monkeypatch):
    monkeypatch.setattr(claude_client, "is_configured", lambda: False)
    monkeypatch.setattr("prism.ai.openai_client.is_configured", lambda: False)
    assert scoring.enabled() is False
    assert scoring.should_score("sentiment", "some text") is False


def test_should_score_only_text_bearing_categories(monkeypatch):
    monkeypatch.setattr(scoring, "enabled", lambda: True)
    assert scoring.should_score("sentiment", "text") is True
    assert scoring.should_score("filings", "text") is True
    assert scoring.should_score("trends", "text") is False   # not text-bearing
    assert scoring.should_score("sentiment", None) is False   # no summary


def test_divergence_flags_when_models_disagree():
    d = scoring._divergence({"sentiment": 0.1}, {"sentiment": 0.9})
    assert d["flagged"] is True and d["sentiment_delta"] == 0.8


def test_divergence_not_flagged_when_close():
    d = scoring._divergence({"sentiment": 0.5}, {"sentiment": 0.6})
    assert d["flagged"] is False


def test_divergence_single_model_not_flagged():
    assert scoring._divergence({"sentiment": 0.5}, None)["flagged"] is False


def test_synthesis_skips_without_anthropic_key(monkeypatch):
    monkeypatch.setattr(claude_client, "is_configured", lambda: False)
    assert synthesis.refresh_all() == {}


def test_brief_format_signals_is_grounded():
    from datetime import datetime, timezone

    sigs = [{"category": "sentiment", "source": "reddit",
             "event_timestamp": datetime(2026, 6, 1, tzinfo=timezone.utc),
             "summary_text": "Robinhood (HOOD): positive chatter", "sentiment": 0.8}]
    text = claude_client._format_signals(sigs)
    assert "Robinhood" in text and "sentiment=+0.80" in text


def test_brief_endpoint_returns_data():
    r = client.get("/brief", params={"company": "HOOD"}).json()
    assert r["source"] in {"db", "mock"}
    assert r["brief"] is not None
    assert "Sentiment Trend" in r["brief"]["brief_text"]
