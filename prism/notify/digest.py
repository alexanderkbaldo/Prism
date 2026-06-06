"""Batched anomaly-alert email digest via Resend.

A scheduled job (Prefect deployment — see prism/flows/dag.py) calls
`send_digest()`, which collects anomaly alerts not yet emailed, sends them as a
single digest through Resend, and marks them notified so they're never sent
twice. No-op unless both `RESEND_API_KEY` and `ALERT_EMAIL_TO` are configured.
"""
from __future__ import annotations

import html
import logging

import httpx

from prism.common.config import settings
from prism.common.db import mark_alerts_notified, unnotified_alerts

log = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"


def is_configured() -> bool:
    return bool(settings.resend_api_key and settings.alert_email_to)


def _row_html(a: dict) -> str:
    company = html.escape(f"{a.get('company')} ({a.get('ticker')})"
                          if a.get("ticker") else str(a.get("company")))
    category = html.escape(str(a.get("category") or "signal"))
    direction = html.escape(str(a.get("direction") or ""))
    dev = a.get("deviation")
    dev_str = f"{dev:+.1f}σ" if isinstance(dev, (int, float)) else "—"
    summary = html.escape(a.get("summary_text") or "")
    when = a.get("created_at")
    when_str = when.strftime("%b %d, %H:%M UTC") if hasattr(when, "strftime") else ""
    return (
        f"<tr>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #CBBDA8;'>"
        f"<strong>{company}</strong><br><span style='color:#6E6253;font-size:13px;'>"
        f"{category} · {direction} · <strong>{dev_str}</strong></span><br>"
        f"<span style='color:#8A7D6B;font-size:12px;'>{summary}</span></td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #CBBDA8;"
        f"color:#8A7D6B;font-size:12px;white-space:nowrap;'>{when_str}</td>"
        f"</tr>"
    )


def _build_html(alerts: list[dict]) -> str:
    dash = settings.dashboard_url.rstrip("/") + "/dashboard"
    rows = "".join(_row_html(a) for a in alerts)
    return (
        f"<div style='font-family:Georgia,serif;max-width:600px;color:#1A2018;'>"
        f"<h2 style='font-weight:400;'>Prism — {len(alerts)} new anomaly "
        f"alert{'s' if len(alerts) != 1 else ''}</h2>"
        f"<p style='color:#6E6253;'>Signals that moved more than 1σ from their "
        f"7-day average.</p>"
        f"<table style='border-collapse:collapse;width:100%;'>{rows}</table>"
        f"<p style='margin-top:20px;'>"
        f"<a href='{html.escape(dash)}' style='color:#6B8F71;'>Open the Prism "
        f"dashboard →</a></p></div>"
    )


def _send_email(subject: str, body_html: str) -> bool:
    try:
        resp = httpx.post(
            RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.alert_email_from,
                "to": [settings.alert_email_to],
                "subject": subject,
                "html": body_html,
            },
            timeout=settings.http_timeout,
        )
        if resp.status_code >= 300:
            log.error("Resend send failed: %s %s", resp.status_code, resp.text[:200])
            return False
        return True
    except Exception:  # noqa: BLE001
        log.exception("Resend send failed")
        return False


def send_digest() -> int:
    """Email all un-notified alerts as one digest. Returns the number sent."""
    if not is_configured():
        log.info("email digest skipped (RESEND_API_KEY/ALERT_EMAIL_TO not set)")
        return 0

    alerts = unnotified_alerts(settings.alert_digest_max)
    if not alerts:
        log.info("email digest: no new alerts")
        return 0

    subject = f"Prism: {len(alerts)} new anomaly alert" + (
        "s" if len(alerts) != 1 else "")
    if not _send_email(subject, _build_html(alerts)):
        return 0  # leave them un-notified so the next run retries

    mark_alerts_notified([a["id"] for a in alerts])
    log.info("emailed digest of %d alert(s) to %s", len(alerts),
             settings.alert_email_to)
    return len(alerts)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    print(f"sent {send_digest()} alert(s)")


if __name__ == "__main__":
    main()
