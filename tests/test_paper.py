"""Unit tests for the paper-trading portfolio engine.

Pure functions only — no database, no network. Inputs are crafted so the
expected outputs are checkable by hand.
"""
from __future__ import annotations

from datetime import date

import pytest

from prism.analysis import paper as P


def _rec(week: date, net_positive: bool, stock: float, sp: float):
    return {
        "week_start": week,
        "net_positive": net_positive,
        "stock_return": stock,
        "sp_return": sp,
        "relative_return": stock - sp,
        "outperformed": (stock - sp) > 0,
    }


def test_build_trades_prices_one_trade_by_hand():
    # +10% stock, +5% S&P on $10k: pnl $1,000 vs benchmark $500.
    records = {"Robinhood": [_rec(date(2026, 1, 5), True, 0.10, 0.05)]}
    trades = P.build_trades(records, {"Robinhood": "HOOD"})

    assert len(trades) == 1
    t = trades[0]
    assert t["ticker"] == "HOOD"
    assert t["pnl"] == pytest.approx(1000.0)
    assert t["sp_pnl"] == pytest.approx(500.0)
    assert t["outperformed"] is True


def test_build_trades_skips_unflagged_and_sorts_chronologically():
    records = {
        "Affirm": [
            _rec(date(2026, 2, 2), True, 0.01, 0.0),
            _rec(date(2026, 1, 5), False, 0.09, 0.0),   # not flagged: no trade
        ],
        "Robinhood": [_rec(date(2026, 1, 12), True, -0.02, 0.0)],
    }
    trades = P.build_trades(records)

    assert [(t["company"], t["week_start"]) for t in trades] == [
        ("Robinhood", date(2026, 1, 12)),
        ("Affirm", date(2026, 2, 2)),
    ]


def test_equity_curve_accumulates_and_folds_shared_weeks():
    records = {
        "A": [_rec(date(2026, 1, 5), True, 0.10, 0.05),
              _rec(date(2026, 1, 12), True, -0.05, 0.01)],
        "B": [_rec(date(2026, 1, 5), True, 0.02, 0.05)],
    }
    curve = P.equity_curve(P.build_trades(records))

    # Two trades share the first week -> one point holding both.
    assert len(curve) == 2
    assert curve[0]["week_start"] == date(2026, 1, 5)
    assert curve[0]["agent_pnl"] == pytest.approx(1000 + 200)
    assert curve[0]["sp_pnl"] == pytest.approx(500 + 500)
    assert curve[1]["agent_pnl"] == pytest.approx(1200 - 500)


def test_summarize_portfolio_totals_and_win_rate():
    records = {
        "A": [_rec(date(2026, 1, 5), True, 0.10, 0.05),    # win
              _rec(date(2026, 1, 12), True, -0.05, 0.01)],  # loss
    }
    s = P.summarize_portfolio(P.build_trades(records))

    assert s["trades"] == 2
    assert s["deployed"] == pytest.approx(20_000)
    assert s["pnl"] == pytest.approx(1000 - 500)
    assert s["sp_pnl"] == pytest.approx(500 + 100)
    assert s["vs_sp_pnl"] == pytest.approx(-100)
    assert s["win_rate"] == pytest.approx(0.5)
    assert s["return_pct"] == pytest.approx(500 / 20_000)
    assert s["small_sample"] is True
    assert "PRELIMINARY" in s["data_quality"]


def test_summarize_portfolio_empty_is_honest():
    s = P.summarize_portfolio([])
    assert s["trades"] == 0
    assert s["win_rate"] is None
    assert s["return_pct"] is None
    assert "No paper trades yet" in s["data_quality"]


def test_build_portfolio_inception_splits_live_from_prelaunch():
    records = {
        "A": [_rec(date(2026, 7, 13), True, -0.03, 0.0),   # pre-launch loss
              _rec(date(2026, 7, 20), True, 0.02, 0.01),   # live (on inception)
              _rec(date(2026, 7, 27), True, 0.01, 0.0)],   # live
    }
    out = P.build_portfolio(records, inception=date(2026, 7, 20))

    # Live record starts at $0 on inception: only the two later trades count.
    assert out["inception"] == date(2026, 7, 20)
    assert out["summary"]["trades"] == 2
    assert out["summary"]["pnl"] == pytest.approx(200 + 100)
    assert [p["week_start"] for p in out["curve"]] == [
        date(2026, 7, 20), date(2026, 7, 27)]
    # The pre-launch loss stays published, in its own labelled bucket.
    assert out["prelaunch"]["summary"]["trades"] == 1
    assert out["prelaunch"]["summary"]["pnl"] == pytest.approx(-300)
    assert out["prelaunch"]["trades"][0]["week_start"] == date(2026, 7, 13)


def test_build_portfolio_inception_compares_iso_string_weeks():
    # Mock-path records carry ISO strings, not dates; the split must agree.
    records = {"A": [
        {**_rec(date(2026, 7, 13), True, 0.01, 0.0), "week_start": "2026-07-13"},
        {**_rec(date(2026, 7, 20), True, 0.01, 0.0), "week_start": "2026-07-20"},
    ]}
    out = P.build_portfolio(records, inception=date(2026, 7, 20))
    assert out["summary"]["trades"] == 1
    assert out["prelaunch"]["summary"]["trades"] == 1


def test_build_portfolio_orders_trades_newest_first():
    records = {
        "A": [_rec(date(2026, 1, 5), True, 0.01, 0.0),
              _rec(date(2026, 1, 19), True, 0.01, 0.0)],
    }
    out = P.build_portfolio(records)
    assert out["trades"][0]["week_start"] == date(2026, 1, 19)
    assert out["curve"][0]["week_start"] == date(2026, 1, 5)  # curve oldest-first
