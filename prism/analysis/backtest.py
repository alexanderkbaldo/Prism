"""Historical price backtest — Part 2 of Prism's signal validation engine.

Builds on Part 1 (`composite.py`, `weekly_scores`). The question this answers:
when the alternative-data signals flag a company's week as "net-positive", did
the stock actually beat the market over the following week?

Honest scope (Step 2): of the five signals, only **Google Trends** and **SEC
filings** have legitimate historical depth — the others (Reddit/StockTwits
sentiment, hiring, app reviews) only exist for the recent window Prism has been
scraping. So the backtest uses a separate **2-signal "backtestable composite"**
(Trends + Filings only), with the SAME relative-to-trailing-median net-positive
rule from Part 1. This is deliberately distinct from Part 1's 5-signal composite,
which is left untouched.

The method (Step 3): for each historical week the 2-signal composite flags
net-positive, take the stock's close at the start of the week and 5 trading days
later, compute the return, and compare it to the S&P 500 (^GSPC) over the
identical dates. The stock "outperformed" if its 5-day return exceeded the
index's. We report the hit rate on net-positive weeks against the base rate
across all tested weeks.

This is analysis infrastructure, NOT a prediction or a recommendation. With only
a short price history for these recent IPOs, results are preliminary by
construction — the output says so explicitly (Step 4).

The arithmetic lives in small pure functions (`compute_relative_return`,
`window_prices`, `evaluate_weeks`, `summarize`) so it is unit-testable against
hand-checked values without a database or network.
"""
from __future__ import annotations

import bisect
import logging
from datetime import date
from typing import Any

from prism.analysis import composite as C

log = logging.getLogger(__name__)

# Trading days held after the week-start entry.
HORIZON_DAYS = 5

# The two signals with real historical depth.
BACKTEST_SIGNALS = (C.TRENDS, C.FILINGS)

# S&P 500 index symbol (yfinance) and our storage key for it.
SP500 = "^GSPC"

# Below this many net-positive weeks, the hit rate is too thin to trust.
SMALL_SAMPLE_THRESHOLD = 20

# yfinance symbols for the five tracked companies + the index are just their
# tickers; resolved from the registry at call time.


# --- pure return math --------------------------------------------------------

def compute_relative_return(
    stock_entry: float, stock_exit: float, sp_entry: float, sp_exit: float
) -> dict[str, Any]:
    """Stock vs S&P simple returns over one window, and their difference.

    relative_return is the arithmetic difference of simple returns:
        (stock_exit/stock_entry - 1) - (sp_exit/sp_entry - 1).
    Example: $10 -> $11 (stock, +10%) while S&P $100 -> $105 (+5%) gives a
    relative return of exactly +5%. "outperformed" is a strict beat (> 0).
    """
    stock_return = stock_exit / stock_entry - 1.0
    sp_return = sp_exit / sp_entry - 1.0
    relative = stock_return - sp_return
    return {
        "stock_return": stock_return,
        "sp_return": sp_return,
        "relative_return": relative,
        "outperformed": relative > 0,
    }


def window_prices(
    prices: list[tuple[date, float]], week_start: date, horizon: int = HORIZON_DAYS
) -> tuple[date, float, date, float] | None:
    """Entry/exit closes for a week: the first trading day on/after `week_start`,
    and the close `horizon` trading days later.

    `prices` is an oldest-first list of (date, close). Returns
    (entry_date, entry_close, exit_date, exit_close), or None if there isn't a
    full `horizon`-day window available after the entry.
    """
    dates = [d for d, _ in prices]
    i = bisect.bisect_left(dates, week_start)
    if i >= len(prices) or i + horizon >= len(prices):
        return None
    entry_date, entry_close = prices[i]
    exit_date, exit_close = prices[i + horizon]
    return entry_date, entry_close, exit_date, exit_close


