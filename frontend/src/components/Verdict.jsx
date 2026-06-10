import React from "react";
import { useVerdict } from "../hooks/useVerdict";

// A scannable, data-driven read of the week, shown under the company name. It
// summarises the alternative-data signals below — not a price view, not advice.
export default function Verdict({ ticker }) {
  const v = useVerdict(ticker);
  if (!v) return null;

  return (
    <div
      style={styles.wrap}
      title="Our quick read on this week's signals — based on social mood and hiring. Not investment advice."
    >
      <span style={{ ...styles.dot, background: v.color }} />
      <span style={{ ...styles.label, color: v.color }}>{v.label}</span>
      <span style={styles.clause}>— {v.sentText}, {v.hireText}</span>
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px 9px",
    marginTop: "16px",
  },
  dot: { width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0 },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  clause: { fontSize: "13px", color: "var(--muted)", letterSpacing: "0.01em" },
};
