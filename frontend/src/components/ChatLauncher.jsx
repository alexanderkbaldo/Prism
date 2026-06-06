import React, { useState, useRef, useEffect } from "react";
import { apiUrl } from "../api";

const SUGGESTIONS = [
  "What's the overall read?",
  "Any hiring signals?",
  "Why the sentiment shift?",
];

export default function ChatLauncher({ ticker }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role, text}
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hovered, setHovered] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, open]);

  async function ask(question) {
    const q = question.trim();
    if (!q || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", text: "" }]);
    setStreaming(true);

    try {
      const res = await fetch(apiUrl("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, company: ticker }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            text: copy[copy.length - 1].text + chunk,
          };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", text: `Something went wrong (${e.message}).` };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  return (
    <div style={styles.root}>
      {open && (
        <div style={styles.popover}>
          <div style={styles.popHead}>
            <div style={styles.popTitle}>
              <span style={styles.dot} />
              <span>Ask about {ticker}</span>
            </div>
            <button onClick={() => setOpen(false)} style={styles.x} aria-label="Close">×</button>
          </div>

          <div ref={scrollRef} style={styles.log}>
            {messages.length === 0 && (
              <p style={styles.intro}>
                Ask anything about {ticker}. Answers are grounded in Prism's
                signals, alerts, and the latest brief.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  ...styles.msg,
                  ...(m.role === "user" ? styles.userMsg : styles.botMsg),
                }}
              >
                {m.text || (streaming ? "…" : "")}
              </div>
            ))}
          </div>

          {messages.length === 0 && (
            <div style={styles.pills}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} style={styles.pill}>{s}</button>
              ))}
            </div>
          )}

          <div style={styles.inputRow}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Ask about ${ticker}…`}
              style={styles.input}
              disabled={streaming}
            />
            <button
              onClick={() => ask(input)}
              disabled={streaming || !input.trim()}
              style={styles.send}
              aria-label="Send"
            >
              ↑
            </button>
          </div>
        </div>
      )}

      <div style={styles.launchWrap}>
        {!open && hovered && <span style={styles.tooltip}>Ask Prism AI</span>}
        <button
          onClick={() => setOpen((o) => !o)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={styles.launcher}
          title="Ask Prism AI"
          aria-label={open ? "Close chat" : "Ask Prism AI"}
        >
          {open ? (
            <span style={styles.launcherX}>×</span>
          ) : (
            <span style={styles.launcherDot} />
          )}
        </button>
      </div>
    </div>
  );
}

const styles = {
  root: {
    position: "fixed",
    bottom: "28px",
    right: "28px",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "14px",
  },
  launchWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  tooltip: {
    position: "absolute",
    right: "100%",
    marginRight: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    whiteSpace: "nowrap",
    background: "var(--ink)",
    color: "var(--bg)",
    padding: "6px 11px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "0.01em",
    boxShadow: "0 4px 14px rgba(26,32,24,0.20)",
    pointerEvents: "none",
  },
  launcher: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    background: "var(--ink)",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(26,32,24,0.22)",
  },
  launcherDot: {
    width: "11px",
    height: "11px",
    borderRadius: "50%",
    background: "var(--sage)",
    display: "inline-block",
  },
  launcherX: { color: "var(--bg)", fontSize: "24px", lineHeight: 1, fontWeight: 300 },

  popover: {
    width: "360px",
    maxHeight: "70vh",
    background: "var(--bg)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "16px",
    boxShadow: "0 12px 40px rgba(26,32,24,0.18)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  popHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "15px 16px",
    borderBottom: "0.5px solid var(--hairline)",
  },
  popTitle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--ink)",
  },
  dot: { width: "7px", height: "7px", borderRadius: "50%", background: "var(--sage)" },
  x: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "20px",
    lineHeight: 1,
    color: "var(--faint)",
    padding: "0 2px",
  },
  log: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minHeight: "80px",
  },
  intro: { fontSize: "13px", color: "var(--muted)", lineHeight: 1.55 },
  msg: {
    fontSize: "13.5px",
    lineHeight: 1.55,
    padding: "9px 12px",
    borderRadius: "12px",
    maxWidth: "85%",
    whiteSpace: "pre-wrap",
  },
  userMsg: {
    alignSelf: "flex-end",
    background: "var(--sage-soft)",
    color: "var(--ink)",
  },
  botMsg: {
    alignSelf: "flex-start",
    background: "var(--surface)",
    color: "var(--ink)",
  },
  pills: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    padding: "0 16px 14px",
  },
  pill: {
    background: "transparent",
    border: "0.5px solid var(--hairline)",
    borderRadius: "99px",
    padding: "6px 12px",
    fontSize: "12px",
    color: "var(--muted)",
    cursor: "pointer",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 14px",
    borderTop: "0.5px solid var(--hairline)",
  },
  input: {
    flex: 1,
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "10px",
    padding: "9px 12px",
    fontSize: "13.5px",
    color: "var(--ink)",
    fontFamily: "inherit",
    outline: "none",
  },
  send: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "var(--sage)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    flexShrink: 0,
  },
};
