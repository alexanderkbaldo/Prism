import React from "react";
import { Link } from "react-router-dom";
import StatRow from "../components/StatRow";
import Footer from "../components/Footer";

const STEPS = [
  { n: "1", title: "Collect", body: "Five alternative-data signals, gathered every morning." },
  { n: "2", title: "Detect", body: "Anomalies flagged automatically as they emerge." },
  { n: "3", title: "Synthesize", body: "AI writes a plain-English research brief." },
];

const TRACKED = [
  ["Social sentiment", "Reddit and StockTwits chatter, scored for tone."],
  ["Search interest", "Google Trends momentum, week over week."],
  ["Hiring activity", "Job postings as a read on growth and focus."],
  ["App store reviews", "Ratings and review sentiment over time."],
  ["SEC filings", "New 10-K, 10-Q, 8-K, and S-1 activity."],
];

export default function Home() {
  return (
    <div style={styles.column}>
      {/* Hero */}
      <section style={styles.hero}>
        <h1 style={styles.headline}>
          Fintech intelligence before the earnings call.
        </h1>
        <p style={styles.sub}>
          Prism monitors the alternative-data signals that move fintech —
          sentiment, hiring, search, app reviews, and filings — and uses AI to
          turn them into readable research.
        </p>
        <Link to="/dashboard" style={styles.cta}>Launch dashboard</Link>
      </section>

      {/* A look inside */}
      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <span className="eyebrow">A look inside</span>
          <span style={styles.previewMeta}>Robinhood · last 7 days</span>
        </div>
        <h2 style={styles.previewName}>Robinhood</h2>
        <StatRow ticker="HOOD" />
        <Link to="/dashboard" style={styles.previewLink}>See the full brief →</Link>
      </section>

      {/* How it works */}
      <section style={styles.section}>
        <span className="eyebrow">How it works</span>
        <div style={styles.steps}>
          {STEPS.map((s) => (
            <div key={s.n} style={styles.step}>
              <span style={styles.stepN}>{s.n}</span>
              <h3 style={styles.stepTitle}>{s.title}</h3>
              <p style={styles.stepBody}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What we track */}
      <section style={styles.section}>
        <span className="eyebrow">What we track</span>
        <ul style={styles.tracked}>
          {TRACKED.map(([name, desc]) => (
            <li key={name} style={styles.trackedRow}>
              <span style={styles.trackedName}>{name}</span>
              <span style={styles.trackedDesc}>{desc}</span>
            </li>
          ))}
        </ul>
      </section>

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
  hero: {
    paddingTop: "160px",
    paddingBottom: "150px",
    maxWidth: "720px",
    marginLeft: "auto",
    marginRight: "auto",
    textAlign: "center",
  },
  headline: {
    fontFamily: "var(--serif)",
    fontSize: "56px",
    fontWeight: 400,
    lineHeight: 1.08,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
  },
  sub: {
    fontSize: "17px",
    lineHeight: 1.6,
    color: "var(--muted)",
    marginTop: "28px",
    maxWidth: "560px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  cta: {
    display: "inline-block",
    marginTop: "40px",
    background: "var(--sage)",
    color: "#fff",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 500,
    padding: "12px 24px",
    borderRadius: "8px",
  },

  section: {
    paddingTop: "72px",
    borderTop: "0.5px solid var(--hairline)",
    marginTop: "8px",
  },
  sectionHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  previewMeta: { fontSize: "11px", color: "var(--faint)" },
  previewName: {
    fontFamily: "var(--serif)",
    fontSize: "30px",
    fontWeight: 400,
    letterSpacing: "-0.01em",
    color: "var(--ink)",
    marginTop: "12px",
  },
  previewLink: {
    fontSize: "13px",
    color: "var(--sage)",
    textDecoration: "none",
  },

  steps: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "40px",
    marginTop: "32px",
  },
  step: { paddingRight: "20px" },
  stepN: {
    fontFamily: "var(--serif)",
    fontSize: "22px",
    color: "var(--sage)",
  },
  stepTitle: {
    fontFamily: "var(--serif)",
    fontSize: "20px",
    fontWeight: 400,
    color: "var(--ink)",
    marginTop: "12px",
  },
  stepBody: {
    fontSize: "14.5px",
    lineHeight: 1.6,
    color: "var(--muted)",
    marginTop: "8px",
  },

  tracked: {
    listStyle: "none",
    marginTop: "28px",
    maxWidth: "720px",
  },
  trackedRow: {
    display: "flex",
    gap: "32px",
    padding: "16px 0",
    borderBottom: "0.5px solid var(--hairline)",
  },
  trackedName: {
    fontFamily: "var(--serif)",
    fontSize: "17px",
    color: "var(--ink)",
    flexShrink: 0,
    width: "200px",
  },
  trackedDesc: {
    fontSize: "14.5px",
    lineHeight: 1.6,
    color: "var(--muted)",
  },
};
