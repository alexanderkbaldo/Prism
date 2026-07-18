import React, { useState } from "react";
import { apiUrl } from "../api";

// Email signup for Prism updates. Posts to the API's double-opt-in /subscribe
// endpoint; the backend emails a confirmation link, so success here just means
// "check your inbox". Used on the Home page.

const TYPES = [
  ["daily", "Daily digest", "A once-a-day roundup of the signals."],
  ["anomaly", "Anomaly alerts", "When a signal breaks >1σ from its pattern."],
  ["weekly", "Weekly summary", "A lighter recap, once a week."],
];

export default function SubscribeForm({ dark = false }) {
  const [email, setEmail] = useState("");
  const [prefs, setPrefs] = useState({ daily: true, anomaly: true, weekly: false });
  const [status, setStatus] = useState(null); // {ok, message}
  const [busy, setBusy] = useState(false);

  const toggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(apiUrl("/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...prefs }),
      });
      const data = await res.json().catch(() => ({}));
      setStatus(
        data.message
          ? { ok: data.ok, message: data.message }
          : { ok: false, message: "Something went wrong. Please try again." }
      );
      if (data.ok) setEmail("");
    } catch {
      setStatus({ ok: false, message: "Couldn't reach the server. Try again later." });
    } finally {
      setBusy(false);
    }
  }

  const muted = dark ? "rgba(231,220,203,0.7)" : "var(--muted)";
  const faint = dark ? "rgba(231,220,203,0.55)" : "var(--faint)";

  return (
    <form onSubmit={submit} style={s.form}>
      <div style={s.inputRow}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Email address"
          style={{
            ...s.input,
            ...(dark ? s.inputDark : {}),
          }}
        />
        <button type="submit" disabled={busy} style={s.button}>
          {busy ? "Sending…" : "Subscribe"}
        </button>
      </div>

      <div style={s.types}>
        {TYPES.map(([key, label, desc]) => (
          <label key={key} style={{ ...s.type, color: muted }}>
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={() => toggle(key)}
              style={s.checkbox}
            />
            <span>
              <span style={s.typeLabel}>{label}</span>
              <span style={{ ...s.typeDesc, color: faint }}>{desc}</span>
            </span>
          </label>
        ))}
      </div>

      {status && (
        <p
          role="status"
          style={{
            ...s.status,
            color: status.ok ? "var(--sage)" : dark ? "#E7A08F" : "var(--down)",
          }}
        >
          {status.message}
        </p>
      )}
      <p style={{ ...s.fine, color: faint }}>
        Double opt-in: we'll email a confirmation link. Unsubscribe anytime.
      </p>
    </form>
  );
}

const s = {
  form: { maxWidth: "520px", margin: "0 auto", textAlign: "left" },
  inputRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
  input: {
    flex: "1 1 240px",
    fontSize: "15px",
    fontFamily: "var(--sans)",
    padding: "14px 16px",
    borderRadius: "10px",
    border: "0.5px solid var(--hairline)",
    background: "var(--surface)",
    color: "var(--ink)",
    outline: "none",
  },
  inputDark: {
    background: "rgba(231,220,203,0.08)",
    border: "0.5px solid rgba(231,220,203,0.22)",
    color: "var(--bg)",
  },
  button: {
    background: "var(--sage)",
    color: "#fff",
    border: "none",
    fontSize: "15px",
    fontWeight: 500,
    padding: "14px 28px",
    borderRadius: "10px",
    cursor: "pointer",
  },
  types: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    marginTop: "18px",
  },
  type: {
    display: "flex",
    gap: "9px",
    alignItems: "flex-start",
    fontSize: "13px",
    cursor: "pointer",
    lineHeight: 1.4,
  },
  checkbox: { marginTop: "2px", accentColor: "var(--sage)", flexShrink: 0 },
  typeLabel: { display: "block", fontWeight: 500 },
  typeDesc: { display: "block", fontSize: "12px", marginTop: "1px" },
  status: { fontSize: "14px", marginTop: "16px", fontWeight: 500 },
  fine: { fontSize: "12px", marginTop: "14px" },
};
