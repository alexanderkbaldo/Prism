import React, { useState, useRef, useEffect } from "react";

export default function ChatPanel({ ticker }) {
  const [messages, setMessages] = useState([]); // {role, text}
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function send() {
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setStreaming(true);

    // Placeholder assistant message we append streamed chunks into.
    setMessages((m) => [...m, { role: "assistant", text: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, company: ticker }),
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
        copy[copy.length - 1] = {
          role: "assistant",
          text: `[error] ${e.message}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.heading}>
        <span>💬</span> Ask about {ticker}
      </h2>

      <div ref={scrollRef} style={styles.log}>
        {messages.length === 0 && (
          <p style={styles.empty}>
            Ask a question like “Why did {ticker}'s app rating drop?” —
            answers are grounded in Prism's signals, alerts, and brief.
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
            <span style={styles.msgRole}>{m.role === "user" ? "You" : "Prism"}</span>
            <span style={styles.msgText}>{m.text || (streaming ? "…" : "")}</span>
          </div>
        ))}
      </div>

      <div style={styles.inputRow}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Ask about ${ticker}…`}
          rows={2}
          style={styles.input}
          disabled={streaming}
        />
        <button onClick={send} disabled={streaming || !input.trim()} style={styles.btn}>
          {streaming ? "…" : "Send"}
        </button>
      </div>
    </section>
  );
}

const styles = {
  section: {
    background: "var(--surface)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
  },
  heading: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  log: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxHeight: "340px",
    overflowY: "auto",
    marginBottom: "12px",
  },
  empty: { color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.5 },
  msg: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    padding: "10px 12px",
    borderRadius: "8px",
    maxWidth: "92%",
  },
  userMsg: {
    alignSelf: "flex-end",
    background: "var(--teal-light)",
    border: "1px solid var(--teal-mid)",
  },
  botMsg: {
    alignSelf: "flex-start",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
  },
  msgRole: {
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--teal)",
  },
  msgText: {
    fontSize: "0.88rem",
    color: "var(--text)",
    whiteSpace: "pre-wrap",
    lineHeight: 1.55,
  },
  inputRow: { display: "flex", gap: "8px", alignItems: "flex-end" },
  input: {
    flex: 1,
    resize: "none",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "8px 10px",
    color: "var(--text)",
    fontSize: "0.88rem",
    fontFamily: "inherit",
  },
  btn: {
    background: "var(--teal)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 18px",
    fontWeight: 600,
    fontSize: "0.85rem",
    cursor: "pointer",
  },
};
