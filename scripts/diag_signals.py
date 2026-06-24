"""Quick diagnostic: per-category row counts + date range for one company in the
`signals` table. Helps explain why the backtest sees 0 backtestable weeks.

Usage:  python scripts/diag_signals.py [company]   # default: Block
"""
from __future__ import annotations

import sys

# The two categories the backtest actually uses (composite.TRENDS / FILINGS).
BACKTEST_CATEGORIES = {"trends", "filings"}


def main() -> None:
    company = sys.argv[1] if len(sys.argv) > 1 else "Block"
    from prism.common.db import get_cursor

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT category,
                   count(*)                  AS n,
                   min(event_timestamp)::date AS first_day,
                   max(event_timestamp)::date AS last_day
            FROM signals
            WHERE lower(company) = lower(%(c)s) OR upper(ticker) = upper(%(c)s)
            GROUP BY category
            ORDER BY category
            """,
            {"c": company},
        )
        rows = cur.fetchall()

    print(f"signals rows for company = {company!r}")
    print(f"{'category':<12} {'rows':>7}  {'first_day':<12} {'last_day':<12}")
    print("-" * 48)
    total = 0
    present = set()
    for r in rows:
        total += r["n"]
        present.add(r["category"])
        print(f"{r['category']:<12} {r['n']:>7}  "
              f"{str(r['first_day']):<12} {str(r['last_day']):<12}")
    if not rows:
        print("(no rows at all for this company)")
    print("-" * 48)
    print(f"{'TOTAL':<12} {total:>7}")

    print("\nBacktestable signals (Trends + Filings):")
    for cat in sorted(BACKTEST_CATEGORIES):
        have = cat in present
        print(f"  {cat:<10} {'present' if have else 'MISSING — no data'}")
    if not (BACKTEST_CATEGORIES & present):
        print("\n=> No Trends or Filings data => 0 backtestable weeks. Expected.")


if __name__ == "__main__":
    main()
