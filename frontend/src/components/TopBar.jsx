import React from "react";

const TICKERS = ["HOOD", "AFRM", "XYZ", "KLAR", "CHYM"];

export default function TopBar({ ticker, onChange }) {
  return (
    <header style={styles.bar}>
      <div style={styles.wordmark}>
        <span style={styles.dot} />
        <span style={styles.word}>prism</span>
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
  wordmark: { display: "flex", alignItems: "center", gap: "8px" },
  dot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "var(--sage)",
    display: "inline-block",
  },
  word: {
    fontSize: "16px",
    fontWeight: 500,
    letterSpacing: "-0.01em",
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
