import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import CompanySwitcher from "../components/CompanySwitcher";
import StatRow from "../components/StatRow";
import SignalReport from "../components/SignalReport";
import SignalCorrelation from "../components/SignalCorrelation";
import AnomalyLine from "../components/AnomalyLine";
import EarningsLine from "../components/EarningsLine";
import Verdict from "../components/Verdict";
import PeerStanding from "../components/PeerStanding";
import Footer from "../components/Footer";
import { Reveal } from "../anim";
import { useBrief, useSignals } from "../hooks/useApi";
import { extractRead } from "../utils/brief";

const COMPANY_NAMES = {
  HOOD: "Robinhood",
  AFRM: "Affirm",
  XYZ: "Block",
  KLAR: "Klarna",
  CHYM: "Chime",
};

function Hero({ ticker }) {
  const { data } = useBrief(ticker);
  const read = extractRead(data?.brief?.brief_text);

  return (
    <div style={styles.hero}>
      <div style={styles.nameRow}>
        <h1 style={styles.name}>{COMPANY_NAMES[ticker]}</h1>
        <span style={styles.ticker}>{ticker}</span>
      </div>
      <span style={styles.tracking}>
        Tracking 5 alternative-data signals · updated daily at 6am
      </span>
      <EarningsLine ticker={ticker} />
      <Verdict ticker={ticker} />
      <PeerStanding ticker={ticker} />
      {read && <p style={styles.read}>{read}</p>}
    </div>
  );
}

// "Last updated", reflects data freshness via the most recent signal timestamp.
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
        <span style={styles.mock} title="The backend is unreachable, showing sample data.">
          Sample data
        </span>
      )}
      <span style={styles.updated}>Last updated · {when}</span>
    </div>
  );
}

export default function Dashboard({ ticker, onTickerChange }) {
  // Deep links from the Guide (/dashboard#read, #signals, #anomalies). App
  // scrolls to top on every navigation; when a hash is present, the anchor
  // wins (effects run after App's layout effect).
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const scroll = () => {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ block: "start" });
    };
    // Charts and briefs load async and grow the page above the anchor, so
    // re-assert the position a couple of times as the content settles.
    scroll();
    const t1 = setTimeout(scroll, 450);
    const t2 = setTimeout(scroll, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [location.hash]);

  return (
    <div className="page" style={styles.column}>
      <div className="switch-row" style={styles.switchRow}>
        <span className="eyebrow">Companies</span>
        <CompanySwitcher ticker={ticker} onChange={onTickerChange} />
      </div>

      <div id="read" style={styles.anchor}>
        <Hero ticker={ticker} />
        <LastUpdated ticker={ticker} />
      </div>
      <div id="signals" style={styles.anchor}>
        <Reveal><StatRow ticker={ticker} variant="cards" /></Reveal>
        {/* Plain-English read per signal, each paired with its chart. */}
        <Reveal style={styles.briefWrap}>
          <SignalReport ticker={ticker} />
        </Reveal>
      </div>
      <Reveal><SignalCorrelation ticker={ticker} /></Reveal>
      <div id="anomalies" style={styles.anchor}>
        <Reveal><AnomalyLine ticker={ticker} /></Reveal>
      </div>

      <Footer />
    </div>
  );
}

const styles = {
  column: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "0 40px 80px",
  },
  switchRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "32px",
  },
  hero: { marginTop: "48px" },
  // Keep anchored sections clear of the sticky nav when deep-linked.
  anchor: { scrollMarginTop: "84px" },
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
    fontSize: "40px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
    lineHeight: 1.05,
  },
  ticker: { fontSize: "12px", letterSpacing: "0.08em", color: "var(--faint)" },
  tracking: {
    display: "block",
    fontSize: "12.5px",
    color: "var(--muted)",
    letterSpacing: "0.01em",
    marginTop: "12px",
  },
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
  briefWrap: { marginTop: "48px" },
};
