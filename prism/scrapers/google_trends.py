"""Google Trends scraper.

Uses `pytrends` (no API key) to pull daily interest-over-time for each company's
search term. Each emitted event is one (company, date) interest point; the
metric value is the 0-100 relative search interest Google reports.
"""
from __future__ import annotations

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
            log.warning("pytrends not installed; skipping trends")
            return self._sample() if settings.allow_sample_data else []

        out: list[RawEvent] = []
        try:
            pytrends = TrendReq(hl="en-US", tz=settings.trends_tz)
            for company in COMPANIES:
                pytrends.build_payload(
                    [company.name], timeframe="now 7-d", geo=settings.trends_geo
                )
                frame = pytrends.interest_over_time()
                if frame.empty:
                    continue
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
        except Exception:  # noqa: BLE001 - pytrends 429s are common
            log.exception("google trends fetch failed")
            if not out and settings.allow_sample_data:
                return self._sample()
        return out

    def _sample(self) -> list[RawEvent]:
        out = []
        for i, company in enumerate(COMPANIES):
            out.append(
                RawEvent(
                    source=self.source,
                    category=self.category,
                    external_id=f"sample:trends:{company.name}",
                    title=f"Search interest: {company.name}",
                    raw_timestamp="2026-06-01T00:00:00Z",
                    metrics={"interest": 50 + i * 7, "geo": settings.trends_geo},
                    payload={"company": company.name, "sample": True},
                )
            )
        return out


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    with GoogleTrendsScraper() as scraper:
        print(f"published {scraper.run()} trends events")


if __name__ == "__main__":
    main()
