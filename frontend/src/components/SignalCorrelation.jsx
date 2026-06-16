import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useCorrelation } from "../hooks/useApi";
import { EASE } from "../anim";

const DIR = {
  bullish: { color: "var(--up)", arrow: "↑", word: "Up" },
  bearish: { color: "var(--down)", arrow: "↓", word: "Down" },
  neutral: { color: "var(--faint)", arrow: "·", word: "Flat" },
};

export default function SignalCorrelation({ ticker }) {
  const { data } = useCorrelation(ticker);
  const reduce = useReducedMotion();
  if (!data) return null;

  const { insight, aligned, signals = [] } = data;
  const headColor =
    aligned?.direction === "bullish"
      ? "var(--up)"
      : aligned?.direction === "bearish"
      ? "var(--down)"
      : "var(--muted)";

  return (
    <section style={styles.card}>
      <span className="eyebrow" style={styles.eyebrow}>Do the signals agree?</span>
      <p style={{ ...styles.insight, color: headColor }}>{insight}</p>
      <p style={styles.note}>
        When several signals move the same way, it's a stronger read than any one alone.
      </p>

      {signals.length > 0 && (
        <motion.div
          style={styles.row}
          variants={reduce ? undefined : { show: { transition: { staggerChildren: 0.08 } } }}
          initial={reduce ? false : "hidden"}
          whileInView={reduce ? undefined : "show"}
          viewport={{ once: true, amount: 0.4 }}
        >
          {signals.map((s) => {
            const d = DIR[s.direction] || DIR.neutral;
            return (
              <motion.div
                key={s.category}
                style={styles.chip}
                title={s.detail}
                variants={
                  reduce
                    ? undefined
                    : {
                        hidden: { opacity: 0, x: -12 },
                        show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE } },
                      }
                }
              >
                <span style={styles.chipLabel}>{s.label}</span>
                <span style={{ ...styles.chipDir, color: d.color }}>
                  {d.arrow} {d.word}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </section>
  );
}

const styles = {
  card: {
    marginTop: "40px",
    padding: "28px 32px",
    background: "var(--paper)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "10px",
    boxShadow: "var(--shadow-card)",
  },
  eyebrow: { color: "var(--faint)" },
  insight: {
    fontFamily: "var(--serif)",
    fontSize: "20px",
    fontStyle: "italic",
    fontWeight: 400,
    lineHeight: 1.4,
    margin: "12px 0 0",
  },
  note: { fontSize: "12px", color: "var(--faint)", lineHeight: 1.5, margin: "8px 0 0" },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "18px",
  },
  chip: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    padding: "8px 13px",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "8px",
  },
  chipLabel: {
    fontSize: "10px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--faint)",
  },
  chipDir: { fontSize: "13px", fontWeight: 500 },
};
