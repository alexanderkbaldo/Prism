# Prism

**Fintech intelligence before the earnings call.**

Prism is an AI-powered alternative-data platform for fintech equity research. It tracks the signals that move a company before they reach the income statement, and turns them into clear, readable research.

---

## What it does

Prism continuously monitors five leading fintech companies — **Robinhood (HOOD)**, **Affirm (AFRM)**, **Block (XYZ)**, **Klarna (KLAR)**, and **Chime (CHYM)** — across five categories of alternative data: social sentiment, hiring activity, search interest, app-store reviews, and SEC filings. Each signal is normalized, scored, and checked against its own recent history. Every morning, Claude synthesizes the day's signals for each company into a plain-English research brief — the kind of intelligence that used to require a Bloomberg terminal and a team of analysts.

---

## Features

- **Daily research briefs** — AI-synthesized, plain-English summaries of each company's signals, generated every morning.
- **Anomaly detection** — automatic flagging when a signal breaks more than 1σ from its trailing rolling average.
- **30-day historical charts** — per-signal time series so you can see trends, not just snapshots.
- **Signal correlation** — surfaces when multiple signals move the same direction for a stronger combined read.
- **Company comparison** — any two companies side by side, with an AI verdict on which looks stronger this week.
- **Email alerts** — digests of newly detected anomalies.
- **Earnings calendar** — the next scheduled earnings date per company, found via web search and cached.
- **Real-time AI chat** — ask questions about any company and get answers grounded strictly in Prism's underlying data.

---

## Architecture

Prism is a two-tier system: a Python data-and-AI backend and a React frontend.

**Backend**
- **Scrapers** fetch raw data from five sources and emit events onto a **Redis** stream.
- A **normaliser** worker consumes the stream: deduplication, UTC normalization, company tagging, sentiment scoring, plain-English summary generation, and inline anomaly detection.
- Cleaned **signals**, **alerts**, **briefs**, and **earnings** persist in **Postgres**.
- **Prefect** orchestrates the daily scrape-and-synthesize schedule.
- **FastAPI** serves the query API (`/signals`, `/alerts`, `/brief`, `/series`, `/correlation`, `/earnings`, `/chat`).
- Everything runs locally via **Docker Compose**.

**AI layer**
- The **Claude API** powers daily brief synthesis, the data-grounded chat endpoint, the comparison verdict, and earnings-date web search. Static instructions use prompt caching.
- **Multi-model scoring** runs each text signal through more than one model and records their agreement, with a **circuit breaker** that degrades gracefully when a provider is unavailable.

**Frontend**
- **React + Vite**, with an editorial design system, Recharts visualizations, framer-motion scroll animations, and a floating chat launcher.
- A marketing home page, a live dashboard, a company-comparison view, and an about page.

---

## The five signals

| Signal | What it measures | Source |
|---|---|---|
| **Social sentiment** | Retail/social chatter about a company, scored for tone | Reddit, StockTwits |
| **Hiring activity** | Open job postings as a read on growth and focus | LinkedIn / Indeed (via SerpApi) |
| **Search interest** | Public attention, indexed 0–100 against the company's own recent peak | Google Trends |
| **App reviews** | Product health from new ratings and review sentiment | Apple App Store, Google Play |
| **SEC filings** | Material regulatory activity (10-K, 10-Q, 8-K, S-1) | SEC EDGAR |

---

## Tech stack

**Backend** · Python · FastAPI · PostgreSQL · Redis · Prefect · Docker

**AI** · Claude API · multi-model scoring with circuit breaker · prompt caching

**Frontend** · React · Vite · React Router · Recharts · Framer Motion

**Data sources** · Reddit · StockTwits · Google Trends · SerpApi · App Store / Google Play · SEC EDGAR

---

## Disclaimer

Prism is a University of Michigan student project. For research and educational purposes only; not investment advice.
