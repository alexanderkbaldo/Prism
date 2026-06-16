import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { useBrief, useSeries, useSignals } from "../hooks/useApi";
import { useVerdict } from "../hooks/useVerdict";
import { extractBottomLine, parseSections } from "../utils/brief";

// Source text can arrive HTML-escaped (&#39; etc.); decode safely via a
// detached textarea (no live-DOM markup parsing).
function decodeEntities(str) {
  if (!str || typeof document === "undefined") return str;
  const el = document.createElement("textarea");
  el.innerHTML = str;
  return el.value;
}

// Palette (hex — recharts sets SVG attributes which don't resolve CSS vars).
const C = { sage: "#6B8F71", ink: "#1A2018", hairline: "#CBBDA8", faint: "#8A7D6B", bg: "#E7DCCB" };

// ---- data helpers -----------------------------------------------------------

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function weekAgg(points, from, to) {
  let count = 0, sentW = 0, sentN = 0, intSum = 0, intN = 0;
  for (const p of points || []) {
    if (p.day < from || p.day > to) continue;
    const c = p.count || 0;
    count += c;
    if (p.avg_sentiment != null) { sentW += p.avg_sentiment * (c || 1); sentN += c || 1; }
    if (p.avg_interest != null) { intSum += p.avg_interest; intN += 1; }
  }
  return {
    count,
    sentiment: sentN ? sentW / sentN : null,
    interest: intN ? intSum / intN : null,
  };
}

function metricsFor(series, key) {
  const cur = weekAgg(series[key], isoDaysAgo(6), isoDaysAgo(0));
  const prior = weekAgg(series[key], isoDaysAgo(13), isoDaysAgo(7));
  const month = weekAgg(series[key], isoDaysAgo(29), isoDaysAgo(0));
  const score = cur.sentiment != null ? Math.round(((cur.sentiment + 1) / 2) * 100) : null;
  return {
    count: cur.count,
    score,
    delta: cur.count - prior.count,
    interest: cur.interest,
    interestDelta: cur.interest != null && prior.interest != null ? cur.interest - prior.interest : 0,
    baselineInterest: month.interest, // 30-day average, the anchor for "is 59 high?"
  };
}

// ---- plain-English takeaways (the simple, Maya-facing layer) -----------------

function takeaway(key, m) {
  switch (key) {
    case "sentiment": {
      if (m.count === 0) return { line: "Quiet week — little social chatter.", stat: "0 mentions" };
      const tone = m.score >= 60 ? "mostly positive" : m.score != null && m.score < 40 ? "mostly negative" : "mixed";
      return { line: `Social chatter is ${tone}.`, stat: `${m.count} mentions · ${m.score ?? "–"}/100` };
    }
    case "hiring": {
      if (m.count === 0) return { line: "No new job postings this week.", stat: "0 postings" };
      const trend = m.delta > 0 ? "picking up" : m.delta < 0 ? "slowing down" : "holding steady";
      return { line: `Hiring is ${trend}.`, stat: `${m.count} new postings` };
    }
    case "trends": {
      if (m.interest == null) return { line: "Not many people are searching for the company.", stat: "–" };
      const base = m.baselineInterest;
      let level;
      if (base != null) {
        level = m.interest > base * 1.15 ? "running above its usual level"
          : m.interest < base * 0.85 ? "running below its usual level"
          : "in line with its usual level";
      } else {
        level = m.interest >= 66 ? "high" : m.interest >= 33 ? "moderate" : "low";
      }
      const move = m.interestDelta > 3 ? ", and rising" : m.interestDelta < -3 ? ", and easing" : "";
      const stat = base != null
        ? `${Math.round(m.interest)} of 100 · its 30-day norm is ${Math.round(base)}`
        : `${Math.round(m.interest)} of 100`;
      return { line: `Search attention is ${level}${move}.`, stat };
    }
    case "reviews": {
      if (m.count === 0) return { line: "No new app reviews this week.", stat: "0 reviews" };
      const tone = m.score >= 60 ? "mostly positive" : m.score != null && m.score < 40 ? "mostly negative" : "mixed";
      return { line: `App reviews are ${tone}.`, stat: `${m.count} reviews · ${m.score ?? "–"}/100` };
    }
    case "filings": {
      if (m.count === 0) return { line: "No new SEC filings.", stat: "0 filings" };
      return { line: `${m.count} new SEC filing${m.count === 1 ? "" : "s"} — worth a look.`, stat: `${m.count} filing${m.count === 1 ? "" : "s"}` };
    }
    default:
      return { line: "", stat: "" };
  }
}