def price_on_or_before(
    dates: list[date], price_map: dict[date, float], target: date
) -> float | None:
    """The close on `target`, or the most recent trading day before it.

    Used to value the S&P on the stock's exact entry/exit dates; on a shared
    exchange calendar these usually match, but this tolerates the odd gap.
    `dates` must be sorted ascending and cover `price_map`'s keys.
    """
    if target in price_map:
        return price_map[target]
    i = bisect.bisect_right(dates, target) - 1
    return price_map[dates[i]] if i >= 0 else None


# --- 2-signal backtestable composite ----------------------------------------

def backtestable_weeks(company: str) -> list[C.WeeklyScore]:
    """Weekly scores from ONLY Trends + Filings, with Part 1's net-positive rule.

    Reuses `composite.score_weeks` (same trailing-median logic, same
    MIN_TRAILING_WEEKS) but feeds it weeks restricted to the two backtestable
    signals, so most-weeks-missing-most-signals doesn't distort the score.
    """
    from prism.common.db import weekly_signal_aggregates

    rows = weekly_signal_aggregates(company)
    return backtestable_weeks_from_rows(rows)


def backtestable_weeks_from_rows(rows: list[dict[str, Any]]) -> list[C.WeeklyScore]:
    """Pure variant of `backtestable_weeks` for testing (takes raw agg rows)."""
    grouped = C._group_by_week(rows)
    restricted = [
        (week_start, {k: v for k, v in aggs.items() if k in BACKTEST_SIGNALS})
        for week_start, aggs in grouped
    ]
    # Drop weeks with neither backtestable signal present.
    restricted = [(w, a) for w, a in restricted if a]
    return C.score_weeks(restricted)


# --- evaluation --------------------------------------------------------------

def evaluate_weeks(
    weeks: list[C.WeeklyScore],
    stock_prices: list[tuple[date, float]],
    sp_prices: list[tuple[date, float]],
    horizon: int = HORIZON_DAYS,
) -> list[dict[str, Any]]:
    """One record per week that has a computable 5-day window in both series.

    Each record: {week_start, net_positive, stock_return, sp_return,
    relative_return, outperformed}. The S&P is valued on the SAME entry/exit
    dates the stock used, so the comparison is over identical windows.
    """
    sp_dates = [d for d, _ in sp_prices]
    sp_map = {d: c for d, c in sp_prices}

    records: list[dict[str, Any]] = []
    for wk in weeks:
        win = window_prices(stock_prices, wk.week_start, horizon)
        if win is None:
            continue
        entry_date, entry_close, exit_date, exit_close = win
        sp_entry = price_on_or_before(sp_dates, sp_map, entry_date)
        sp_exit = price_on_or_before(sp_dates, sp_map, exit_date)
        if sp_entry is None or sp_exit is None or entry_close == 0 or sp_entry == 0:
            continue
        r = compute_relative_return(entry_close, exit_close, sp_entry, sp_exit)
        records.append({
            "week_start": wk.week_start,
            "net_positive": wk.net_positive is True,
            **r,
        })
    return records


def _pct(part: list, predicate) -> float | None:
    """Fraction of `part` satisfying `predicate`, or None if empty."""
    if not part:
        return None
    return sum(1 for x in part if predicate(x)) / len(part)


