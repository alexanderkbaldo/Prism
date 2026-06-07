import React from "react";
import CompanySwitcher from "../components/CompanySwitcher";
import StatRow from "../components/StatRow";
import HistoricalCharts from "../components/HistoricalCharts";
import SignalCorrelation from "../components/SignalCorrelation";
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

  const isMock = data?.source === "mock";

  return (
    <div style={styles.metaRow}>
      {isMock && (
        <span style={styles.mock} title="The backend is unreachable — showing sample data.">
          Sample data
        </span>
      )}
      <span style={styles.updated}>Last updated · {when}</span>
    </div>
  );
}

export default function Dashboard({ ticker, onTickerChange }) {
  return (
    <div className="page" style={styles.column}>
      <div className="switch-row" style={styles.switchRow}>
        <span className="eyebrow">Companies</span>
        <CompanySwitcher ticker={ticker} onChange={onTickerChange} />
      </div>

      <Hero ticker={ticker} />
      <LastUpdated ticker={ticker} />
      <StatRow ticker={ticker} />
      {/* The brief is the headline value, so it sits high — above the deeper
          historical/correlation/alert detail. */}
      <div style={styles.briefWrap}>
        <Brief ticker={ticker} />
      </div>
      <HistoricalCharts ticker={ticker} />
      <SignalCorrelation ticker={ticker} />
      <AnomalyLine ticker={ticker} />

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
  metaRow: {
    marginTop: "18px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  updated: {
    fontSize: "11px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--faint)",
  },
  mock: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--ink)",
    background: "var(--sage-soft)",
    padding: "2px 8px",
    borderRadius: "99px",
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
  briefWrap: { marginTop: "24px" },
};
