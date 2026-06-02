"""Prefect orchestration for Prism scrapers.

Each scraper is wrapped as a Prefect flow. `serve()` registers them as
deployments on a daily cron (staggered so they don't all hammer sources at the
same minute). The normaliser is a always-on worker (see docker-compose), not a
scheduled flow, so it is intentionally absent here.

Run locally:        python -m prism.flows.dag         # serves all deployments
Trigger one now:    python -m prism.flows.dag run sentiment
"""
from __future__ import annotations

import logging
import sys

from prefect import flow, get_run_logger, task

from prism.scrapers.app_reviews import AppReviewsScraper
from prism.scrapers.google_trends import GoogleTrendsScraper
from prism.scrapers.hiring import HiringScraper
from prism.scrapers.sec_edgar import SecEdgarScraper
from prism.scrapers.sentiment import SentimentScraper

logging.basicConfig(level=logging.INFO)

_SCRAPERS = {
    "sentiment": SentimentScraper,
    "hiring": HiringScraper,
    "google_trends": GoogleTrendsScraper,
    "app_reviews": AppReviewsScraper,
    "sec_edgar": SecEdgarScraper,
}


@task(retries=2, retry_delay_seconds=60, log_prints=True)
def _run_scraper(name: str) -> int:
    scraper_cls = _SCRAPERS[name]
    with scraper_cls() as scraper:
        published = scraper.run()
    get_run_logger().info("%s published %d events", name, published)
    return published


@flow(name="sentiment-scraper")
def sentiment_flow() -> int:
    return _run_scraper("sentiment")


@flow(name="hiring-scraper")
def hiring_flow() -> int:
    return _run_scraper("hiring")


@flow(name="google-trends-scraper")
def google_trends_flow() -> int:
    return _run_scraper("google_trends")


@flow(name="app-reviews-scraper")
def app_reviews_flow() -> int:
    return _run_scraper("app_reviews")


@flow(name="sec-edgar-scraper")
def sec_edgar_flow() -> int:
    return _run_scraper("sec_edgar")


@flow(name="prism-ingest-all")
def ingest_all() -> dict[str, int]:
    """Convenience flow to run every scraper once (e.g. for backfills)."""
    return {name: _run_scraper(name) for name in _SCRAPERS}


# (flow object, daily cron) — staggered across the early-UTC hours.
_DEPLOYMENTS = [
    (sentiment_flow, "0 6 * * *"),
    (hiring_flow, "15 6 * * *"),
    (google_trends_flow, "30 6 * * *"),
    (app_reviews_flow, "45 6 * * *"),
    (sec_edgar_flow, "0 7 * * *"),
]


def _serve() -> None:
    from prefect import serve

    deployments = [
        flow_fn.to_deployment(name=f"{flow_fn.name}-daily", cron=cron)
        for flow_fn, cron in _DEPLOYMENTS
    ]
    serve(*deployments)


def main() -> None:
    if len(sys.argv) >= 3 and sys.argv[1] == "run":
        name = sys.argv[2]
        if name == "all":
            print(ingest_all())
        else:
            print({name: _run_scraper.fn(name)})
        return
    _serve()


if __name__ == "__main__":
    main()