def summarize(
    company: str,
    ticker: str | None,
    records: list[dict[str, Any]],
    weeks_available: int,
) -> dict[str, Any]:
    """Aggregate per-week records into the stored backtest summary.

    * total_weeks_tested  : all weeks with a computable 5-day return (the universe)
    * net_positive_weeks  : of those, the ones the 2-signal composite flagged
    * hit_rate            : fraction of net-positive weeks that outperformed
    * base_rate           : fraction of ALL tested weeks that outperformed
                            (the signal-agnostic baseline over the same period)
    * avg_relative_return : mean (stock - S&P) 5d return on net-positive weeks
    """
    np_records = [r for r in records if r["net_positive"]]
    n_np = len(np_records)

    hit_rate = _pct(np_records, lambda r: r["outperformed"])
    base_rate = _pct(records, lambda r: r["outperformed"])
    avg_rel = (
        sum(r["relative_return"] for r in np_records) / n_np if n_np else None
    )

    small = n_np < SMALL_SAMPLE_THRESHOLD
    quality = (
        f"{weeks_available} weeks of 2-signal composite history available; "
        f"{len(records)} had a computable 5-day price window; "
        f"{n_np} were net-positive."
    )
    if n_np == 0:
        quality += (
            " No net-positive weeks with price data, so nothing to conclude."
        )
    elif small:
        quality += (
            f" PRELIMINARY: under {SMALL_SAMPLE_THRESHOLD} net-positive weeks, "
            "so this is directional only, not statistically robust."
        )

    return {
        "company": company,
        "ticker": ticker,
        "total_weeks_tested": len(records),
        "net_positive_weeks": n_np,
        "hit_rate": hit_rate,
        "base_rate": base_rate,
        "avg_relative_return": avg_rel,
        "weeks_available": weeks_available,
        "small_sample": small,
        "data_quality": quality,
    }


# --- price ingest (yfinance) -------------------------------------------------

def fetch_price_history(symbol: str) -> list[tuple[date, float]]:
    """Pull all available daily closes for a symbol via yfinance."""
    import yfinance as yf

    df = yf.Ticker(symbol).history(period="max", interval="1d", auto_adjust=True)
    if df is None or df.empty or "Close" not in df:
        log.warning("no price history returned for %s", symbol)
        return []
    out: list[tuple[date, float]] = []
    for idx, close in df["Close"].items():
        try:
            out.append((idx.date(), float(close)))
        except (ValueError, TypeError):
            continue
    return out


def pull_and_store_prices() -> dict[str, int]:
    """Pull + store price history for the 5 tickers and the S&P 500."""
    from prism.common.companies import COMPANIES
    from prism.common.db import upsert_prices

    symbols = [c.ticker for c in COMPANIES if c.ticker] + [SP500]
    counts: dict[str, int] = {}
    for sym in symbols:
        try:
            rows = fetch_price_history(sym)
            counts[sym] = upsert_prices(sym, rows)
            log.info("stored %d daily closes for %s", counts[sym], sym)
        except Exception:  # noqa: BLE001 - isolate per-symbol failures
            log.exception("price pull failed for %s", sym)
            counts[sym] = 0
    return counts


# --- DB-backed orchestration -------------------------------------------------

def _resolve_company(ticker_or_name: str):
    from prism.common.companies import COMPANIES

    t = ticker_or_name.strip()
    return next(
        (c for c in COMPANIES
         if (c.ticker and c.ticker.upper() == t.upper())
         or c.name.lower() == t.lower()),
        None,
    )


def _records_for_company(company: str):
    """Resolve a company and compute its per-week backtest records from the DB.

    Returns (matched_company, weeks, records) where `records` is the output of
    `evaluate_weeks`. Shared by the summary and the flagged-weeks detail.
    """
    from prism.common.db import get_prices

    matched = _resolve_company(company)
    if matched is None:
        raise ValueError(f"Unknown company: {company!r}")

    weeks = backtestable_weeks(matched.name)
    stock_rows = get_prices(matched.ticker) if matched.ticker else []
    sp_rows = get_prices(SP500)
    stock_prices = [(r["date"], float(r["close_price"])) for r in stock_rows]
    sp_prices = [(r["date"], float(r["close_price"])) for r in sp_rows]

    records = evaluate_weeks(weeks, stock_prices, sp_prices)
    return matched, weeks, records


def run_backtest_for_company(company: str) -> dict[str, Any]:
    """Compute (without storing) the backtest summary for one company."""
    matched, weeks, records = _records_for_company(company)
    return summarize(matched.name, matched.ticker, records, weeks_available=len(weeks))


def select_flagged(records: list[dict[str, Any]], limit: int = 12) -> list[dict[str, Any]]:
    """Net-positive records only, newest first, capped at `limit`. Pure."""
    flagged = [r for r in records if r["net_positive"]]
    flagged.sort(key=lambda r: r["week_start"], reverse=True)
    return flagged[:limit]


