"""Tests for source-based signal relevance weighting."""
from __future__ import annotations

from prism.common.schemas import RawEvent
from prism.normaliser.weighting import weight_for


def _event(source, **metrics):
    return RawEvent(source=source, category="sentiment", external_id="x",
                    metrics=metrics)


def test_authoritative_sources_outweigh_reddit():
    edgar = weight_for(_event("edgar"))
    hiring = weight_for(_event("linkedin"))
    reddit = weight_for(_event("reddit"))
    assert edgar > reddit and hiring > reddit
    assert reddit < 1.0 < edgar


def test_stocktwits_verified_bumps_weight():
    plain = weight_for(_event("stocktwits"))
    verified = weight_for(_event("stocktwits", official=True))
    assert verified > plain
    assert verified >= 1.5


def test_stocktwits_followers_bump():
    small = weight_for(_event("stocktwits", followers=10))
    large = weight_for(_event("stocktwits", followers=5000))
    assert large > small


def test_weight_is_clamped():
    # Verified + huge following must not exceed the cap.
    w = weight_for(_event("stocktwits", official=True, followers=10_000_000))
    assert w <= 2.0


def test_unknown_source_defaults_to_baseline():
    assert weight_for(_event("mystery")) == 1.0
