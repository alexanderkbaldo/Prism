# Prism

AI-powered alternative-data platform for fintech equity research. Prism ingests
five alt-data sources, normalises and company-tags them, scores sentiment, flags
anomalies, and serves the result over a query API — all runnable locally with one
command. Every normalised signal carries a plain-English `summary_text` ready to
hand straight to the Claude API.

## Architecture

```
                 ┌──────────────────────────────────────────┐
   Prefect       │  scrapers (daily cron)                    │
   schedules ───▶│  sentiment · hiring · trends · reviews ·  │
                 │  sec_edgar                                │
                 └─────────────────┬────────────────────────┘
                                   │ RawEvent (JSON)
                                   ▼
                         Redis Stream  prism:raw
                                   │  consumer group
                                   ▼
                 ┌──────────────────────────────────────────────────┐
                 │  normaliser worker(s)                             │
                 │  dedup → UTC → company tag → sentiment →          │
                 │  summary_text → Signal → anomaly check →          │
                 │  multi-model score (Claude + GPT-4o)              │
                 └─────────────────┬────────────────────────────────┘
                                   ▼
            Postgres:  raw_events · signals · alerts · company_briefs
                          ▲                    ▲
   Prefect 07:30 ─────────┘                    │
   daily brief:  Claude synthesis              │
   (last-24h signals → brief)        FastAPI ──┘  GET /signals /alerts /brief
```

- **Scrapers** only *fetch and emit* `RawEvent`s onto Redis. No DB access.
- **Redis Streams** is the durable message queue (at-least-once via a consumer
  group, so the normaliser scales horizontally).
- **Normaliser** owns all enrichment: two-layer dedup (Redis set + a unique
  `dedup_hash` in Postgres), UTC normalisation, company entity tagging, sentiment
  scoring, `summary_text` generation, inline anomaly detection, and inline
  multi-model scoring.
- **Anomaly detection** runs on each stored signal: if a company's sentiment
  moves more than 1σ from its trailing 7-day rolling average, a row is written to
  `alerts` (`prism/normaliser/anomaly.py`).
- **Multi-model scoring** (`prism/ai/scoring.py`): for text-bearing signals,
  Claude (nuanced sentiment + regulatory read) and GPT-4o (fast structured
  score) each score the signal; both — plus a >0.3 disagreement flag — land in
  `signals.model_scores`. No-op unless keys are set and `ENABLE_MODEL_SCORING`.
- **Claude synthesis** (`prism/ai/synthesis.py`): a Prefect deployment runs at
  07:30 daily (after the scrapers), batches each company's last-24h signals,
  and has Claude write a structured research brief into `company_briefs`. Uses
  prompt caching on the static instruction prefix.
- **FastAPI** serves `/signals`, `/alerts`, and `/brief` over the tables.
- **Prefect** schedules each scraper on a staggered daily cron.

### Company universe
Robinhood (HOOD), Affirm (AFRM), Block (XYZ), Klarna (KLAR), Chime (CHYM).
Defined once in `prism/common/companies.py`.

## Sources

| Scraper        | Sources                | Access                                       |
|----------------|------------------------|----------------------------------------------|
| `sentiment`    | Reddit, StockTwits     | **Live** — Reddit OAuth (PRAW); StockTwits   |
| `hiring`       | LinkedIn, Indeed       | **Live** — SerpApi Google Jobs (`SERPAPI_KEY`)|
| `google_trends`| Google Trends          | **Live** — `pytrends`, no key                |
| `app_reviews`  | App Store / Play Store | App Store **live** (RSS); Play **stubbed**   |
| `sec_edgar`    | SEC EDGAR filings      | **Live** — public (contact email in UA)      |

Each scraper falls back to deterministic **sample data** when its credentials are
absent, so the whole pipeline runs with zero keys configured.

## Frontend dashboard

A React dashboard lives in `frontend/`. It connects to the FastAPI backend at
`localhost:8000` and shows live signal cards, anomaly alerts, and the daily
research brief for each company.

```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173
```

Requires Node 18+. The Vite dev server proxies all `/api/*` requests to
`localhost:8000`, so start the backend first (`docker compose up -d` or
`uvicorn prism.api.main:app --reload --port 8000`). The dashboard renders
clearly-labelled mock data if the API is unreachable.

## Quick start

```bash
cp .env.example .env          # optional: add SERPAPI_KEY, Reddit creds, etc.
docker compose up -d --build  # postgres, redis, prefect, normaliser, api
```

Trigger a scraper immediately (instead of waiting for the daily cron):

```bash
docker compose exec prefect-worker python -m prism.flows.dag run sentiment
docker compose exec prefect-worker python -m prism.flows.dag run all   # all five
```

Query the data:

