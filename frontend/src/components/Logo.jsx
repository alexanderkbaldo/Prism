import React from "react";

// The swirl mark: a sage rounded square with a continuous sand spiral.
// `size` controls the rendered square; the path lives in a 52-unit viewBox.
export default function Logo({ size = 36, withWordmark = true }) {
  return (
    <span style={styles.wrap}>
      <svg width={size} height={size} viewBox="0 0 52 52" style={styles.svg} aria-hidden="true">
        <rect x="0" y="0" width="52" height="52" rx="13" fill="var(--sage)" />
        <path
          d="M26 6 C39 6 47 15 46 26 C45 37 36 44 26 43 C16 43 9 34 10 26 C11 17 18 11 25 11 C32 11 37 17 37 24 C37 31 32 35 26 35 C20 35 17 30 18 26 C19 22 23 20 26 21 C29 22 30 26 28 28"
          fill="none"
          stroke="var(--bg)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {withWordmark && <span style={styles.word}>Prism</span>}
    </span>
  );
}

const styles = {
  wrap: { display: "inline-flex", alignItems: "center", gap: "10px" },
  svg: { display: "block", flexShrink: 0 },
  word: {
    fontSize: "18px",
    fontWeight: 500,
    letterSpacing: "0.01em",
    color: "var(--ink)",
  },
};
