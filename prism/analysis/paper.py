"""Paper-trading agent — the simulated portfolio behind the /agent page.

The agent's rule is the backtest's rule: every week the 2-signal composite
(Trends + Filings) flags as net-positive, open a fixed-notional paper position
at that week's entry close, hold five trading days, close. Nothing here decides
anything new — a trade IS a flagged week, valued in dollars. The same notional
is "invested" in the S&P 500 over the identical dates as the benchmark leg.

Everything is a pure fold over the per-week records `evaluate_weeks` already
produces (see prism/analysis/backtest.py), so this module needs no database,
no network, and is unit-testable against hand-checked values.

Simulated money for research and education. Not a prediction, not advice.
"""
from __future__ import annotations

from typing import Any

# Fixed notional per paper trade, in dollars.
TRADE_NOTIONAL = 10_000

# Under this many closed trades, the summary carries a preliminary warning.
SMALL_SAMPLE_THRESHOLD = 20


def build_trades(
    records_by_company: dict[str, list[dict[str, Any]]],
    tickers: dict[str, str | None] | None = None,
    notional: float = TRADE_NOTIONAL,
) -> list[dict[str, Any]]:
    """One paper trade per net-positive week, chronological (oldest first).

    `records_by_company` maps company name -> `evaluate_weeks` records. Each
    trade carries the dollar P&L of the stock leg and of an identical-dates
    S&P leg at the same notional:

        pnl    = notional * stock_return
        sp_pnl = notional * sp_return
    """
    tickers = tickers or {}
    trades: list[dict[str, Any]] = []
    for company, records in records_by_company.items():
        for r in records:
            if not r.get("net_positive"):
                continue
            trades.append({
                "company": company,
                "ticker": tickers.get(company),
                "week_start": r["week_start"],
                "notional": notional,
                "stock_return": r["stock_return"],
                "sp_return": r["sp_return"],
                "relative_return": r["relative_return"],
                "pnl": notional * r["stock_return"],
                "sp_pnl": notional * r["sp_return"],
                "outperformed": r["outperformed"],
            })
    trades.sort(key=lambda t: (t["week_start"], t["company"]))
    return trades


def equity_curve(trades: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Cumulative realized P&L after each trade week, agent vs benchmark.

    Trades sharing a week are folded into one point (the curve is weekly).
    """
    points: list[dict[str, Any]] = []
    agent = 0.0
    sp = 0.0
    for t in trades:
        agent += t["pnl"]
        sp += t["sp_pnl"]
        week = t["week_start"]
        if points and points[-1]["week_start"] == week:
            points[-1]["agent_pnl"] = agent
            points[-1]["sp_pnl"] = sp
        else:
            points.append({"week_start": week, "agent_pnl": agent, "sp_pnl": sp})
    return points


def summarize_portfolio(trades: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate the trade log into the headline numbers the page shows.

    * deployed      : total notional put to work across all trades
    * pnl           : realized P&L of the agent's stock legs
    * sp_pnl        : realized P&L of the benchmark legs (same dates, same size)
    * return_pct    : pnl / deployed (simple, non-compounded)
    * win_rate      : fraction of trades that beat the S&P leg
    """
    n = len(trades)
    deployed = sum(t["notional"] for t in trades)
    pnl = sum(t["pnl"] for t in trades)
    sp_pnl = sum(t["sp_pnl"] for t in trades)
    wins = sum(1 for t in trades if t["outperformed"])

    small = n < SMALL_SAMPLE_THRESHOLD
    quality = (
        f"{n} paper trades closed, ${deployed:,.0f} total notional deployed "
        f"at ${TRADE_NOTIONAL:,} per trade."
    )
    if n == 0:
        quality = "No paper trades yet — the pipeline is still building signal history."
    elif small:
        quality += (
            f" PRELIMINARY: under {SMALL_SAMPLE_THRESHOLD} trades, so this is"
            " directional only, not statistically robust."
        )

    return {
        "trades": n,
        "deployed": deployed,
        "pnl": pnl,
        "sp_pnl": sp_pnl,
        "vs_sp_pnl": pnl - sp_pnl,
        "return_pct": (pnl / deployed) if deployed else None,
        "sp_return_pct": (sp_pnl / deployed) if deployed else None,
        "win_rate": (wins / n) if n else None,
        "notional_per_trade": TRADE_NOTIONAL,
        "small_sample": small,
        "data_quality": quality,
    }


def build_portfolio(
    records_by_company: dict[str, list[dict[str, Any]]],
    tickers: dict[str, str | None] | None = None,
    notional: float = TRADE_NOTIONAL,
) -> dict[str, Any]:
    """Trades + curve + summary in one payload (newest trades first)."""
    trades = build_trades(records_by_company, tickers, notional)
    return {
        "summary": summarize_portfolio(trades),
        "curve": equity_curve(trades),
        "trades": list(reversed(trades)),
    }
