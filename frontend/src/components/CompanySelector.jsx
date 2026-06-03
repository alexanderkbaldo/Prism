import React from "react";

const COMPANIES = [
  { ticker: "HOOD", name: "Robinhood" },
  { ticker: "AFRM", name: "Affirm" },
  { ticker: "XYZ",  name: "Block" },
  { ticker: "KLAR", name: "Klarna" },
  { ticker: "CHYM", name: "Chime" },
];

export default function CompanySelector({ selected, onChange }) {
  return (
    <div style={styles.wrap}>
      {COMPANIES.map((c) => {
        const active = selected === c.ticker;
        return (
          <button
            key={c.ticker}
            onClick={() => onChange(c.ticker)}
            style={{ ...styles.btn, ...(active ? styles.active : {}) }}
          >
            <span style={styles.ticker}>{c.ticker}</span>
            <span style={styles.name}>{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  btn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    padding: "10px 18px",
    borderRadius: "var(--radius)",
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    cursor: "pointer",
    transition: "all 0.15s",
    color: "var(--text-muted)",
  },
  active: {
    borderColor: "var(--teal)",
    background: "var(--teal-light)",
    color: "var(--teal-dark)",
  },
  ticker: {
    fontWeight: 700,
    fontSize: "0.95rem",
    letterSpacing: "0.04em",
  },
  name: {
    fontSize: "0.72rem",
    opacity: 0.8,
  },
};
