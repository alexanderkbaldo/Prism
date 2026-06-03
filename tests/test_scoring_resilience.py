"""Tests for the circuit breaker and the decoupled scoring path."""
from __future__ import annotations

from prism.ai import scoring
from prism.ai.circuit_breaker import CircuitBreaker


class FakeClock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


def test_breaker_opens_after_threshold():
    cb = CircuitBreaker(threshold=3, cooldown_seconds=60, clock=FakeClock())
    assert cb.allow("claude")
    cb.record_failure("claude")
    cb.record_failure("claude")
    assert cb.allow("claude")          # 2 < 3, still closed
    cb.record_failure("claude")
    assert not cb.allow("claude")      # tripped on the 3rd
    assert cb.status("claude") == "open"


def test_breaker_success_resets_failures():
    cb = CircuitBreaker(threshold=2, cooldown_seconds=60, clock=FakeClock())
    cb.record_failure("gpt4o")
    cb.record_success("gpt4o")         # reset
    cb.record_failure("gpt4o")
    assert cb.allow("gpt4o")           # only 1 failure since reset


def test_breaker_closes_after_cooldown():
    clock = FakeClock()
    cb = CircuitBreaker(threshold=1, cooldown_seconds=30, clock=clock)
    cb.record_failure("x")
    assert not cb.allow("x")           # open
    clock.t += 31                       # past cooldown
    assert cb.allow("x")               # closed again


def test_breaker_is_per_key():
    cb = CircuitBreaker(threshold=1, cooldown_seconds=60, clock=FakeClock())
    cb.record_failure("claude")
    assert not cb.allow("claude")
    assert cb.allow("gpt4o")           # independent


def test_score_returns_none_when_both_breakers_open(monkeypatch):
    # Force both models "configured" but make their scorers fail, so the breaker
    # trips and subsequent calls short-circuit to None without scoring.
    monkeypatch.setattr(scoring.claude_client, "is_configured", lambda: True)
    monkeypatch.setattr(scoring.openai_client, "is_configured", lambda: True)
    monkeypatch.setattr(scoring.claude_client, "score_signal",
                        lambda *a, **k: None)
    monkeypatch.setattr(scoring.openai_client, "score_signal",
                        lambda *a, **k: None)
    monkeypatch.setattr(scoring, "_breaker",
                        CircuitBreaker(threshold=1, cooldown_seconds=300,
                                       clock=FakeClock()))
    # update_model_scores would hit the DB; it must never be called when there's
    # nothing to store.
    called = {"n": 0}
    monkeypatch.setattr(scoring, "update_model_scores",
                        lambda *a, **k: called.__setitem__("n", called["n"] + 1))

    assert scoring.score(1, "reviews", "text") is None
    # After the first failures, breakers are open; a second call still returns
    # None and never persists.
    assert scoring.score(2, "reviews", "text") is None
    assert called["n"] == 0
    assert scoring._breaker.status("claude") == "open"
