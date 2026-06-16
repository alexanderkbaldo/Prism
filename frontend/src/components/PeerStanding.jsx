import React from "react";
import { usePeerRanks } from "../hooks/usePeerRanks";

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// A compact relative read, where this company stands among the tracked
// fintechs this week. Gives the raw numbers a peer baseline ("is 246 a lot?").
export default function PeerStanding({ ticker }) {
  const ranks = usePeerRanks(ticker);
  if (!ranks) return null;

  const parts = [
    ["sentiment", ranks.sentiment],
    ["buzz", ranks.mentions],
    ["hiring", ranks.hiring],
  ].filter(([, r]) => r);

  if (parts.length === 0) return null;
  const of = parts[0][1].of;

  return (
    <div style={styles.wrap}>
      <span style={styles.lead}>Among {of} fintechs tracked</span>
      {parts.map(([label, r]) => (
        <span key={label} style={styles.item}>
          {label}{" "}
          <strong style={{ ...styles.rank, ...(r.rank === 1 ? styles.top : {}) }}>
            {ordinal(r.rank)}
          </strong>
        </span>
      ))}
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "6px 14px",
    marginTop: "12px",
    fontSize: "12px",
    color: "var(--faint)",
    letterSpacing: "0.01em",
  },
  lead: {
    fontSize: "10px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--faint)",
  },
  item: { color: "var(--muted)" },
  rank: { fontWeight: 600, color: "var(--ink)" },
  top: { color: "var(--sage)" },
};
