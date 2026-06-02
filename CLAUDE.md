# Prism — Project Brief

## What Prism is
An AI-powered alternative data platform for fintech equity research. 
Users can ask questions about fintech companies and get data-driven, 
analyst-style research briefs powered by alternative signals.

## Who it's for
Finance students, early-career analysts, retail investors who want 
institutional-quality research without paying for Bloomberg.

## What's been built
- Phase 1: Data pipeline — scrapers for Reddit, Google Trends, hiring, 
  App Store reviews, SEC filings. Runs daily at 6am via Prefect. 
  Data stored in Postgres, streamed through Redis.
- Phase 2: Claude AI synthesis layer and anomaly detection.

## Companies tracked
Robinhood (HOOD), Affirm (AFRM), Block (XYZ), Klarna (KLAR), Chime (CHYM)

## Tech stack
Python scrapers · Redis · Postgres · Prefect · FastAPI · Docker · Claude API

## Our goal
Resume/portfolio project for consulting recruiting. 
Two econ majors at University of Michigan.
Need a polished, deployed product by end of summer.

## What's needed next
- Frontend web dashboard
- Get API keys into .env so real data flows
- Deploy publicly so it has a real URL
