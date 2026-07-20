import React from "react";
import { Link, NavLink } from "react-router-dom";
import Logo from "./Logo";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/dashboard", label: "Dashboard", end: false },
  { to: "/investments", label: "Investments", end: false },
  { to: "/agent", label: "Agent", end: false },
  { to: "/guide", label: "Guide", end: false },
  // TEMPORARILY DISABLED - re-enable once AI backend is stable.
  // The Compare page is hidden from the nav; the /compare route redirects to
  // /dashboard (see App.jsx). Restore this line to bring it back.
  // { to: "/compare", label: "Compare", end: false },
  { to: "/about", label: "About", end: false },
];

export default function NavBar() {
  return (
    <header style={styles.bar}>
      <div className="nav-inner" style={styles.inner}>
        <Link to="/" style={styles.brand}>
          <Logo />
        </Link>

        <nav className="nav-links" style={styles.links}>
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              style={({ isActive }) => ({
                ...styles.link,
                ...(isActive ? styles.linkActive : {}),
              })}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

const styles = {
  bar: {
    borderBottom: "0.5px solid var(--hairline)",
    position: "sticky",
    top: 0,
    background: "var(--bg)",
    zIndex: 500,
  },
  inner: {
    maxWidth: "1440px",
    margin: "0 auto",
    padding: "18px 56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { textDecoration: "none" },
  links: { display: "flex", gap: "6px" },
  link: {
    textDecoration: "none",
    fontSize: "13px",
    color: "var(--muted)",
    padding: "6px 13px",
    borderRadius: "6px",
    transition: "color 0.15s, background 0.15s",
  },
  linkActive: {
    color: "var(--ink)",
    background: "var(--surface)",
  },
};
