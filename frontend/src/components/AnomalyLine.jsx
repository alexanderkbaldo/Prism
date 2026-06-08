import React from "react";
import { useAlerts } from "../hooks/useApi";

export default function AnomalyLine({ ticker }) {
  const { data } = useAlerts(ticker);
  const alerts = data?.alerts ?? [];
  const count = alerts.length;

  // Zero anomalies — collapse to a single quiet line, no card.
  if (count === 0) {
    return (
      <p style={styles.quiet}>
        <span style={{ ...styles.dot, background: "var(--sage)" }} />
        No anomalies in the last seven days.
      </p>
    );
  }

  return (
    <section style={styles.card}>
      <div style={styles.head}>
        <span className="eyebrow">Recent anomalies</span>
        <span style={{ ...styles.badge, ...styles.badgeActive }}>{count}</span>
      </div>

      <ul style={styles.list}>
        {alerts.slice(0, 4).map((a, i) => (
          <li key={a.id ?? i} style={styles.item}>
            <span style={{ ...styles.dot, background: "var(--alert)" }} />
            <span style={styles.text}>
              {a.summary_text || a.message || `${a.category} anomaly detected`}
            </span>
          </li>
        ))}
        {count > 4 && (
          <li style={styles.more}>+ {count - 4} more in the last seven days</li>
        )}
      </ul>
    </section>
  );
}

const styles = {
  card: {
    marginTop: "30px",
    padding: "20px 24px",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "14px",
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
  },
  badge: {
    minWidth: "22px",
    height: "20px",
    padding: "0 7px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "99px",
    fontSize: "11px",
    fontWeight: 500,
    background: "var(--hairline)",
    color: "var(--muted)",
  },
  badgeActive: {
    background: "var(--alert)",
    color: "#fff",
  },
  quiet: {
    marginTop: "30px",
    display: "flex",
    alignItems: "baseline",
    gap: "9px",
    fontSize: "13px",
    color: "var(--faint)",
  },
  list: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "11px",
  },
  item: {
    display: "flex",
    alignItems: "baseline",
    gap: "9px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
    transform: "translateY(-1px)",
  },
  text: { color: "var(--ink)" },
  more: {
    fontSize: "12px",
    color: "var(--faint)",
    paddingLeft: "15px",
  },
};
