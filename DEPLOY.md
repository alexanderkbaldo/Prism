# Deploying Prism

Backend → **Railway** (API + Postgres + Redis + workers). Frontend → **Vercel**.
Everything is environment-variable driven — no secrets or URLs are hardcoded.

## 1. Backend (Railway)

1. **New Project → Deploy from GitHub repo** (`blakelevine650-wq/Prism`).
2. **Add plugins:** Postgres and Redis. Railway injects `DATABASE_URL` and
   `REDIS_URL`, which `prism.common.config` reads automatically.
3. The **API service** builds from `railway.toml` (uses `docker/Dockerfile`),
   runs the idempotent migration, then serves on Railway's `$PORT`. A public URL
   is assigned (e.g. `https://prism-api.up.railway.app`).
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

## 2. Frontend (Vercel)

1. **New Project → import the repo**, set **Root Directory = `frontend`**.
   Vercel auto-detects Vite (build `npm run build`, output `dist`).
2. **Environment variable:** `VITE_API_URL=https://prism-api.up.railway.app`
   (the Railway API URL from step 1).
3. Deploy → Vercel assigns `https://<your-app>.vercel.app`.

`frontend/vercel.json` already handles SPA routing (rewrites non-asset paths to
`index.html`).

## 3. Connect them (CORS)

Set the Railway API's `CORS_ALLOW_ORIGINS` to the Vercel URL and redeploy the
API service. Verify:

```bash
curl -s -i 'https://prism-api.up.railway.app/healthz' \
  -H 'Origin: https://<your-app>.vercel.app' | grep -i access-control-allow-origin
# → access-control-allow-origin: https://<your-app>.vercel.app
```

Then open the Vercel URL — the dashboard should load live data and the chat
launcher should stream answers.

## Notes
- Local dev is unchanged: leave `VITE_API_URL` blank (Vite proxies `/api` →
  `localhost:8000`) and run `docker compose up -d`.
- Rotate any key that has ever appeared in logs before going public.
