"""Next-earnings-date lookup for the dashboard's earnings calendar.

`get_next_earnings()` returns a company's next scheduled earnings date and how
many days away it is. Results are cached in Postgres for 24 hours so we don't
run a Claude web search on every request — the search is the expensive part.

Cache policy: a row is reused if it was searched within the last 24h *and* its
date is still in the future. Otherwise we re-search (when Claude is configured),
falling back to any stale cached row if the search fails.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from prism.common.companies import COMPANIES
from prism.common.config import settings

log = logging.getLogger(__name__)

CACHE_TTL_HOURS = 24


def _resolve_company(ticker_or_name: str):
    t = ticker_or_name.strip()
    return next(
        (c for c in COMPANIES
         if (c.ticker and c.ticker.upper() == t.upper())
         or c.name.lower() == t.lower()),
        None,
    )


def _to_date(value):
    """Coerce a DATE column / ISO string to a `date`, or None."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _shape(company: str, ticker: str | None, earnings_date, searched_at) -> dict:
    d = _to_date(earnings_date)
    days_until = (d - date.today()).days if d is not None else None
    if isinstance(searched_at, datetime):
        searched_at = searched_at.isoformat()
    return {
        "company": company,
        "ticker": ticker,
        "next_earnings_date": d.isoformat() if d else None,
        "days_until": days_until,
        "source_searched_at": searched_at,
    }


def _is_fresh(row: dict) -> bool:
    """True if the cached row was searched within the TTL and is still upcoming."""
    searched = row.get("source_searched_at")
    if not isinstance(searched, datetime):
        return False
    if searched.tzinfo is None:
        searched = searched.replace(tzinfo=timezone.utc)
    age_hours = (datetime.now(timezone.utc) - searched).total_seconds() / 3600
    if age_hours > CACHE_TTL_HOURS:
        return False
    d = _to_date(row.get("next_earnings_date"))
    # A past (or missing) date means the cached estimate is stale — re-search.
    return d is not None and d >= date.today()


_SEARCH_SYSTEM = (
    "You find the next scheduled quarterly earnings report date for public "
    "companies. Search the web for the most recent, authoritative source "
    "(the company's investor-relations page, Nasdaq, or a major financial "
    "data provider). Today's date is {today}. Identify the next UPCOMING "
    "earnings date strictly after today; if a date is only 'estimated', use it "
    "but prefer confirmed dates. Respond with ONLY a JSON object and nothing "
    'else: {{"next_earnings_date": "YYYY-MM-DD"}} for the next date, or '
    '{{"next_earnings_date": null}} if you cannot determine it.'
)


def _search_earnings_date(name: str, ticker: str | None) -> date | None:
    """Use Claude with web search to find the next earnings date. May return None."""
    import anthropic

    from prism.ai.claude_client import _parse_json, get_client

    who = f"{name} ({ticker})" if ticker else name
    system = _SEARCH_SYSTEM.format(today=date.today().isoformat())

    try:
        resp = get_client().messages.create(
            model=settings.claude_model,
            max_tokens=1024,
            system=system,
            tools=[{"type": "web_search_20260209", "name": "web_search",
                    "max_uses": 3}],
            messages=[{"role": "user",
                       "content": f"What is the next upcoming earnings report "
                                  f"date for {who}?"}],
        )
    except anthropic.APIError:
        log.exception("earnings web search failed for %s", name)
        return None

    text = "".join(b.text for b in resp.content if b.type == "text")
    data = _parse_json(text) or {}
    return _to_date(data.get("next_earnings_date"))


def get_next_earnings(company: str) -> dict:
    """Return next earnings info for a company, using a 24h Postgres cache.

    Raises ValueError for an unknown company. Returns a dict with
    next_earnings_date / days_until = None when nothing can be determined.
    """
    matched = _resolve_company(company)
    if matched is None:
        raise ValueError(f"Unknown company: {company!r}")

    from prism.ai.claude_client import is_configured

    # 1. Try the cache (tolerate a down DB).
    cached = None
    try:
        from prism.common.db import get_cached_earnings

        cached = get_cached_earnings(matched.name)
    except Exception:  # noqa: BLE001 - DB not up
        log.exception("earnings cache read failed for %s", matched.name)

    if cached and _is_fresh(cached):
        return _shape(matched.name, matched.ticker,
                      cached["next_earnings_date"], cached["source_searched_at"])

    # 2. Stale or missing — re-search if Claude is configured.
    if is_configured():
        found = _search_earnings_date(matched.name, matched.ticker)
        if found is not None:
            try:
                from prism.common.db import upsert_earnings

                upsert_earnings(matched.name, matched.ticker, found.isoformat())
            except Exception:  # noqa: BLE001 - DB not up; still return the value
                log.exception("earnings cache write failed for %s", matched.name)
            return _shape(matched.name, matched.ticker, found,
                          datetime.now(timezone.utc).isoformat())

    # 3. Fall back to a stale cached row if we have one.
    if cached:
        return _shape(matched.name, matched.ticker,
                      cached["next_earnings_date"], cached["source_searched_at"])

    # 4. Nothing available.
    return _shape(matched.name, matched.ticker, None, None)
