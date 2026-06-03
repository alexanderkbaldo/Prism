import React from "react";
import ReactMarkdown from "react-markdown";
import { useBrief } from "../hooks/useApi";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function ResearchBrief({ ticker }) {
  const { data, loading, error } = useBrief(ticker);
  const brief = data?.brief;

  return (
    <section style={styles.section}>
      <h2 style={styles.heading}>
        <span>🧠</span> Daily Research Brief
        {data?.source === "mock" && <span style={styles.mockBadge}>mock data</span>}
      </h2>

      {loading && !data && <p style={styles.muted}>Generating brief…</p>}
      {error && <p style={styles.error}>Failed to load brief.</p>}

      {!loading && !brief && (
        <p style={styles.muted}>No research brief available yet for {ticker}.</p>
      )}

      {brief && (
        <div>
          <div style={styles.meta}>
            <span style={styles.metaItem}>
              <span style={styles.metaLabel}>Company</span>
              {brief.company} ({brief.ticker})
            </span>
            <span style={styles.metaItem}>
              <span style={styles.metaLabel}>Generated</span>
              {formatDate(brief.generated_at)}
            </span>
            <span style={styles.metaItem}>
              <span style={styles.metaLabel}>Model</span>
              {brief.model}
            </span>
            <span style={styles.metaItem}>
              <span style={styles.metaLabel}>Signals used</span>
              {brief.signal_count}
            </span>
          </div>

          <div style={styles.briefBody}>
            <ReactMarkdown
              components={{
                h2: ({ children }) => <h3 style={styles.mdH2}>{children}</h3>,
                p:  ({ children }) => <p style={styles.mdP}>{children}</p>,
                strong: ({ children }) => <strong style={styles.mdStrong}>{children}</strong>,
                ul: ({ children }) => <ul style={styles.mdUl}>{children}</ul>,
                li: ({ children }) => <li style={styles.mdLi}>{children}</li>,
              }}
            >
              {brief.brief_text}
            </ReactMarkdown>
          </div>
        </div>
      )}
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
  mockBadge: {
    marginLeft: "auto",
    fontSize: "0.7rem",
    background: "var(--amber)22",
    color: "var(--amber)",
    border: "1px solid var(--amber)44",
    borderRadius: "99px",
    padding: "2px 8px",
    fontWeight: 500,
  },
  muted: { color: "var(--text-muted)", fontSize: "0.85rem" },
  error: { color: "var(--red)", fontSize: "0.85rem" },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "20px",
  },
  metaItem: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "0.78rem",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "4px 10px",
    color: "var(--text)",
  },
  metaLabel: {
    color: "var(--text-muted)",
    marginRight: "2px",
  },
  briefBody: {
    borderLeft: "3px solid var(--teal)",
    paddingLeft: "16px",
  },
  mdH2: {
    fontSize: "0.92rem",
    fontWeight: 700,
    color: "var(--teal)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginTop: "18px",
    marginBottom: "6px",
  },
  mdP: {
    fontSize: "0.9rem",
    color: "var(--text)",
    lineHeight: 1.65,
    marginBottom: "10px",
  },
  mdStrong: {
    color: "var(--text)",
    fontWeight: 700,
  },
  mdUl: {
    paddingLeft: "18px",
    marginBottom: "10px",
  },
  mdLi: {
    fontSize: "0.9rem",
    color: "var(--text)",
    lineHeight: 1.6,
    marginBottom: "4px",
  },
};
