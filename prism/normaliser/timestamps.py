"""Best-effort parsing of the many timestamp formats sources hand us, always
returning a timezone-aware UTC datetime."""
from __future__ import annotations

from datetime import datetime, timezone

from dateutil import parser as dateutil_parser

from prism.common.schemas import utcnow


def to_utc(raw: str | None) -> datetime:
    """Parse `raw` into UTC. Falls back to now() when unparseable.

    Handles: ISO-8601 strings, plain dates (EDGAR), and unix epoch seconds
    (Reddit's created_utc arrives as a float-ish string).
    """
    if not raw:
        return utcnow()

    raw = raw.strip()

    # Unix epoch seconds, e.g. "1717243200" or "1717243200.0".
    try:
        epoch = float(raw)
        if epoch > 1_000_000_000:  # ~2001+, sane lower bound
            return datetime.fromtimestamp(epoch, tz=timezone.utc)
    except (TypeError, ValueError):
        pass

    try:
        dt = dateutil_parser.parse(raw)
    except (ValueError, OverflowError):
        return utcnow()

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
