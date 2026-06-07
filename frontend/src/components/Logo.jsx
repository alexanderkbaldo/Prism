import React from "react";
import logoSrc from "../assets/prism-logo.png";

// The Prism mark (rounded square) plus the wordmark. `size` controls the mark;
// pass withWordmark={false} for the icon alone.
export default function Logo({ size = 36, withWordmark = true }) {
  return (
    <span style={styles.wrap}>
      <img
        src={logoSrc}
        width={size}
        height={size}
        alt="Prism"
        style={{ ...styles.mark, borderRadius: `${Math.round(size * 0.26)}px` }}
      />
      {withWordmark && <span style={styles.word}>Prism</span>}
    </span>
  );
}

const styles = {
  wrap: { display: "inline-flex", alignItems: "center", gap: "10px" },
  mark: { display: "block", flexShrink: 0, objectFit: "cover" },
  word: {
    fontSize: "18px",
    fontWeight: 500,
    letterSpacing: "0.01em",
    color: "var(--ink)",
  },
};
