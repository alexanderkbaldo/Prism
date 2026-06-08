import React from "react";
import ReactMarkdown from "react-markdown";
import { useBrief } from "../hooks/useApi";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export default function Brief({ ticker }) {
  const { data, loading } = useBrief(ticker);
  const brief = data?.brief;

  return (
    <section style={styles.section}>
      <div style={styles.head}>
        <h2 style={styles.heading}>Today's research brief</h2>
        {brief && (
          <span style={styles.meta}>
            {formatDate(brief.generated_at)} · {brief.signal_count} signals
          </span>
        )}
      </div>

      {loading && !data && <p style={styles.muted}>Composing…</p>}
      {!loading && !brief && <p style={styles.muted}>No brief yet for {ticker}.</p>}

      {brief && (
        <div style={styles.body}>
          <ReactMarkdown
            components={{
              h2: ({ children }) => <h3 style={styles.h2}>{children}</h3>,
              p: ({ children }) => <p style={styles.p}>{children}</p>,
              strong: ({ children }) => <strong style={styles.strong}>{children}</strong>,
              ul: ({ children }) => <ul style={styles.ul}>{children}</ul>,
              li: ({ children }) => <li style={styles.li}>{children}</li>,
            }}
          >
            {brief.brief_text}
          </ReactMarkdown>
        </div>
      )}
    </section>
  );
}

const styles = {
  section: { marginTop: "72px" },
  head: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingBottom: "18px",
    borderBottom: "0.5px solid var(--hairline)",
    marginBottom: "36px",
  },
  heading: {
    fontFamily: "var(--serif)",
    fontSize: "26px",
    fontWeight: 400,
    letterSpacing: "-0.01em",
    color: "var(--ink)",
  },
  meta: { fontSize: "12px", color: "var(--faint)" },
  muted: { color: "var(--muted)", fontSize: "16px" },
  body: { maxWidth: "680px" },
  h2: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--sage)",
    marginTop: "38px",
    marginBottom: "11px",
  },
  p: {
    fontFamily: "var(--serif)",
    fontSize: "19px",
    lineHeight: 1.78,
    color: "var(--ink)",
    marginBottom: "18px",
  },
  strong: { fontWeight: 500, fontStyle: "italic" },
  ul: { listStyle: "none", padding: 0, marginBottom: "18px" },
  li: {
    fontFamily: "var(--serif)",
    fontSize: "19px",
    lineHeight: 1.78,
    color: "var(--ink)",
    paddingLeft: "18px",
    position: "relative",
  },
};
