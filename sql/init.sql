-- Prism Phase 1 schema.
-- Two tables: an append-only audit log of everything scraped (`raw_events`),
-- and the cleaned, company-attributed records analysts query (`signals`).

CREATE TABLE IF NOT EXISTS raw_events (
    id            BIGSERIAL PRIMARY KEY,
    source        TEXT        NOT NULL,
    category      TEXT        NOT NULL,
    external_id   TEXT        NOT NULL,
    title         TEXT,
    body          TEXT,
    url           TEXT,
    author        TEXT,
    raw_timestamp TEXT,                       -- original, unparsed
    metrics       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Identity of a logical source item; lets re-runs be idempotent.
    CONSTRAINT uq_raw_source_external UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_raw_events_category ON raw_events (category);
CREATE INDEX IF NOT EXISTS idx_raw_events_fetched  ON raw_events (fetched_at DESC);

CREATE TABLE IF NOT EXISTS signals (
    id              BIGSERIAL PRIMARY KEY,
    raw_event_id    BIGINT REFERENCES raw_events (id) ON DELETE SET NULL,
    source          TEXT        NOT NULL,
    category        TEXT        NOT NULL,
    company         TEXT        NOT NULL,      -- canonical name
    ticker          TEXT,
    title           TEXT,
    body            TEXT,
    sentiment       DOUBLE PRECISION,          -- [-1, 1], nullable
    url             TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL,      -- always UTC
    -- Plain-English, Claude-ready description of the signal (Phase 2 input).
    summary_text    TEXT,
    -- Source-based relevance/quality weight (1.0 = baseline).
    weight          DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    -- Secondary AI scores per signal: {"claude": {...}, "gpt4o": {...},
    -- "divergence": {...}}. Populated asynchronously by the normaliser.
    model_scores    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    metrics         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    dedup_hash      TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Authoritative dedup guard (layer 2; layer 1 is the Redis set).
    CONSTRAINT uq_signals_dedup UNIQUE (dedup_hash)
);

CREATE INDEX IF NOT EXISTS idx_signals_company   ON signals (company);
CREATE INDEX IF NOT EXISTS idx_signals_category  ON signals (category);
CREATE INDEX IF NOT EXISTS idx_signals_event_ts  ON signals (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_company_ts ON signals (company, event_timestamp DESC);

-- Anomaly alerts: written by the normaliser when a company's signal score moves
-- more than one standard deviation from its trailing rolling average.
CREATE TABLE IF NOT EXISTS alerts (
    id           BIGSERIAL PRIMARY KEY,
    signal_id    BIGINT REFERENCES signals (id) ON DELETE CASCADE,
    company      TEXT        NOT NULL,
    ticker       TEXT,
    category     TEXT,
    metric       TEXT        NOT NULL DEFAULT 'sentiment',  -- what moved
    value        DOUBLE PRECISION,                          -- the anomalous value
    rolling_avg  DOUBLE PRECISION,
    rolling_std  DOUBLE PRECISION,
    deviation    DOUBLE PRECISION,                          -- signed, in σ units
    direction    TEXT,                                      -- 'spike' | 'drop'
    summary_text TEXT,                                      -- Claude-ready blurb
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One alert per (signal, metric); makes the writer idempotent.
    CONSTRAINT uq_alerts_signal_metric UNIQUE (signal_id, metric)
);

CREATE INDEX IF NOT EXISTS idx_alerts_company    ON alerts (company);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);

-- AI-generated daily research briefs (one current row surfaced per company; the
-- table is append-only so prior briefs remain for history/audit).
CREATE TABLE IF NOT EXISTS company_briefs (
    id           BIGSERIAL PRIMARY KEY,
    company      TEXT        NOT NULL,
    ticker       TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    model        TEXT,                       -- model that produced the brief
    signal_count INTEGER,                    -- how many signals fed the brief
    brief_text   TEXT        NOT NULL        -- the synthesised brief (markdown)
);

CREATE INDEX IF NOT EXISTS idx_briefs_company_gen
    ON company_briefs (company, generated_at DESC);

-- Idempotent migrations for existing databases (CREATE ... IF NOT EXISTS above
-- only adds objects on a fresh DB; these ALTERs upgrade a populated one without
-- touching existing rows). Safe to re-run.
ALTER TABLE signals
    ADD COLUMN IF NOT EXISTS model_scores JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE signals
    ADD COLUMN IF NOT EXISTS summary_text TEXT;
ALTER TABLE signals
    ADD COLUMN IF NOT EXISTS weight DOUBLE PRECISION NOT NULL DEFAULT 1.0;
-- When the alert was included in an emailed digest (NULL = not yet sent).
ALTER TABLE alerts
    ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Earnings calendar cache. One row per company (canonical name); refreshed at
-- most once every 24h by the /earnings endpoint, which uses Claude web search
-- to find the next scheduled earnings date. Avoids a web search per request.
CREATE TABLE IF NOT EXISTS company_earnings (
    company            TEXT PRIMARY KEY,   -- canonical name
    ticker             TEXT,
    next_earnings_date DATE,               -- NULL if not found
    source_searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note               TEXT                -- optional model rationale/source
);

-- Signal validation engine (Part 1): one composite weekly score per company.
-- A transparent average of the available normalised signals for the week, plus
-- a "net-positive" flag defined relative to the company's OWN trailing median
-- (not an absolute threshold). Analysis infrastructure, not a prediction.
-- Idempotent: re-running the computation upserts on (company, week_start).
CREATE TABLE IF NOT EXISTS weekly_scores (
    company         TEXT    NOT NULL,        -- canonical name
    week_start      DATE    NOT NULL,        -- Monday of the ISO week (UTC)
    composite_score DOUBLE PRECISION,        -- mean of normalised signals [0,1]
    net_positive    BOOLEAN,                 -- > trailing median; NULL if too little history
    signals_present INTEGER NOT NULL DEFAULT 0,  -- how many of the 5 signals had data
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_weekly_scores PRIMARY KEY (company, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_scores_company
    ON weekly_scores (company, week_start);

-- Signal validation engine (Part 2): historical price backtest.
-- Daily closing prices for the tracked tickers + the S&P 500 (^GSPC), pulled
-- from yfinance. Idempotent: upsert on (ticker, date).
CREATE TABLE IF NOT EXISTS daily_prices (
    ticker      TEXT             NOT NULL,   -- e.g. HOOD, AFRM, XYZ, KLAR, CHYM, ^GSPC
    date        DATE             NOT NULL,
    close_price DOUBLE PRECISION NOT NULL,
    CONSTRAINT pk_daily_prices PRIMARY KEY (ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_prices_ticker
    ON daily_prices (ticker, date);

-- One backtest summary per company. Tests whether weeks flagged net-positive by
-- the 2-signal (Trends + Filings) backtestable composite outperformed the S&P
-- over the following 5 trading days, vs the base rate across all tested weeks.
-- Analysis infrastructure, NOT a prediction or recommendation.
CREATE TABLE IF NOT EXISTS backtest_results (
    company              TEXT PRIMARY KEY,        -- canonical name
    ticker               TEXT,
    total_weeks_tested   INTEGER NOT NULL DEFAULT 0,  -- candidate weeks w/ computable 5d return
    net_positive_weeks   INTEGER NOT NULL DEFAULT 0,  -- of those, flagged net-positive
    hit_rate             DOUBLE PRECISION,        -- % of net-positive weeks that outperformed
    base_rate            DOUBLE PRECISION,        -- % of ALL tested weeks that outperformed
    avg_relative_return  DOUBLE PRECISION,        -- mean (stock - S&P) 5d return on net-pos weeks
    weeks_available      INTEGER NOT NULL DEFAULT 0,  -- weeks of composite history available
    small_sample         BOOLEAN NOT NULL DEFAULT TRUE,  -- net_positive_weeks below robustness bar
    data_quality         TEXT,                    -- human-readable caveat
    computed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Convenience view: daily per-company sentiment + volume rollup.
CREATE OR REPLACE VIEW daily_company_signals AS
SELECT
    company,
    category,
    date_trunc('day', event_timestamp) AS day,
    count(*)                            AS signal_count,
    avg(sentiment)                      AS avg_sentiment
FROM signals
GROUP BY company, category, date_trunc('day', event_timestamp);
