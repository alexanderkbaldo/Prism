import React, { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import NavBar from "./components/NavBar";
import ChatLauncher from "./components/ChatLauncher";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Compare from "./pages/Compare";
import About from "./pages/About";

export default function App() {
  // Lifted so the chat launcher (global) stays in sync with the dashboard's
  // company selection.
  const [ticker, setTicker] = useState("HOOD");
  const location = useLocation();
  const reduce = useReducedMotion();

  const routes = (
    <Routes location={location}>
      <Route path="/" element={<Home />} />
      <Route
        path="/dashboard"
        element={<Dashboard ticker={ticker} onTickerChange={setTicker} />}
      />
      <Route path="/compare" element={<Compare />} />
      <Route path="/about" element={<About />} />
    </Routes>
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <NavBar />
      {reduce ? (
        routes
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {routes}
          </motion.div>
        </AnimatePresence>
      )}
      <ChatLauncher ticker={ticker} />
    </div>
  );
}
