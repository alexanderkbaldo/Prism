import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Footer from "../components/Footer";
import { useSeries, useBrief } from "../hooks/useApi";
import { useVerdict } from "../hooks/useVerdict";
import { computeStats, statsSummary } from "../utils/stats";
import { extractBottomLine, extractRead } from "../utils/brief";
import { apiUrl } from "../api";
import { EASE } from "../anim";

const COMPANIES = [
  ["HOOD", "Robinhood"],
  ["AFRM", "Affirm"],
  ["XYZ", "Block"],
  ["KLAR", "Klarna"],
  ["CHYM", "Chime"],
];
const NAME = Object.fromEntries(COMPANIES);

function verdictRead(v) {
  if (!v) return { label: "—", color: "var(--faint)" };
  if (v.score >= 1) return { label: "Looking positive", color: "var(--up)" };
  if (v.score <= -1) return { label: "Looking negative", color: "var(--down)" };
  return { label: "Mixed signals", color: "var(--muted)" };
}

function twoSentences(text) {
  if (!text) return null;
  const m = text.match(/^(\s*\S[\s\S]*?[.?!])(\s+\S[\s\S]*?[.?!])?/);
  return m ? (m[0]).trim() : text;
}

function Selector({ value, exclude, onChange }) {
  return (
    <select className="cmp-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {COMPANIES.map(([t, name]) => (
        <option key={t} value={t} disabled={t === exclude}>
          {name} · {t}
        </option>
      ))}
    </select>
  );
}

