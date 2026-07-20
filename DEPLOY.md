# Deploying Prism

Backend → **Railway** (API + Postgres + Redis + workers). Frontend → **Vercel**.
Everything is environment-variable driven — no secrets or URLs are hardcoded.

## 1. Backend (Railway)

1. **New Project → Deploy from GitHub repo** (`blakelevine650-wq/Prism`).
2. **Add plugins:** Postgres and Redis. Railway injects `DATABASE_URL` and
   `REDIS_URL`, which `prism.common.config` reads automatically.
3. The **API service** builds from `railway.toml` (uses `docker/Dockerfile`),
   runs the idempotent migration, then serves on Railway's `$PORT`. A public URL
   is assigned (this project's live one: `https://prism-production-8655.up.railway.app`).
4. **Set service variables** (Settings → Variables):
   - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SERPAPI_KEY` — as needed
   - `CORS_ALLOW_ORIGINS=https://<your-app>.vercel.app` (the frontend URL; add it
     after step 2 of the frontend, or set it now if you know it)
   - `PRISM_API_KEY` — optional, gates non-browser access
   - `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `DASHBOARD_URL` — for email alerts
5. **Health check:** `/healthz` (already configured in `railway.toml`).

### Workers (optional, for live data)
The API serves whatever is in Postgres. To populate it, deploy the background
workers as **separate Railway services from the same repo**, overriding the
start command (Settings → Deploy → Custom Start Command):

| Service | Start command |
|---|---|
| normaliser | `python -m prism.normaliser.worker` |
| scorer | `python -m prism.ai.scorer` |
| prefect-worker | `python -m prism.flows.dag` |

They share the same Postgres/Redis plugins and variables. Without them, the API
returns empty results (or labelled mock data if the DB is unreachable).

**Do not run the migration in a worker start command.** Only the API service
runs `python -m prism.common.migrate` (it's baked into `railway.toml`'s start
command). Letting multiple services migrate concurrently on first deploy can
race; the workers just need the schema to already exist. If you ever deploy a
worker *before* the API, run the migration once manually first:
`railway ssh "python -m prism.common.migrate"`.

**Prefect networking (`prefect-worker` only).** `docker-compose.yml` points the
worker at `http://prefect-server:4200/api`, and the local default is
`http://localhost:4200/api` — neither resolves on Railway. If you run Prefect on
Railway, deploy a `prefect-server` service (`prefect server start --host 0.0.0.0`)
and set on the worker:

```
PREFECT_API_URL=http://<prefect-server-service>.railway.internal:4200/api
```

using Railway's private network hostname (Settings → Networking shows the
service's internal domain). Simpler first ship: skip Prefect entirely and use the
**snapshot deploy** below — it seeds data once and needs no `prefect-worker`.

## 2. Frontend (Vercel)

1. **New Project → import the repo**, set **Root Directory = `frontend`**.
   Vercel auto-detects Vite (build `npm run build`, output `dist`).
2. **Environment variable:** `VITE_API_URL=https://prism-production-8655.up.railway.app`
   (the Railway API URL from step 1).
3. Deploy → Vercel assigns `https://<your-app>.vercel.app`.

`frontend/vercel.json` already handles SPA routing (rewrites non-asset paths to
`index.html`).

## 3. Connect them (CORS)

Set the Railway API's `CORS_ALLOW_ORIGINS` to the Vercel URL and redeploy the
API service. Verify:

```bash
curl -s -i 'https://prism-production-8655.up.railway.app/healthz' \
  -H 'Origin: https://<your-app>.vercel.app' | grep -i access-control-allow-origin
# → access-control-allow-origin: https://<your-app>.vercel.app
```

Then open the Vercel URL — the dashboard should load live data and the chat
launcher should stream answers.

## Notes
- Local dev is unchanged: leave `VITE_API_URL` blank (Vite proxies `/api` →
  `localhost:8000`) and run `docker compose up -d`.
- Rotate any key that has ever appeared in logs before going public.

---

# Snapshot deploy (recommended first ship)

Ship the **site only** (API + Postgres + Redis + frontend) reading from a
one-time snapshot of your local data. No background workers, ~$0 ongoing, never
crash-loops. Data is frozen until you re-seed. This is the fastest path to a
real URL; graduate to live workers later if you want daily refresh.

What runs: **Railway** = Postgres + Redis + API. **Vercel** = frontend.
What you do NOT deploy: `normaliser`, `scorer`, `prefect-worker`.

### 0. Take a fresh snapshot (local)
```
./scripts/backup_db.sh
```
Note the newest file under `./backups/` — that's your seed. Take it *after*
regenerating briefs so the deployed copy has the latest plain-language ones.

