import React from "react";

export default function Footer() {
  return (
    <footer style={styles.footer}>
      Prism — a University of Michigan student project. For research and
      educational purposes only; not investment advice.
    </footer>
  );
}

const styles = {
  footer: {
    marginTop: "96px",
    paddingTop: "22px",
    borderTop: "0.5px solid var(--hairline)",
    fontSize: "11.5px",
    color: "var(--faint)",
    lineHeight: 1.5,
  },
};
