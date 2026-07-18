import React, { useState, useEffect, useLayoutEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar";
// TEMPORARILY DISABLED - re-enable once AI backend is stable.
// The floating "Ask about [COMPANY]" chat widget is turned off site-wide.
// Restore this import and its <ChatLauncher /> mount below to bring it back.
// import ChatLauncher from "./components/ChatLauncher";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
// TEMPORARILY DISABLED - re-enable once AI backend is stable.
// The Compare page is feature-flagged off; /compare redirects to /dashboard.
// Restore this import and the original <Route> below to bring it back.
// import Compare from "./pages/Compare";
import About from "./pages/About";
import Guide from "./pages/Guide";
import Investments from "./pages/Investments";

export default function App() {
  // Lifted so the chat launcher (global) stays in sync with the dashboard's
  // company selection.
  const [ticker, setTicker] = useState("HOOD");
  const location = useLocation();

  // Opt out of the browser's automatic scroll restoration so navigations don't
  // land mid-page.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // Always start a newly-navigated page at the top.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const routes = (
    <Routes location={location}>
      <Route path="/" element={<Home />} />
      <Route
        path="/dashboard"
        element={<Dashboard ticker={ticker} onTickerChange={setTicker} />}
      />
      {/* TEMPORARILY DISABLED - re-enable once AI backend is stable.
          The Compare UI is hidden; /compare redirects to the dashboard so the
          route still resolves. Restore the line below to bring it back:
          <Route path="/compare" element={<Compare />} /> */}
      <Route path="/compare" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/investments"
        element={<Investments ticker={ticker} onTickerChange={setTicker} />}
      />
      <Route path="/guide" element={<Guide />} />
      <Route path="/about" element={<About />} />
    </Routes>
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <a href="#main" className="skip-link">Skip to content</a>
      <NavBar />
      {/* Routes swap instantly: product surfaces load into a task, and page
          content is never gated on an animation finishing. */}
      <main id="main">{routes}</main>
      {/* TEMPORARILY DISABLED - re-enable once AI backend is stable.
          The "Ask about [COMPANY]" chat widget is off site-wide. Restore the
          line below (and its import above) to bring it back:
          <ChatLauncher ticker={ticker} /> */}
    </div>
  );
}