### 1. Railway — Postgres + Redis + API
1. **New Project → Deploy from GitHub repo** (`blakelevine650-wq/Prism`).
2. **Add plugins:** Postgres and Redis. (Redis here only powers the per-IP rate
   limiter — keep it so a public `/chat` can't burn your Claude credits.)
3. The **API service** builds from `railway.toml`, runs the idempotent
   migration, and serves on `$PORT`. Let the first deploy finish.
4. Grab the DB URL: **Postgres plugin → Connect → "Postgres Connection URL".**
5. **Seed it from your machine** (needs `psql`: `brew install libpq && brew link --force libpq`):
   ```
   ./scripts/seed_remote.sh --reset backups/prism-YYYYMMDD-HHMMSS.sql.gz "<that URL>"
   ```
   `--reset` wipes the freshly-migrated empty tables and loads your snapshot
   cleanly. It prints the target and asks you to type `yes` first.
6. **API service variables** (Settings → Variables):
   - `ANTHROPIC_API_KEY` — chat needs it live.
   - `CHAT_RATE_LIMIT_PER_MINUTE=5` — bounds chat-credit spend by visitors.
   - `CORS_ALLOW_ORIGINS=https://<your-app>.vercel.app` — set after step 2 below.
   - **Not needed** in snapshot mode: `OPENAI_API_KEY`, `SERPAPI_KEY`.

### 2. Vercel — frontend
1. **New Project → import the repo**, **Root Directory = `frontend`** (Vite auto-detected).
2. Env var: `VITE_API_URL=https://<your-api>.up.railway.app`.
3. Deploy → note the assigned `https://<your-app>.vercel.app`.

### 3. Connect (CORS)
Set the API's `CORS_ALLOW_ORIGINS` to the Vercel URL, redeploy the API, verify:
```
curl -s -i 'https://<your-api>.up.railway.app/healthz' \
  -H 'Origin: https://<your-app>.vercel.app' | grep -i access-control-allow-origin
```
Then open the Vercel URL — dashboard loads the snapshot, chat streams live.

### Refresh the snapshot later
```
./scripts/backup_db.sh
./scripts/seed_remote.sh --reset backups/prism-<new>.sql.gz "<railway db url>"
```
The site updates instantly (no redeploy needed — it's just data).

---

# Email subscriptions & automatic monitoring

Two additions beyond the snapshot ship: public email subscriptions (double
opt-in) and an automatically-scheduled, self-monitoring pipeline.

### Email subscriptions (double opt-in)
The site's signup form posts to `POST /subscribe`. The API stores the address
unconfirmed and emails a confirmation link; clicking it (`GET /confirm?token=`)
activates it. Every email carries a one-click unsubscribe link
(`GET /unsubscribe?token=`). Subscribers choose any of: **daily digest**,
**anomaly alerts**, **weekly summary**.

Required env (on the API service AND the pipeline service):
- `RESEND_API_KEY` — Resend key. Without it, signups are stored but no mail goes
  out.
- `ALERT_EMAIL_FROM` — a **verified** Resend sender. `onboarding@resend.dev`
  only delivers to your own Resend account; to email real subscribers you must
  verify a domain in Resend (e.g. `Prism <alerts@prismdata.co>`).
- `API_PUBLIC_URL` — the API's public URL (e.g.
  `https://prism-production-8655.up.railway.app`); confirm/unsubscribe links are
  built from it.
- `DASHBOARD_URL` — the Vercel URL (link inside emails).

### Scheduled pipeline + monitoring
`python -m prism.flows.pipeline` runs the whole daily cycle in one shot:
scrapers → wait for the normaliser to drain → daily briefs → health monitor →
subscriber emails (anomaly + daily; weekly on `WEEKLY_SUMMARY_WEEKDAY`). Deploy
it as a **Railway cron service** (replaces the manual console refresh):

1. New service from the same repo → Settings → Config-as-code path =
   `railway.pipeline.toml` (runs `prism.flows.pipeline` daily at 06:00 UTC via
   `cronSchedule`; restart policy NEVER so a finished run isn't relaunched).
2. Give it the same variables as the API/normaliser (`DATABASE_URL`,
   `REDIS_URL`, `ANTHROPIC_API_KEY`, scraper keys, and the email vars above).
3. The always-on `normaliser` service must be deployed for the pipeline's
   scraped events to reach Postgres.

### Health monitoring
Each scraper run is logged to `scraper_runs`. The pipeline runs a health check
that flags any scraper that errored, produced 0 events, or has gone silent for
more than `MONITOR_STALE_HOURS` (default 36), and emails `ALERT_EMAIL_TO` when
something is wrong. The same report is exposed (open, no key) at `GET /monitor`
for an external uptime probe:
```
curl -s 'https://<your-api>.up.railway.app/monitor' | jq .status
```
