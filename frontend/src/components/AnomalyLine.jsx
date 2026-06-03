import React from "react";
import { useAlerts } from "../hooks/useApi";

export default function AnomalyLine({ ticker }) {
  const { data } = useAlerts(ticker);
  const alerts = data?.alerts ?? [];

  if (alerts.length === 0) {
    return (
      <p style={styles.line}>
        <span style={{ ...styles.dot, background: "var(--sage)" }} />
        <span style={styles.quiet}>No anomalies in the last seven days.</span>
      </p>
    );
  }

  const latest = alerts[0];
  const message =
    latest.summary_text || latest.message || `${latest.category} anomaly detected`;

  return (
    <p style={styles.line}>
      <span style={{ ...styles.dot, background: "var(--alert)" }} />
      <span style={styles.text}>{message}</span>
      {alerts.length > 1 && (
        <span style={styles.quiet}>&nbsp;· {alerts.length - 1} more</span>
      )}
    </p>
  );
}

const styles = {
  line: {
    display: "flex",
    alignItems: "baseline",
    gap: "9px",
    fontSize: "13px",
    margin: "30px 0 0",
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
    transform: "translateY(-1px)",
  },
  text: { color: "var(--ink)" },
  quiet: { color: "var(--faint)" },
};
