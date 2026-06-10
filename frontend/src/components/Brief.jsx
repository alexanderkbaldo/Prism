import React from "react";
import ReactMarkdown from "react-markdown";
import { useBrief } from "../hooks/useApi";
import { useVerdict } from "../hooks/useVerdict";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function stripMd(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/[*_]{1,3}/g, "") // all bold/italic markers (incl. strays)
    .replace(/\s+/g, " ")
    .trim();
}

// Pull the brief's own "bottom line" out of the body so it can lead the note
// instead of hiding at the end. Handles an inline "**Bottom line:** …" and a
// "## Bottom line" heading section. Returns the sentence + the remaining body.
function extractBottomLine(text) {
  if (!text) return { sentence: null, body: text };

  let m = text.match(/\*\*\s*bottom line\s*:?\s*\*\*\s*([\s\S]+?)\s*$/i);
  if (m) {
    return { sentence: stripMd(m[1]), body: text.slice(0, m.index).trim() };
  }
  m = text.match(/\n#{1,6}\s*bottom line\s*:?\s*\n+([\s\S]+?)\s*$/i);
  if (m) {
    return { sentence: stripMd(m[1]), body: text.slice(0, m.index).trim() };
  }
  return { sentence: null, body: text };
}

export default function Brief({ ticker }) {
  const { data, loading } = useBrief(ticker);
  const verdict = useVerdict(ticker);
  const brief = data?.brief;
  const { sentence, body } = extractBottomLine(brief?.brief_text);

  return (
    <section style={styles.section}>
      <div style={styles.head}>
        <span className="eyebrow">The brief</span>
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
          {/* Lead with the rating + bottom line, so the call is the first thing
              read rather than the last. */}
          {(verdict || sentence) && (
            <div style={styles.callout}>
              <div style={styles.calloutHead}>
                <span className="eyebrow" style={styles.calloutLabel}>Bottom line</span>
                {verdict && (
                  <span
                    style={{ ...styles.rating, color: verdict.color, borderColor: verdict.color }}
                  >
                    {verdict.label}
                  </span>
                )}
              </div>
              {sentence && <p style={styles.calloutText}>{sentence}</p>}
            </div>
          )}

          <ReactMarkdown
            components={{
              h2: ({ children }) => <h3 style={styles.h2}>{children}</h3>,
              p: ({ children }) => <p style={styles.p}>{children}</p>,
              strong: ({ children }) => <strong style={styles.strong}>{children}</strong>,
              ul: ({ children }) => <ul style={styles.ul}>{children}</ul>,
              li: ({ children }) => <li style={styles.li}>{children}</li>,
            }}
          >
            {body}
          </ReactMarkdown>
        </div>
      )}
    </section>
  );
}

const styles = {
  section: { marginTop: "8px" },
  head: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingBottom: "16px",
    borderBottom: "0.5px solid var(--hairline)",
    marginBottom: "26px",
  },
  meta: { fontSize: "11px", color: "var(--faint)" },
  muted: { color: "var(--muted)", fontSize: "15px" },
  body: { maxWidth: "640px" },
  callout: {
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "12px",
    padding: "16px 18px",
    marginBottom: "30px",
  },
  calloutHead: { display: "flex", alignItems: "center", gap: "11px" },
  calloutLabel: { color: "var(--faint)" },
  rating: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "2px 9px",
    borderRadius: "99px",
    border: "1px solid",
  },
  calloutText: {
    fontFamily: "var(--serif)",
    fontSize: "18px",
    lineHeight: 1.55,
    color: "var(--ink)",
    marginTop: "11px",
  },
  h2: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--sage)",
    marginTop: "30px",
    marginBottom: "9px",
  },
  p: {
    fontFamily: "var(--serif)",
    fontSize: "17px",
    lineHeight: 1.7,
    color: "var(--ink)",
    marginBottom: "14px",
  },
  strong: { fontWeight: 500, fontStyle: "italic" },
  ul: { listStyle: "none", padding: 0, marginBottom: "14px" },
  li: {
    fontFamily: "var(--serif)",
    fontSize: "17px",
    lineHeight: 1.7,
    color: "var(--ink)",
    paddingLeft: "18px",
    position: "relative",
  },
};
