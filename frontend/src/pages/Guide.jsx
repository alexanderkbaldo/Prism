import React from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { RevealGroup, RevealChild } from "../anim";

// The dashboard, read top to bottom. Each step names the panel it maps to so a
// first-time visitor knows exactly where to look.
const STEPS = [
  [
    "Pick a company",
    "Use the switcher to move between the five fintechs we track — Robinhood, Affirm, Block, Klarna, and Chime. Everything below reloads for that company.",
  ],
  [
    "Read the bottom line",
    "Start with “The read.” It opens with a one-line verdict on the week, drawn from where the signals agree — the fastest way to see if the story is turning positive or negative.",
  ],
  [
    "See which signals moved",
    "The five stat cards show social mentions, hiring postings, search interest, app reviews, and SEC filings — each with its week-over-week change, so you can tell what actually shifted, not just the level.",
  ],
  [
    "Open the analyst notes",
    "Under each signal, “Read the analyst note” expands the plain-English reasoning: what the number means and why it moved. This is the starting point for a thesis, not a verdict.",
  ],
  [
    "Watch for anomalies",
    "The anomaly list flags any signal that broke more than 2σ from its own recent pattern. A fresh anomaly is your cue to dig in before the quarterly report catches up.",
  ],
  [
    "Draw your own conclusion",
    "Check the company against its peers and the days-to-earnings countdown, then decide what you think. Prism surfaces what's moving and why — the call is yours.",
  ],
];

// The three use cases from the landing page, in full.
const USE_CASES = [
  [
    "Prep for the earnings call",
    "Before a company reports, scan its five signals for where they diverge from the consensus story. If hiring is accelerating while sentiment cools, that tension is worth a closer look — and it's visible weeks before the print.",
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
      <RevealGroup as="article" style={styles.article} amount={0.1}>
        <RevealChild as="span" className="eyebrow">Guide</RevealChild>
        <RevealChild as="h1" style={styles.title}>How to read Prism</RevealChild>

        <RevealChild as="p" style={styles.lede}>
          Prism turns five alternative-data signals into a readable view of where
          a company is heading. Here's how to go from the dashboard to a view of
          your own.
        </RevealChild>

        <RevealChild as="h2" style={styles.h2}>Start here</RevealChild>
        <RevealChild as="p" style={styles.p}>
          Open the dashboard and work down the page. It's built to be read in
          order.
        </RevealChild>

        {STEPS.map(([title, body], i) => (
          <RevealChild as="div" key={title} style={styles.step}>
            <span style={styles.stepNum}>{i + 1}</span>
            <div>
              <div style={styles.stepTitle}>{title}</div>
              <p style={styles.stepBody}>{body}</p>
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

        <RevealChild as="p" style={styles.p}>
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

  // ---- Numbered walkthrough ----
  step: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
    padding: "20px 0",
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

  // ---- Use cases ----
  useCase: { marginBottom: "28px" },
  useCaseTitle: {
    fontFamily: "var(--serif)",
    fontSize: "20px",
    fontWeight: 400,
    color: "var(--ink)",
    marginBottom: "8px",
  },

  cta: {
    display: "inline-block",
    marginTop: "16px",
    color: "var(--sage)",
    textDecoration: "none",
    fontSize: "15px",
    fontWeight: 500,
  },
};
