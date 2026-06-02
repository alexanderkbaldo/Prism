"""SEC EDGAR filings scraper.

EDGAR is fully public and free. We use the `submissions` JSON API to pull each
company's most recent filings by CIK. SEC requires a descriptive User-Agent that
includes a contact email (`SEC_USER_AGENT`); requests without one are throttled.
"""
from __future__ import annotations

import logging

from prism.common.companies import COMPANIES
from prism.common.config import settings
from prism.common.schemas import CATEGORY_FILINGS, RawEvent
from prism.scrapers.base import BaseScraper

log = logging.getLogger(__name__)

# Filing form types worth surfacing as signals.
INTERESTING_FORMS = {"10-K", "10-Q", "8-K", "S-1", "424B4", "13F-HR", "4"}


class SecEdgarScraper(BaseScraper):
    source = "edgar"
    category = CATEGORY_FILINGS

    def fetch(self) -> list[RawEvent]:
        out: list[RawEvent] = []
        headers = {"User-Agent": settings.sec_user_agent}
        for company in COMPANIES:
            if not company.cik:
                continue
            cik = company.cik.zfill(10)
            url = f"https://data.sec.gov/submissions/CIK{cik}.json"
            try:
                resp = self.client.get(url, headers=headers)
                if resp.status_code != 200:
                    log.info("edgar %s -> %s", company.name, resp.status_code)
                    continue
                recent = resp.json().get("filings", {}).get("recent", {})
                out.extend(self._parse_recent(company, cik, recent))
            except Exception:  # noqa: BLE001
                log.exception("edgar fetch failed for %s", company.name)
        if not out and settings.allow_sample_data:
            out.extend(self._sample())
        return out

    def _parse_recent(self, company, cik, recent) -> list[RawEvent]:
        out: list[RawEvent] = []
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accessions = recent.get("accessionNumber", [])
        primary_docs = recent.get("primaryDocument", [])
        report_dates = recent.get("reportDate", [])
        for i, form in enumerate(forms):
            if form not in INTERESTING_FORMS:
                continue
            accession = accessions[i]
            accession_nodash = accession.replace("-", "")
            doc = primary_docs[i] if i < len(primary_docs) else ""
            url = (
                f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/"
                f"{accession_nodash}/{doc}"
            )
            out.append(
                RawEvent(
                    source=self.source,
                    category=self.category,
                    external_id=f"edgar:{accession}",
                    title=f"{company.name} filed {form}",
                    body=None,
                    url=url,
                    author=company.name,
                    raw_timestamp=dates[i] if i < len(dates) else None,
                    metrics={
                        "form": form,
                        "report_date": report_dates[i]
                        if i < len(report_dates) else None,
                    },
                    payload={"company": company.name, "cik": cik},
                )
            )
            if len(out) >= 40:  # keep the per-run batch bounded
                break
        return out

    def _sample(self) -> list[RawEvent]:
        rows = [
            ("Robinhood", "8-K", "0001783879-26-000045"),
            ("Affirm", "10-Q", "0001820953-26-000012"),
            ("Klarna", "S-1", "0001821587-26-000003"),
        ]
        out = []
        for company, form, accession in rows:
            out.append(
                RawEvent(
                    source=self.source,
                    category=self.category,
                    external_id=f"sample:edgar:{accession}",
                    title=f"{company} filed {form}",
                    url=f"https://www.sec.gov/cgi-bin/browse-edgar?action={accession}",
                    author=company,
                    raw_timestamp="2026-06-01",
                    metrics={"form": form},
                    payload={"company": company, "sample": True},
                )
            )
        return out


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    with SecEdgarScraper() as scraper:
        print(f"published {scraper.run()} filing events")


if __name__ == "__main__":
    main()
