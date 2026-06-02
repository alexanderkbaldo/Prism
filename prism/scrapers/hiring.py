"""Hiring scraper: LinkedIn + Indeed postings via SerpApi's Google Jobs engine.

LinkedIn and Indeed expose no open jobs API and forbid direct scraping. SerpApi's
`google_jobs` engine aggregates postings from both (and others) behind a single
licensed endpoint. We query per company, keep only postings whose `via` board is
in `HIRING_BOARDS` (LinkedIn / Indeed), and emit one RawEvent per posting.

Hiring velocity — open-role counts per company over time — is the downstream
signal of interest.

Set SERPAPI_KEY to go live; without it the scraper emits sample postings so the
pipeline stays exercisable.
"""
from __future__ import annotations

import logging

from prism.common.companies import COMPANIES
from prism.common.config import settings
from prism.common.schemas import CATEGORY_HIRING, RawEvent
from prism.scrapers.base import BaseScraper

log = logging.getLogger(__name__)


class HiringScraper(BaseScraper):
    source = "hiring"
    category = CATEGORY_HIRING

    def has_credentials(self) -> bool:
        return bool(settings.serpapi_key)

    def fetch(self) -> list[RawEvent]:
        if self.has_credentials():
            events = self._fetch_serpapi()
            if events:
                return events
        if settings.allow_sample_data:
            return self._sample()
        return []

    def _allowed_boards(self) -> set[str]:
        return {b.strip().lower() for b in settings.hiring_boards.split(",") if b.strip()}

    def _fetch_serpapi(self) -> list[RawEvent]:
        out: list[RawEvent] = []
        allowed = self._allowed_boards()
        for company in COMPANIES:
            try:
                resp = self.client.get(
                    settings.serpapi_base_url,
                    params={
                        "engine": "google_jobs",
                        "q": f"{company.name} jobs",
                        "hl": "en",
                        "api_key": settings.serpapi_key,
                    },
                )
                if resp.status_code != 200:
                    log.info("serpapi jobs %s -> %s", company.name, resp.status_code)
                    continue
                for job in resp.json().get("jobs_results", []):
                    via = (job.get("via") or "").replace("via", "").strip()
                    # Keep only the boards we care about (LinkedIn / Indeed).
                    if allowed and not any(b in via.lower() for b in allowed):
                        continue
                    ext = job.get("detected_extensions", {}) or {}
                    # SerpApi exposes a stable per-result id under job_id.
                    job_id = job.get("job_id") or f"{company.name}:{job.get('title')}"
                    out.append(
                        RawEvent(
                            source=via.lower() or "google_jobs",
                            category=self.category,
                            external_id=f"hiring:{job_id}",
                            title=job.get("title"),
                            body=job.get("description"),
                            url=self._job_url(job),
                            author=job.get("company_name") or company.name,
                            raw_timestamp=ext.get("posted_at"),
                            metrics={
                                "board": via,
                                "location": job.get("location"),
                                "schedule": ext.get("schedule_type"),
                                "work_from_home": ext.get("work_from_home"),
                            },
                            payload={"company": company.name, "via": via},
                        )
                    )
            except Exception:  # noqa: BLE001
                log.exception("serpapi hiring fetch failed for %s", company.name)
        return out

    @staticmethod
    def _job_url(job: dict) -> str | None:
        for link in job.get("apply_options", []) or []:
            if link.get("link"):
                return link["link"]
        return (job.get("related_links") or [{}])[0].get("link")

    def _sample(self) -> list[RawEvent]:
        rows = [
            ("Robinhood", "LinkedIn", "Senior Backend Engineer, Crypto"),
            ("Affirm", "Indeed", "Risk Data Scientist"),
            ("Block", "LinkedIn", "Staff ML Engineer, Cash App"),
            ("Klarna", "Indeed", "Product Manager, Payments"),
            ("Chime", "LinkedIn", "Engineering Manager, Platform"),
        ]
        out = []
        for i, (company, board, title) in enumerate(rows):
            out.append(
                RawEvent(
                    source=board.lower(),
                    category=self.category,
                    external_id=f"sample:hiring:{i}",
                    title=title,
                    body=f"{company} is hiring a {title}.",
                    url=f"https://example.com/jobs/{i}",
                    author=company,
                    raw_timestamp="2026-06-01T09:00:00Z",
                    metrics={"board": board, "location": "Remote",
                             "work_from_home": True},
                    payload={"company": company, "via": board, "sample": True},
                )
            )
        return out


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    with HiringScraper() as scraper:
        print(f"published {scraper.run()} hiring events")


if __name__ == "__main__":
    main()
