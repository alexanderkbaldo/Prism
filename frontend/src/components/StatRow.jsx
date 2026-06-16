import React from "react";
import { useSeries } from "../hooks/useApi";
import InfoTip from "./InfoTip";
import { CountUp } from "../anim";

// Display order + human labels for each signal category.
// `metric: "count"` → headline is volume; `metric: "index"` → headline is the
// 0-100 search-interest index (shown as N/100). `showScore` adds a 0-100
// sentiment read beneath the headline. `info` anchors the number for newcomers.
const STATS = [
  {
    key: "sentiment", label: "Social", unit: "mentions", metric: "count", showScore: true,
    info: "Reddit + StockTwits posts mentioning the company. Sentiment runs 0–100, where 50 is neutral and higher is more bullish.",
  },
  {
    key: "hiring", label: "Hiring", unit: "postings", metric: "count",
    info: "New job postings detected for the company — a read on where it's investing.",
  },
  {
    key: "trends", label: "Search interest", unit: "index, 0–100", metric: "index",
    info: "Google Trends search index, 0–100, scaled to the company's own recent peak. Higher means more public attention.",
  },
  {
    key: "reviews", label: "App reviews", unit: "reviews", metric: "count", showScore: true,
    info: "New App Store + Google Play reviews. Sentiment runs 0–100, where 50 is neutral and higher is more positive.",
  },
  {
    key: "filings", label: "Filings", unit: "filings", metric: "count",
    info: "New SEC filings (10-K, 10-Q, 8-K, S-1). Even one can be material.",
  },
];

// ISO (YYYY-MM-DD) for `n` days before today. Series days are ISO date strings,
// so lexicographic comparison is enough to bucket them into weeks.
function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Aggregate one category's daily points within [from, to] (inclusive ISO days).
function agg(points, from, to) {
  let count = 0;
  let sentW = 0;
  let sentN = 0;
  let intSum = 0;
  let intN = 0;
  for (const p of points || []) {
    if (p.day < from || p.day > to) continue;
    const c = p.count || 0;
    count += c;
    if (p.avg_sentiment != null) {
      sentW += p.avg_sentiment * (c || 1);
      sentN += c || 1;
    }
    if (p.avg_interest != null) {
      intSum += p.avg_interest;
      intN += 1;
    }
  }
  return {
    count,
    sentiment: sentN ? sentW / sentN : null, // count-weighted mean, -1..1
    interest: intN ? intSum / intN : null, // simple daily mean, 0..100
  };
}

// Sentiment (-1..1) → labelled 0-100 read.
function scoreFrom(avg) {
  if (avg == null) return null;
  return {
    value: Math.round(((avg + 1) / 2) * 100),
    color: avg >= 0.05 ? "var(--up)" : avg <= -0.05 ? "var(--down)" : "var(--faint)",
    arrow: avg >= 0.05 ? "↑" : avg <= -0.05 ? "↓" : "·",
  };
}

// Week-over-week change caption. Both volumes and the 0-100 index use an
// ABSOLUTE change ("↑ 13 vs last wk") rather than a percentage — on small
// baselines a percentage explodes into nonsense (1 → 62 reads as "6100%").
function deltaFrom(metric, cur, prior) {
  if (cur == null || prior == null) return null;
  if (cur === 0 && prior === 0) return null; // no activity either week

  const d = Math.round(cur - prior);
  if (d === 0) return { text: "flat vs last wk", color: "var(--faint)", arrow: "·" };
  const mag = Math.abs(d);
  const suffix =
    metric === "index" ? ` pt${mag === 1 ? "" : "s"} vs last wk` : " vs last wk";
  return {
    text: `${mag}${suffix}`,
    color: d > 0 ? "var(--up)" : "var(--down)",
    arrow: d > 0 ? "↑" : "↓",
  };
}

