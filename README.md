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
                 ┌──────────────────────────────────────────┐
                 │  normaliser worker(s)                     │
                 │  dedup → UTC → company tag → sentiment →  │
                 │  summary_text → Signal → anomaly check    │
                 └─────────────────┬────────────────────────┘
                                   ▼
                 Postgres:  raw_events · signals · alerts
                                   ▲
                                   │
                 FastAPI  ─────────┘   GET /signals  /alerts
```

- **Scrapers** only *fetch and emit* `RawEvent`s onto Redis. No DB access.
- **Redis Streams** is the durable message queue (at-least-once via a consumer
  group, so the normaliser scales horizontally).
- **Normaliser** owns all enrichment: two-layer dedup (Redis set + a unique
  `dedup_hash` in Postgres), UTC normalisation, company entity tagging, sentiment
  scoring, `summary_text` generation, and inline anomaly detection.
- **Anomaly detection** runs on each stored signal: if a company's sentiment
  moves more than 1σ from its trailing 7-day rolling average, a row is written to
  `alerts` (`prism/normaliser/anomaly.py`).
- **FastAPI** serves signals and alerts for downstream / Phase 2 consumers.
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

`GET /alerts` — anomaly flags. `GET /companies`, `GET /healthz` for metadata.
If Postgres is unreachable the API returns clearly-labelled mock data
(`"source": "mock"`) so it can be demoed standalone.

## Local (no Docker)

```bash
pip install -e .
# point at local redis/postgres (see .env), then in separate terminals:
python -m prism.normaliser.worker                 # consumer
python -m prism.flows.dag run all                 # produce
uvicorn prism.api.main:app --reload --port 8000   # API
```

## Layout

```
prism/
  common/      config, schemas, redis + db clients, company registry
  scrapers/    base + five source scrapers (SerpApi hiring; Play stub)
  normaliser/  worker loop, dedup, timestamps, sentiment, summaries, anomaly
  api/         FastAPI query layer (/signals, /alerts)
  flows/       Prefect flows & daily deployments
sql/init.sql   raw_events · signals (+ summary_text) · alerts (+ rollup view)
docker/        shared image
docker-compose.yml
```

## Tests

```bash
pip install -e ".[dev]"
pytest          # 15 tests, no external services required
```

## Notes & Phase 2 hooks
- **`summary_text`** is built deterministically in `normaliser/summaries.py`;
  it's the Claude-ready unit. Swap in an LLM-written summary behind the same
  `build()` signature without touching the schema.
- **Sentiment** is a lexicon + source-signal blend (`normaliser/sentiment.py`);
  swap in a model behind the same `score()` signature.
- **Anomaly** window/threshold (`ROLLING_WINDOW_DAYS`, `STDDEV_THRESHOLD`,
  `MIN_SAMPLES`) live at the top of `normaliser/anomaly.py`.
- **Google Play** reviews are stubbed; replace the body of
  `AppReviewsScraper._fetch_play()` with a provider call to go live.
- `daily_company_signals` view gives an immediate per-company rollup.
