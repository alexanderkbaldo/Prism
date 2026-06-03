"""Tests for the chat feature: company resolution, context assembly, the
not-configured fallback, and the streaming /chat endpoint. No API keys or
live services required — the Claude stream is mocked."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from prism.ai import chat
from prism.api.main import app

client = TestClient(app)


def test_resolve_company_by_ticker_and_name():
    assert chat._resolve_company("HOOD").name == "Robinhood"
    assert chat._resolve_company("hood").ticker == "HOOD"
    assert chat._resolve_company("Robinhood").ticker == "HOOD"
    assert chat._resolve_company("nope") is None


def test_format_signals_is_grounded():
    sigs = [{"category": "reviews", "source": "app_store",
             "event_timestamp": datetime(2026, 6, 1, tzinfo=timezone.utc),
             "summary_text": "HOOD app rating dipped to 3.9", "sentiment": -0.4}]
    text = chat._format_signals(sigs)
    assert "app rating dipped" in text and "sentiment=-0.40" in text


def test_format_signals_empty():
    assert "No signals" in chat._format_signals([])


def test_format_alerts_empty():
    assert "No anomaly alerts" in chat._format_alerts([])


def test_stream_answer_unknown_company_raises():
    with pytest.raises(ValueError):
        list(chat.stream_answer("why?", "BOGUS"))


def test_stream_answer_without_key_yields_fallback(monkeypatch):
    monkeypatch.setattr("prism.ai.claude_client.is_configured", lambda: False)
    out = "".join(chat.stream_answer("why did the rating drop?", "HOOD"))
    assert "not configured" in out.lower()


def test_chat_endpoint_unknown_company():
    r = client.post("/chat", json={"question": "why?", "company": "BOGUS"})
    assert r.status_code == 200  # errors stream in-band
    assert "[error]" in r.text and "Unknown company" in r.text


def test_chat_endpoint_streams_mocked_claude(monkeypatch):
    """End-to-end wiring: a configured Claude client streams text back."""
    monkeypatch.setattr("prism.ai.claude_client.is_configured", lambda: True)
    monkeypatch.setattr(chat, "_build_context", lambda name: "## Recent signals\n- stuff")

    class _FakeStream:
        text_stream = ["Robinhood's ", "rating dropped ", "on weak reviews."]

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    class _FakeMessages:
        def stream(self, **kwargs):
            # Assert the company context made it into the user turn.
            user = kwargs["messages"][0]["content"]
            assert "Robinhood (HOOD)" in user
            assert "weak reviews" not in user  # only our injected context
            return _FakeStream()

    class _FakeClient:
        messages = _FakeMessages()

    monkeypatch.setattr("prism.ai.claude_client.get_client", lambda: _FakeClient())

    r = client.post("/chat", json={"question": "why did the rating drop?",
                                   "company": "HOOD"})
    assert r.status_code == 200
    assert r.text == "Robinhood's rating dropped on weak reviews."