export default function StatRow({ ticker, variant = "row" }) {
  const { data, loading } = useSeries(ticker, 14);
  const series = data?.series || {};
  const cards = variant === "cards";

  // Trailing 7 days vs the 7 days before that.
  const curFrom = isoDaysAgo(6);
  const today = isoDaysAgo(0);
  const priorFrom = isoDaysAgo(13);
  const priorTo = isoDaysAgo(7);

  return (
    <div>
      {/* One explicit window for the whole row — and what the deltas compare
          against, so a reader always knows the period. */}
      <div style={styles.caption}>
        Trailing 7 days<span style={styles.captionDim}> · change vs prior 7 days</span>
      </div>
      <div className="stat-grid" style={{ ...styles.row, ...(cards ? styles.rowCards : {}) }}>
        {STATS.map((stat, i) => {
        const points = series[stat.key];
        const cur = agg(points, curFrom, today);
        const prior = agg(points, priorFrom, priorTo);

        const isIndex = stat.metric === "index";
        const curVal = isIndex ? cur.interest : cur.count;
        const priorVal = isIndex ? prior.interest : prior.count;
        const isLoading = loading && !data;

        // A genuine zero (count signals only) is "nothing happened this week",
        // not missing data — render it calmly so it doesn't look broken.
        const isEmpty = data && !isLoading && !isIndex && cur.count === 0;
        const headline = isLoading
          ? "—"
          : isIndex
          ? cur.interest == null
            ? "—"
            : Math.round(cur.interest)
          : cur.count;

        const delta = data && !isEmpty ? deltaFrom(stat.metric, curVal, priorVal) : null;
        const s = !isEmpty && stat.showScore ? scoreFrom(cur.sentiment) : null;

        return (
          <div
            key={stat.key}
            className="stat-cell"
            style={{
              ...styles.cell,
              ...(cards ? styles.cellCard : i > 0 ? styles.cellDivider : {}),
            }}
          >
            <span style={styles.labelRow}>
              <span className="eyebrow" style={styles.label}>{stat.label}</span>
              <InfoTip text={stat.info} label={stat.label} />
            </span>
            <span style={{ ...styles.number, ...(isEmpty ? styles.numberEmpty : {}) }}>
              <CountUp value={headline} />
              {isIndex && headline !== "—" && <span style={styles.denom}>/100</span>}
            </span>
            <span style={styles.unit}>{stat.unit}</span>

            {/* Affirmative empty state — "we checked, there were none". */}
            {isEmpty && <span style={styles.none}>none this week</span>}

            {/* Week-over-week change — gives the headline number a baseline. */}
            {delta && (
              <span style={{ ...styles.delta, color: delta.color }}>
                {delta.arrow} {delta.text}
              </span>
            )}

            {/* A single, labelled sentiment read (sentiment / reviews only).
                Colour conveys tone; no arrow, to avoid clashing with the
                week-over-week arrow above. */}
            {s && (
              <span style={{ ...styles.score, color: s.color }}>
                <span style={styles.scoreLabel}>sentiment</span>{" "}
                {s.value}<span style={styles.scoreDenom}>/100</span>
              </span>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  caption: {
    fontSize: "11px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--faint)",
    marginTop: "44px",
  },
  captionDim: { color: "var(--hairline)" },
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    margin: "14px 0 44px",
  },
  // Ventriloc KPI tiles: each stat a paper card lifting off the canvas, set in
  // a grid with 20px gaps (no dividers).
  rowCards: {
    gap: "20px",
    margin: "16px 0 0",
  },
  cellCard: {
    padding: "22px 22px 20px",
    background: "var(--paper)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "10px",
    boxShadow: "var(--shadow-card)",
  },
  labelRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "3px",
  },
  cell: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "4px 26px",
  },
  cellDivider: { borderLeft: "0.5px solid var(--hairline)" },
  label: { color: "var(--faint)", marginBottom: "3px" },
  numberEmpty: { color: "var(--faint)" },
  none: {
    fontSize: "11px",
    fontStyle: "italic",
    color: "var(--faint)",
    letterSpacing: "0.01em",
    marginTop: "2px",
  },
  number: {
    fontFamily: "var(--serif)",
    fontSize: "33px",
    fontWeight: 400,
    lineHeight: 1,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
  },
  denom: { fontFamily: "var(--sans)", fontSize: "14px", color: "var(--faint)" },
  unit: { fontSize: "11px", color: "var(--faint)", letterSpacing: "0.02em" },
  delta: {
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.01em",
    marginTop: "2px",
  },
  score: {
    fontSize: "12px",
    fontWeight: 500,
    marginTop: "5px",
    letterSpacing: "0.01em",
  },
  scoreLabel: {
    fontSize: "9px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--faint)",
  },
  scoreDenom: { fontWeight: 400, color: "var(--faint)" },
};
