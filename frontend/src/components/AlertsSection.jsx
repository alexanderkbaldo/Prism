import React from "react";
import { useAlerts } from "../hooks/useApi";

function severityStyle(severity) {
  if (!severity || severity === "low") return { color: "var(--amber)", bg: "var(--amber)18", border: "var(--amber)44" };
  if (severity === "high") return { color: "var(--red)", bg: "var(--red)18", border: "var(--red)44" };
  return { color: "var(--green)", bg: "var(--green)18", border: "var(--green)44" };
}

function formatTs(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function AlertsSection({ ticker }) {
  const { data, loading } = useAlerts(ticker);
  const alerts = data?.alerts ?? [];

  return (
    <section style={styles.section}>
      <h2 style={styles.heading}>
        <span>🚨</span> Alerts
        {alerts.length > 0 && (
          <span style={styles.countBadge}>{alerts.length}</span>
        )}
      </h2>

      {loading && !data && <p style={styles.muted}>Loading alerts…</p>}

      {!loading && alerts.length === 0 && (
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>✅</span>
          <span>No anomalies detected in the last 7 days.</span>
        </div>
      )}

      <div style={styles.list}>
        {alerts.map((a, i) => {
          const sty = severityStyle(a.severity);
          return (
            <div
              key={a.id ?? i}
              style={{
                ...styles.item,
                background: sty.bg,
                borderColor: sty.border,
              }}
            >
              <div style={styles.itemHeader}>
                <span style={{ ...styles.severityTag, color: sty.color }}>
                  ● {a.severity ?? "anomaly"}
                </span>
                <span style={styles.itemCat}>{a.category}</span>
                <span style={styles.itemTs}>{formatTs(a.created_at)}</span>
              </div>
              <p style={styles.itemMsg}>{a.message ?? a.summary_text ?? JSON.stringify(a)}</p>
              {a.z_score != null && (
                <p style={styles.zScore}>z-score: {a.z_score.toFixed(2)}σ</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const styles = {
  section: {
    background: "var(--surface)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    padding: "20px",
  },
  heading: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  countBadge: {
    background: "var(--red)",
    color: "#fff",
    borderRadius: "99px",
    padding: "0 7px",
    fontSize: "0.7rem",
    fontWeight: 700,
    lineHeight: 1.7,
  },
  muted: { color: "var(--text-muted)", fontSize: "0.85rem" },
  empty: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--text-muted)",
    fontSize: "0.85rem",
  },
  emptyIcon: { fontSize: "1.1rem" },
  list: { display: "flex", flexDirection: "column", gap: "10px" },
  item: {
    borderRadius: "8px",
    border: "1px solid",
    padding: "12px 14px",
  },
  itemHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "6px",
  },
  severityTag: {
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  itemCat: {
    fontSize: "0.72rem",
    color: "var(--text-muted)",
    background: "var(--surface2)",
    borderRadius: "4px",
    padding: "1px 6px",
  },
  itemTs: { marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-muted)" },
  itemMsg: { fontSize: "0.88rem", color: "var(--text)", lineHeight: 1.5 },
  zScore: { marginTop: "4px", fontSize: "0.75rem", color: "var(--text-muted)" },
};
