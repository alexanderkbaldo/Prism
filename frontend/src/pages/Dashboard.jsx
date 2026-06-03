import React from "react";
import CompanySwitcher from "../components/CompanySwitcher";
import StatRow from "../components/StatRow";
import AnomalyLine from "../components/AnomalyLine";
import Brief from "../components/Brief";
import Footer from "../components/Footer";
import { useBrief, useSignals } from "../hooks/useApi";

const COMPANY_NAMES = {
  HOOD: "Robinhood",
  AFRM: "Affirm",
  XYZ: "Block",
  KLAR: "Klarna",
  CHYM: "Chime",
};

// Pull a single-sentence "read" from the brief — the bottom line if present,
// otherwise the first substantive sentence.
function extractRead(briefText) {
  if (!briefText) return null;
  const bottom = briefText.match(/\*\*Bottom line:\*\*\s*(.+)/i);
  if (bottom) return bottom[1].replace(/\(mock[^)]*\)/i, "").trim();
  const firstPara = briefText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith("*"));
  return firstPara || null;
}

function Hero({ ticker }) {
  const { data } = useBrief(ticker);
  const read = extractRead(data?.brief?.brief_text);

  return (
    <div style={styles.hero}>
      <div style={styles.nameRow}>
        <h1 style={styles.name}>{COMPANY_NAMES[ticker]}</h1>
        <span style={styles.ticker}>{ticker}</span>
      </div>
      {read && <p style={styles.read}>{read}</p>}
    </div>
  );
}

// "Last updated" — reflects data freshness via the most recent signal timestamp.
function LastUpdated({ ticker }) {
  const { data } = useSignals(ticker);
  const signals = data?.signals ?? [];
  if (signals.length === 0) return null;

  const latestMs = signals.reduce((max, s) => {
    const t = new Date(s.event_timestamp).getTime();
    return Number.isNaN(t) ? max : Math.max(max, t);
  }, 0);
  if (!latestMs) return null;

  const when = new Date(latestMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div style={styles.metaRow}>
      <span style={styles.updated}>Last updated · {when}</span>
    </div>
  );
}

export default function Dashboard({ ticker, onTickerChange }) {
  return (
    <div style={styles.column}>
      <div style={styles.switchRow}>
        <span className="eyebrow">Companies</span>
        <CompanySwitcher ticker={ticker} onChange={onTickerChange} />
      </div>

      <Hero ticker={ticker} />
      <LastUpdated ticker={ticker} />
      <StatRow ticker={ticker} />
      <AnomalyLine ticker={ticker} />
      <div style={styles.briefWrap}>
        <Brief ticker={ticker} />
      </div>

      <Footer />
    </div>
  );
}

const styles = {
  column: {
    maxWidth: "1440px",
    margin: "0 auto",
    padding: "0 56px 80px",
  },
  switchRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "32px",
  },
  hero: { marginTop: "48px" },
  metaRow: { marginTop: "18px" },
  updated: {
    fontSize: "11px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--faint)",
  },
  nameRow: { display: "flex", alignItems: "baseline", gap: "14px" },
  name: {
    fontFamily: "var(--serif)",
    fontSize: "38px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
    lineHeight: 1.1,
  },
  ticker: { fontSize: "12px", letterSpacing: "0.08em", color: "var(--faint)" },
  read: {
    fontFamily: "var(--serif)",
    fontSize: "21px",
    fontStyle: "italic",
    fontWeight: 400,
    lineHeight: 1.5,
    color: "var(--muted)",
    marginTop: "20px",
    maxWidth: "620px",
  },
  briefWrap: { marginTop: "64px" },
};
