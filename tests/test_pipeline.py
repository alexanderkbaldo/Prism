"""Unit tests for the pure pipeline logic (no Redis/Postgres required)."""
from __future__ import annotations

from datetime import timezone

from prism.common.companies import tag_companies
from prism.common.schemas import RawEvent, Signal, utcnow
from prism.normaliser.sentiment import lexicon_score, score
from prism.normaliser.timestamps import to_utc


def test_company_tagging_matches_aliases_and_tickers():
    found = {c.name for c in tag_companies("Thinking about $HOOD and Affirm today")}
    assert found == {"Robinhood", "Affirm"}


def test_company_tagging_prefers_specific_alias():
    # "robin hood" must map to Robinhood, not partial-match noise.
    found = [c.name for c in tag_companies("robin hood is great")]
    assert found == ["Robinhood"]


def test_company_tagging_word_boundaries():
    # "hoodie" should not trip the "hood" alias.
    assert tag_companies("I bought a new hoodie") == []


def test_lexicon_sentiment_direction():
    assert lexicon_score("strong growth, bullish buy") > 0
    assert lexicon_score("weak miss, bearish sell") < 0
    assert lexicon_score("the sky is blue") == 0.0
    assert lexicon_score("") is None


def test_score_prefers_explicit_signals():
    assert score(text="whatever", basic_sentiment="Bullish") == 1.0
    assert score(text="whatever", rating=5) == 1.0
    assert score(text="whatever", rating=1) == -1.0


def test_timestamps_normalise_to_utc():
    # ISO with offset, epoch seconds, and plain date all -> aware UTC.
    iso = to_utc("2026-06-01T12:00:00-04:00")
    assert iso.tzinfo == timezone.utc and iso.hour == 16
    epoch = to_utc("1717243200")
    assert epoch.tzinfo == timezone.utc
    plain = to_utc("2026-06-01")
    assert plain.tzinfo == timezone.utc


def test_raw_event_dedup_hash_is_identity_stable():
    a = RawEvent(source="reddit", category="sentiment", external_id="x1",
                 body="hello")
    b = RawEvent(source="reddit", category="sentiment", external_id="x1",
                 body="EDITED")
    assert a.dedup_hash() == b.dedup_hash()  # identity, not content


def test_signal_dedup_hash_changes_with_company():
    base = dict(source="reddit", category="sentiment", title="t",
                event_timestamp=utcnow())
    s1 = Signal(company="Robinhood", **base)
    s2 = Signal(company="Affirm", **base)
    assert s1.compute_dedup_hash() != s2.compute_dedup_hash()
