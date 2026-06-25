"""The Phase 1 company universe.

Used in two places:
  * scrapers read `search_terms` / tickers to know what to pull;
  * the normaliser uses `aliases` to tag free text with a canonical company.

Keep aliases lowercase; matching is case-insensitive and word-boundary aware.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Company:
    name: str  # canonical display name
    ticker: str | None
    aliases: tuple[str, ...]
    # App identifiers for the reviews scraper.
    apple_app_id: str | None = None
    play_package: str | None = None
    # SEC Central Index Key (zero-padded to 10 digits) for EDGAR.
    cik: str | None = None
    extra: dict = field(default_factory=dict)


COMPANIES: tuple[Company, ...] = (
    Company(
        name="Robinhood",
        ticker="HOOD",
        aliases=("robinhood", "robin hood", "hood", "$hood"),
        apple_app_id="938003185",
        play_package="com.robinhood.android",
        cik="0001783879",
    ),
    Company(
        name="Affirm",
        ticker="AFRM",
        aliases=("affirm", "affirm holdings", "$afrm"),
        apple_app_id="1097193508",
        play_package="com.affirm.central",
        cik="0001820953",
    ),
    Company(
        name="Block",
        ticker="XYZ",
        # "block" / "square" (bare) are needed so trends/filings events titled
        # with the canonical name ("Search interest: Block", "Block filed 10-Q")
        # tag correctly — every other company's bare name is already an alias.
        aliases=("block", "block inc", "block, inc", "square", "square inc",
                 "cash app", "$xyz", "$sq"),
        apple_app_id="711923939",  # Cash App
        play_package="com.squareup.cash",
        cik="0001512673",
    ),
    Company(
        name="Klarna",
        ticker="KLAR",
        aliases=("klarna", "klarna group", "$klar"),
        apple_app_id="1115120118",
        play_package="com.myklarnamobile",
        cik="0001821587",
    ),
    Company(
        name="Chime",
        ticker="CHYM",
        aliases=("chime", "chime financial", "$chym"),
        apple_app_id="836215269",
        play_package="com.onedebit.chime",
        cik="0001767094",
    ),
)

BY_NAME: dict[str, Company] = {c.name: c for c in COMPANIES}
BY_TICKER: dict[str, Company] = {c.ticker: c for c in COMPANIES if c.ticker}

# Pre-compile one regex per alias, ordered longest-first so that the most
# specific alias wins (e.g. "robin hood" before "hood").
_ALIAS_PATTERNS: list[tuple[re.Pattern[str], Company]] = []
for _company in COMPANIES:
    for _alias in sorted(_company.aliases, key=len, reverse=True):
        _ALIAS_PATTERNS.append(
            (re.compile(rf"(?<!\w){re.escape(_alias)}(?!\w)", re.IGNORECASE), _company)
        )


def tag_companies(*texts: str | None) -> list[Company]:
    """Return the distinct companies mentioned across the given texts."""
    haystack = " \n ".join(t for t in texts if t)
    found: list[Company] = []
    seen: set[str] = set()
    for pattern, company in _ALIAS_PATTERNS:
        if company.name in seen:
            continue
        if pattern.search(haystack):
            found.append(company)
            seen.add(company.name)
    return found
