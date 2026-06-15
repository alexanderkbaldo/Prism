import React from "react";
import { Link } from "react-router-dom";
import StatRow from "../components/StatRow";
import Verdict from "../components/Verdict";
import Footer from "../components/Footer";
import { useBrief } from "../hooks/useApi";
import { extractBottomLine } from "../utils/brief";

// The brief's plain-English bottom line — gives the preview an AI "read", not
// just numbers. Mirrors what the dashboard shows.
function PreviewRead({ ticker }) {
  const { data } = useBrief(ticker);
  const { sentence } = extractBottomLine(data?.brief?.brief_text);
  if (!sentence) return null;
  return <p style={styles.previewRead}>{sentence}</p>;
}

// Section eyebrow with a small sage accent dot — one warm accent per section.
function SectionLabel({ children }) {
  return (
    <span className="eyebrow" style={styles.sectionLabel}>
      <span style={styles.labelDot} />
      {children}
    </span>
  );
}

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
    <div className="page" style={styles.column}>
      {/* Hero */}
      <section className="home-hero" style={styles.hero}>
        {/* Faint decorative line-chart motif behind the headline. */}
        <svg
          style={styles.heroMotif}
          viewBox="0 0 900 200"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points="0,150 90,140 180,158 270,120 360,132 450,80 540,104 630,52 720,74 810,28 900,44"
            fill="none"
            stroke="var(--sage)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="450" cy="80" r="4" fill="var(--sage)" />
          <circle cx="810" cy="28" r="4" fill="var(--sage)" />
        </svg>

        <div style={styles.heroContent}>
          <h1 className="home-headline" style={styles.headline}>
            Fintech intelligence before the earnings call.
          </h1>
          <p style={styles.sub}>
            Prism monitors five alternative-data signals across leading fintech
            companies and uses AI to turn them into readable research.
          </p>
          <Link to="/dashboard" style={styles.cta}>Launch dashboard</Link>
        </div>
      </section>

      {/* A look inside */}
      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <SectionLabel>A look inside</SectionLabel>
          <span style={styles.previewMeta}>Robinhood · last 7 days</span>
        </div>
        <h2 style={styles.previewName}>Robinhood</h2>
        <Verdict ticker="HOOD" />
        <PreviewRead ticker="HOOD" />
        <StatRow ticker="HOOD" />
        <Link to="/dashboard" style={styles.previewLink}>See the full brief →</Link>
      </section>

      {/* How it works */}
      <section style={styles.section}>
        <SectionLabel>How it works</SectionLabel>
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
        <SectionLabel>What we track</SectionLabel>
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
    position: "relative",
    paddingTop: "160px",
    paddingBottom: "150px",
    maxWidth: "720px",
    marginLeft: "auto",
    marginRight: "auto",
    textAlign: "center",
  },
  heroMotif: {
    position: "absolute",
    top: "50%",
    left: "-12%",
    width: "124%",
    height: "320px",
    transform: "translateY(-50%)",
    opacity: 0.1,
    pointerEvents: "none",
    zIndex: 0,
  },
  heroContent: { position: "relative", zIndex: 1 },
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
  sectionLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  labelDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--sage)",
    display: "inline-block",
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
  previewRead: {
    fontFamily: "var(--serif)",
    fontSize: "20px",
    fontStyle: "italic",
    lineHeight: 1.45,
    color: "var(--muted)",
    margin: "16px 0 4px",
    maxWidth: "620px",
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
    fontSize: "18px",
    color: "var(--sage)",
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    background: "var(--sage-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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
