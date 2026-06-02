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
