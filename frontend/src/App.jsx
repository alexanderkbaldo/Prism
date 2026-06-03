import React, { useState, useEffect } from "react";
import CompanySelector from "./components/CompanySelector";
import SignalCards from "./components/SignalCards";
import AlertsSection from "./components/AlertsSection";
import ResearchBrief from "./components/ResearchBrief";

const COMPANY_NAMES = {
  HOOD: "Robinhood",
  AFRM: "Affirm",
  XYZ:  "Block",
  KLAR: "Klarna",
  CHYM: "Chime",
};

function BackendStatus() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    fetch("/api/healthz")
      .then((r) => (r.ok ? setStatus("ok") : setStatus("error")))
      .catch(() => setStatus("error"));
  }, []);
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: "5px",
        color: status === "ok" ? "var(--green)" : status === "error" ? "var(--red)" : "var(--text-muted)",
      }}
    >
      <span style={{ fontSize: "0.6rem" }}>●</span>
      {status === "ok" ? "API connected" : status === "error" ? "API offline" : "Checking…"}
    </span>
  );
}

export default function App() {
  const [ticker, setTicker] = useState("HOOD");

  return (
    <div style={styles.root}>
      {/* Top nav */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoMark}>◈</span>
          <span style={styles.logoText}>Prism</span>
          <span style={styles.logoSub}>Alternative Data</span>
        </div>
        <BackendStatus />
      </header>

      <main style={styles.main}>
        {/* Page title */}
        <div style={styles.titleRow}>
          <div>
            <h1 style={styles.pageTitle}>
              {COMPANY_NAMES[ticker]}{" "}
              <span style={styles.pageTicker}>({ticker})</span>
            </h1>
            <p style={styles.pageSubtitle}>Fintech alternative data signals · last 7 days</p>
          </div>
        </div>

        {/* Company selector */}
        <CompanySelector selected={ticker} onChange={setTicker} />

        {/* 2-column grid: signals + sidebar */}
        <div style={styles.grid}>
          {/* Left — signals */}
          <div style={styles.left}>
            <SignalCards ticker={ticker} />
          </div>

          {/* Right — alerts + brief */}
          <div style={styles.right}>
            <AlertsSection ticker={ticker} />
            <ResearchBrief ticker={ticker} />
          </div>
        </div>
      </main>

      <footer style={styles.footer}>
        <span>Prism · University of Michigan · {new Date().getFullYear()}</span>
        <span>Built with Claude API</span>
      </footer>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 28px",
    height: "58px",
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  logo: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
  },
  logoMark: {
    color: "var(--teal)",
    fontSize: "1.3rem",
    lineHeight: 1,
  },
  logoText: {
    fontWeight: 700,
    fontSize: "1.15rem",
    color: "var(--text)",
    letterSpacing: "-0.01em",
  },
  logoSub: {
    fontSize: "0.72rem",
    color: "var(--text-muted)",
    fontWeight: 500,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  main: {
    flex: 1,
    maxWidth: "1200px",
    width: "100%",
    margin: "0 auto",
    padding: "28px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "var(--text)",
    lineHeight: 1.2,
  },
  pageTicker: {
    color: "var(--teal)",
    fontWeight: 600,
  },
  pageSubtitle: {
    fontSize: "0.82rem",
    color: "var(--text-muted)",
    marginTop: "4px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 380px",
    gap: "20px",
    alignItems: "start",
  },
  left: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  right: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    position: "sticky",
    top: "78px",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 28px",
    borderTop: "1px solid var(--border)",
    fontSize: "0.75rem",
    color: "var(--text-muted)",
  },
};
