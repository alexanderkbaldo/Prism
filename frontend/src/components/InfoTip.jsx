import React, { useState } from "react";

// A small "i" mark that reveals a one-line explanation on hover or focus.
// Used to anchor otherwise-ambiguous numbers (what's counted, what the scale
// means) without cluttering the default view.
export default function InfoTip({ text, label }) {
  const [open, setOpen] = useState(false);

  return (
    <span style={styles.wrap}>
      <button
        type="button"
        aria-label={label ? `About ${label}` : "More information"}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        style={styles.btn}
      >
        i
      </button>
      {open && (
        <span role="tooltip" style={styles.bubble}>
          {text}
        </span>
      )}
    </span>
  );
}

const styles = {
  wrap: { position: "relative", display: "inline-flex", lineHeight: 0 },
  btn: {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    border: "0.5px solid var(--faint)",
    background: "transparent",
    color: "var(--faint)",
    fontSize: "9px",
    fontStyle: "italic",
    fontFamily: "Georgia, serif",
    lineHeight: 1,
    cursor: "help",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    position: "absolute",
    top: "calc(100% + 7px)",
    left: 0,
    width: "210px",
    maxWidth: "70vw",
    background: "var(--ink)",
    color: "var(--bg)",
    padding: "9px 11px",
    borderRadius: "8px",
    fontSize: "11.5px",
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: "0.01em",
    textTransform: "none",
    boxShadow: "0 6px 20px rgba(26,32,24,0.22)",
    zIndex: 600,
    pointerEvents: "none",
  },
};
