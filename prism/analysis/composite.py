"""Composite weekly signal score — Part 1 of Prism's signal validation engine.

For a company and a calendar week, we combine the five alternative-data signals
(social sentiment, hiring, search interest, app reviews, SEC filings) into one
number in [0, 1] describing how positive/active that company's week looked.

Design principles (this is infrastructure, not prediction):

  * **Transparency over sophistication.** Each signal is normalised to a common
    [0, 1] scale with a documented, hand-checkable rule, then we take a plain
    average of whatever signals are present that week. No weighting, no model.
  * **Graceful missingness.** A week is scored from the signals that ARE present;
    we also record how many of the five were present (`signals_present`).
  * **Relative, not absolute.** "Net-positive" is defined against the company's
    OWN trailing-median composite, so it means "better than this company's
    normal", not "above some global line".

The normalisation and combination logic lives in pure functions
(`normalize_signal`, `composite_from_normals`, `score_weeks`) so it can be
unit-tested against known inputs without a database. The DB-backed entry points
(`compute_and_store_for_company`, `compute_and_store_all`) read weekly
aggregates, run the pure logic, and upsert the results.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from statistics import median
from typing import Any

log = logging.getLogger(__name__)

# The five signals, by their stored `category` value.
SENTIMENT = "sentiment"   # social sentiment (Reddit/StockTwits), avg in [-1, 1]
HIRING = "hiring"         # job postings, a volume (row count)
TRENDS = "trends"         # Google Trends search interest, avg in [0, 100]
REVIEWS = "reviews"       # app-store review sentiment, avg in [-1, 1]
FILINGS = "filings"       # SEC filings, a volume (row count)

CATEGORIES = (SENTIMENT, HIRING, TRENDS, REVIEWS, FILINGS)

# --- Volume-saturation constants --------------------------------------------
# Counts (hiring, filings) have no natural upper bound, so we map them to [0, 1)
# with a saturating curve  n / (n + K).  This is monotonic, bounded, and
# transparent: at n = K the signal reads 0.5, and it approaches 1 as n grows.
# K is set near a "typical" busy week for each so ordinary activity lands mid-
# scale rather than saturating. Hiring postings are far more frequent than SEC
# filings, hence a larger K.
HIRING_K = 10.0
FILINGS_K = 2.0

# Weeks of prior composites required before "net-positive" is meaningful. With
# fewer than this, the trailing median is too noisy, so net_positive is left
# undefined (None) rather than asserted.
MIN_TRAILING_WEEKS = 4


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def normalize_signal(category: str, agg: dict[str, Any]) -> float | None:
    """Normalise one category's weekly aggregate to [0, 1], or None if absent.

    `agg` is the weekly aggregate for a single category, with keys:
        n             : number of signal rows that week (int)
        avg_sentiment : mean sentiment in [-1, 1] (float | None)
        avg_interest  : mean Google Trends interest in [0, 100] (float | None)

    Normalisation per signal (higher = more positive/active):

    * sentiment, reviews : sentiment lives on [-1, 1]; map linearly to [0, 1]
                           via (x + 1) / 2  (so -1 -> 0, 0 -> 0.5, +1 -> 1).
                           Values are clamped to [-1, 1] for safety.
    * trends             : search interest is already 0-100; divide by 100.
                           (0 -> 0, 50 -> 0.5, 100 -> 1), clamped to [0, 100].
    * hiring, filings    : volumes, saturated as n / (n + K) — see constants.

    Returns None when the signal has no usable value that week (treated as
    missing, not zero), so the composite is computed only from present signals.
    """
    if category in (SENTIMENT, REVIEWS):
        avg = agg.get("avg_sentiment")
        if avg is None:
            return None
        return (_clamp(float(avg), -1.0, 1.0) + 1.0) / 2.0

    if category == TRENDS:
        avg = agg.get("avg_interest")
        if avg is None:
            return None
        return _clamp(float(avg), 0.0, 100.0) / 100.0

    if category == HIRING:
        n = agg.get("n") or 0
        return None if n <= 0 else n / (n + HIRING_K)

    if category == FILINGS:
        n = agg.get("n") or 0
        return None if n <= 0 else n / (n + FILINGS_K)

    return None  # unknown category — ignore


def composite_from_normals(normals: dict[str, float]) -> tuple[float | None, int]:
    """Combine present normalised signals into one composite score.

    Transparent and simple: the unweighted mean of the available normalised
    signals. Returns (composite, signals_present). With no signals present,
    returns (None, 0).
    """
    values = [v for v in normals.values() if v is not None]
    if not values:
        return None, 0
    return sum(values) / len(values), len(values)


def normalize_week(week_aggs: dict[str, dict[str, Any]]) -> dict[str, float]:
    """Normalise every present category for one week into {category: value}."""
    out: dict[str, float] = {}
    for category, agg in week_aggs.items():
        v = normalize_signal(category, agg)
        if v is not None:
            out[category] = v
    return out


@dataclass(frozen=True)
class WeeklyScore:
    week_start: date
    composite_score: float
    signals_present: int
    net_positive: bool | None


def score_weeks(
    weeks: list[tuple[date, dict[str, dict[str, Any]]]]
) -> list[WeeklyScore]:
    """Compute composite scores + net-positive flags for a company's weeks.

    `weeks` is an ordered (oldest-first) list of (week_start, {category: agg}).
    Pure function — no DB — so it is directly unit-testable.

    `net_positive` is set relative to the company's own history: a week is
    net-positive if its composite exceeds the median of all STRICTLY-PRIOR
    weeks' composites. It stays None until at least MIN_TRAILING_WEEKS of prior
    history exist (the trailing median would otherwise be too noisy to assert).
    """
    # Sort defensively so the trailing-median logic is always chronological.
    ordered = sorted(weeks, key=lambda w: w[0])

    scored: list[WeeklyScore] = []
    prior_composites: list[float] = []

    for week_start, week_aggs in ordered:
        normals = normalize_week(week_aggs)
        composite, present = composite_from_normals(normals)
        if composite is None:
            # No signals at all this week — nothing to score, and it does not
            # enter the trailing history.
            continue

        if len(prior_composites) >= MIN_TRAILING_WEEKS:
            net_positive: bool | None = composite > median(prior_composites)
        else:
            net_positive = None

        scored.append(
            WeeklyScore(
                week_start=week_start,
                composite_score=composite,
                signals_present=present,
                net_positive=net_positive,
            )
        )
        prior_composites.append(composite)

    return scored


# --- DB-backed orchestration -------------------------------------------------

def _group_by_week(
    rows: list[dict[str, Any]]
) -> list[tuple[date, dict[str, dict[str, Any]]]]:
    """Turn flat (week_start, category, ...) aggregate rows into per-week maps."""
    by_week: dict[date, dict[str, dict[str, Any]]] = {}
    for r in rows:
        by_week.setdefault(r["week_start"], {})[r["category"]] = r
    return sorted(by_week.items(), key=lambda kv: kv[0])


def compute_for_company(company: str) -> list[WeeklyScore]:
    """Read a company's weekly aggregates and compute scores (no write)."""
    from prism.common.db import weekly_signal_aggregates

    rows = weekly_signal_aggregates(company)
    return score_weeks(_group_by_week(rows))


