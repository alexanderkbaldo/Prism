import React from "react";
import { useEarnings } from "../hooks/useApi";

function formatDate(iso) {
  if (!iso) return "";
  // Parse as a plain calendar date (avoid TZ shifting the day).
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function dayWord(n) {
  return `${n} ${Math.abs(n) === 1 ? "day" : "days"}`;
}

export default function EarningsLine({ ticker }) {
  const { data } = useEarnings(ticker);
  const date = data?.next_earnings_date;
  const days = data?.days_until;
  // Show the actual per-company earnings date. If it isn't available yet
  // (loading, or the backend couldn't determine it) render nothing rather than
  // a fabricated placeholder — a fixed fallback date looked identical for every
  // company and hid the real, distinct dates the API returns.
  if (!date || days == null) return null;

  const when = formatDate(date);

  // ≤3 days: peak relevance, bold clay sentence.
  if (days <= 3) {
    const lead = days <= 0 ? "Earnings today" : `Earnings in ${dayWord(days)}`;
    return (
      <p style={{ ...styles.line, ...styles.urgent, ...styles.veryClose }}>
        {lead}
        <span style={styles.sep}>·</span>
        signals at peak relevance
      </p>
    );
  }

  // ≤14 days: approaching, clay accent sentence.
  if (days <= 14) {
    return (
      <p style={{ ...styles.line, ...styles.urgent }}>
        Earnings in {dayWord(days)}
        <span style={styles.sep}>·</span>
        {when}, signals matter now
      </p>
    );
  }

  // Normal: quiet, muted.
  return (
    <p style={styles.line}>
      <span style={styles.label}>Next earnings</span>
      <span style={styles.sep}>·</span>
      {when}
      <span style={styles.sep}>·</span>
      {dayWord(days)}
    </p>
  );
}

const styles = {
  line: {
    marginTop: "10px",
    fontSize: "12.5px",
    color: "var(--muted)",
    letterSpacing: "0.01em",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "7px",
  },
  label: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  sep: { color: "var(--hairline)" },
  urgent: { color: "var(--clay)" },
  veryClose: { fontWeight: 600 },
};
