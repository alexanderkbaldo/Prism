"""Sentiment scraper: Reddit + StockTwits.

Reddit is read via PRAW when credentials are present. StockTwits is read via its
public symbol streams endpoint (token optional, but rate-limited without one).
Both fall back to deterministic sample data so the pipeline runs end-to-end with
no keys configured.
"""
from __future__ import annotations

import logging

from prism.common.companies import COMPANIES
from prism.common.config import settings
from prism.common.schemas import CATEGORY_SENTIMENT, RawEvent
from prism.scrapers.base import BaseScraper

log = logging.getLogger(__name__)


class SentimentScraper(BaseScraper):
    source = "sentiment"
    category = CATEGORY_SENTIMENT

    def has_credentials(self) -> bool:
        return bool(
            settings.reddit_client_id and settings.reddit_client_secret
        ) or bool(settings.stocktwits_access_token)

    def fetch(self) -> list[RawEvent]:
        events: list[RawEvent] = []
        events.extend(self._fetch_reddit())
        events.extend(self._fetch_stocktwits())
        if not events and settings.allow_sample_data:
            events.extend(self._sample())
        return events

    # ------------------------------------------------------------------ Reddit
    def _fetch_reddit(self) -> list[RawEvent]:
        # PENDING: Reddit credentials not provisioned yet — skip entirely.
        if not settings.reddit_enabled:
            log.info("reddit scraping is pending (reddit_enabled=false); skipping")
            return []
        if not (settings.reddit_client_id and settings.reddit_client_secret):
            return []
        try:
            import praw  # imported lazily so the dep is optional at runtime
        except ImportError:
            log.warning("praw not installed; skipping reddit")
            return []

        reddit = praw.Reddit(
            client_id=settings.reddit_client_id,
            client_secret=settings.reddit_client_secret,
            user_agent=settings.reddit_user_agent or settings.user_agent,
        )
        out: list[RawEvent] = []
        subs = [s.strip() for s in settings.reddit_subreddits.split(",") if s.strip()]
        terms = [a for c in COMPANIES for a in (c.name, c.ticker) if a]
        query = " OR ".join(f'"{t}"' for t in terms)
        for sub in subs:
            try:
                for post in reddit.subreddit(sub).search(query, sort="new", limit=50):
                    out.append(
                        RawEvent(
                            source="reddit",
                            category=self.category,
                            external_id=f"reddit:{post.id}",
                            title=post.title,
                            body=getattr(post, "selftext", "") or "",
                            url=f"https://reddit.com{post.permalink}",
                            author=str(post.author) if post.author else None,
                            raw_timestamp=str(post.created_utc),
                            metrics={"score": post.score,
                                     "num_comments": post.num_comments},
                            payload={"subreddit": sub},
                        )
                    )
            except Exception:  # noqa: BLE001
                log.exception("reddit search failed for r/%s", sub)
        return out

    # ------------------------------------------------------------- StockTwits
    def _fetch_stocktwits(self) -> list[RawEvent]:
        out: list[RawEvent] = []
        headers = {}
        if settings.stocktwits_access_token:
            headers["Authorization"] = f"OAuth {settings.stocktwits_access_token}"
        for company in COMPANIES:
            if not company.ticker:
                continue
            url = (
                "https://api.stocktwits.com/api/2/streams/symbol/"
                f"{company.ticker}.json"
            )
            try:
                resp = self.client.get(url, headers=headers)
                if resp.status_code != 200:
                    log.info("stocktwits %s -> %s", company.ticker, resp.status_code)
                    continue
                for msg in resp.json().get("messages", []):
                    sentiment = (msg.get("entities", {}) or {}).get("sentiment") or {}
                    out.append(
                        RawEvent(
                            source="stocktwits",
                            category=self.category,
                            external_id=f"stocktwits:{msg['id']}",
                            title=None,
                            body=msg.get("body"),
                            url=f"https://stocktwits.com/message/{msg['id']}",
                            author=(msg.get("user", {}) or {}).get("username"),
                            raw_timestamp=msg.get("created_at"),
                            metrics={"basic_sentiment": sentiment.get("basic")},
                            payload={"symbol": company.ticker},
                        )
                    )
            except Exception:  # noqa: BLE001
                log.exception("stocktwits fetch failed for %s", company.ticker)
        return out

    # --------------------------------------------------------------- Samples
    def _sample(self) -> list[RawEvent]:
        samples = [
            ("reddit", "DD: $HOOD crushing it on options revenue",
             "Robinhood active users up again, bullish.", 0),
            ("stocktwits", None, "Affirm BNPL volume looking strong into earnings $AFRM", 1),
            ("reddit", "Is Cash App losing users?",
             "Block (Square) Cash App growth seems to be slowing.", 0),
        ]
        out = []
        for i, (src, title, body, idx) in enumerate(samples):
            out.append(
                RawEvent(
                    source=src,
                    category=self.category,
                    external_id=f"sample:sentiment:{i}",
                    title=title,
                    body=body,
                    url=f"https://example.com/sentiment/{i}",
                    author="sample_user",
                    raw_timestamp="2026-06-01T12:00:00Z",
                    metrics={"basic_sentiment": "Bullish" if idx else "Bearish"},
                    payload={"sample": True},
                )
            )
        return out


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    with SentimentScraper() as scraper:
        print(f"published {scraper.run()} sentiment events")


if __name__ == "__main__":
    main()
