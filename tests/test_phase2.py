"""Tests for Phase 2 hardening: summaries, the query API, and the SerpApi
hiring scraper's parsing/sample path."""
from __future__ import annotations

from fastapi.testclient import TestClient

from prism.api.main import app
from prism.common.companies import BY_NAME
from prism.common.schemas import (
    CATEGORY_FILINGS,
    CATEGORY_HIRING,
    CATEGORY_SENTIMENT,
    RawEvent,
)
from prism.normaliser import summaries
from prism.scrapers.hiring import HiringScraper

client = TestClient(app)


def _event(category: str, **kw) -> RawEvent:
    base = dict(source="test", category=category, external_id="x", title="T")
    base.update(kw)
    return RawEvent(**base)


def test_summary_sentiment_includes_company_and_mood():
    e = _event(CATEGORY_SENTIMENT, source="reddit", body="great quarter")
    text = summaries.build(e, BY_NAME["Robinhood"], 0.9)
    assert "Robinhood (HOOD)" in text and "positive" in text


def test_summary_filing_mentions_form():
    e = _event(CATEGORY_FILINGS, title="Affirm filed 10-Q", metrics={"form": "10-Q"})
    text = summaries.build(e, BY_NAME["Affirm"], None)
    assert "10-Q" in text and "SEC" in text


def test_summary_hiring_mentions_board_and_role():
    e = _event(CATEGORY_HIRING, title="Staff Engineer",
               metrics={"board": "LinkedIn", "location": "Remote"})
    text = summaries.build(e, BY_NAME["Block"], None)
    assert "LinkedIn" in text and "Staff Engineer" in text


def test_hiring_sample_has_linkedin_and_indeed():
    events = HiringScraper()._sample()
    boards = {e.metrics["board"] for e in events}
    assert {"LinkedIn", "Indeed"} <= boards
    assert all(e.category == CATEGORY_HIRING for e in events)


def test_api_healthz():
    assert client.get("/healthz").json() == {"status": "ok"}


def test_api_signals_filtering():
    # Works whether the endpoint serves DB rows or the mock fallback: every
    # returned signal must match the requested filters.
    r = client.get("/signals", params={"company": "HOOD", "type": "sentiment"}).json()
    assert r["source"] in {"db", "mock"}
    for s in r["signals"]:
        assert (s.get("ticker") or "").upper() == "HOOD"
        assert s["category"] == "sentiment"


def test_api_companies_lists_five():
    assert len(client.get("/companies").json()) == 5
