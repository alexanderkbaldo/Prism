"""Unit tests for the historical backtest (Part 2).

Pure functions only — no database, no yfinance/network. Inputs are crafted so
the expected outputs are checkable by hand.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from prism.analysis import backtest as B
from prism.analysis import composite as C


# --- relative return: the headline hand-checkable case -----------------------

def test_relative_return_exact_five_percent():
    # Stock $10 -> $11 is +10%; S&P $100 -> $105 is +5%; relative is exactly +5%.
    r = B.compute_relative_return(10.0, 11.0, 100.0, 105.0)
    assert r["stock_return"] == pytest.approx(0.10)
    assert r["sp_return"] == pytest.approx(0.05)
    assert r["relative_return"] == pytest.approx(0.05)
    assert r["outperformed"] is True


def test_relative_return_equal_is_not_outperformance():
    # Both +10% -> relative 0; a tie is not a strict beat.
    r = B.compute_relative_return(10.0, 11.0, 100.0, 110.0)
    assert r["relative_return"] == pytest.approx(0.0)
    assert r["outperformed"] is False


def test_relative_return_underperformance_is_negative():
    # Stock -10%, S&P -5% -> relative -5%.
    r = B.compute_relative_return(10.0, 9.0, 100.0, 95.0)
    assert r["relative_return"] == pytest.approx(-0.05)
    assert r["outperformed"] is False


# --- window / lookup helpers -------------------------------------------------

def _series(start: date, closes: list[float]) -> list[tuple]:
    """Daily (date, close) series of consecutive calendar days from `start`."""
    return [(start + timedelta(days=i), c) for i, c in enumerate(closes)]


def test_window_prices_picks_entry_on_or_after_week_start():
    prices = _series(date(2026, 1, 5), [10, 11, 12, 13, 14, 15, 16, 17])
    # Week start lands exactly on the first day; +5 trading days later.
    win = B.window_prices(prices, date(2026, 1, 5), horizon=5)
    assert win == (date(2026, 1, 5), 10, date(2026, 1, 10), 15)


def test_window_prices_returns_none_without_full_horizon():
    prices = _series(date(2026, 1, 5), [10, 11, 12])  # too short for +5
    assert B.window_prices(prices, date(2026, 1, 5), horizon=5) is None


def test_window_prices_skips_to_next_trading_day():
    # No price exactly on the week_start (e.g. Monday holiday); use the next day.
    prices = _series(date(2026, 1, 6), [10, 11, 12, 13, 14, 15])
    win = B.window_prices(prices, date(2026, 1, 5), horizon=5)
    assert win[0] == date(2026, 1, 6) and win[1] == 10


def test_price_on_or_before_exact_and_gap():
    prices = _series(date(2026, 1, 5), [100, 101, 102])
    dates = [d for d, _ in prices]
    pm = {d: c for d, c in prices}
    assert B.price_on_or_before(dates, pm, date(2026, 1, 6)) == 101      # exact
    assert B.price_on_or_before(dates, pm, date(2026, 1, 8)) == 102      # nearest before
    assert B.price_on_or_before(dates, pm, date(2026, 1, 1)) is None     # before history


# --- 2-signal backtestable composite ----------------------------------------

def test_backtestable_composite_uses_only_trends_and_filings():
    # Each week carries sentiment too, but only trends+filings should count.
    rows = []
    for i in range(6):
        wk = date(2026, 1, 5) + timedelta(weeks=i)
        rows.append({"week_start": wk, "category": "sentiment", "n": 9, "avg_sentiment": 0.9})
        rows.append({"week_start": wk, "category": "trends", "n": 7, "avg_interest": 50})
        rows.append({"week_start": wk, "category": "filings", "n": 2, "avg_sentiment": None})
    scored = B.backtestable_weeks_from_rows(rows)
    # trends 50/100 = 0.5, filings 2/(2+2) = 0.5 -> composite 0.5, two signals.
    assert all(s.signals_present == 2 for s in scored)
    assert all(round(s.composite_score, 3) == 0.5 for s in scored)


def test_backtestable_composite_net_positive_relative_to_median():
    # Drive composites via the trends index only: 0.40 x4, then 0.90, 0.10.
    interests = [40, 40, 40, 40, 90, 10]
    rows = []
    for i, interest in enumerate(interests):
        wk = date(2026, 1, 5) + timedelta(weeks=i)
        rows.append({"week_start": wk, "category": "trends", "n": 5, "avg_interest": interest})
    scored = B.backtestable_weeks_from_rows(rows)
    # First MIN_TRAILING_WEEKS undefined; then 0.9 > median(0.4*4)=0.4 -> True;
    # 0.1 > median(0.4,0.4,0.4,0.4,0.9)=0.4 -> False.
    assert [s.net_positive for s in scored] == [None, None, None, None, True, False]


# --- evaluate_weeks: stock valued vs S&P on identical dates ------------------

def test_evaluate_weeks_pairs_stock_and_sp_on_same_dates():
    # One net-positive week. Stock 10->11 (+10%), S&P 100->105 (+5%) -> +5% rel.
    wk = date(2026, 1, 5)
    weeks = [C.WeeklyScore(week_start=wk, composite_score=0.8, signals_present=2, net_positive=True)]
    stock = _series(wk, [10, 10, 10, 10, 10, 11])  # entry day0=10, day5=11
    sp = _series(wk, [100, 100, 100, 100, 100, 105])
    recs = B.evaluate_weeks(weeks, stock, sp, horizon=5)
    assert len(recs) == 1
    assert recs[0]["net_positive"] is True
    assert recs[0]["relative_return"] == pytest.approx(0.05)
    assert recs[0]["outperformed"] is True


# --- summarize: hit rate, base rate, averages, small-sample flag -------------

def _rec(net_positive: bool, rel: float):
    return {
        "week_start": date(2026, 1, 5),
        "net_positive": net_positive,
        "stock_return": rel, "sp_return": 0.0,
        "relative_return": rel, "outperformed": rel > 0,
    }


def test_summarize_hit_and_base_rates():
    records = [
        _rec(True, 0.02),    # net-pos, outperformed
        _rec(True, 0.04),    # net-pos, outperformed
        _rec(True, -0.01),   # net-pos, underperformed
        _rec(False, 0.03),   # not net-pos, outperformed
        _rec(False, -0.02),  # not net-pos, underperformed
    ]
    s = B.summarize("Robinhood", "HOOD", records, weeks_available=12)

    assert s["total_weeks_tested"] == 5
    assert s["net_positive_weeks"] == 3
    assert s["hit_rate"] == pytest.approx(2 / 3)     # 2 of 3 net-pos outperformed
    assert s["base_rate"] == pytest.approx(3 / 5)    # 3 of 5 all weeks outperformed
    assert s["avg_relative_return"] == pytest.approx((0.02 + 0.04 - 0.01) / 3)
    assert s["small_sample"] is True                 # 3 < 20
    assert "PRELIMINARY" in s["data_quality"]


def test_summarize_handles_no_net_positive_weeks():
    s = B.summarize("Chime", "CHYM", [_rec(False, 0.01)], weeks_available=3)
    assert s["net_positive_weeks"] == 0
    assert s["hit_rate"] is None
    assert s["avg_relative_return"] is None
    assert s["base_rate"] == pytest.approx(1.0)
    assert "nothing to conclude" in s["data_quality"]
