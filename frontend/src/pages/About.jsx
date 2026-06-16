import React from "react";
import Footer from "../components/Footer";
import { RevealGroup, RevealChild } from "../anim";

export default function About() {
  return (
    <div className="page" style={styles.column}>
      <RevealGroup as="article" style={styles.article} amount={0.1}>
        <RevealChild as="span" className="eyebrow">About</RevealChild>
        <RevealChild as="h1" style={styles.title}>About Prism</RevealChild>

        <RevealChild as="p" style={styles.lede}>
          Prism started with a simple frustration: by the time a company's
          earnings report comes out, the story is already old.
        </RevealChild>

        <RevealChild as="p" style={styles.p}>
          Sophisticated investors have long known that the most valuable signals
          live outside the income statement: in hiring patterns, app store
          reviews, search trends, social sentiment, and regulatory filings. But
          the tools to track those signals have always been locked behind five-
          and six-figure subscriptions, available only to hedge funds and
          institutional desks.
        </RevealChild>

        <RevealChild as="p" style={styles.p}>
          We're two economics students at the University of Michigan who thought
          that gap was worth closing. Prism continuously monitors alternative
          data across leading fintech companies and uses AI to synthesize it into
          clear, readable research, the kind of intelligence that used to require
          a Bloomberg terminal and a team of analysts.
        </RevealChild>

        <RevealChild as="h2" style={styles.h2}>The problem we're solving</RevealChild>
        <RevealChild as="p" style={styles.p}>
          Traditional financial research is slow and backward-looking. Earnings
          are quarterly; the world is not. Prism watches the signals that change
          daily, and explains what they mean in plain English.
        </RevealChild>

        <RevealChild as="h2" style={styles.h2}>How we think about it</RevealChild>
        <RevealChild as="p" style={styles.p}>
          We don't believe in replacing human judgment. Prism surfaces what's
          moving and why, then gets out of the way. Every brief is a starting
          point for analysis, not a verdict. When our models disagree, we show
          you the disagreement.
        </RevealChild>

        <RevealChild as="p" style={styles.p}>
          Prism is a research and educational project. It is not investment
          advice.
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
  // An elevated reading panel, the editorial content lifted off the canvas,
  // with a comfortable ~600px measure inside generous padding.
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
};