def flagged_weeks_for_company(company: str, limit: int = 12) -> list[dict[str, Any]]:
    """Newest-first net-positive weeks with their 5-day outcomes.

    The evidence rows behind the stored summary: each is one week the 2-signal
    composite flagged, with the stock's return vs the S&P over the following
    five trading days.
    """
    matched, _weeks, records = _records_for_company(company)
    return [
        {
            "company": matched.name,
            "ticker": matched.ticker,
            "week_start": r["week_start"],
            "stock_return": r["stock_return"],
            "sp_return": r["sp_return"],
            "relative_return": r["relative_return"],
            "outperformed": r["outperformed"],
        }
        for r in select_flagged(records, limit)
    ]


def run_and_store_for_company(company: str) -> dict[str, Any]:
    """Compute and persist the backtest summary for one company."""
    from prism.common.db import upsert_backtest_result

    result = run_backtest_for_company(company)
    upsert_backtest_result(result)
    return result


def run_and_store_all() -> dict[str, dict[str, Any]]:
    """Compute and store backtests for every tracked company."""
    from prism.common.companies import COMPANIES

    out: dict[str, dict[str, Any]] = {}
    for c in COMPANIES:
        try:
            out[c.name] = run_and_store_for_company(c.name)
        except Exception:  # noqa: BLE001 - isolate per-company failures
            log.exception("backtest failed for %s", c.name)
    return out


# --- inspection --------------------------------------------------------------

def _fmt_pct(x: float | None) -> str:
    return "—" if x is None else f"{x * 100:.1f}%"


def _fmt_signed_pct(x: float | None) -> str:
    return "—" if x is None else f"{x * 100:+.2f}%"


def format_result(r: dict[str, Any]) -> str:
    """Render one backtest summary as a readable block."""
    edge = None
    if r["hit_rate"] is not None and r["base_rate"] is not None:
        edge = r["hit_rate"] - r["base_rate"]
    lines = [
        f"  {r['company']} ({r.get('ticker') or '—'})",
        f"    weeks tested (any week, computable 5d return) : {r['total_weeks_tested']}",
        f"    net-positive weeks (Trends + Filings)         : {r['net_positive_weeks']}",
        f"    hit rate  (net-positive weeks outperformed)   : {_fmt_pct(r['hit_rate'])}",
        f"    base rate (all tested weeks outperformed)     : {_fmt_pct(r['base_rate'])}",
        f"    edge (hit rate - base rate)                   : {_fmt_signed_pct(edge)}",
        f"    avg relative 5d return on net-positive weeks  : {_fmt_signed_pct(r['avg_relative_return'])}",
        f"    {'⚠ ' if r['small_sample'] else ''}{r['data_quality']}",
    ]
    return "\n".join(lines)


def print_results(company: str | None = None) -> None:
    """Compute (live) and print the backtest for one company or all of them."""
    from prism.common.companies import COMPANIES

    print("Prism signal backtest — Trends + Filings net-positive weeks vs S&P 500")
    print("(analysis infrastructure, not a prediction or recommendation)\n")
    targets = [company] if company else [c.name for c in COMPANIES]
    for name in targets:
        print(format_result(run_backtest_for_company(name)))
        print()


def main(argv: list[str] | None = None) -> None:
    """CLI: pull prices, run the backtest, and inspect results.

        python -m prism.analysis.backtest --pull          # fetch + store prices
        python -m prism.analysis.backtest --all           # run + store all
        python -m prism.analysis.backtest Robinhood       # print one (live)
        python -m prism.analysis.backtest                  # print all (live)
    """
    import sys

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    args = list(sys.argv[1:] if argv is None else argv)

    if args and args[0] in ("--pull", "-p"):
        print(pull_and_store_prices())
        return
    if args and args[0] in ("--all", "-a"):
        results = run_and_store_all()
        for r in results.values():
            print(format_result(r))
            print()
        return
    print_results(" ".join(args) if args else None)


if __name__ == "__main__":
    main()
