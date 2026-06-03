"""Tests for API auth and rate limiting (no live Redis required)."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from prism.api import security


class FakeRequest:
    def __init__(self, ip="1.2.3.4", forwarded=None):
        self.headers = {}
        if forwarded:
            self.headers["x-forwarded-for"] = forwarded
        self.client = type("C", (), {"host": ip})()


class FakeRedis:
    """Minimal in-memory stand-in for the fixed-window counter."""
    def __init__(self):
        self.store = {}
    def incr(self, key):
        self.store[key] = self.store.get(key, 0) + 1
        return self.store[key]
    def expire(self, key, ttl):
        pass


# --- auth -----------------------------------------------------------------

def test_api_key_disabled_when_unset(monkeypatch):
    monkeypatch.setattr(security.settings, "prism_api_key", None)
    # No exception regardless of header.
    assert security.require_api_key(None) is None
    assert security.require_api_key("anything") is None


def test_api_key_required_when_set(monkeypatch):
    monkeypatch.setattr(security.settings, "prism_api_key", "secret123")
    assert security.require_api_key("secret123") is None
    with pytest.raises(HTTPException) as e:
        security.require_api_key("wrong")
    assert e.value.status_code == 401
    with pytest.raises(HTTPException):
        security.require_api_key(None)


# --- client ip ------------------------------------------------------------

def test_client_ip_prefers_forwarded_for():
    req = FakeRequest(ip="10.0.0.1", forwarded="203.0.113.7, 10.0.0.1")
    assert security.client_ip(req) == "203.0.113.7"


def test_client_ip_falls_back_to_peer():
    assert security.client_ip(FakeRequest(ip="10.0.0.1")) == "10.0.0.1"


# --- rate limiter ---------------------------------------------------------

def test_rate_limiter_allows_under_limit_then_429(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("prism.common.redis_client.get_client", lambda: fake)
    rl = security.RateLimiter(limit=3, window_seconds=60, name="t")
    req = FakeRequest(ip="9.9.9.9")
    for _ in range(3):
        assert rl(req) is None          # 1st-3rd allowed
    with pytest.raises(HTTPException) as e:
        rl(req)                          # 4th over the limit
    assert e.value.status_code == 429
    assert e.value.headers["Retry-After"] == "60"


def test_rate_limiter_per_ip(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr("prism.common.redis_client.get_client", lambda: fake)
    rl = security.RateLimiter(limit=1, window_seconds=60, name="t")
    assert rl(FakeRequest(ip="1.1.1.1")) is None
    assert rl(FakeRequest(ip="2.2.2.2")) is None   # different IP, own bucket


def test_rate_limiter_fails_open_when_redis_down(monkeypatch):
    def boom():
        raise RuntimeError("redis down")
    monkeypatch.setattr("prism.common.redis_client.get_client", boom)
    rl = security.RateLimiter(limit=1, window_seconds=60, name="t")
    # Should not raise — availability over strictness.
    assert rl(FakeRequest()) is None
    assert rl(FakeRequest()) is None


def test_rate_limiter_disabled_when_limit_zero():
    rl = security.RateLimiter(limit=0, window_seconds=60, name="t")
    for _ in range(100):
        assert rl(FakeRequest()) is None
