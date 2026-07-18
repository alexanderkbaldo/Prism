import React from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import SubscribeForm from "../components/SubscribeForm";
import { RevealGroup, RevealChild } from "../anim";
import { GLOSSARY } from "../utils/glossary";

/*
 * Static mini-mockups: small, clearly-sample replicas of the dashboard panels
 * each step describes, so a first-time reader sees the thing before they meet
 * it. Values are plausible but illustrative; no live data.
 */

function MockTabs() {
  const tabs = ["HOOD", "AFRM", "XYZ", "KLAR", "CHYM"];
  return (
    <div style={m.panel}>
      <div style={m.tabRow}>
        {tabs.map((t, i) => (
          <span key={t} style={{ ...m.tab, ...(i === 0 ? m.tabActive : {}) }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function MockRead() {
  return (
    <div style={m.panel}>
      <div style={m.verdictRow}>
        <span style={{ ...m.dot, background: "var(--up)" }} />
        <span style={m.verdict}>Looking positive</span>
        <span style={m.verdictWhy}>· people are upbeat, hiring is growing</span>
      </div>
      <p style={m.readLine}>
        Online chatter is mostly positive, with some caution mixed in.
      </p>
    </div>
  );
}

function MockStat() {
  return (
    <div style={{ ...m.panel, maxWidth: "230px" }}>
      <div style={m.statLabel}>Social</div>
      <div style={m.statValue}>128</div>
      <div style={m.statUnit}>mentions</div>
      <div style={m.statDelta}>↑ 12 vs last wk</div>
    </div>
  );
}

function MockNote() {
  return (
    <div style={m.panel}>
      <div style={m.noteToggle}>Read the analyst note ▸</div>
      <p style={m.notePreview}>
        Mentions rose on the product announcement; the tone is watchful rather
        than euphoric, so the score moved less than the volume…
      </p>
    </div>
  );
}

function MockAnomaly() {
  return (
    <div style={m.panel}>
      <div style={m.verdictRow}>
        <span style={{ ...m.dot, background: "var(--clay)" }} />
        <span style={m.anomalyText}>
          Hiring <strong>+2.4σ</strong> above its 90-day pattern
        </span>
        <span style={m.anomalyDate}>Jul 14</span>
      </div>
    </div>
  );
}

function MockPeers() {
  return (
    <div style={m.panel}>
      <div style={m.peersLabel}>Among 5 fintechs tracked</div>
      <div style={m.peersRow}>
        sentiment <strong>3rd</strong> · buzz <strong>1st</strong> · hiring <strong>1st</strong>
      </div>
    </div>
  );
}

// The dashboard, read top to bottom. Each step names the panel it maps to,
// shows a sample of it, and links to the live version.
const STEPS = [
  {
    title: "Pick a company",
    body:
      "Use the switcher to move between the five fintechs we track: Robinhood, " +
      "Affirm, Block, Klarna, and Chime. Everything below reloads for that company.",
    Mock: MockTabs,
    to: "/dashboard",
    linkLabel: "Open the dashboard",
  },
  {
    title: "Read the bottom line",
    body:
      "Start with “The read.” It opens with a one-line verdict on the week, drawn " +
      "from where the signals agree. It's the fastest way to see if the story is " +
      "turning positive or negative.",
    Mock: MockRead,
    to: "/dashboard#read",
    linkLabel: "See the read live",
  },
  {
    title: "See which signals moved",
    body:
      "The five stat cards show social mentions, hiring postings, search interest, " +
      "app reviews, and SEC filings, each with its week-over-week change, so you " +
      "can tell what actually shifted, not just the level.",
    Mock: MockStat,
    to: "/dashboard#signals",
    linkLabel: "See the stat cards live",
  },
  {
    title: "Open the analyst notes",
    body:
      "Under each signal, “Read the analyst note” expands the plain-English " +
      "reasoning: what the number means and why it moved. This is the starting " +
      "point for a thesis, not a verdict.",
    Mock: MockNote,
    to: "/dashboard#signals",
    linkLabel: "See the notes live",
  },
  {
    title: "Watch for anomalies",
    body:
      "The anomaly list flags any signal that broke more than 2σ from its own " +
      "recent pattern. A fresh anomaly is your cue to dig in before the quarterly " +
      "report catches up.",
    Mock: MockAnomaly,
    to: "/dashboard#anomalies",
    linkLabel: "See anomalies live",
  },
  {
    title: "Draw your own conclusion",
    body:
      "Check the company against its peers and the days-to-earnings countdown, " +
      "then decide what you think. Prism surfaces what's moving and why; the " +
      "call is yours.",
    Mock: MockPeers,
    to: "/investments",
    linkLabel: "See the peer scoreboard",
  },
];

// The three use cases from the landing page, in full.
const USE_CASES = [
  [
    "Prep for the earnings call",
    "Before a company reports, scan its five signals for where they diverge from the consensus story. If hiring is accelerating while sentiment cools, that tension is worth a closer look, and it's visible weeks before the print.",
  ],
  [
    "Catch an inflection early",
    "Earnings are quarterly; the world is not. The anomaly feed watches every signal against its own history and flags the moment one breaks from the pattern, so you're looking at a turning point while it's still forming.",
  ],
  [
    "Read a company against its peers",
    "No signal means much in isolation. Peer standing ranks each fintech against the other four on buzz, hiring, and sentiment, so you can see who's actually gaining ground and who's just moving with the group.",
  ],
];

export default function Guide() {
  return (
    <div className="page" style={styles.column}>
      <RevealGroup as="article" style={styles.article}>
        <RevealChild as="span" className="eyebrow">Guide</RevealChild>
        <RevealChild as="h1" style={styles.title}>How to read Prism</RevealChild>

        <RevealChild as="p" style={styles.lede}>
          Prism turns five alternative-data signals into a readable view of where
          a company is heading. Here's how to go from the dashboard to a view of
          your own.
        </RevealChild>

        <RevealChild as="h2" style={styles.h2}>Two places to work</RevealChild>
        <RevealChild as="div" style={styles.placesRow}>
          <Link to="/investments" style={styles.place}>
            <span style={styles.placeName}>Investments</span>
            <span style={styles.placeDesc}>
              Start each week here: all five companies on one scoreboard, plus
              what's reporting next.
            </span>
            <span style={styles.placeGo}>Open →</span>
          </Link>
          <Link to="/dashboard" style={styles.place}>
            <span style={styles.placeName}>Dashboard</span>
            <span style={styles.placeDesc}>
              Then deep-dive one company: its verdict, five signals, analyst
              notes, and anomalies.
            </span>
            <span style={styles.placeGo}>Open →</span>
          </Link>
        </RevealChild>

        <RevealChild as="h2" style={styles.h2}>Start here</RevealChild>
        <RevealChild as="p" style={styles.p}>
          Open the dashboard and work down the page. It's built to be read in
          order. The small panels below are illustrative samples of what you'll
          see.
        </RevealChild>

        {STEPS.map(({ title, body, Mock, to, linkLabel }, i) => (
          <RevealChild as="div" key={title} style={styles.step}>
            <span style={styles.stepNum}>{i + 1}</span>
            <div style={styles.stepMain}>
              <div style={styles.stepTitle}>{title}</div>
              <p style={styles.stepBody}>{body}</p>
              <Mock />
              <Link to={to} style={styles.stepLink}>{linkLabel} →</Link>
            </div>
          </RevealChild>
        ))}

        <RevealChild as="h2" style={styles.h2}>Three ways to use it</RevealChild>
        {USE_CASES.map(([title, body]) => (
          <RevealChild as="div" key={title} style={styles.useCase}>
            <div style={styles.useCaseTitle}>{title}</div>
            <p style={styles.p}>{body}</p>
          </RevealChild>
        ))}

        <RevealChild as="div" style={styles.example}>
          <span className="eyebrow" style={{ color: "var(--sage)" }}>
            Worked example · illustrative
          </span>
          <div style={styles.exampleTitle}>A week the signals disagreed</div>
          <div style={styles.exampleChips}>
            <span style={{ ...styles.chip, color: "var(--up)" }}>Hiring ↑ +2.1σ</span>
            <span style={{ ...styles.chip, color: "var(--down)" }}>Sentiment ↓ 44</span>
            <span style={styles.chip}>Search · flat</span>
          </div>
          <p style={styles.exampleBody}>
            Three weeks before a print, hiring postings broke above their
            90-day pattern while social sentiment cooled. That's a tension: the
            company was staffing up while the crowd got quieter. An analyst
            reading this would open the hiring note to see which teams were
            growing, check whether peers showed the same cooling, and form a
            view before the quarter made it obvious. The signals don't answer
            the question; they tell you which question to ask.
          </p>
          <p style={styles.exampleFoot}>Sample data, for illustration only.</p>
        </RevealChild>

        <RevealChild as="h2" style={styles.h2}>The numbers, defined</RevealChild>
        <RevealChild as="div" style={styles.glossaryGrid}>
          {GLOSSARY.map((g) => (
            <div key={g.id} style={styles.glossItem}>
              <div style={styles.glossTerm}>{g.term}</div>
              <div style={styles.glossDef}>{g.def}</div>
            </div>
          ))}
        </RevealChild>

        <RevealChild as="h2" style={styles.h2}>Let the signals come to you</RevealChild>
        <RevealChild as="p" style={styles.p}>
          Anomaly alerts email you the moment a signal breaks from its pattern;
          the daily digest is a two-minute read before the market opens.
        </RevealChild>
        <RevealChild as="div" style={styles.subscribeWrap}>
          <SubscribeForm />
        </RevealChild>

        <RevealChild as="p" style={{ ...styles.p, marginTop: "40px" }}>
          Prism is a research and educational project. It surfaces signals and
          explains them; it is not investment advice.
        </RevealChild>

        <RevealChild as="div">
          <Link to="/dashboard" style={styles.cta}>Launch the dashboard &rarr;</Link>
        </RevealChild>
      </RevealGroup>

      <Footer />
    </div>
  );
}

// ---- mockup styles ----------------------------------------------------------

const m = {
  panel: {
    background: "var(--paper)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "10px",
    padding: "14px 16px",
    margin: "14px 0 4px",
  },
  tabRow: { display: "flex", gap: "6px", flexWrap: "wrap" },
  tab: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "var(--muted)",
    padding: "6px 12px",
    borderRadius: "7px",
    background: "var(--surface)",
  },
  tabActive: { background: "var(--ink)", color: "var(--bg)" },
  verdictRow: { display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" },
  dot: { width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0 },
  verdict: {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    color: "var(--up)",
  },
  verdictWhy: { fontSize: "13px", color: "var(--muted)" },
  readLine: {
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    fontSize: "15.5px",
    color: "var(--muted)",
    margin: "10px 0 0",
    lineHeight: 1.5,
  },
  statLabel: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--faint)",
  },
  statValue: { fontFamily: "var(--serif)", fontSize: "26px", color: "var(--ink)", marginTop: "4px", lineHeight: 1 },
  statUnit: { fontSize: "12px", color: "var(--muted)", marginTop: "4px" },
  statDelta: { fontSize: "12px", color: "var(--up)", marginTop: "8px" },
  noteToggle: { fontSize: "13px", fontWeight: 500, color: "var(--sage)" },
  notePreview: { fontSize: "13px", lineHeight: 1.6, color: "var(--muted)", margin: "8px 0 0" },
  anomalyText: { fontSize: "13.5px", color: "var(--ink)" },
  anomalyDate: { fontSize: "12px", color: "var(--faint)", marginLeft: "auto" },
  peersLabel: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--faint)",
  },
  peersRow: { fontSize: "14px", color: "var(--ink)", marginTop: "6px" },
};

// ---- page styles --------------------------------------------------------------

const styles = {
  column: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "0 40px 80px",
  },
  // An elevated reading panel, matching About.jsx.
  article: {
    maxWidth: "760px",
    margin: "72px auto 0",
    padding: "60px 72px",
    background: "var(--paper-raised)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "12px",
    boxShadow: "var(--shadow-card)",
  },
  title: {
    fontFamily: "var(--serif)",
    fontSize: "40px",
    fontWeight: 400,
    lineHeight: 1.12,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
    marginTop: "16px",
  },
  lede: {
    fontFamily: "var(--serif)",
    fontSize: "21px",
    fontStyle: "italic",
    lineHeight: 1.5,
    color: "var(--muted)",
    marginTop: "28px",
    marginBottom: "40px",
  },
  h2: {
    fontFamily: "var(--serif)",
    fontSize: "22px",
    fontWeight: 400,
    color: "var(--ink)",
    marginTop: "60px",
    marginBottom: "16px",
  },
  p: {
    fontSize: "16px",
    lineHeight: 1.7,
    color: "var(--ink)",
    marginBottom: "20px",
  },

  // ---- two places to work ----
  placesRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px",
    marginBottom: "8px",
  },
  place: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "18px 20px",
    background: "var(--paper)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "10px",
    textDecoration: "none",
  },
  placeName: { fontFamily: "var(--serif)", fontSize: "19px", color: "var(--ink)" },
  placeDesc: { fontSize: "13.5px", lineHeight: 1.55, color: "var(--muted)" },
  placeGo: { fontSize: "13px", fontWeight: 500, color: "var(--sage)", marginTop: "4px" },

  // ---- numbered walkthrough ----
  step: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
    padding: "24px 0",
    borderBottom: "0.5px solid var(--hairline)",
  },
  stepNum: {
    fontFamily: "var(--serif)",
    fontSize: "28px",
    lineHeight: 1,
    color: "var(--sage)",
    flexShrink: 0,
    width: "36px",
  },
  stepMain: { flex: 1, minWidth: 0 },
  stepTitle: {
    fontFamily: "var(--serif)",
    fontSize: "20px",
    fontWeight: 400,
    color: "var(--ink)",
    marginBottom: "6px",
  },
  stepBody: {
    fontSize: "15px",
    lineHeight: 1.65,
    color: "var(--muted)",
    margin: 0,
  },
  stepLink: {
    display: "inline-block",
    marginTop: "10px",
    fontSize: "13.5px",
    fontWeight: 500,
    color: "var(--sage)",
    textDecoration: "none",
  },

  // ---- use cases ----
  useCase: { marginBottom: "28px" },
  useCaseTitle: {
    fontFamily: "var(--serif)",
    fontSize: "20px",
    fontWeight: 400,
    color: "var(--ink)",
    marginBottom: "8px",
  },

  // ---- worked example ----
  example: {
    marginTop: "48px",
    padding: "26px 28px",
    background: "var(--paper)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "12px",
  },
  exampleTitle: {
    fontFamily: "var(--serif)",
    fontSize: "22px",
    color: "var(--ink)",
    margin: "10px 0 14px",
  },
  exampleChips: { display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" },
  chip: {
    fontSize: "12.5px",
    fontWeight: 600,
    color: "var(--muted)",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "99px",
    padding: "5px 12px",
  },
  exampleBody: { fontSize: "15px", lineHeight: 1.7, color: "var(--ink)", margin: 0 },
  exampleFoot: { fontSize: "12px", color: "var(--faint)", margin: "14px 0 0" },

  // ---- glossary ----
  glossaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "18px 24px",
  },
  glossItem: { paddingBottom: "4px" },
  glossTerm: { fontFamily: "var(--serif)", fontSize: "17px", color: "var(--ink)" },
  glossDef: { fontSize: "13.5px", lineHeight: 1.6, color: "var(--muted)", marginTop: "4px" },

  // ---- subscribe ----
  subscribeWrap: { maxWidth: "560px" },

  cta: {
    display: "inline-block",
    marginTop: "16px",
    color: "var(--sage)",
    textDecoration: "none",
    fontSize: "15px",
    fontWeight: 500,
  },
};
