import React from "react";

// A visible educational caveat (louder than the footer line). Used at the top of
// the Investments tab, where scores and backtest numbers are most likely to be
// misread as advice. `children` overrides the default text.
export default function Disclaimer({ children, style }) {
  return (
    <aside role="note" style={{ ...styles.box, ...style }}>
      <span style={styles.tag}>Educational tool</span>
      <p style={styles.text}>
        {children || (
          <>
            Prism is a student research project. The scores and backtests here
            describe alternative-data <em>signals</em>: they are not prices,
            forecasts, or recommendations, and this is <strong>not investment
            advice</strong>. Do your own research.
          </>
        )}
      </p>
    </aside>
  );
}

const styles = {
  box: {
    display: "flex",
    gap: "16px",
    alignItems: "baseline",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "10px",
    padding: "16px 20px",
  },
  tag: {
    flexShrink: 0,
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--clay)",
  },
  text: {
    margin: 0,
    fontSize: "13.5px",
    lineHeight: 1.6,
    color: "var(--muted)",
  },
};
