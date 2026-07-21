"""Unit tests for the composite weekly signal score (Part 1).

These exercise the pure normalisation and combination logic with known inputs
whose outputs are verifiable by hand — no database or external services.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from prism.analysis import composite as C


# --- normalize_signal: sentiment / reviews (-1..1 -> 0..1) -------------------

@pytest.mark.parametrize(
    "avg, expected",
    [(-1.0, 0.0), (0.0, 0.5), (1.0, 1.0), (0.5, 0.75), (-0.5, 0.25)],
)
def test_normalize_sentiment_linear(avg, expected):
    assert C.normalize_signal("sentiment", {"avg_sentiment": avg}) == expected
    # reviews uses the same -1..1 mapping
    assert C.normalize_signal("reviews", {"avg_sentiment": avg}) == expected


def test_normalize_sentiment_clamps_out_of_range():
    assert C.normalize_signal("sentiment", {"avg_sentiment": 2.0}) == 1.0
    assert C.normalize_signal("sentiment", {"avg_sentiment": -3.0}) == 0.0


def test_normalize_sentiment_missing_is_none():
    assert C.normalize_signal("sentiment", {"avg_sentiment": None}) is None
    assert C.normalize_signal("reviews", {}) is None


# --- normalize_signal: trends (0..100 -> 0..1) ------------------------------

@pytest.mark.parametrize(
    "interest, expected",
    [(0.0, 0.0), (50.0, 0.5), (100.0, 1.0), (25.0, 0.25)],
)
def test_normalize_trends(interest, expected):
    assert C.normalize_signal("trends", {"avg_interest": interest}) == expected


def test_normalize_trends_clamps_and_missing():
    assert C.normalize_signal("trends", {"avg_interest": 150.0}) == 1.0
    assert C.normalize_signal("trends", {"avg_interest": None}) is None


# --- normalize_signal: hiring / filings (volume saturation n/(n+K)) ---------

def test_normalize_hiring_saturation():
    # K = 10: at n = 10 the signal is exactly 0.5; at n = 30 it is 0.75.
    assert C.normalize_signal("hiring", {"n": 10}) == 0.5
    assert C.normalize_signal("hiring", {"n": 30}) == 0.75
    assert C.normalize_signal("hiring", {"n": 0}) is None


def test_normalize_filings_saturation():
    # K = 2: at n = 2 -> 0.5; at n = 6 -> 0.75.
    assert C.normalize_signal("filings", {"n": 2}) == 0.5
    assert C.normalize_signal("filings", {"n": 6}) == 0.75
    assert C.normalize_signal("filings", {"n": 0}) is None


def test_normalize_unknown_category():
    assert C.normalize_signal("mystery", {"n": 5}) is None


# --- composite_from_normals --------------------------------------------------

def test_composite_is_plain_average():
    score, present = C.composite_from_normals({"a": 0.5, "b": 1.0, "c": 0.0})
    assert score == pytest.approx(0.5)
    assert present == 3


def test_composite_with_one_signal():
    score, present = C.composite_from_normals({"sentiment": 0.8})
    assert score == pytest.approx(0.8)
    assert present == 1


def test_composite_empty():
    assert C.composite_from_normals({}) == (None, 0)


# --- normalize_week: only present signals count ------------------------------

def test_normalize_week_drops_missing_signals():
    week = {
        "sentiment": {"avg_sentiment": 1.0},   # -> 1.0
        "hiring": {"n": 10},                    # -> 0.5
        "filings": {"n": 0},                    # absent (zero rows)
        "trends": {"avg_interest": None},       # absent (no interest metric)
    }
    normals = C.normalize_week(week)
    assert normals == {"sentiment": 1.0, "hiring": 0.5}
    score, present = C.composite_from_normals(normals)
    assert score == pytest.approx(0.75)
    assert present == 2


# --- score_weeks: net-positive is relative to the trailing median ------------

def _week(i: int):
    """A Monday `i` weeks after a fixed start date."""
    return date(2026, 1, 5) + timedelta(weeks=i)  # 2026-01-05 is a Monday


def _sentiment_week(avg):
    """A week whose only signal is sentiment, so composite == (avg+1)/2."""
    return {"sentiment": {"avg_sentiment": avg}}


def test_net_positive_trailing_median():
    # Composites by design: 0.5,0.5,0.5,0.5,1.0,0.0
    avgs = [0.0, 0.0, 0.0, 0.0, 1.0, -1.0]
    weeks = [(_week(i), _sentiment_week(a)) for i, a in enumerate(avgs)]

    scored = C.score_weeks(weeks)

    assert [round(s.composite_score, 3) for s in scored] == [0.5, 0.5, 0.5, 0.5, 1.0, 0.0]
    # First MIN_TRAILING_WEEKS (4) weeks: undefined (not enough history).
    assert [s.net_positive for s in scored] == [None, None, None, None, True, False]
    assert all(s.signals_present == 1 for s in scored)


def test_score_weeks_skips_empty_weeks_and_sorts():
    # An empty week in the middle must be skipped and must not enter history.
    weeks = [
        (_week(2), _sentiment_week(0.0)),   # out of order on purpose
        (_week(0), _sentiment_week(0.0)),
        (_week(1), {}),                     # no signals -> skipped
    ]
    scored = C.score_weeks(weeks)
    assert [s.week_start for s in scored] == [_week(0), _week(2)]
    assert all(s.net_positive is None for s in scored)  # <4 weeks of history


def test_group_by_week_builds_per_category_maps():
    rows = [
        {"week_start": _week(0), "category": "sentiment", "n": 3, "avg_sentiment": 0.2},
        {"week_start": _week(0), "category": "hiring", "n": 5, "avg_sentiment": None},
        {"week_start": _week(1), "category": "trends", "n": 7, "avg_interest": 60.0},
    ]
    grouped = C._group_by_week(rows)
    assert [w for w, _ in grouped] == [_week(0), _week(1)]
    assert set(grouped[0][1].keys()) == {"sentiment", "hiring"}
    assert grouped[1][1]["trends"]["avg_interest"] == 60.0


# --- sentiment gate (the "FTX problem") -------------------------------------
#
# Trends and filings measure volume, not direction, so a fraud collapse scores
# like a triumph: search interest pegs at 100 and EDGAR fills with 8-Ks. These
# tests pin the veto that stops an obviously-negative week being flagged.

def _week(n: int) -> date:
    return date(2026, 1, 5) + timedelta(weeks=n)


def _quiet(interest: float = 30.0, sentiment: float | None = 0.2) -> dict:
    """A normal week: modest search interest, mildly positive chatter."""
    aggs = {"trends": {"avg_interest": interest, "n": 5}}
    if sentiment is not None:
        aggs["sentiment"] = {"avg_sentiment": sentiment, "n": 20}
    return aggs


def test_sentiment_veto_fires_only_on_clearly_negative_weeks():
    assert C.sentiment_veto({"sentiment": {"avg_sentiment": -0.8}}) is True
    # -0.3 maps to exactly the 0.35 gate; the veto is strict, so this passes.
    assert C.sentiment_veto({"sentiment": {"avg_sentiment": -0.3}}) is False
    assert C.sentiment_veto({"sentiment": {"avg_sentiment": -0.1}}) is False
    assert C.sentiment_veto({"sentiment": {"avg_sentiment": 0.5}}) is False


def test_sentiment_veto_absent_data_is_not_bad_news():
    assert C.sentiment_veto({}) is False
    assert C.sentiment_veto({"sentiment": {"avg_sentiment": None}}) is False
    assert C.sentiment_veto({"trends": {"avg_interest": 100.0}}) is False


def test_scandal_week_is_not_flagged_net_positive():
    """The FTX case: max attention, max filings, sentiment on the floor."""
    weeks = [(_week(i), _quiet()) for i in range(6)]
    scandal = {
        "trends": {"avg_interest": 100.0, "n": 200},   # normalises to 1.0
        "filings": {"n": 12},                          # 12/(12+2) = 0.857
        "sentiment": {"avg_sentiment": -0.85, "n": 400},
    }
    weeks.append((_week(6), scandal))

    scored = C.score_weeks(weeks)
    last = scored[-1]

    # The composite still reports what it measured: a very loud week.
    assert last.composite_score > 0.6
    # But it is not called net-positive, and the veto is recorded.
    assert last.net_positive is False
    assert last.sentiment_vetoed is True


def test_gates_supply_sentiment_the_score_itself_excludes():
    """Backtest path: scored on trends only, vetoed on sentiment via `gates`."""
    weeks = [(_week(i), {"trends": {"avg_interest": 30.0}}) for i in range(6)]
    weeks.append((_week(6), {"trends": {"avg_interest": 100.0}}))
    gates = {_week(6): {"sentiment": {"avg_sentiment": -0.9}}}

    ungated = C.score_weeks(weeks)
    gated = C.score_weeks(weeks, gates=gates)

    # Identical scores; only the flag differs.
    assert ungated[-1].composite_score == gated[-1].composite_score
    assert ungated[-1].net_positive is True
    assert gated[-1].net_positive is False
    assert gated[-1].sentiment_vetoed is True


def test_veto_does_not_disturb_ordinary_positive_weeks():
    weeks = [(_week(i), _quiet()) for i in range(6)]
    weeks.append((_week(6), _quiet(interest=90.0, sentiment=0.6)))

    last = C.score_weeks(weeks)[-1]
    assert last.net_positive is True
    assert last.sentiment_vetoed is False
