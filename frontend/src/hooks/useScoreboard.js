import { useState, useEffect } from "react";
import { apiUrl } from "../api";

// Cross-company scoreboard: this week's live signal read for all five fintechs,
// derived client-side from /series (the same basis as the dashboard verdict), so
// it works against the running API without a new endpoint and never depends on
// the historical validation engine being populated. Mirrors usePeerRanks.js's
// fan-out + windowing.

const COMPANIES = [
  ["HOOD", "Robinhood"],
  ["AFRM", "Affirm"],
  ["XYZ", "Block"],
  ["KLAR", "Klarna"],
  ["CHYM", "Chime"],
];
const TICKERS = COMPANIES.map(([t]) => t);

// N days before an anchor date (YYYY-MM-DD), in UTC.
function isoDaysBefore(anchor, n) {
  const d = new Date(anchor + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Freshest day present across a company's series categories.
function latestDay(series) {
  let m = null;
  for (const pts of Object.values(series || {}))
    for (const p of pts || []) if (!m || p.day > m) m = p.day;
  return m;
}

function weekAgg(points, from, to) {
  let count = 0;
  let sentW = 0;
  let sentN = 0;
  for (const p of points || []) {
    if (p.day < from || p.day > to) continue;
    const c = p.count || 0;
    count += c;
    if (p.avg_sentiment != null) {
      sentW += p.avg_sentiment * (c || 1);
      sentN += c || 1;
    }
  }
  return { count, sentiment: sentN ? sentW / sentN : null };
}

function metricsFor(series, anchor) {
  const to = anchor;
  const from = isoDaysBefore(anchor, 6);

  const social = weekAgg(series.sentiment, from, to);
  const reviews = weekAgg(series.reviews, from, to);
  const hiring = weekAgg(series.hiring, from, to);

  // Sentiment blends social + reviews, count-weighted.
  let sw = 0;
  let sn = 0;
  for (const a of [social, reviews]) {
    if (a.sentiment != null) {
      sw += a.sentiment * (a.count || 1);
      sn += a.count || 1;
    }
  }
  const sentiment = sn ? sw / sn : null;

  return {
    mentions: social.count,
    sentiment,
    hiring: hiring.count,
    // 0–100 read (50 neutral) — the same mapping the dashboard cards use.
    score: sentiment != null ? Math.round(((sentiment + 1) / 2) * 100) : null,
  };
}

// Descending rank of `ticker` on `key` among companies that have that value.
function rankOf(map, ticker, key) {
  const vals = TICKERS.map((t) => ({ t, v: map[t]?.[key] }))
    .filter((x) => x.v != null)
    .sort((a, b) => b.v - a.v);
  const idx = vals.findIndex((x) => x.t === ticker);
  return idx >= 0 ? { rank: idx + 1, of: vals.length } : null;
}

export function useScoreboard() {
  const [rows, setRows] = useState(null); // sorted array, or null while loading
  const [source, setSource] = useState("db");

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      TICKERS.map((t) =>
        fetch(apiUrl(`/series?company=${t}&days=14`))
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const seriesByTicker = TICKERS.map((t, i) => results[i]?.series || {});
      if (results.some((r) => r?.source === "mock")) setSource("mock");
      // One shared anchor (latest day across all companies) so every company is
      // read over the same week, independent of the viewer's clock.
      const anchor =
        seriesByTicker.reduce((m, s) => {
          const d = latestDay(s);
          return d && (!m || d > m) ? d : m;
        }, null) || new Date().toISOString().slice(0, 10);

      const map = {};
      TICKERS.forEach((t, i) => {
        map[t] = metricsFor(seriesByTicker[i], anchor);
      });

      const out = COMPANIES.map(([ticker, name]) => ({
        ticker,
        name,
        ...map[ticker],
        ranks: {
          sentiment: rankOf(map, ticker, "sentiment"),
          mentions: rankOf(map, ticker, "mentions"),
          hiring: rankOf(map, ticker, "hiring"),
        },
      }));
      // Highest signal read first; companies with no read sink to the bottom.
      out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      setRows(out);
    });
    return () => {
      cancelled = true;
    };
  }, []); // peer set is fixed; fetch once

  return { rows, source };
}
