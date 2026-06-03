import React from "react";

const TICKERS = ["HOOD", "AFRM", "XYZ", "KLAR", "CHYM"];

export default function TopBar({ ticker, onChange }) {
  return (
    <header style={styles.bar}>
      <div style={styles.wordmark}>
        <svg width="36" height="36" viewBox="0 0 52 52" style={styles.logo} aria-hidden="true">
          <rect x="0" y="0" width="52" height="52" rx="13" fill="var(--sage)" />
          <path
            d="M26 6 C39 6 47 15 46 26 C45 37 36 44 26 43 C16 43 9 34 10 26 C11 17 18 11 25 11 C32 11 37 17 37 24 C37 31 32 35 26 35 C20 35 17 30 18 26 C19 22 23 20 26 21 C29 22 30 26 28 28"
            fill="none"
            stroke="var(--bg)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span style={styles.word}>Prism</span>
      </div>

      <nav style={styles.tabs}>
        {TICKERS.map((t) => {
          const active = t === ticker;
          return (
            <button
              key={t}
              onClick={() => onChange(t)}
              style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}
            >
              {t}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

const styles = {
  bar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "22px 0",
    borderBottom: "0.5px solid var(--hairline)",
  },
  wordmark: { display: "flex", alignItems: "center", gap: "10px" },
  logo: { display: "block", flexShrink: 0 },
  word: {
    fontSize: "18px",
    fontWeight: 500,
    letterSpacing: "0.01em",
    color: "var(--ink)",
  },
  tabs: { display: "flex", gap: "4px" },
  tab: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "12px",
    letterSpacing: "0.04em",
    color: "var(--muted)",
    padding: "5px 11px",
    borderRadius: "5px",
    transition: "color 0.15s, background 0.15s",
  },
  tabActive: {
    background: "var(--ink)",
    color: "var(--bg)",
  },
};
