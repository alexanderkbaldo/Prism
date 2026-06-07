import React from "react";

const COMPANIES = [
  ["HOOD", "Robinhood"],
  ["AFRM", "Affirm"],
  ["XYZ", "Block"],
  ["KLAR", "Klarna"],
  ["CHYM", "Chime"],
];

export default function CompanySwitcher({ ticker, onChange }) {
  return (
    <nav className="company-tabs" style={styles.tabs}>
      {COMPANIES.map(([t, name]) => {
        const active = t === ticker;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{ ...styles.tab, ...(active ? styles.tabActive : {}) }}
          >
            <span
              style={{ ...styles.ticker, ...(active ? styles.tickerActive : {}) }}
            >
              {t}
            </span>
            <span
              style={{ ...styles.name, ...(active ? styles.nameActive : {}) }}
            >
              {name}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  tabs: { display: "flex", gap: "4px" },
  tab: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: "7px",
    transition: "color 0.15s, background 0.15s",
  },
  tabActive: {
    background: "var(--ink)",
  },
  ticker: {
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "0.04em",
    color: "var(--muted)",
  },
  name: {
    fontSize: "10px",
    letterSpacing: "0.01em",
    color: "var(--faint)",
  },
  // When active, the tab background is --ink, so flip text to light surfaces.
  tickerActive: { color: "var(--bg)" },
  nameActive: { color: "var(--sage-soft)" },
};
