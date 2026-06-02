"""Daily Claude synthesis layer.

For each company in the Phase 1 universe, batch the last-24h normalised signals,
send them to Claude to generate a structured research brief, and store the result
in `company_briefs`. Driven by a Prefect deployment that runs at 07:30 (after all
scrapers have finished their daily cron) — see `prism/flows/dag.py`.
"""
from __future__ import annotations

import logging

from prism.ai import claude_client
from prism.common.companies import COMPANIES
from prism.common.config import settings
from prism.common.db import insert_brief, recent_signals_for_company

log = logging.getLogger(__name__)


def refresh_company(company_name: str) -> int | None:
    """Generate and store today's brief for one company. Returns the brief id."""
    company = next((c for c in COMPANIES if c.name == company_name), None)
    if company is None:
        log.warning("unknown company %s", company_name)
        return None

    signals = recent_signals_for_company(
        company.name,
        hours=settings.brief_lookback_hours,
        limit=settings.brief_max_signals,
    )
    brief_text = claude_client.generate_brief(company.name, company.ticker, signals)
    brief_id = insert_brief(
        company=company.name,
        ticker=company.ticker,
        model=settings.claude_model,
        signal_count=len(signals),
        brief_text=brief_text,
    )
    log.info("stored brief %s for %s (%d signals)", brief_id, company.name,
             len(signals))
    return brief_id


def refresh_all() -> dict[str, int | None]:
    """Generate briefs for every company. One failure doesn't abort the rest."""
    if not claude_client.is_configured():
        log.warning("ANTHROPIC_API_KEY not configured; skipping brief refresh")
        return {}
    results: dict[str, int | None] = {}
    for company in COMPANIES:
        try:
            results[company.name] = refresh_company(company.name)
        except Exception:  # noqa: BLE001 - isolate per-company failures
            log.exception("brief refresh failed for %s", company.name)
            results[company.name] = None
    return results


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    print(refresh_all())


if __name__ == "__main__":
    main()
