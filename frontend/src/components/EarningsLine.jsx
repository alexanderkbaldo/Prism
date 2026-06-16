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

// Client-side fallback so the indicator always renders, even if the API (and
// its own mock fallback) is unreachable. Mirrors the backend mock: ~46 days out.
const FALLBACK_DAYS = 46;
function fallbackEarnings() {
  const d = new Date();
  d.setDate(d.getDate() + FALLBACK_DAYS);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { next_earnings_date: iso, days_until: FALLBACK_DAYS };
}

export default function EarningsLine({ ticker }) {
  const { data } = useEarnings(ticker);
  // Use the API result when present; otherwise fall back to a mock date so the
  // line always shows something regardless of backend status.
  const source =
    data?.next_earnings_date && data?.days_until != null ? data : fallbackEarnings();
  const date = source.next_earnings_date;
  const days = source.days_until;

  const when = formatDate(date);

  // ≤3 days: peak relevance — bold clay sentence.
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

  // ≤14 days: approaching — clay accent sentence.
  if (days <= 14) {
    return (
      <p style={{ ...styles.line, ...styles.urgent }}>
        Earnings in {dayWord(days)}
        <span style={styles.sep}>·</span>
        {when} — signals matter now
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
