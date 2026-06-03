import React from "react";

const TICKERS = ["HOOD", "AFRM", "XYZ", "KLAR", "CHYM"];

export default function CompanySwitcher({ ticker, onChange }) {
  return (
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
  );
}

const styles = {
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
