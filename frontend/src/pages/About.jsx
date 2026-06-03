import React from "react";
import Footer from "../components/Footer";

export default function About() {
  return (
    <div style={styles.column}>
      <article style={styles.article}>
        <span className="eyebrow">About</span>
        <h1 style={styles.title}>About Prism</h1>

        <p style={styles.lede}>
          Prism started with a simple frustration: by the time a company's
          earnings report comes out, the story is already old.
        </p>

        <p style={styles.p}>
          Sophisticated investors have long known that the most valuable signals
          live outside the income statement: in hiring patterns, app store
          reviews, search trends, social sentiment, and regulatory filings. But
          the tools to track those signals have always been locked behind five-
          and six-figure subscriptions, available only to hedge funds and
          institutional desks.
        </p>

        <p style={styles.p}>
          We're two economics students at the University of Michigan who thought
          that gap was worth closing. Prism continuously monitors alternative
          data across leading fintech companies and uses AI to synthesize it into
          clear, readable research, the kind of intelligence that used to require
          a Bloomberg terminal and a team of analysts.
        </p>

        <h2 style={styles.h2}>The problem we're solving</h2>
        <p style={styles.p}>
          Traditional financial research is slow and backward-looking. Earnings
          are quarterly; the world is not. Prism watches the signals that change
          daily, and explains what they mean in plain English.
        </p>

        <h2 style={styles.h2}>How we think about it</h2>
        <p style={styles.p}>
          We don't believe in replacing human judgment. Prism surfaces what's
          moving and why, then gets out of the way. Every brief is a starting
          point for analysis, not a verdict. When our models disagree, we show
          you the disagreement.
        </p>

        <p style={styles.p}>
          Prism is a research and educational project. It is not investment
          advice.
        </p>
      </article>

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
  article: {
    maxWidth: "640px",
    margin: "0 auto",
    paddingTop: "96px",
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
  },
  h2: {
    fontFamily: "var(--serif)",
    fontSize: "22px",
    fontWeight: 400,
    color: "var(--ink)",
    marginTop: "44px",
    marginBottom: "12px",
  },
  p: {
    fontSize: "16px",
    lineHeight: 1.7,
    color: "var(--ink)",
  },
};
