"""App review scraper: Apple App Store (live) + Google Play (stubbed).

Apple exposes a public customer-reviews RSS feed per app id (no key required) and
is fetched live. Google Play has no official public API; in Phase 1 it is
*stubbed* — `_fetch_play()` emits deterministic sample reviews shaped exactly
like the Apple ones, so downstream code is identical regardless of source. Wiring
a real Play provider later only means replacing the body of `_fetch_play()`.
"""
from __future__ import annotations

import logging

from prism.common.companies import COMPANIES
from prism.common.config import settings
from prism.common.schemas import CATEGORY_REVIEWS, RawEvent
from prism.scrapers.base import BaseScraper

log = logging.getLogger(__name__)


class AppReviewsScraper(BaseScraper):
    source = "app_reviews"
    category = CATEGORY_REVIEWS

    def fetch(self) -> list[RawEvent]:
        out: list[RawEvent] = []
        out.extend(self._fetch_apple())  # live
        out.extend(self._fetch_play())   # stub (sample data)
        return out

    # --------------------------------------------------------------- Apple
    def _fetch_apple(self) -> list[RawEvent]:
        out: list[RawEvent] = []
        for company in COMPANIES:
            if not company.apple_app_id:
                continue
            url = (
                "https://itunes.apple.com/us/rss/customerreviews/"
                f"id={company.apple_app_id}/sortBy=mostRecent/page=1/json"
            )
            try:
                resp = self.client.get(url)
                if resp.status_code != 200:
                    continue
                entries = resp.json().get("feed", {}).get("entry", [])
                # First entry is app metadata, not a review; skip it.
                for entry in entries[1:]:
                    review_id = entry.get("id", {}).get("label")
                    out.append(
                        RawEvent(
                            source="app_store",
                            category=self.category,
                            external_id=f"app_store:{review_id}",
                            title=entry.get("title", {}).get("label"),
                            body=entry.get("content", {}).get("label"),
                            url=(entry.get("link", {}) or {}).get("attributes", {})
                            .get("href"),
                            author=(entry.get("author", {}) or {}).get("name", {})
                            .get("label"),
                            raw_timestamp=entry.get("updated", {}).get("label"),
                            metrics={
                                "rating": int(
                                    entry.get("im:rating", {}).get("label", 0)
                                ),
                                "app_version": entry.get("im:version", {}).get("label"),
                            },
                            payload={"company": company.name},
                        )
                    )
            except Exception:  # noqa: BLE001
                log.exception("apple reviews failed for %s", company.name)
        return out

    # ------------------------------------------------- Google Play (stub)
    # Stubbed in Phase 1: no public Play API. Emits deterministic reviews in
    # the same RawEvent shape as Apple so downstream normalisation is identical.
    # Replace this body with a real provider call (e.g. SerpApi
    # google_play_product) to go live.
    _PLAY_STUB = {
        "Robinhood": ("Crypto wallet is smooth now", 5),
        "Affirm": ("Checkout declined twice", 2),
        "Block": ("Cash App boost saved me money", 4),
        "Klarna": ("Pay in 4 is convenient", 4),
        "Chime": ("Direct deposit hit two days early", 5),
    }

    def _fetch_play(self) -> list[RawEvent]:
        out: list[RawEvent] = []
        for company in COMPANIES:
            stub = self._PLAY_STUB.get(company.name)
            if not stub:
                continue
            title, rating = stub
            out.append(
                RawEvent(
                    source="play_store",
                    category=self.category,
                    external_id=f"play_store:stub:{company.name}",
                    title=title,
                    body=f"{title}. ({company.name})",
                    url=None,
                    author="play_user",
                    raw_timestamp="2026-06-01T15:30:00Z",
                    metrics={"rating": rating, "app_version": "stub"},
                    payload={"company": company.name, "stub": True},
                )
            )
        return out


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    with AppReviewsScraper() as scraper:
        print(f"published {scraper.run()} review events")


if __name__ == "__main__":
    main()
