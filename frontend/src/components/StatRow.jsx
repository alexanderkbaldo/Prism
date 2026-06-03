import React from "react";
import { useSignals } from "../hooks/useApi";

// Display order + human labels for each signal category.
const STATS = [
  { key: "sentiment", label: "Sentiment", unit: "mentions", showScore: true },
  { key: "hiring", label: "Hiring", unit: "postings", showScore: false },
  { key: "trends", label: "Search interest", unit: "readings", showScore: false },
  { key: "reviews", label: "App reviews", unit: "reviews", showScore: true },
  { key: "filings", label: "Filings", unit: "filings", showScore: false },
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

function Delta({ stat, bucket }) {
  if (stat.showScore && bucket.sentN > 0) {
    const avg = bucket.sentSum / bucket.sentN;
    const color = avg >= 0.05 ? "var(--up)" : avg <= -0.05 ? "var(--down)" : "var(--faint)";
    const arrow = avg >= 0.05 ? "↑" : avg <= -0.05 ? "↓" : "·";
    return (
      <span style={{ ...styles.delta, color }}>
        {arrow} {avg >= 0 ? "+" : ""}{avg.toFixed(2)}
      </span>
    );
  }
  return <span style={styles.delta}>{stat.unit}</span>;
}

export default function StatRow({ ticker }) {
  const { data, loading } = useSignals(ticker);
  const buckets = summarise(data?.signals || []);

  return (
    <div style={styles.row}>
      {STATS.map((stat, i) => {
        const b = buckets[stat.key];
        return (
          <div
            key={stat.key}
            style={{
              ...styles.cell,
              ...(i > 0 ? styles.cellDivider : {}),
            }}
          >
            <span className="eyebrow" style={styles.label}>{stat.label}</span>
            <span style={styles.number}>{loading && !data ? "—" : b.count}</span>
            <Delta stat={stat} bucket={b} />
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
    gap: "9px",
    padding: "4px 26px",
  },
  cellDivider: {
    borderLeft: "0.5px solid var(--hairline)",
  },
  label: { color: "var(--faint)" },
  number: {
    fontFamily: "var(--serif)",
    fontSize: "33px",
    fontWeight: 400,
    lineHeight: 1,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
  },
  delta: {
    fontSize: "11px",
    color: "var(--muted)",
    letterSpacing: "0.01em",
  },
};
