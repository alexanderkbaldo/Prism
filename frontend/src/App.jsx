import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import ChatLauncher from "./components/ChatLauncher";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";

export default function App() {
  // Lifted so the chat launcher (global) stays in sync with the dashboard's
  // company selection.
  const [ticker, setTicker] = useState("HOOD");

  return (
    <div style={{ minHeight: "100vh" }}>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/dashboard"
          element={<Dashboard ticker={ticker} onTickerChange={setTicker} />}
        />
        <Route path="/about" element={<About />} />
      </Routes>
      <ChatLauncher ticker={ticker} />
    </div>
  );
}
