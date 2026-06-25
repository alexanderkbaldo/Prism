"""Batched anomaly-alert email digest via Resend.

The scheduled pipeline (see prism/flows/pipeline.py) calls `send_digest()`,
which collects anomaly alerts not yet emailed and sends them as a single digest
to every confirmed subscriber who opted into anomaly alerts (plus the legacy
`ALERT_EMAIL_TO` admin address, if set). Alerts are marked notified afterward so
they're never sent twice. No-op unless Resend is configured and there's at least
one recipient.
"""
from __future__ import annotations

import html
import logging

from prism.common.config import settings
from prism.common.db import (
    confirmed_subscribers,
    mark_alerts_notified,
    mark_subscribers_emailed,
    unnotified_alerts,
)
from prism.notify.email import (
    HAIRLINE,
    MUTED,
    FAINT,
    is_configured,
    render_email,
    send_email,
    unsubscribe_url,
)

log = logging.getLogger(__name__)


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
        f"<td style='padding:8px 12px;border-bottom:1px solid {HAIRLINE};'>"
        f"<strong>{company}</strong><br><span style='color:{MUTED};font-size:13px;'>"
        f"{category} · {direction} · <strong>{dev_str}</strong></span><br>"
        f"<span style='color:{FAINT};font-size:12px;'>{summary}</span></td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid {HAIRLINE};"
        f"color:{FAINT};font-size:12px;white-space:nowrap;'>{when_str}</td>"
        f"</tr>"
    )


def _build_html(alerts: list[dict], unsub_url: str | None) -> str:
    rows = "".join(_row_html(a) for a in alerts)
    body = (
        f"<p style='color:{MUTED};'>Signals that moved more than 1σ from their "
        f"7-day average.</p>"
        f"<table style='border-collapse:collapse;width:100%;'>{rows}</table>"
    )
    title = (f"{len(alerts)} new anomaly alert"
             f"{'s' if len(alerts) != 1 else ''}")
    return render_email(title, body, unsub_url)


def _recipients() -> list[dict]:
    """Confirmed anomaly subscribers, plus the legacy admin address if set.

    Each entry is {"email", "unsub_token" | None}; a None token means no
    unsubscribe link (the admin address is not a public subscriber).
    """
    recips = [dict(r) for r in confirmed_subscribers("anomaly")]
    seen = {r["email"] for r in recips}
    if settings.alert_email_to and settings.alert_email_to not in seen:
        recips.append({"email": settings.alert_email_to, "unsub_token": None})
    return recips


def send_digest() -> int:
    """Email all un-notified alerts as one digest to every anomaly recipient.

    Returns the number of alerts included (0 if nothing to send / no recipients).
    """
    if not is_configured():
        log.info("email digest skipped (RESEND_API_KEY not set)")
        return 0

    alerts = unnotified_alerts(settings.alert_digest_max)
    if not alerts:
        log.info("email digest: no new alerts")
        return 0

    recipients = _recipients()
    if not recipients:
        log.info("email digest: no recipients (no anomaly subscribers)")
        return 0

    subject = f"Prism: {len(alerts)} new anomaly alert" + (
        "s" if len(alerts) != 1 else "")

    sent_to: list[str] = []
    for r in recipients:
        unsub = unsubscribe_url(r["unsub_token"]) if r.get("unsub_token") else None
        if send_email(r["email"], subject, _build_html(alerts, unsub)):
            sent_to.append(r["email"])

    if not sent_to:
        return 0  # every send failed; leave alerts un-notified to retry

    mark_alerts_notified([a["id"] for a in alerts])
    mark_subscribers_emailed(sent_to)
    log.info("emailed digest of %d alert(s) to %d recipient(s)",
             len(alerts), len(sent_to))
    return len(alerts)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    print(f"sent {send_digest()} alert(s)")


if __name__ == "__main__":
    main()
