import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import Footer from "../components/Footer";
import SubscribeForm from "../components/SubscribeForm";
import { Reveal, RevealGroup, RevealChild, CountUp, EASE } from "../anim";

const MOCK_CHIPS = [
  ["Sentiment", "87"],
  ["Hiring", "12"],
  ["Search", "91"],
  ["Filings", "2"],
];

const SIGNALS = ["Social", "Hiring", "Search", "App Reviews", "Filings"];

const COMPANIES = [
  ["Robinhood", "HOOD"],
  ["Affirm", "AFRM"],
  ["Block", "XYZ"],
  ["Klarna", "KLAR"],
  ["Chime", "CHYM"],
];

function MockCard() {
  return (
    <div className="home-mockcard" style={s.mockCard}>
      <div style={s.mockHead}>
        <span style={s.mockEyebrow}>Research brief</span>
        <span style={s.mockTicker}>HOOD</span>
      </div>
      <h3 style={s.mockName}>Robinhood</h3>
      <div style={s.mockScoreRow}>
        <span style={s.mockScore}>87</span>
        <span style={s.mockScoreLabel}>Sentiment score</span>
      </div>
      <p style={s.mockBrief}>
        Elevated search interest and insider activity suggest near-term upside
        despite recent pullback.
      </p>
      <div style={s.mockChips}>
        {MOCK_CHIPS.map(([label, value]) => (
          <div key={label} style={s.chip}>
            <span style={s.chipLabel}>{label}</span>
            <span style={s.chipValue}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Label({ children, dark }) {
  return <span style={{ ...s.label, ...(dark ? { color: "var(--sage)" } : {}) }}>{children}</span>;
}

export default function Home() {
  const reduce = useReducedMotion();
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
      {/* SECTION 1, Hero (sand) */}
      <section className="home-hero" style={s.hero}>
        <div className="home-hero-grid" style={s.heroGrid}>
          <div style={s.heroLeft}>
            <motion.h1 className="home-headline" style={s.headline} {...seq(0.05)}>
              Fintech intelligence
              <br />
              before the earnings call.
            </motion.h1>
            <motion.p style={s.heroSub} {...seq(0.22)}>
              Prism monitors five alternative-data signals across leading fintech
              companies and uses AI to turn them into readable research.
            </motion.p>
            <motion.div {...seq(0.4)}>
              <Link to="/dashboard" className="home-launch" style={s.cta}>
                Launch dashboard
              </Link>
            </motion.div>
          </div>
          <motion.div style={s.heroRight} {...seq(0.28, 48)}>
            <MockCard />
          </motion.div>
        </div>
      </section>

      {/* SECTION 2, The problem (dark) */}
      <section style={{ ...s.section, ...s.dark, textAlign: "center" }}>
        <div style={{ ...s.inner, maxWidth: "880px" }}>
          <Reveal><Label dark>The problem</Label></Reveal>
          <Reveal y={40} duration={0.8} delay={0.05}>
            <h2 style={{ ...s.statement, color: "var(--bg)" }}>
              By the time earnings are public, the story is already old.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p style={s.statementSub}>
              Markets move on information most people can't see yet.
            </p>
          </Reveal>
        </div>
      </section>

      {/* SECTION 3, Collect (sand) */}
      <section style={s.section}>
        <div className="story-grid" style={{ ...s.inner, ...s.grid2 }}>
          <div>
            <Reveal><Label>Collect</Label></Reveal>
            <Reveal y={40} duration={0.8} delay={0.05}>
              <h2 style={s.headline2}>Five signals. Every morning.</h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p style={s.body}>
                Before the market opens, Prism gathers alternative data from five
                independent sources, the early, scattered traces of where a
                company is really heading. Each is normalized, scored, and ready
                to read.
              </p>
            </Reveal>
          </div>
          <RevealGroup as="ul" style={s.signalList} amount={0.3}>
            {SIGNALS.map((sig) => (
              <RevealChild as="li" key={sig} style={s.signalItem}>
                <span style={s.signalDot} />
                {sig}
              </RevealChild>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* SECTION 4, Detect (dark) */}
      <section style={{ ...s.section, ...s.dark }}>
        <div style={s.inner}>
          <Reveal><Label dark>Detect</Label></Reveal>
          <Reveal y={40} duration={0.8} delay={0.05}>
            <h2 style={{ ...s.headline2, color: "var(--bg)", maxWidth: "680px" }}>
              Anomalies, the moment they emerge.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p style={{ ...s.body, color: "rgba(231,220,203,0.72)", maxWidth: "560px" }}>
              Every signal is measured against its own recent history. When
              something breaks from the pattern, Prism flags it automatically -
              no waiting for the quarterly report.
            </p>
          </Reveal>
          <Reveal delay={0.32} style={s.statBlock}>
            <div style={s.statNumber}>
              <CountUp value={112} />
            </div>
            <div style={s.statCaption}>anomalies detected in the first 48 hours</div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 5, Synthesize (sand) */}
      <section style={s.section}>
        <div style={{ ...s.inner, maxWidth: "900px" }}>
          <Reveal><Label>Synthesize</Label></Reveal>
          <Reveal y={40} duration={0.8} delay={0.05}>
            <h2 style={s.headline2}>AI that takes a position.</h2>
          </Reveal>
          <Reveal delay={0.2} style={s.quoteWrap}>
            <blockquote style={s.quote}>
              "Elevated search interest and insider activity suggest near-term
              upside despite recent pullback."
            </blockquote>
            <cite style={s.quoteCite}>Prism research brief, Robinhood</cite>
          </Reveal>
        </div>
      </section>

      {/* SECTION 6, What we track (sand) */}
      <section style={s.section}>
        <div style={s.inner}>
          <Reveal><Label>What we track</Label></Reveal>
          <Reveal y={40} duration={0.8} delay={0.05}>
            <h2 style={{ ...s.headline2, marginBottom: "8px" }}>
              Five fintechs, watched daily.
            </h2>
          </Reveal>
          <RevealGroup className="company-grid" style={s.companyGrid} amount={0.2}>
            {COMPANIES.map(([name, ticker]) => (
              <RevealChild key={ticker} className="track-card" style={s.companyCard}>
                <span style={s.companyDot} />
                <div>
                  <div style={s.companyName}>{name}</div>
                  <div style={s.companyTicker}>{ticker}</div>
                </div>
              </RevealChild>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* SECTION 6b, Subscribe (sand) */}
      <section style={s.section}>
        <div style={{ ...s.inner, maxWidth: "720px", textAlign: "center" }}>
          <Reveal><Label>Stay ahead</Label></Reveal>
          <Reveal y={40} duration={0.8} delay={0.05}>
            <h2 style={{ ...s.headline2, marginBottom: "8px" }}>
              Get the signals in your inbox.
            </h2>
          </Reveal>
          <Reveal delay={0.18}>
            <p style={{ ...s.body, margin: "0 auto 36px", maxWidth: "480px" }}>
              Subscribe for a daily digest, real-time anomaly alerts, or a
              weekly summary across all five fintechs.
            </p>
          </Reveal>
          <Reveal delay={0.28}>
            <SubscribeForm />
          </Reveal>
        </div>
      </section>

      {/* SECTION 7, Closing CTA (dark) */}
      <section style={{ ...s.section, ...s.dark, textAlign: "center" }}>
        <div style={{ ...s.inner, maxWidth: "760px" }}>
          <Reveal><Label dark>Get started</Label></Reveal>
          <Reveal y={40} duration={0.8} delay={0.05}>
            <h2 style={{ ...s.statement, color: "var(--bg)" }}>
              See what the signals say today.
            </h2>
          </Reveal>
          <Reveal delay={0.25}>
            <Link to="/dashboard" className="home-launch" style={{ ...s.cta, ...s.ctaLarge }}>
              Launch dashboard
            </Link>
          </Reveal>
        </div>
      </section>

      <div style={s.inner}>
        <Footer />
      </div>
    </div>
  );
}

const s = {
  inner: { maxWidth: "1100px", margin: "0 auto", padding: "0 40px", width: "100%" },

  // Full-height story section
  section: {
    minHeight: "90vh",
    display: "flex",
    alignItems: "center",
    padding: "120px 0",
  },
  dark: { background: "var(--ink)" },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "80px",
    alignItems: "center",
  },

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
  heroSub: {
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
  ctaLarge: { fontSize: "16px", padding: "18px 40px", marginTop: "36px" },

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

  // ---- Shared type ----
  label: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--sage)",
    display: "block",
  },
  // Big dramatic centered statement (problem / closing)
  statement: {
    fontFamily: "var(--serif)",
    fontSize: "52px",
    fontWeight: 400,
    lineHeight: 1.12,
    letterSpacing: "-0.025em",
    color: "var(--ink)",
    marginTop: "24px",
  },
  statementSub: {
    fontSize: "19px",
    lineHeight: 1.6,
    color: "rgba(231, 220, 203, 0.66)",
    marginTop: "28px",
  },
  // Section headline (left-aligned chapters)
  headline2: {
    fontFamily: "var(--serif)",
    fontSize: "44px",
    fontWeight: 400,
    lineHeight: 1.1,
    letterSpacing: "-0.025em",
    color: "var(--ink)",
    marginTop: "18px",
  },
  body: {
    fontSize: "17px",
    lineHeight: 1.7,
    color: "var(--muted)",
    marginTop: "24px",
    maxWidth: "440px",
  },

  // ---- Collect signal list ----
  signalList: { listStyle: "none", margin: 0, padding: 0 },
  signalItem: {
    fontFamily: "var(--serif)",
    fontSize: "30px",
    fontWeight: 400,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
    padding: "18px 0",
    borderBottom: "0.5px solid var(--hairline)",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  signalDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--sage)",
    flexShrink: 0,
  },

  // ---- Detect stat ----
  statBlock: { marginTop: "56px" },
  statNumber: {
    fontFamily: "var(--serif)",
    fontSize: "84px",
    fontWeight: 400,
    lineHeight: 1,
    letterSpacing: "-0.03em",
    color: "var(--sage)",
  },
  statCaption: {
    fontSize: "14px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(231, 220, 203, 0.6)",
    marginTop: "16px",
  },

  // ---- Synthesize pull-quote ----
  quoteWrap: { marginTop: "40px", borderLeft: "2px solid var(--sage)", paddingLeft: "32px" },
  quote: {
    fontFamily: "var(--serif)",
    fontSize: "40px",
    fontStyle: "italic",
    fontWeight: 400,
    lineHeight: 1.32,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
    margin: 0,
  },
  quoteCite: {
    display: "block",
    fontStyle: "normal",
    fontSize: "13px",
    letterSpacing: "0.04em",
    color: "var(--faint)",
    marginTop: "24px",
  },

  // ---- Companies grid ----
  companyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "20px",
    marginTop: "48px",
  },
  companyCard: {
    display: "flex",
    gap: "14px",
    alignItems: "center",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "12px",
    padding: "24px 24px",
  },
  companyDot: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: "var(--sage)",
    flexShrink: 0,
  },
  companyName: {
    fontFamily: "var(--serif)",
    fontSize: "21px",
    fontWeight: 400,
    color: "var(--ink)",
  },
  companyTicker: {
    fontSize: "11px",
    letterSpacing: "0.08em",
    color: "var(--faint)",
    marginTop: "3px",
  },
};
