"""Google Trends scraper.

Uses `pytrends` (no API key) to pull daily interest-over-time for each company's
search term. Each emitted event is one (company, date) interest point; the
metric value is the 0-100 relative search interest Google reports.
"""
from __future__ import annotations

import datetime
import logging

from prism.common.companies import COMPANIES
from prism.common.config import settings
from prism.common.schemas import CATEGORY_TRENDS, RawEvent
from prism.scrapers.base import BaseScraper

log = logging.getLogger(__name__)


class GoogleTrendsScraper(BaseScraper):
    source = "google_trends"
    category = CATEGORY_TRENDS

    def fetch(self) -> list[RawEvent]:
        try:
            from pytrends.request import TrendReq
        except ImportError:
            log.warning("pytrends not installed; using sample trends")
            return self._sample() if settings.allow_sample_data else []

        try:
            pytrends = TrendReq(hl="en-US", tz=settings.trends_tz)
        except Exception:  # noqa: BLE001
            log.exception("pytrends init failed")
            return self._sample() if settings.allow_sample_data else []

        # Each company is fetched independently: a pytrends 429 (common) on one
        # company must NOT abort the rest, and each company that returns nothing
        # falls back to its own sample so every company gets trends data.
        out: list[RawEvent] = []
        for company in COMPANIES:
            events = self._fetch_company(pytrends, company)
            if not events and settings.allow_sample_data:
                events = self._sample_company(company)
            out.extend(events)
        return out

    def _fetch_company(self, pytrends, company) -> list[RawEvent]:
        try:
            pytrends.build_payload(
                [company.name], timeframe="now 7-d", geo=settings.trends_geo
            )
            frame = pytrends.interest_over_time()
        except Exception:  # noqa: BLE001 - pytrends 429s are common; isolate them
            log.warning("trends fetch failed for %s (likely 429)", company.name)
            return []
        if frame.empty:
            return []
        out: list[RawEvent] = []
        for ts, row in frame.iterrows():
            value = int(row[company.name])
            out.append(
                RawEvent(
                    source=self.source,
                    category=self.category,
                    external_id=f"trends:{company.name}:{ts.isoformat()}",
                    title=f"Search interest: {company.name}",
                    body=None,
                    url="https://trends.google.com/",
                    author=None,
                    raw_timestamp=ts.isoformat(),
                    metrics={"interest": value, "geo": settings.trends_geo},
                    payload={"company": company.name},
                )
            )
        return out

    def _sample_company(self, company) -> list[RawEvent]:
        # ~7 recent daily points (ending today) so the chart and the dashboard's
        # current-week window both populate. Deterministic per company.
        base = 50 + (COMPANIES.index(company) * 7) % 45
        today = datetime.datetime.now(datetime.timezone.utc).date()
        out: list[RawEvent] = []
        for d in range(7):
            day = today - datetime.timedelta(days=d)
            value = max(0, min(100, base - d * 2))
            out.append(
                RawEvent(
                    source=self.source,
                    category=self.category,
                    external_id=f"sample:trends:{company.name}:{day.isoformat()}",
                    title=f"Search interest: {company.name}",
                    raw_timestamp=f"{day.isoformat()}T00:00:00Z",
                    metrics={"interest": value, "geo": settings.trends_geo},
                    payload={"company": company.name, "sample": True},
                )
            )
        return out

    def _sample(self) -> list[RawEvent]:
        out: list[RawEvent] = []
        for company in COMPANIES:
            out.extend(self._sample_company(company))
        return out


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    with GoogleTrendsScraper() as scraper:
        print(f"published {scraper.run()} trends events")


if __name__ == "__main__":
    main()