```bash
# Via the API (http://localhost:8000/docs for interactive docs):
curl 'http://localhost:8000/signals?company=HOOD&type=sentiment&days=7'
curl 'http://localhost:8000/alerts?company=HOOD'
curl 'http://localhost:8000/brief?company=HOOD'

# Generate today's briefs on demand (needs ANTHROPIC_API_KEY):
docker compose exec prefect-worker python -m prism.flows.dag run brief

# Or straight from Postgres:
docker compose exec postgres psql -U prism -c \
  "SELECT company, category, count(*), round(avg(sentiment)::numeric,2) AS sent
   FROM signals GROUP BY 1,2 ORDER BY 1,2;"
```

UIs: Prefect <http://localhost:4200> · API docs <http://localhost:8000/docs>.

## Query API

`GET /signals` — normalised signals, filterable:

| Param     | Example       | Notes                                   |
|-----------|---------------|-----------------------------------------|
| `company` | `HOOD`        | ticker **or** canonical name (Robinhood)|
| `type`    | `sentiment`   | sentiment·hiring·trends·reviews·filings |
| `days`    | `7`           | trailing window (1–90)                   |
| `limit`   | `200`         | max rows (1–1000)                        |

`GET /alerts?company=HOOD` — anomaly flags. `GET /brief?company=HOOD` — the
latest AI-generated research brief. `GET /companies`, `GET /healthz` for
metadata. If Postgres is unreachable the API returns clearly-labelled mock data
(`"source": "mock"`) so it can be demoed standalone.

## AI layer (Phase 2)

Both AI paths are **off unless keys are set** (`ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`); the rest of the pipeline runs unaffected.

- **Daily brief** — `prism/ai/synthesis.py` batches each company's last-24h
  signals and has Claude (`CLAUDE_MODEL`, default `claude-sonnet-4-20250514`)
  write a 5-section research brief (sentiment · hiring · search · app store ·
  regulatory) into `company_briefs`. Static instructions are prompt-cached.
  > `claude-sonnet-4-20250514` is Sonnet 4.0, **deprecated (retires 2026-06-15)**
  > — set `CLAUDE_MODEL=claude-sonnet-4-6` to use the current Sonnet.
- **Multi-model scoring** — `prism/ai/scoring.py` runs inline in the normaliser
  for text-bearing signals: Claude + GPT-4o each score, and `model_scores`
  records both plus a `divergence` flag when their sentiment reads differ by
  more than `MODEL_DIVERGENCE_THRESHOLD` (0.3). Two LLM calls per scored signal
  — set `ENABLE_MODEL_SCORING=false` to disable even when keys are present.

## Local (no Docker)

```bash
pip install -e .
python -m prism.common.migrate                    # create/upgrade schema
# point at local redis/postgres (see .env), then in separate terminals:
python -m prism.normaliser.worker                 # consumer
python -m prism.flows.dag run all                 # produce
python -m prism.flows.dag run brief               # generate briefs (needs key)
uvicorn prism.api.main:app --reload --port 8000   # API
```

## Migrations

`sql/init.sql` is idempotent (`CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT
EXISTS`) and runs automatically on a fresh Postgres volume. For an **existing**
database, `python -m prism.common.migrate` (re-)applies it — adding the Phase 2
`company_briefs` table and `model_scores` column **without dropping data**. In
Docker this runs as a one-shot `migrate` service the workers wait on.

## Layout

```
prism/
  common/      config, schemas, redis + db clients, company registry, migrate
  scrapers/    base + five source scrapers (SerpApi hiring; Play stub)
  normaliser/  worker loop, dedup, timestamps, sentiment, summaries, anomaly
  ai/          claude_client, openai_client, scoring (multi-model), synthesis
  api/         FastAPI query layer (/signals, /alerts, /brief)
  flows/       Prefect flows & daily deployments (incl. 07:30 brief)
sql/init.sql   raw_events · signals (+ summary_text, model_scores) ·
               alerts · company_briefs (+ rollup view)
docker/        shared image
docker-compose.yml
```

## Tests

```bash
pip install -e ".[dev]"
pytest          # 23 tests; AI paths are gated off when keys are absent
```

## Notes & Phase 3 hooks
- **`summary_text`** is built deterministically in `normaliser/summaries.py`;
  it's the Claude-ready unit. Swap in an LLM-written summary behind the same
  `build()` signature without touching the schema.
- **Inline scoring vs. batch.** Multi-model scoring runs synchronously in the
  normaliser for simplicity; for high throughput, move it to the Batch APIs
  (50% cheaper) or a separate worker behind the same `scoring.score()` call.
- **Sentiment** is a lexicon + source-signal blend (`normaliser/sentiment.py`);
  swap in a model behind the same `score()` signature.
- **Anomaly** window/threshold (`ROLLING_WINDOW_DAYS`, `STDDEV_THRESHOLD`,
  `MIN_SAMPLES`) live at the top of `normaliser/anomaly.py`.
- **Google Play** reviews are stubbed; replace the body of
  `AppReviewsScraper._fetch_play()` with a provider call to go live.
- `daily_company_signals` view gives an immediate per-company rollup.
