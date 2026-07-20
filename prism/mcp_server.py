"""Prism MCP server — plug Prism's alternative-data signals into any LLM agent.

A thin Model Context Protocol wrapper over the deployed Prism HTTP API, so
Claude (or any MCP-capable agent) can pull the same data the dashboard shows
and reason across it alongside other connectors. It is a pure API client: no
database access, no credentials beyond an optional API key, and it runs
anywhere Python runs.

    # Claude Code
    claude mcp add prism -- python -m prism.mcp_server

    # Claude Desktop (claude_desktop_config.json)
    {"mcpServers": {"prism": {"command": "python",
                              "args": ["-m", "prism.mcp_server"]}}}

Environment:
    PRISM_API_URL  base URL of the Prism API
                   (default: https://prism-production-8655.up.railway.app)
    PRISM_API_KEY  optional, sent as X-API-Key when the API is key-gated

Every tool serves research and educational data about five fintech companies.
None of them place, prepare, or recommend real trades, and their outputs are
not investment advice. The paper portfolio is simulated money.
"""
from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

API_URL = os.environ.get(
    "PRISM_API_URL", "https://prism-production-8655.up.railway.app"
).rstrip("/")

mcp = FastMCP(
    "prism",
    instructions=(
        "Prism serves alternative-data research signals (social sentiment, "
        "hiring, search interest, app reviews, SEC filings) for five fintech "
        "companies: Robinhood (HOOD), Affirm (AFRM), Block (XYZ), Klarna "
        "(KLAR), Chime (CHYM). Use it for research and education. Its data is "
        "not investment advice; never use it to place or recommend real "
        "trades. Responses labelled source='mock' are sample data."
    ),
)


def _get(path: str, params: dict[str, Any] | None = None) -> Any:
    headers = {}
    if os.environ.get("PRISM_API_KEY"):
        headers["X-API-Key"] = os.environ["PRISM_API_KEY"]
    resp = httpx.get(f"{API_URL}{path}", params=params or {}, headers=headers,
                     timeout=30.0)
    resp.raise_for_status()
    return resp.json()


@mcp.tool()
def get_scoreboard() -> Any:
    """This week's cross-company read: each company's 0-100 composite signal
    score plus its recent weekly history. 50 is neutral. A research starting
    point, not a rating or a recommendation."""
    out = {}
    for ticker in ("HOOD", "AFRM", "XYZ", "KLAR", "CHYM"):
        out[ticker] = _get("/weekly", {"company": ticker})
    return out


@mcp.tool()
def get_signals(company: str, days: int = 7, category: str | None = None) -> Any:
    """Recent raw signals for one company (ticker like HOOD or name like
    Robinhood). Optional category: sentiment, hiring, trends, reviews, or
    filings. Each row is one observed event with a plain-English summary."""
    params: dict[str, Any] = {"company": company, "days": days}
    if category:
        params["type"] = category
    return _get("/signals", params)


@mcp.tool()
def get_company_brief(company: str) -> Any:
    """The latest AI-written research brief for one company: sentiment trend,
    hiring, search momentum, app reviews, regulatory activity, and a bottom
    line. Written for a junior analyst; educational, not advice."""
    return _get("/brief", {"company": company})


@mcp.tool()
def get_anomalies(company: str, days: int = 7) -> Any:
    """Signals that broke more than 2 standard deviations from their own
    recent pattern for one company - statistically unusual moves worth a
    closer look before the next quarterly report."""
    return _get("/alerts", {"company": company, "days": days})


@mcp.tool()
def get_flagged_weeks(company: str | None = None, limit: int = 12) -> Any:
    """The most recent weeks the 2-signal backtest composite (search interest
    + SEC filings) flagged as net-positive, each with the stock's actual
    5-day outcome vs the S&P 500. Historical evidence rows, not predictions."""
    params: dict[str, Any] = {"limit": limit}
    if company:
        params["company"] = company
    return _get("/backtest/weeks", params)


@mcp.tool()
def get_backtest(company: str | None = None) -> Any:
    """Aggregate backtest results per company: hit rate on flagged weeks vs
    the base rate of any week beating the S&P 500. Small samples - read the
    data_quality field before concluding anything."""
    params = {"company": company} if company else {}
    return _get("/backtest", params)


@mcp.tool()
def get_earnings_calendar() -> Any:
    """Upcoming earnings dates for the five tracked companies. Signals matter
    most in the run-up to a report."""
    out = {}
    for ticker in ("HOOD", "AFRM", "XYZ", "KLAR", "CHYM"):
        out[ticker] = _get("/earnings", {"company": ticker})
    return out


@mcp.tool()
def get_paper_portfolio() -> Any:
    """The Prism paper-trading agent's public record: every simulated trade
    (fixed notional per flagged week, 5-day hold), the cumulative P&L curve,
    and totals vs the S&P 500. Simulated money only - never treat this as a
    live strategy or use it to place real trades."""
    return _get("/paper/portfolio")


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