def compute_and_store_for_company(company: str) -> int:
    """Compute and upsert all weekly scores for one company. Returns the count."""
    from prism.common.db import upsert_weekly_score

    scores = compute_for_company(company)
    for s in scores:
        upsert_weekly_score(
            company=company,
            week_start=s.week_start,
            composite_score=s.composite_score,
            net_positive=s.net_positive,
            signals_present=s.signals_present,
        )
    log.info("stored %d weekly scores for %s", len(scores), company)
    return len(scores)


def compute_and_store_all() -> dict[str, int]:
    """Compute and store weekly scores for every tracked company.

    One company's failure does not abort the rest.
    """
    from prism.common.companies import COMPANIES

    results: dict[str, int] = {}
    for company in COMPANIES:
        try:
            results[company.name] = compute_and_store_for_company(company.name)
        except Exception:  # noqa: BLE001 - isolate per-company failures
            log.exception("weekly score computation failed for %s", company.name)
            results[company.name] = 0
    return results


def format_scores(company: str, scores: list[WeeklyScore]) -> str:
    """Render a company's scores as a fixed-width table for sanity-checking."""
    lines = [
        f"Weekly composite scores — {company}",
        f"{'week_start':<12} {'composite':>9} {'present':>7} {'net_positive':>12}",
        "-" * 44,
    ]
    for s in scores:
        np = "—" if s.net_positive is None else ("yes" if s.net_positive else "no")
        lines.append(
            f"{s.week_start.isoformat():<12} {s.composite_score:>9.3f} "
            f"{s.signals_present:>7} {np:>12}"
        )
    if not scores:
        lines.append("(no weeks with any signal data)")
    return "\n".join(lines)


def print_scores(company: str) -> None:
    """Compute (without storing) and print one company's scores for inspection."""
    print(format_scores(company, compute_for_company(company)))


def main(argv: list[str] | None = None) -> None:
    """CLI: inspect or (re)compute weekly composite scores.

        python -m prism.analysis.composite Robinhood     # print one company
        python -m prism.analysis.composite --all         # compute + store all
    """
    import sys

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    args = list(sys.argv[1:] if argv is None else argv)

    if args and args[0] in ("--all", "-a"):
        print(compute_and_store_all())
        return
    if not args:
        from prism.common.companies import COMPANIES

        print("Usage: python -m prism.analysis.composite <company|--all>")
        print("Companies:", ", ".join(c.name for c in COMPANIES))
        return
    print_scores(" ".join(args))


if __name__ == "__main__":
    main()
