"""Shared Resend email transport + branded HTML layout.

Every Prism mailing (anomaly digest, daily/weekly summaries, double-opt-in
confirmation) goes through `send_email`, and wraps its body in `render_email`
so they share chrome and an unsubscribe footer. Sending is a no-op (returns
False) unless `RESEND_API_KEY` is configured.

Mailings are sent one request per recipient — never a shared To/BCC — because
each email carries that subscriber's unique unsubscribe link, and so recipients
never see each other's addresses.
"""
from __future__ import annotations

import html
import logging

import httpx

from prism.common.config import settings

log = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"

# Palette mirrors the dashboard (sand/ink/sage) so email feels of-a-piece.
INK = "#1A2018"
SAGE = "#6B8F71"
MUTED = "#6E6253"
FAINT = "#8A7D6B"
HAIRLINE = "#CBBDA8"
PAPER = "#FBF8F2"


def is_configured() -> bool:
    return bool(settings.resend_api_key)


def render_email(title: str, body_html: str, unsub_url: str | None = None) -> str:
    """Wrap body content in the shared Prism email shell.

    `title` is the masthead line; `unsub_url`, when given, renders the required
    one-click unsubscribe footer.
    """
    dash = settings.dashboard_url.rstrip("/")
    footer_links = (
        f"<a href='{html.escape(dash)}' style='color:{SAGE};text-decoration:none;'>"
        f"Open Prism</a>"
    )
    if unsub_url:
        footer_links += (
            f" &nbsp;·&nbsp; "
            f"<a href='{html.escape(unsub_url)}' style='color:{FAINT};"
            f"text-decoration:underline;'>Unsubscribe</a>"
        )
    return (
        f"<div style='background:{PAPER};padding:32px 0;'>"
        f"<div style='font-family:Georgia,\"Times New Roman\",serif;max-width:600px;"
        f"margin:0 auto;background:#fff;border:0.5px solid {HAIRLINE};"
        f"border-radius:12px;overflow:hidden;'>"
        f"<div style='padding:24px 28px 8px;'>"
        f"<div style='font-size:11px;letter-spacing:0.18em;text-transform:uppercase;"
        f"color:{SAGE};font-weight:bold;'>Prism</div>"
        f"<h1 style='font-weight:400;font-size:23px;color:{INK};margin:10px 0 0;'>"
        f"{html.escape(title)}</h1>"
        f"</div>"
        f"<div style='padding:8px 28px 24px;color:{INK};font-size:15px;"
        f"line-height:1.55;'>{body_html}</div>"
        f"<div style='padding:18px 28px;border-top:0.5px solid {HAIRLINE};"
        f"font-size:12px;color:{FAINT};'>{footer_links}<br><br>"
        f"Prism — a student research project. For educational purposes only; "
        f"not investment advice.</div>"
        f"</div></div>"
    )


def send_email(to: str, subject: str, body_html: str) -> bool:
    """Send one email via Resend. Returns True on success.

    No-op (returns False) when no Resend key is configured.
    """
    if not is_configured():
        log.info("email skipped (RESEND_API_KEY not set)")
        return False
    try:
        resp = httpx.post(
            RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.alert_email_from,
                "to": [to],
                "subject": subject,
                "html": body_html,
            },
            timeout=settings.http_timeout,
        )
        if resp.status_code >= 300:
            log.error("Resend send failed: %s %s", resp.status_code,
                      resp.text[:200])
            return False
        return True
    except Exception:  # noqa: BLE001
        log.exception("Resend send failed")
        return False


def unsubscribe_url(token: str) -> str:
    """Build the one-click unsubscribe link for a subscriber's token."""
    return f"{settings.api_public_url.rstrip('/')}/unsubscribe?token={token}"
