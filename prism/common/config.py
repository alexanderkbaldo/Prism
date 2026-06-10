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
    # PENDING: Reddit API credentials are not available yet. While disabled the
    # sentiment scraper skips Reddit entirely (StockTwits still runs). Flip to
    # true once REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are provisioned.
    reddit_enabled: bool = Field(default=False)
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

    # --- AI synthesis & multi-model scoring (Phase 2) ------------------
    # The Anthropic SDK reads ANTHROPIC_API_KEY from the environment on its
    # own; setting it here lets pydantic surface it and pass it explicitly.
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    # Model used to synthesise the daily research brief. claude-sonnet-4-6 is
    # the current Sonnet (claude-sonnet-4-20250514 / Sonnet 4.0 is deprecated,
    # retires 2026-06-15). Override via env.
    claude_model: str = Field(default="claude-sonnet-4-6")
    # Per-signal secondary scorers.
    claude_scoring_model: str = Field(default="claude-sonnet-4-6")
    openai_model: str = Field(default="gpt-4o")
    # Window of signals fed into each brief. 7 days (rolling) matches the
    # dashboard's "trailing 7 days" framing and keeps sparse signals (filings,
    # reviews) present rather than empty on quiet days.
    brief_lookback_hours: int = Field(default=168)
    brief_max_signals: int = Field(default=120)
    # Multi-model scoring makes two LLM calls per scored signal, so it only
    # fires when keys are present AND this is on.
    enable_model_scoring: bool = Field(default=True)
    # Models are flagged as disagreeing when their sentiment scores differ by
    # more than this absolute amount.
    model_divergence_threshold: float = Field(default=0.3)
    # Where scoring runs:
    #   "worker" (default) — the dedicated `scorer` service scores signals off
    #     the ingestion hot path, so the normaliser drains fast.
    #   "inline" — the normaliser scores each signal as it ingests (simple, but
    #     blocks the consumer on LLM latency).
    #   "off" — no model scoring.
    scoring_mode: str = Field(default="worker")
    # Background scorer batch size and idle sleep when there's nothing to score.
    scorer_batch_size: int = Field(default=25)
    scorer_idle_seconds: int = Field(default=15)
    # Circuit breaker: after N consecutive failures for a model (e.g. a throttled
    # or out-of-quota key), stop calling it for `cooldown` seconds so it can't
    # stall scoring with retries. A success resets the counter.
    scoring_breaker_threshold: int = Field(default=3)
    scoring_breaker_cooldown_seconds: int = Field(default=300)

    # --- API security --------------------------------------------------
    # Optional API key. When set, every data/chat endpoint requires a matching
    # `X-API-Key` header (health check stays open). Note: a public SPA ships its
    # key to the browser, so this gates non-browser access — per-IP rate limiting
    # below is the real abuse protection. Leave blank to disable the key check.
    prism_api_key: str | None = None
    # Per-IP fixed-window limits (requests per minute). 0 disables a limit.
    rate_limit_per_minute: int = Field(default=60)
    # Stricter limit for the LLM-backed /chat endpoint (spends Claude credits).
    chat_rate_limit_per_minute: int = Field(default=10)
    # Browser origins allowed to call the API (CORS), comma-separated. Defaults to
    # the local Vite dev server; in production set this to the deployed frontend
    # URL, e.g. CORS_ALLOW_ORIGINS=https://prism.vercel.app
    cors_allow_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

    # --- Email alerts (Resend) -----------------------------------------
    # A scheduled digest emails new anomaly alerts. No-op unless both a Resend
    # API key and a recipient are configured. `alert_email_from` must be a
    # verified Resend sender (onboarding@resend.dev works for testing, but only
    # delivers to your own Resend account email).
    resend_api_key: str | None = None
    alert_email_to: str | None = None
    alert_email_from: str = Field(default="Prism Alerts <onboarding@resend.dev>")
    # Base URL used to build the dashboard link inside the email.
    dashboard_url: str = Field(default="http://localhost:5173")
    alert_digest_max: int = Field(default=50)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
