import React from "react";
import { useSignals } from "../hooks/useApi";

// Display order, human labels, and a plain-English description per signal.
const STATS = [
  { key: "sentiment", label: "Sentiment", desc: "Social mentions scored for tone", showScore: true },
  { key: "hiring", label: "Hiring", desc: "Open job postings this week", showScore: false },
  { key: "trends", label: "Search interest", desc: "Google Trends index, 0–100", showScore: false },
  { key: "reviews", label: "App reviews", desc: "New App Store reviews", showScore: true },
  { key: "filings", label: "Filings", desc: "New SEC regulatory filings", showScore: false },
];

function summarise(signals) {
  const out = {};
  for (const s of STATS) out[s.key] = { count: 0, sentSum: 0, sentN: 0 };
  for (const sig of signals) {
    const bucket = out[sig.category];
    if (!bucket) continue;
    bucket.count += 1;
    if (sig.sentiment != null) {
      bucket.sentSum += sig.sentiment;
      bucket.sentN += 1;
    }
  }
  return out;
}

// Sentiment score: average sentiment (-1..1) mapped to a labelled 0-100 scale.
function score(bucket) {
  if (bucket.sentN === 0) return null;
  const avg = bucket.sentSum / bucket.sentN;
  return {
    value: Math.round(((avg + 1) / 2) * 100),
    color: avg >= 0.05 ? "var(--up)" : avg <= -0.05 ? "var(--down)" : "var(--faint)",
    arrow: avg >= 0.05 ? "↑" : avg <= -0.05 ? "↓" : "·",
  };
}

export default function StatRow({ ticker }) {
  const { data, loading } = useSignals(ticker);
  const buckets = summarise(data?.signals || []);

  return (
    <div className="stat-grid" style={styles.row}>
      {STATS.map((stat, i) => {
        const b = buckets[stat.key];
        const s = stat.showScore ? score(b) : null;
        return (
          <div
            key={stat.key}
            className="stat-cell"
            style={{ ...styles.cell, ...(i > 0 ? styles.cellDivider : {}) }}
          >
            <span className="eyebrow" style={styles.label}>{stat.label}</span>
            {/* The headline number is volume; the caption explains it. */}
            <span style={styles.number}>{loading && !data ? "—" : b.count}</span>
            <span style={styles.desc}>{stat.desc}</span>
            {/* A single, labelled sentiment score (no second raw scale). */}
            {s && (
              <span style={{ ...styles.score, color: s.color }}>
                <span style={styles.scoreLabel}>sentiment</span>{" "}
                {s.arrow} {s.value}<span style={styles.scoreDenom}>/100</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    margin: "44px 0",
  },
  cell: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "4px 26px",
  },
  cellDivider: { borderLeft: "0.5px solid var(--hairline)" },
  label: { color: "var(--faint)", marginBottom: "3px" },
  number: {
    fontFamily: "var(--serif)",
    fontSize: "33px",
    fontWeight: 400,
    lineHeight: 1,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
  },
  desc: {
    fontSize: "11px",
    color: "var(--muted)",
    lineHeight: 1.35,
    letterSpacing: "0.01em",
    maxWidth: "150px",
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
