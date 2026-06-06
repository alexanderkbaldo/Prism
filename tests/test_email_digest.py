"""Tests for the Resend alert digest (no network)."""
from __future__ import annotations

from datetime import datetime, timezone

from prism.notify import digest


def _alert(**kw):
    base = dict(id=1, company="Robinhood", ticker="HOOD", category="sentiment",
                metric="sentiment", value=0.95, deviation=2.3, direction="spike",
                summary_text="Robinhood sentiment spike",
                created_at=datetime(2026, 6, 6, 14, 5, tzinfo=timezone.utc))
    base.update(kw)
    return base


def test_not_configured_without_key(monkeypatch):
    monkeypatch.setattr(digest.settings, "resend_api_key", None)
    monkeypatch.setattr(digest.settings, "alert_email_to", "me@example.com")
    assert digest.is_configured() is False


def test_configured_with_both(monkeypatch):
    monkeypatch.setattr(digest.settings, "resend_api_key", "re_test")
    monkeypatch.setattr(digest.settings, "alert_email_to", "me@example.com")
    assert digest.is_configured() is True


def test_send_digest_noop_when_unconfigured(monkeypatch):
    monkeypatch.setattr(digest.settings, "resend_api_key", None)
    # Must not touch the DB or network when unconfigured.
    monkeypatch.setattr(digest, "unnotified_alerts",
                        lambda *a: (_ for _ in ()).throw(AssertionError("DB hit")))
    assert digest.send_digest() == 0


def test_html_includes_alert_details_and_link(monkeypatch):
    monkeypatch.setattr(digest.settings, "dashboard_url", "https://prism.vercel.app")
    body = digest._build_html([_alert(), _alert(id=2, company="Affirm",
                                               ticker="AFRM", deviation=-1.8)])
    assert "Robinhood (HOOD)" in body
    assert "Affirm (AFRM)" in body
    assert "+2.3" in body and "-1.8" in body          # deviation, signed
    assert "sentiment" in body                         # signal type
    assert "https://prism.vercel.app/dashboard" in body  # link


def test_send_digest_marks_notified_on_success(monkeypatch):
    monkeypatch.setattr(digest.settings, "resend_api_key", "re_test")
    monkeypatch.setattr(digest.settings, "alert_email_to", "me@example.com")
    monkeypatch.setattr(digest, "unnotified_alerts",
                        lambda limit: [_alert(id=7), _alert(id=8)])
    monkeypatch.setattr(digest, "_send_email", lambda subj, body: True)
    marked = {}
    monkeypatch.setattr(digest, "mark_alerts_notified",
                        lambda ids: marked.update(ids=ids))
    assert digest.send_digest() == 2
    assert marked["ids"] == [7, 8]


def test_send_digest_does_not_mark_on_failure(monkeypatch):
    monkeypatch.setattr(digest.settings, "resend_api_key", "re_test")
    monkeypatch.setattr(digest.settings, "alert_email_to", "me@example.com")
    monkeypatch.setattr(digest, "unnotified_alerts", lambda limit: [_alert(id=9)])
    monkeypatch.setattr(digest, "_send_email", lambda subj, body: False)
    called = {"marked": False}
    monkeypatch.setattr(digest, "mark_alerts_notified",
                        lambda ids: called.update(marked=True))
    assert digest.send_digest() == 0
    assert called["marked"] is False  # left un-notified so next run retries
