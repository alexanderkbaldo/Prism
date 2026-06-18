import { useState, useEffect } from "react";
import { apiUrl } from "../api";

// Ranks the current company against the other tracked fintechs on this week's
// signals, so a number like "246 mentions" gains a frame of reference
// ("2nd of 5"). Fetches every company's series once on mount, client-side, so
// it works against the running API without a new endpoint.

const TICKERS = ["HOOD", "AFRM", "XYZ", "KLAR", "CHYM"];

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

  return {
    mentions: social.count,
    sentiment: sn ? sw / sn : null,
    hiring: hiring.count,
  };
}

export function usePeerRanks(ticker) {
  const [all, setAll] = useState(null); // { TICKER: {mentions, sentiment, hiring} }

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
      // One shared anchor (latest day across all companies) so every company is
      // ranked over the same week, independent of the viewer's clock.
      const anchor =
        seriesByTicker.reduce((m, s) => {
          const d = latestDay(s);
          return d && (!m || d > m) ? d : m;
        }, null) || new Date().toISOString().slice(0, 10);
      const map = {};
      TICKERS.forEach((t, i) => {
        map[t] = metricsFor(seriesByTicker[i], anchor);
      });
      setAll(map);
    });
    return () => {
      cancelled = true;
    };
  }, []); // peer set is fixed; fetch once

  if (!all || !all[ticker]) return null;

  // Rank descending (higher = better standing) among companies that have data.
  const rankBy = (key) => {
    const vals = TICKERS.map((t) => ({ t, v: all[t]?.[key] }))
      .filter((x) => x.v != null)
      .sort((a, b) => b.v - a.v);
    const idx = vals.findIndex((x) => x.t === ticker);
    return idx >= 0 ? { rank: idx + 1, of: vals.length } : null;
  };

  return {
    sentiment: rankBy("sentiment"),
    mentions: rankBy("mentions"),
    hiring: rankBy("hiring"),
  };
}