const SIGNALS = [
  { key: "sentiment", title: "Social sentiment", field: "avg_sentiment", domain: [-1, 1], unit: "",
    note: "What people are saying about the company on Reddit and StockTwits." },
  { key: "hiring", title: "Hiring", field: "count", domain: [0, "auto"], unit: " postings",
    note: "New job postings — a read on where the company is investing." },
  { key: "trends", title: "Search interest", field: "avg_interest", domain: [0, 100], unit: "/100",
    note: "How much people are Googling the company. The 0–100 index is relative to its own recent peak — so it shows attention rising or fading, not a head count." },
  { key: "reviews", title: "App reviews", field: "avg_sentiment", domain: [-1, 1], unit: "",
    note: "What users are saying in new App Store and Google Play reviews." },
  { key: "filings", title: "SEC filings", field: null, domain: null, unit: "",
    note: "New regulatory documents filed with the SEC (10-K, 10-Q, 8-K, S-1)." },
];

// ---- chart ------------------------------------------------------------------

function fmtDay(d) {
  const [, m, day] = d.split("-");
  return `${parseInt(m, 10)}/${parseInt(day, 10)}`;
}

function MiniChart({ points, field, domain, unit }) {
  const data = (points || [])
    .map((p) => ({ day: fmtDay(p.day), value: p[field] }))
    .filter((p) => p.value != null);

  if (data.length < 3) {
    return (
      <div style={styles.chartEmpty}>
        {data.length === 0 ? "No data in the last 30 days." : `Building history — ${data.length} day${data.length === 1 ? "" : "s"} so far.`}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={150}>
      <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -4 }}>
        <CartesianGrid stroke={C.hairline} strokeDasharray="2 3" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.faint }} tickLine={false}
          axisLine={{ stroke: C.hairline }} minTickGap={24} />
        <YAxis domain={domain} tick={{ fontSize: 10, fill: C.faint }} tickLine={false}
          axisLine={false} width={44} />
        <Tooltip
          cursor={{ stroke: C.hairline }}
          contentStyle={{ background: C.bg, border: `0.5px solid ${C.hairline}`, borderRadius: 8, fontSize: 12, color: C.ink }}
          labelStyle={{ color: C.faint, fontSize: 11 }}
          formatter={(v) => [`${typeof v === "number" ? v.toFixed(2).replace(/\.00$/, "") : v}${unit}`, undefined]}
        />
        <Line type="monotone" dataKey="value" stroke={C.sage} strokeWidth={1.6} dot={false}
          activeDot={{ r: 3.5, fill: C.sage, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---- section ----------------------------------------------------------------

function FilingsList({ items }) {
  if (!items || items.length === 0) {
    return <div style={styles.chartEmpty}>No new filings this week.</div>;
  }
  return (
    <ul style={styles.filings}>
      {items.slice(0, 5).map((f, i) => {
        // Trim the normaliser's redundant trailing "(… filed …)" parenthetical.
        const text = (decodeEntities(f.summary_text || f.title) || "SEC filing")
          .replace(/\s*\([^)]*\bfiled\b[^)]*\)\s*$/i, "");
        return (
          <li key={f.id ?? i} style={styles.filingItem}>
            <span style={styles.filingDot} />
            {text}
          </li>
        );
      })}
    </ul>
  );
}

function Section({ signal, metrics, points, prose, filings }) {
  const [open, setOpen] = useState(false);
  // Filings count comes from the same list shown on the right, so the headline
  // and the list never disagree.
  const t =
    signal.key === "filings"
      ? takeaway("filings", { count: filings ? filings.length : 0 })
      : takeaway(signal.key, metrics);

  return (
    <div className="signal-row" style={styles.row}>
      <div style={styles.left}>
        <span className="eyebrow" style={styles.sectionLabel}>{signal.title}</span>
        <p style={styles.takeaway}>{t.line}</p>
        <span style={styles.stat}>{t.stat}</span>
        {signal.note && <span style={styles.note}>{signal.note}</span>}
        {prose && (
          <>
            <button type="button" style={styles.toggle} onClick={() => setOpen((o) => !o)}>
              {open ? "Hide analyst note" : "Read the analyst note"}
            </button>
            {open && (
              <div style={styles.prose}>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={styles.proseP}>{children}</p>,
                    strong: ({ children }) => <strong style={styles.proseStrong}>{children}</strong>,
                  }}
                >
                  {prose}
                </ReactMarkdown>
              </div>
            )}
          </>
        )}
      </div>

      <div style={styles.right}>
        {signal.key === "filings" ? (
          <FilingsList items={filings} />
        ) : (
          <MiniChart points={points} field={signal.field} domain={signal.domain} unit={signal.unit} />
        )}
      </div>
    </div>
  );
}

