import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import Footer from "../components/Footer";
import { Reveal, RevealGroup, RevealChild, EASE } from "../anim";

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

const MOCK_CHIPS = [
  ["Sentiment", "87"],
  ["Hiring", "12"],
  ["Search", "91"],
  ["Filings", "2"],
];

function SectionLabel({ children, dark }) {
  return (
    <span style={{ ...styles.label, ...(dark ? styles.labelDark : {}) }}>{children}</span>
  );
}

function MockCard() {
  return (
    <div className="home-mockcard" style={styles.mockCard}>
      <div style={styles.mockHead}>
        <span style={styles.mockEyebrow}>Research brief</span>
        <span style={styles.mockTicker}>HOOD</span>
      </div>
      <h3 style={styles.mockName}>Robinhood</h3>
      <div style={styles.mockScoreRow}>
        <span style={styles.mockScore}>87</span>
        <span style={styles.mockScoreLabel}>Sentiment score</span>
      </div>
      <p style={styles.mockBrief}>
        Elevated search interest and insider activity suggest near-term upside
        despite recent pullback.
      </p>
      <div style={styles.mockChips}>
        {MOCK_CHIPS.map(([label, value]) => (
          <div key={label} style={styles.chip}>
            <span style={styles.chipLabel}>{label}</span>
            <span style={styles.chipValue}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const reduce = useReducedMotion();
  // Sequential hero entrance on load.
  const seq = (delay, x = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: x ? 0 : 18, x },
          animate: { opacity: 1, y: 0, x: 0 },
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <div>
      {/* Hero — full viewport, split layout */}
      <section className="home-hero" style={styles.hero}>
        <div className="home-hero-grid" style={styles.heroGrid}>
          <div style={styles.heroLeft}>
            <motion.h1 className="home-headline" style={styles.headline} {...seq(0.05)}>
              Fintech intelligence
              <br />
              before the earnings call.
            </motion.h1>
            <motion.p style={styles.sub} {...seq(0.22)}>
              Prism monitors five alternative-data signals across leading fintech
              companies and uses AI to turn them into readable research.
            </motion.p>
            <motion.div {...seq(0.4)}>
              <Link to="/dashboard" className="home-launch" style={styles.cta}>
                Launch dashboard
              </Link>
            </motion.div>
          </div>

          <motion.div style={styles.heroRight} {...seq(0.28, 48)}>
            <MockCard />
          </motion.div>
        </div>
      </section>

      {/* How it works — dramatic dark band */}
      <section style={styles.darkSection}>
        <div style={styles.inner}>
          <Reveal>
            <SectionLabel dark>How it works</SectionLabel>
            <h2 style={{ ...styles.sectionTitle, color: "var(--bg)" }}>
              From signal to brief, every morning.
            </h2>
          </Reveal>
          <RevealGroup className="steps-grid" style={styles.steps}>
            {STEPS.map((s) => (
              <RevealChild key={s.n} style={styles.step}>
                <span style={styles.stepN}>{s.n}</span>
                <h3 style={styles.stepTitle}>{s.title}</h3>
                <p style={styles.stepBody}>{s.body}</p>
              </RevealChild>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* What we track — staggered card grid */}
      <section style={styles.trackSection}>
        <div style={styles.inner}>
          <Reveal>
            <SectionLabel>What we track</SectionLabel>
            <h2 style={styles.sectionTitle}>Five signals, one read.</h2>
          </Reveal>
          <RevealGroup className="track-grid" style={styles.trackGrid}>
            {TRACKED.map(([name, desc]) => (
              <RevealChild key={name} className="track-card" style={styles.trackCard}>
                <span style={styles.trackDot} />
                <div>
                  <h3 style={styles.trackName}>{name}</h3>
                  <p style={styles.trackDesc}>{desc}</p>
                </div>
              </RevealChild>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* Closing CTA */}
      <section style={styles.ctaSection}>
        <div style={styles.inner}>
          <Reveal>
            <div style={styles.ctaInner}>
              <SectionLabel>Get started</SectionLabel>
              <h2 style={styles.ctaTitle}>See what the signals say today.</h2>
              <Link to="/dashboard" className="home-launch" style={styles.cta}>
                Launch dashboard
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div style={styles.inner}>
        <Footer />
      </div>
    </div>
  );
}

const styles = {
  inner: { maxWidth: "1200px", margin: "0 auto", padding: "0 40px" },

  // ---- Hero ----
  hero: { minHeight: "calc(100vh - 73px)", display: "flex", alignItems: "center" },
  heroGrid: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "80px 40px",
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    gap: "64px",
    alignItems: "center",
  },
  heroLeft: { maxWidth: "560px" },
  headline: {
    fontFamily: "var(--serif)",
    fontSize: "64px",
    fontWeight: 400,
    lineHeight: 1.04,
    letterSpacing: "-0.025em",
    color: "var(--ink)",
  },
  sub: {
    fontSize: "18px",
    lineHeight: 1.6,
    color: "var(--muted)",
    marginTop: "28px",
    maxWidth: "470px",
  },
  cta: {
    display: "inline-block",
    marginTop: "40px",
    background: "var(--sage)",
    color: "#fff",
    textDecoration: "none",
    fontSize: "15px",
    fontWeight: 500,
    padding: "16px 34px",
    borderRadius: "10px",
  },

  // ---- Hero mock card ----
  heroRight: { display: "flex", justifyContent: "center" },
  mockCard: {
    width: "100%",
    maxWidth: "420px",
    background: "var(--ink)",
    color: "var(--bg)",
    borderRadius: "16px",
    padding: "32px 34px",
    boxShadow: "0 24px 60px rgba(26, 32, 24, 0.28), 0 6px 18px rgba(26, 32, 24, 0.18)",
  },
  mockHead: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  mockEyebrow: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--sage-soft)",
  },
  mockTicker: { fontSize: "11px", letterSpacing: "0.08em", color: "rgba(231, 220, 203, 0.55)" },
  mockName: {
    fontFamily: "var(--serif)",
    fontSize: "30px",
    fontWeight: 400,
    letterSpacing: "-0.01em",
    color: "var(--bg)",
    marginTop: "18px",
  },
  mockScoreRow: { display: "flex", alignItems: "baseline", gap: "12px", marginTop: "14px" },
  mockScore: {
    fontFamily: "var(--serif)",
    fontSize: "52px",
    fontWeight: 400,
    lineHeight: 1,
    color: "var(--sage)",
  },
  mockScoreLabel: {
    fontSize: "11px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(231, 220, 203, 0.6)",
  },
  mockBrief: {
    fontFamily: "var(--serif)",
    fontSize: "16px",
    fontStyle: "italic",
    lineHeight: 1.5,
    color: "rgba(231, 220, 203, 0.85)",
    marginTop: "20px",
  },
  mockChips: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "24px" },
  chip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(231, 220, 203, 0.16)",
  },
  chipLabel: {
    fontSize: "11px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "rgba(231, 220, 203, 0.62)",
  },
  chipValue: { fontFamily: "var(--serif)", fontSize: "18px", color: "var(--bg)" },

  // ---- Section typography ----
  label: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--sage)",
  },
  labelDark: { color: "var(--sage)" },
  sectionTitle: {
    fontFamily: "var(--serif)",
    fontSize: "38px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
    color: "var(--ink)",
    marginTop: "16px",
  },

  // ---- How it works (dark) ----
  darkSection: { background: "var(--ink)", padding: "140px 0" },
  steps: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "48px",
    marginTop: "56px",
  },
  step: {},
  stepN: {
    fontFamily: "var(--serif)",
    fontSize: "60px",
    fontWeight: 400,
    lineHeight: 1,
    color: "var(--sage)",
    letterSpacing: "-0.02em",
  },
  stepTitle: {
    fontFamily: "var(--serif)",
    fontSize: "24px",
    fontWeight: 400,
    color: "var(--bg)",
    marginTop: "20px",
  },
  stepBody: {
    fontSize: "15px",
    lineHeight: 1.6,
    color: "rgba(231, 220, 203, 0.7)",
    marginTop: "12px",
    maxWidth: "280px",
  },

  // ---- What we track ----
  trackSection: { padding: "140px 0" },
  trackGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginTop: "56px",
  },
  trackCard: {
    display: "flex",
    gap: "16px",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "12px",
    padding: "28px 30px",
  },
  trackDot: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: "var(--sage)",
    flexShrink: 0,
    marginTop: "8px",
  },
  trackName: {
    fontFamily: "var(--serif)",
    fontSize: "20px",
    fontWeight: 400,
    color: "var(--ink)",
  },
  trackDesc: { fontSize: "14.5px", lineHeight: 1.6, color: "var(--muted)", marginTop: "8px" },

  // ---- Closing CTA ----
  ctaSection: { padding: "40px 0 140px" },
  ctaInner: {
    borderTop: "0.5px solid var(--hairline)",
    paddingTop: "80px",
    textAlign: "center",
  },
  ctaTitle: {
    fontFamily: "var(--serif)",
    fontSize: "44px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
    color: "var(--ink)",
    marginTop: "16px",
  },
};
