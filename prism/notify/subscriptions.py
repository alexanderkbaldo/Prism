"""Email subscription management: double opt-in signup, confirm, unsubscribe.

Flow:
  1. `subscribe(email, prefs)` inserts an unconfirmed row and emails a
     confirmation link.
  2. The recipient clicks it → `confirm(token)` flips the row to confirmed.
     Only confirmed addresses receive mailings.
  3. Every email includes a one-click unsubscribe link → `unsubscribe(token)`.

The API layer (prism/api/main.py) calls these and renders the returned status /
HTML pages. Sending requires `RESEND_API_KEY`; without it `subscribe` still
records the row but reports that confirmation email could not be sent.
"""
from __future__ import annotations

import html
import logging
import re
import secrets

from prism.common.config import settings
from prism.common.db import (
    confirm_subscriber,
    unsubscribe_by_token,
    upsert_subscriber,
)
from prism.notify.email import (
    SAGE,
    render_email,
    send_email,
    unsubscribe_url,
)

log = logging.getLogger(__name__)

# Pragmatic email check — not RFC-complete, just enough to reject obvious junk
# before we store it or hand it to Resend.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _valid_email(email: str) -> bool:
    return bool(_EMAIL_RE.match(email)) and len(email) <= 254


def _confirm_url(token: str) -> str:
    return f"{settings.api_public_url.rstrip('/')}/confirm?token={token}"


def _confirmation_email_html(confirm_link: str, unsub_link: str) -> str:
    body = (
        f"<p>Thanks for subscribing to Prism. Confirm your email to start "
        f"receiving alternative-data updates on the fintechs we track.</p>"
        f"<p style='margin:24px 0;'>"
        f"<a href='{html.escape(confirm_link)}' "
        f"style='display:inline-block;background:{SAGE};color:#fff;"
        f"text-decoration:none;font-family:Helvetica,Arial,sans-serif;"
        f"font-size:14px;font-weight:bold;padding:14px 30px;border-radius:8px;'>"
        f"Confirm subscription</a></p>"
        f"<p style='font-size:13px;color:#6E6253;'>If the button doesn't work, "
        f"paste this link into your browser:<br>"
        f"<span style='word-break:break-all;'>{html.escape(confirm_link)}</span></p>"
        f"<p style='font-size:13px;color:#6E6253;'>If you didn't request this, "
        f"you can ignore this email — you won't be added.</p>"
    )
    return render_email("Confirm your subscription", body, unsub_link)


def subscribe(email: str, daily: bool, anomaly: bool, weekly: bool) -> dict:
    """Register (or update) a subscriber and send a confirmation email.

    Returns {"ok": bool, "message": str}. Idempotent: re-subscribing an
    already-confirmed address just updates its preferences without re-confirming.
    """
    email = (email or "").strip().lower()
    if not _valid_email(email):
        return {"ok": False, "message": "Please enter a valid email address."}
    if not (daily or anomaly or weekly):
        return {"ok": False,
                "message": "Pick at least one type of update to receive."}

    row = upsert_subscriber(
        email=email,
        daily=daily,
        anomaly=anomaly,
        weekly=weekly,
        confirm_token=secrets.token_urlsafe(32),
        unsub_token=secrets.token_urlsafe(32),
    )

    if row["confirmed"]:
        return {"ok": True,
                "message": "You're already subscribed — preferences updated."}

    sent = send_email(
        to=email,
        subject="Confirm your Prism subscription",
        body_html=_confirmation_email_html(
            _confirm_url(row["confirm_token"]),
            unsubscribe_url(row["unsub_token"]),
        ),
    )
    if not sent:
        # Row is stored; the user just can't confirm until email is configured.
        log.warning("subscriber %s stored but confirmation email not sent", email)
        return {"ok": True,
                "message": "Almost there — check your inbox to confirm. "
                           "(If no email arrives, email delivery may not be "
                           "configured yet.)"}
    return {"ok": True,
            "message": "Check your inbox to confirm your subscription."}


def confirm(token: str) -> bool:
    """Confirm a subscriber by token. Returns True if a row was confirmed."""
    return confirm_subscriber(token) is not None


def unsubscribe(token: str) -> bool:
    """Remove a subscriber by token. Returns True if a row was removed."""
    return unsubscribe_by_token(token) is not None


# --- Branded result pages (rendered by the API for email-link clicks) --------

def _page(title: str, message: str) -> str:
    dash = settings.dashboard_url.rstrip("/")
    return (
        f"<!doctype html><html><head><meta charset='utf-8'>"
        f"<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>Prism — {html.escape(title)}</title></head>"
        f"<body style='margin:0;background:#F3ECE0;font-family:Georgia,serif;'>"
        f"<div style='max-width:480px;margin:12vh auto;background:#fff;"
        f"border:0.5px solid #CBBDA8;border-radius:14px;padding:40px 36px;"
        f"text-align:center;'>"
        f"<div style='font-size:11px;letter-spacing:0.2em;text-transform:uppercase;"
        f"color:#6B8F71;font-weight:bold;'>Prism</div>"
        f"<h1 style='font-weight:400;font-size:26px;color:#1A2018;margin:18px 0 10px;'>"
        f"{html.escape(title)}</h1>"
        f"<p style='color:#6E6253;font-size:15px;line-height:1.55;'>"
        f"{html.escape(message)}</p>"
        f"<a href='{html.escape(dash)}' style='display:inline-block;margin-top:22px;"
        f"background:#6B8F71;color:#fff;text-decoration:none;font-size:14px;"
        f"font-family:Helvetica,Arial,sans-serif;padding:13px 28px;"
        f"border-radius:8px;'>Open the dashboard</a>"
        f"</div></body></html>"
    )


def confirm_page(ok: bool) -> str:
    if ok:
        return _page("You're subscribed",
                     "Your email is confirmed. You'll start receiving Prism "
                     "updates with the next scheduled run.")
    return _page("Link expired",
                 "This confirmation link is invalid or has already been used. "
                 "Try subscribing again from the site.")


def unsubscribe_page(ok: bool) -> str:
    if ok:
        return _page("Unsubscribed",
                     "You've been removed and won't receive further emails. "
                     "You can re-subscribe any time.")
    return _page("Link not found",
                 "We couldn't find that subscription — you may already be "
                 "unsubscribed.")