// ---- main -------------------------------------------------------------------

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function SignalReport({ ticker }) {
  const { data: briefData } = useBrief(ticker);
  const { data: seriesData } = useSeries(ticker, 30);
  const { data: signalData } = useSignals(ticker, 7, "filings");
  const verdict = useVerdict(ticker);

  const brief = briefData?.brief;
  const series = seriesData?.series || {};
  const filings = signalData?.signals || [];
  const { sentence } = extractBottomLine(brief?.brief_text);
  const sections = parseSections(extractBottomLine(brief?.brief_text).body);

  return (
    <section style={styles.section}>
      <div style={styles.head}>
        <span className="eyebrow">The read</span>
        {brief && (
          <span style={styles.meta}>
            {formatDate(brief.generated_at)} · {brief.signal_count} signals
          </span>
        )}
      </div>

      {/* Plain-English bottom line up top. */}
      {(verdict || sentence) && (
        <div style={styles.callout}>
          <div style={styles.calloutHead}>
            <span className="eyebrow" style={styles.calloutLabel}>Bottom line</span>
            {verdict && (
              <span style={{ ...styles.rating, color: verdict.color, borderColor: verdict.color }}>
                {verdict.label}
              </span>
            )}
          </div>
          {sentence && <p style={styles.calloutText}>{sentence}</p>}
        </div>
      )}

      {SIGNALS.map((signal) => (
        <Section
          key={signal.key}
          signal={signal}
          metrics={metricsFor(series, signal.key)}
          points={series[signal.key]}
          prose={sections[signal.key]}
          filings={filings}
        />
      ))}
    </section>
  );
}

const styles = {
  // The elevated product panel — the reason you came to the page. A paper card
  // that lifts off the canvas with a whisper-soft shadow.
  section: {
    background: "var(--paper-raised)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "12px",
    boxShadow: "var(--shadow-card)",
    padding: "36px 40px 8px",
  },
  head: {
    display: "flex", alignItems: "baseline", justifyContent: "space-between",
    paddingBottom: "16px", borderBottom: "0.5px solid var(--hairline)",
  },
  meta: { fontSize: "11px", color: "var(--faint)" },
  callout: {
    background: "var(--surface)", border: "0.5px solid var(--hairline)",
    borderRadius: "10px", padding: "20px 22px", margin: "28px 0 8px",
  },
  calloutHead: { display: "flex", alignItems: "center", gap: "11px" },
  calloutLabel: { color: "var(--faint)" },
  rating: {
    fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
    padding: "2px 9px", borderRadius: "99px", border: "1px solid",
  },
  calloutText: { fontFamily: "var(--serif)", fontSize: "18px", lineHeight: 1.55, color: "var(--ink)", marginTop: "11px" },

  row: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: "32px",
    alignItems: "center",
    padding: "26px 0",
    borderBottom: "0.5px solid var(--hairline)",
  },
  left: { display: "flex", flexDirection: "column" },
  sectionLabel: { color: "var(--sage)", marginBottom: "10px" },
  takeaway: {
    fontFamily: "var(--serif)", fontSize: "21px", lineHeight: 1.35, fontWeight: 400,
    color: "var(--ink)", letterSpacing: "-0.01em", margin: 0,
  },
  stat: { fontSize: "13px", color: "var(--muted)", marginTop: "8px", letterSpacing: "0.01em" },
  note: { fontSize: "12px", color: "var(--faint)", lineHeight: 1.5, marginTop: "10px", maxWidth: "420px" },
  toggle: {
    alignSelf: "flex-start", marginTop: "14px", background: "transparent", border: "none",
    padding: 0, cursor: "pointer", fontSize: "12px", color: "var(--sage)",
    textDecoration: "underline", textUnderlineOffset: "2px",
  },
  prose: { marginTop: "10px", maxWidth: "440px" },
  proseP: { fontFamily: "var(--serif)", fontSize: "15px", lineHeight: 1.6, color: "var(--muted)", marginBottom: "10px" },
  proseStrong: { fontWeight: 500, fontStyle: "italic", color: "var(--ink)" },

  right: { minWidth: 0 },
  chartEmpty: {
    height: "150px", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "13px", color: "var(--faint)", background: "var(--surface)",
    border: "0.5px solid var(--hairline)", borderRadius: "8px",
  },
  filings: {
    listStyle: "none", margin: 0, padding: "16px 18px",
    background: "var(--surface)", border: "0.5px solid var(--hairline)", borderRadius: "8px",
    display: "flex", flexDirection: "column", gap: "12px",
  },
  filingItem: {
    display: "flex", alignItems: "baseline", gap: "10px",
    fontSize: "13.5px", lineHeight: 1.5, color: "var(--ink)",
  },
  filingDot: {
    width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
    background: "var(--sage)", transform: "translateY(-1px)",
  },
};