function Column({ side, ticker, exclude, onChange, winners }) {
  const { data: seriesData } = useSeries(ticker, 14);
  const { data: briefData } = useBrief(ticker);
  const verdict = useVerdict(ticker);

  const stats = computeStats(seriesData?.series);
  const v = verdictRead(verdict);
  const bl = extractBottomLine(briefData?.brief?.brief_text);
  const excerpt = twoSentences(bl.sentence || extractRead(briefData?.brief?.brief_text));

  return (
    <div style={styles.col}>
      <Selector value={ticker} exclude={exclude} onChange={onChange} />

      <div style={styles.colHead}>
        <h2 style={styles.colName}>{NAME[ticker]}</h2>
        <span style={styles.colTicker}>{ticker}</span>
      </div>

      <div style={styles.verdict}>
        <span style={{ ...styles.dot, background: v.color }} />
        <span style={{ ...styles.verdictLabel, color: v.color }}>{v.label}</span>
      </div>

      <div style={styles.stats}>
        {stats.map((s) => {
          const wins = winners[s.key] === side;
          return (
            <div key={s.key} style={styles.statRow}>
              <span style={styles.statLabel}>{s.label}</span>
              <span style={styles.statValueWrap}>
                {wins && <span style={styles.arrow} aria-label="stronger">↑</span>}
                <span style={{ ...styles.statValue, ...(wins ? styles.statValueWin : {}) }}>
                  {s.display}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {excerpt && (
        <p style={styles.excerpt}>{excerpt}</p>
      )}
    </div>
  );
}

function ComparisonCard({ left, right }) {
  const leftSeries = useSeries(left, 14);
  const rightSeries = useSeries(right, 14);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const abortRef = useRef(null);
  const reduce = useReducedMotion();

  const leftReady = !!leftSeries.data;
  const rightReady = !!rightSeries.data;

  useEffect(() => {
    if (!leftReady || !rightReady) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setText("");
    setLoading(true);

    const lName = NAME[left];
    const rName = NAME[right];
    const lStats = computeStats(leftSeries.data?.series);
    const rStats = computeStats(rightSeries.data?.series);
    const question =
      `In 1-2 sentences, compare ${lName} and ${rName} using this week's ` +
      `alternative-data signals. Say which looks stronger and why, citing ` +
      `specific signals.\n\n${statsSummary(lName, lStats)}\n` +
      `${statsSummary(rName, rStats)}\n\nBe concise and concrete.`;

    (async () => {
      try {
        const res = await fetch(apiUrl("/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, company: left, history: [] }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          setText((t) => t + decoder.decode(value, { stream: true }));
          setLoading(false);
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          setText(
            `${NAME[left]} and ${NAME[right]} are both tracked across five ` +
            `alternative-data signals — pick a side above to see the live read.`
          );
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [left, right, leftReady, rightReady]);

  const inner = (
    <div style={styles.aiCard}>
      <span style={styles.aiLabel}>The comparison</span>
      <p style={styles.aiText}>
        {loading && !text ? (
          <span style={styles.aiLoading}>Comparing {NAME[left]} and {NAME[right]}…</span>
        ) : (
          text
        )}
      </p>
    </div>
  );

  if (reduce) return inner;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
    >
      {inner}
    </motion.div>
  );
}

export default function Compare() {
  const [left, setLeft] = useState("HOOD");
  const [right, setRight] = useState("AFRM");
  const reduce = useReducedMotion();

  // The two sides can never be the same company.
  function pickLeft(t) {
    setLeft(t);
    if (t === right) setRight(COMPANIES.find(([c]) => c !== t)[0]);
  }
  function pickRight(t) {
    setRight(t);
    if (t === left) setLeft(COMPANIES.find(([c]) => c !== t)[0]);
  }

  // Decide the stronger side per signal.
  const leftStats = computeStats(useSeries(left, 14).data?.series);
  const rightStats = computeStats(useSeries(right, 14).data?.series);
  const winners = {};
  leftStats.forEach((ls, i) => {
    const rs = rightStats[i];
    const lv = ls.value == null ? -Infinity : ls.value;
    const rv = rs.value == null ? -Infinity : rs.value;
    winners[ls.key] = lv === rv ? null : lv > rv ? "left" : "right";
  });

  const slide = (dir) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, x: dir * 40 },
          animate: { opacity: 1, x: 0 },
          transition: { duration: 0.6, ease: EASE },
        };

  return (
    <div className="page" style={styles.column}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Compare</span>
        <h1 style={styles.title}>Two companies, side by side</h1>
        <p style={styles.lede}>
          A scannable read on how any two of the tracked fintechs stack up across
          this week's alternative-data signals.
        </p>
      </div>

      <ComparisonCard left={left} right={right} />

      <div className="cmp-grid" style={styles.grid}>
        <motion.div {...slide(-1)}>
          <Column side="left" ticker={left} exclude={right} onChange={pickLeft} winners={winners} />
        </motion.div>
        <div style={styles.divider} />
        <motion.div {...slide(1)}>
          <Column side="right" ticker={right} exclude={left} onChange={pickRight} winners={winners} />
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}

const styles = {
  column: { maxWidth: "1100px", margin: "0 auto", padding: "0 40px 80px" },
  header: { paddingTop: "56px", maxWidth: "640px" },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--sage)",
  },
  title: {
    fontFamily: "var(--serif)",
    fontSize: "40px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
    lineHeight: 1.08,
    marginTop: "14px",
  },
  lede: {
    fontSize: "16px",
    lineHeight: 1.6,
    color: "var(--muted)",
    marginTop: "16px",
  },

  // AI comparison card
  aiCard: {
    background: "var(--ink)",
    color: "var(--bg)",
    borderRadius: "16px",
    padding: "32px 36px",
    marginTop: "40px",
    boxShadow: "0 20px 50px rgba(26, 32, 24, 0.22)",
  },
  aiLabel: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--sage-soft)",
  },
  aiText: {
    fontFamily: "var(--serif)",
    fontSize: "22px",
    lineHeight: 1.5,
    color: "var(--bg)",
    marginTop: "14px",
    minHeight: "1.5em",
  },
  aiLoading: { color: "rgba(231, 220, 203, 0.6)", fontStyle: "italic" },

  // Two-column grid
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1px 1fr",
    gap: "40px",
    marginTop: "56px",
    alignItems: "start",
  },
  divider: { background: "var(--hairline)", alignSelf: "stretch" },
  col: { minWidth: 0 },

  colHead: { display: "flex", alignItems: "baseline", gap: "12px", marginTop: "22px" },
  colName: {
    fontFamily: "var(--serif)",
    fontSize: "30px",
    fontWeight: 400,
    letterSpacing: "-0.01em",
    color: "var(--ink)",
  },
  colTicker: { fontSize: "12px", letterSpacing: "0.08em", color: "var(--faint)" },

  verdict: { display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" },
  dot: { width: "9px", height: "9px", borderRadius: "50%", flexShrink: 0 },
  verdictLabel: {
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },

  stats: { marginTop: "24px" },
  statRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: "14px 0",
    borderBottom: "0.5px solid var(--hairline)",
  },
  statLabel: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--faint)",
  },
  statValueWrap: { display: "inline-flex", alignItems: "baseline", gap: "7px" },
  arrow: { color: "var(--sage)", fontSize: "13px", fontWeight: 600 },
  statValue: {
    fontFamily: "var(--serif)",
    fontSize: "24px",
    color: "var(--muted)",
    letterSpacing: "-0.01em",
  },
  statValueWin: { color: "var(--ink)" },

  excerpt: {
    fontFamily: "var(--serif)",
    fontSize: "16px",
    fontStyle: "italic",
    lineHeight: 1.55,
    color: "var(--muted)",
    marginTop: "26px",
  },
};
