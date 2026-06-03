import React, { useState } from "react";
import TopBar from "./components/TopBar";
import StatRow from "./components/StatRow";
import AnomalyLine from "./components/AnomalyLine";
import Brief from "./components/Brief";
import ChatLauncher from "./components/ChatLauncher";
import { useBrief } from "./hooks/useApi";

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

export default function App() {
  const [ticker, setTicker] = useState("HOOD");

  return (
    <div style={styles.page}>
      <div style={styles.column}>
        <TopBar ticker={ticker} onChange={setTicker} />

        <main>
          <Hero ticker={ticker} />
          <StatRow ticker={ticker} />
          <AnomalyLine ticker={ticker} />
          <div style={styles.briefWrap}>
            <Brief ticker={ticker} />
          </div>
        </main>

        <footer style={styles.footer}>
          Prism — a University of Michigan student project. For research and
          educational purposes only; not investment advice.
        </footer>
      </div>

      <ChatLauncher ticker={ticker} />
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh" },
  column: {
    maxWidth: "1440px",
    margin: "0 auto",
    padding: "0 56px 80px",
  },
  hero: { marginTop: "64px" },
  nameRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "14px",
  },
  name: {
    fontFamily: "var(--serif)",
    fontSize: "38px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
    lineHeight: 1.1,
  },
  ticker: {
    fontSize: "12px",
    letterSpacing: "0.08em",
    color: "var(--faint)",
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
  briefWrap: { marginTop: "64px" },
  footer: {
    marginTop: "96px",
    paddingTop: "22px",
    borderTop: "0.5px solid var(--hairline)",
    fontSize: "11.5px",
    color: "var(--faint)",
    lineHeight: 1.5,
  },
};
