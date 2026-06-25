"""Scheduled end-to-end pipeline — the daily cron entrypoint.

One invocation runs the whole cycle, Prefect-free (so it works as a plain
one-shot job on Railway cron or any scheduler):

    1. Run every scraper (each isolated; one failure doesn't abort the rest),
       recording health to `scraper_runs`.
    2. Wait PIPELINE_DRAIN_SECONDS for the always-on normaliser to drain Redis
       into Postgres.
    3. Generate the daily Claude research briefs.
    4. Run the health monitor (emails the admin if a scraper is failing/stale).
    5. Send subscriber emails: anomaly digest + daily digest, plus the weekly
       summary when today is WEEKLY_SUMMARY_WEEKDAY.

Run:  python -m prism.flows.pipeline
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from prism.common.config import settings
from prism.flows.dag import _SCRAPERS, _run_scraper_monitored

log = logging.getLogger(__name__)


def run_pipeline() -> dict:
    """Execute the full daily cycle once. Returns a summary dict."""
    summary: dict = {"scrapers": {}}

    # 1. Scrapers — isolate each so one source failing doesn't stop the others.
    for name in _SCRAPERS:
        try:
            summary["scrapers"][name] = _run_scraper_monitored(name)
        except Exception:  # noqa: BLE001 - already recorded; keep going
            log.exception("scraper %s failed", name)
            summary["scrapers"][name] = None

    # 2. Let the normaliser drain the stream into Postgres.
    log.info("waiting %ds for normaliser to drain", settings.pipeline_drain_seconds)
    time.sleep(settings.pipeline_drain_seconds)

    # 3. Daily Claude briefs.
    try:
        from prism.ai.synthesis import refresh_all

        summary["briefs"] = refresh_all()
    except Exception:  # noqa: BLE001
        log.exception("brief refresh failed")
        summary["briefs"] = None

    # 4. Health monitor (emails admin on degradation).
    try:
        from prism.notify.monitor import run_monitor

        report = run_monitor()
        summary["health"] = report["status"]
        summary["health_problems"] = report["problems"]
    except Exception:  # noqa: BLE001
        log.exception("health monitor failed")
        summary["health"] = "unknown"

    # 5. Subscriber emails.
    try:
        from prism.notify.digest import send_digest
        from prism.notify.updates import send_daily, send_weekly

        summary["anomaly_emails"] = send_digest()
        summary["daily_emails"] = send_daily()
        if datetime.now(timezone.utc).weekday() == settings.weekly_summary_weekday:
            summary["weekly_emails"] = send_weekly()
    except Exception:  # noqa: BLE001
        log.exception("subscriber emails failed")

    return summary


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    print(run_pipeline())


if __name__ == "__main__":
    main()
