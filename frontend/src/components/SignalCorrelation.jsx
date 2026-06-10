import React from "react";
import { useCorrelation } from "../hooks/useApi";

const DIR = {
  bullish: { color: "var(--up)", arrow: "↑", word: "Up" },
  bearish: { color: "var(--down)", arrow: "↓", word: "Down" },
  neutral: { color: "var(--faint)", arrow: "·", word: "Flat" },
};

export default function SignalCorrelation({ ticker }) {
  const { data } = useCorrelation(ticker);
  if (!data) return null;

  const { insight, aligned, signals = [] } = data;
  const headColor =
    aligned?.direction === "bullish"
      ? "var(--up)"
      : aligned?.direction === "bearish"
      ? "var(--down)"
      : "var(--muted)";

  return (
    <section style={styles.card}>
      <span className="eyebrow" style={styles.eyebrow}>Do the signals agree?</span>
      <p style={{ ...styles.insight, color: headColor }}>{insight}</p>
      <p style={styles.note}>
        When several signals move the same way, it's a stronger read than any one alone.
      </p>

      {signals.length > 0 && (
        <div style={styles.row}>
          {signals.map((s) => {
            const d = DIR[s.direction] || DIR.neutral;
            return (
              <div key={s.category} style={styles.chip} title={s.detail}>
                <span style={styles.chipLabel}>{s.label}</span>
                <span style={{ ...styles.chipDir, color: d.color }}>
                  {d.arrow} {d.word}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const styles = {
  card: {
    marginTop: "30px",
    padding: "20px 24px",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "14px",
  },
  eyebrow: { color: "var(--faint)" },
  insight: {
    fontFamily: "var(--serif)",
    fontSize: "20px",
    fontStyle: "italic",
    fontWeight: 400,
    lineHeight: 1.4,
    margin: "12px 0 0",
  },
  note: { fontSize: "12px", color: "var(--faint)", lineHeight: 1.5, margin: "8px 0 0" },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "18px",
  },
  chip: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    padding: "8px 13px",
    background: "var(--bg)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "9px",
  },
  chipLabel: {
    fontSize: "10px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--faint)",
  },
  chipDir: { fontSize: "13px", fontWeight: 500 },
};
