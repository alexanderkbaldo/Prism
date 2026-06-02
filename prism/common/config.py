"""Central configuration loaded from environment variables.

All services (scrapers, normaliser, flows) import `settings` from here so that
configuration lives in exactly one place and is driven entirely by the
environment / `.env` file (see `.env.example`).
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Infrastructure -------------------------------------------------
    redis_url: str = Field(default="redis://localhost:6379/0")
    raw_stream: str = Field(default="prism:raw")
    consumer_group: str = Field(default="normalisers")
    dedup_set_key: str = Field(default="prism:seen")

    database_url: str = Field(
        default="postgresql://prism:prism@localhost:5432/prism"
    )

    # --- General scraper behaviour -------------------------------------
    # When a scraper has no credentials configured it falls back to emitting
    # deterministic sample data so the full pipeline can be exercised locally.
    allow_sample_data: bool = Field(default=True)
    http_timeout: float = Field(default=20.0)
    user_agent: str = Field(default="PrismBot/0.1 (+https://example.com/prism)")

    # --- Reddit ---------------------------------------------------------
    reddit_client_id: str | None = None
    reddit_client_secret: str | None = None
    reddit_user_agent: str | None = None
    reddit_subreddits: str = Field(default="stocks,wallstreetbets,fintech")

    # --- StockTwits -----------------------------------------------------
    stocktwits_access_token: str | None = None

    # --- Hiring (LinkedIn / Indeed via SerpApi Google Jobs) ------------
    # Indeed and LinkedIn do not expose open public APIs. We source postings
    # through SerpApi's Google Jobs engine, which aggregates both. One key
    # (SERPAPI_KEY) powers both the hiring and Google Play review scrapers.
    serpapi_key: str | None = None
    serpapi_base_url: str = Field(default="https://serpapi.com/search")
    # Restrict hiring results to postings surfaced via these boards.
    hiring_boards: str = Field(default="LinkedIn,Indeed")

    # --- Google Trends --------------------------------------------------
    # pytrends needs no key; geo/timezone are configurable.
    trends_geo: str = Field(default="US")
    trends_tz: int = Field(default=360)

    # --- App reviews ----------------------------------------------------
    # Apple RSS feeds are public (live). Google Play has no official public
    # API; it is stubbed in Phase 1 (sample data) pending a provider wire-up,
    # mirroring the App Store shape.
    play_reviews_api_key: str | None = None
    play_reviews_base_url: str = Field(default="https://serpapi.com/search")

    # --- SEC EDGAR ------------------------------------------------------
    # EDGAR is fully public but requires a descriptive User-Agent with contact.
    sec_user_agent: str = Field(default="Prism prism@example.com")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
