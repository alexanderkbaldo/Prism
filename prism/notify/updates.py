"""Daily digest and weekly summary mailings.

Both build a compact, per-company roundup of recent activity across the tracked
fintechs and send it to the subscribers who opted into that cadence. The daily
digest covers the trailing 24h; the weekly summary the trailing 7 days. Driven
by the scheduled pipeline (prism/flows/pipeline.py).

No-op unless Resend is configured and at least one matching subscriber exists.
"""
from __future__ import annotations

import html
import logging

from prism.common.companies import COMPANIES
from prism.common.db import (
    confirmed_subscribers,
    daily_series,
    mark_subscribers_emailed,
    query_alerts,
)
from prism.notify.email import (
    HAIRLINE,
    INK,
    MUTED,
    FAINT,
    SAGE,
    is_configured,
    render_email,
    send_email,
    unsubscribe_url,
)

log = logging.getLogger(__name__)


def _company_summary(company: str, days: int) -> dict:
    """Aggregate one company's recent activity for the roundup table."""
    rows = daily_series(company, days)
    total = 0
    sent_w = 0.0
    sent_n = 0.0
    interest_sum = 0.0
    interest_n = 0
    for r in rows:
        c = r.get("count") or 0
        total += c
        # Sentiment-bearing categories are weighted by volume.
        if r.get("category") in ("sentiment", "reviews") and r.get("avg_sentiment") is not None:
            sent_w += r["avg_sentiment"] * (c or 1)
            sent_n += c or 1
        if r.get("avg_interest") is not None:
            interest_sum += r["avg_interest"]
            interest_n += 1
    avg_sent = sent_w / sent_n if sent_n else None
    try:
        alert_count = query_alerts(company=company, days=days, limit=500)
        alerts = len(alert_count)
    except Exception:  # noqa: BLE001 - don't let alerts query sink the email
        alerts = 0
    return {
        "signals": total,
        "sentiment": round(((avg_sent + 1) / 2) * 100) if avg_sent is not None else None,
        "interest": round(interest_sum / interest_n) if interest_n else None,
        "alerts": alerts,
    }


def _row_html(name: str, ticker: str | None, s: dict) -> str:
    label = html.escape(f"{name} ({ticker})" if ticker else name)
    sent = "—" if s["sentiment"] is None else f"{s['sentiment']}/100"
    interest = "—" if s["interest"] is None else str(s["interest"])
    alerts = (f"<span style='color:{SAGE};font-weight:bold;'>{s['alerts']}</span>"
              if s["alerts"] else "0")
    return (
        f"<tr>"
        f"<td style='padding:9px 10px;border-bottom:1px solid {HAIRLINE};"
        f"color:{INK};'><strong>{label}</strong></td>"
        f"<td style='padding:9px 10px;border-bottom:1px solid {HAIRLINE};"
        f"text-align:right;color:{MUTED};'>{s['signals']}</td>"
        f"<td style='padding:9px 10px;border-bottom:1px solid {HAIRLINE};"
        f"text-align:right;color:{MUTED};'>{sent}</td>"
        f"<td style='padding:9px 10px;border-bottom:1px solid {HAIRLINE};"
        f"text-align:right;color:{MUTED};'>{interest}</td>"
        f"<td style='padding:9px 10px;border-bottom:1px solid {HAIRLINE};"
        f"text-align:right;'>{alerts}</td>"
        f"</tr>"
    )


def _summary_body(days: int, period_label: str) -> str:
    """Build the per-company roundup table once (runs the DB queries).

    Identical for every recipient, so the caller renders it once and only varies
    the per-subscriber unsubscribe link.
    """
    head = (
        f"<tr style='font-size:11px;letter-spacing:0.04em;text-transform:uppercase;"
        f"color:{FAINT};'>"
        f"<th style='padding:6px 10px;text-align:left;'>Company</th>"
        f"<th style='padding:6px 10px;text-align:right;'>Signals</th>"
        f"<th style='padding:6px 10px;text-align:right;'>Sentiment</th>"
        f"<th style='padding:6px 10px;text-align:right;'>Search</th>"
        f"<th style='padding:6px 10px;text-align:right;'>Alerts</th>"
        f"</tr>"
    )
    body_rows = "".join(
        _row_html(c.name, c.ticker, _company_summary(c.name, days))
        for c in COMPANIES
    )
    body = (
        f"<p style='color:{MUTED};'>Here's what the alternative-data signals show "
        f"across the fintechs we track, {html.escape(period_label)}.</p>"
        f"<table style='border-collapse:collapse;width:100%;font-size:14px;'>"
        f"{head}{body_rows}</table>"
        f"<p style='color:{FAINT};font-size:12px;margin-top:14px;'>"
        f"Signals = items ingested · Sentiment 0–100 (50 neutral) · "
        f"Search = Google Trends index · Alerts = >1σ anomalies.</p>"
    )
    return body


def _send(kind: str, days: int, period_label: str, subject: str) -> int:
    """Build and send a summary mailing to all subscribers of `kind`."""
    if not is_configured():
        log.info("%s update skipped (RESEND_API_KEY not set)", kind)
        return 0
    recipients = confirmed_subscribers(kind)
    if not recipients:
        log.info("%s update: no subscribers", kind)
        return 0

    # Build the (recipient-independent) summary once; only the unsubscribe link
    # varies per subscriber.
    body = _summary_body(days, period_label)
    title = f"Prism — {period_label}"

    sent_to: list[str] = []
    for r in recipients:
        html_body = render_email(title, body, unsubscribe_url(r["unsub_token"]))
        if send_email(r["email"], subject, html_body):
            sent_to.append(r["email"])

    mark_subscribers_emailed(sent_to)
    log.info("%s update: emailed %d subscriber(s)", kind, len(sent_to))
    return len(sent_to)


def send_daily() -> int:
    """Daily digest (trailing 24h) to daily subscribers."""
    return _send("daily", days=1, period_label="today",
                 subject="Prism: your daily fintech signal digest")


def send_weekly() -> int:
    """Weekly summary (trailing 7 days) to weekly subscribers."""
    return _send("weekly", days=7, period_label="this week",
                 subject="Prism: your weekly fintech signal summary")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    print({"daily": send_daily(), "weekly": send_weekly()})


if __name__ == "__main__":
    main()
