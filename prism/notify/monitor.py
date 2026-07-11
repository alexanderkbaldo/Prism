"""Automatic scraper monitoring: freshness + failure detection.

`check_health()` reads the latest run of every scraper (from `scraper_runs`,
written by the scheduled pipeline) plus the most recent ingested signal, and
classifies each scraper as:

    ok      — last run succeeded recently
    empty   — last run succeeded but produced 0 events
    error   — last run raised
    stale   — last run is older than MONITOR_STALE_HOURS
    unknown — never recorded a run

`run_monitor()` runs the check and, when anything is wrong, emails the admin
(`ALERT_EMAIL_TO`). The API exposes the same check at GET /monitor for an
external uptime probe.
"""
from __future__ import annotations

import html
import logging
from datetime import datetime, timezone

from prism.common.config import settings
from prism.common.db import latest_scraper_runs, latest_signal_at
from prism.notify.email import (
    HAIRLINE,
    MUTED,
    INK,
    is_configured,
    render_email,
    send_email,
)

log = logging.getLogger(__name__)

# The scrapers we expect to report in. Kept in sync with prism/flows/dag.py.
EXPECTED_SCRAPERS = [
    "sentiment", "hiring", "google_trends", "app_reviews", "sec_edgar",
]

_BAD_STATES = {"error", "stale", "unknown", "empty"}


def _hours_since(ts: datetime | None) -> float | None:
    if ts is None:
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - ts).total_seconds() / 3600.0


def check_health() -> dict:
    """Return a health report over all expected scrapers + data freshness."""
    stale_hours = settings.monitor_stale_hours
    runs = {r["scraper"]: r for r in latest_scraper_runs()}

    scrapers = []
    for name in EXPECTED_SCRAPERS:
        run = runs.get(name)
        if run is None:
            state = "unknown"
            detail = "no run recorded yet"
            age = None
        else:
            age = _hours_since(run["created_at"])
            if run["status"] == "error":
                state = "error"
                detail = (run.get("error") or "scraper raised").strip()[:160]
            elif age is not None and age > stale_hours:
                state = "stale"
                detail = f"last successful run {age:.0f}h ago"
            elif (run.get("events") or 0) == 0:
                state = "empty"
                detail = "ran but produced 0 events"
            else:
                state = "ok"
                detail = f"{run['events']} events, {age:.0f}h ago"
        scrapers.append({"scraper": name, "state": state, "detail": detail,
                         "age_hours": round(age, 1) if age is not None else None})

    last_signal = latest_signal_at()
    signal_age = _hours_since(last_signal)
    data_stale = signal_age is None or signal_age > stale_hours

    problems = [s for s in scrapers if s["state"] in _BAD_STATES]
    healthy = not problems and not data_stale

    return {
        "status": "ok" if healthy else "degraded",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "stale_threshold_hours": stale_hours,
        "data_fresh": not data_stale,
        "last_signal_age_hours": round(signal_age, 1) if signal_age is not None else None,
        "scrapers": scrapers,
        "problems": [f"{p['scraper']}: {p['state']} ({p['detail']})"
                     for p in problems],
    }


def _alert_html(report: dict) -> str:
    rows = ""
    for s in report["scrapers"]:
        color = "#B4533A" if s["state"] in _BAD_STATES else MUTED
        rows += (
            f"<tr>"
            f"<td style='padding:7px 10px;border-bottom:1px solid {HAIRLINE};"
            f"color:{INK};'>{html.escape(s['scraper'])}</td>"
            f"<td style='padding:7px 10px;border-bottom:1px solid {HAIRLINE};"
            f"color:{color};font-weight:bold;'>{html.escape(s['state'])}</td>"
            f"<td style='padding:7px 10px;border-bottom:1px solid {HAIRLINE};"
            f"color:{MUTED};font-size:13px;'>{html.escape(s['detail'])}</td>"
            f"</tr>"
        )
    body = (
        f"<p style='color:{MUTED};'>The scraper health check found "
        f"{len(report['problems'])} issue(s). Data freshness: "
        f"{'OK' if report['data_fresh'] else 'STALE'}.</p>"
        f"<table style='border-collapse:collapse;width:100%;'>{rows}</table>"
    )
    return render_email("Scraper health: degraded", body)


def run_monitor() -> dict:
    """Check health and email the admin if anything is wrong. Returns the report."""
    report = check_health()
    if report["status"] == "ok":
        log.info("scraper health: ok")
        return report

    log.warning("scraper health degraded: %s", report["problems"])
    if is_configured() and settings.alert_email_to:
        send_email(settings.alert_email_to,
                   "Prism: scraper health degraded",
                   _alert_html(report))
    return report


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    import json
    print(json.dumps(run_monitor(), indent=2))


if __name__ == "__main__":
    main()
