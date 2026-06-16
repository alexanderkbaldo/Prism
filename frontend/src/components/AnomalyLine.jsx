import React, { useState } from "react";
import { useAlerts } from "../hooks/useApi";

// Source text (esp. StockTwits) arrives HTML-escaped — &#39; &amp; &quot; etc.
// Decode it for display. A detached textarea decodes entities without ever
// parsing markup into the live DOM, so it's safe (no XSS surface).
function decodeEntities(str) {
  if (!str || typeof document === "undefined") return str;
  const el = document.createElement("textarea");
  el.innerHTML = str;
  return el.value;
}

const NOTABLE_SIGMA = 2; // |deviation| at/above this reads as a real move
const SHOWN = 6; // how many to list when expanded

export default function AnomalyLine({ ticker }) {
  const { data } = useAlerts(ticker);
  const [open, setOpen] = useState(false);

  const alerts = data?.alerts ?? [];
  const count = alerts.length;

  if (count === 0) {
    return (
      <section style={styles.wrap}>
        <span className="eyebrow" style={styles.heading}>Anomaly signals</span>
        <p style={styles.summary}>
          <span style={{ ...styles.dot, background: "var(--sage)" }} />
          No unusual moves in the last seven days.
        </p>
      </section>
    );
  }

  // Most significant first, so an expanded view leads with what matters.
  const ranked = [...alerts].sort(
    (a, b) => Math.abs(b.deviation ?? 0) - Math.abs(a.deviation ?? 0)
  );
  const notable = ranked.filter((a) => Math.abs(a.deviation ?? 0) >= NOTABLE_SIGMA).length;

  const context =
    notable === 0
      ? "Most are minor swings within the normal range."
      : `${notable} notable (≥${NOTABLE_SIGMA}σ); the rest are minor swings.`;

  return (
    <section style={styles.wrap}>
      <div style={styles.head}>
        <span className="eyebrow" style={styles.heading}>Anomaly signals</span>
        <span style={styles.count}>{count} in the last 7 days</span>
      </div>

      <p style={styles.summary}>
        {context}{" "}
        <button type="button" style={styles.toggle} onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "View the largest"}
        </button>
      </p>

      {open && (
        <ul style={styles.list}>
          {ranked.slice(0, SHOWN).map((a, i) => {
            const dev = a.deviation;
            const sigma =
              dev != null ? `${dev > 0 ? "+" : ""}${Number(dev).toFixed(1)}σ` : null;
            return (
              <li key={a.id ?? i} style={styles.item}>
                {sigma && <span style={styles.sigma}>{sigma}</span>}
                <span style={styles.text}>
                  {decodeEntities(a.summary_text || a.message) ||
                    `${a.category} anomaly detected`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const styles = {
  // Deliberately quiet: a footnote-weight section, not an alarm. The synthesised
  // brief above is the headline; this is supporting context.
  wrap: {
    marginTop: "48px",
    paddingTop: "24px",
    borderTop: "0.5px solid var(--hairline)",
  },
  head: { display: "flex", alignItems: "baseline", gap: "12px" },
  heading: { color: "var(--faint)" },
  count: { fontSize: "12px", color: "var(--faint)" },
  summary: {
    fontSize: "13px",
    color: "var(--muted)",
    lineHeight: 1.5,
    marginTop: "8px",
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    flexWrap: "wrap",
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
    transform: "translateY(-1px)",
  },
  toggle: {
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontSize: "13px",
    color: "var(--sage)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  list: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "14px",
  },
  item: {
    display: "flex",
    alignItems: "baseline",
    gap: "10px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  sigma: {
    flexShrink: 0,
    fontSize: "11px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: "var(--muted)",
    minWidth: "44px",
  },
  text: { color: "var(--ink)" },
};
