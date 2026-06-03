import React, { useState } from "react";
import { useSignals } from "../hooks/useApi";

const CATEGORIES = ["sentiment", "hiring", "trends", "reviews", "filings"];

const CATEGORY_ICON = {
  sentiment: "💬",
  hiring:    "📋",
  trends:    "📈",
  reviews:   "⭐",
  filings:   "📄",
};

const CATEGORY_LABEL = {
  sentiment: "Sentiment",
  hiring:    "Hiring",
  trends:    "Search Trends",
  reviews:   "App Reviews",
  filings:   "SEC Filings",
};

function sentimentColor(val) {
  if (val == null) return "var(--text-muted)";
  if (val >= 0.3) return "var(--green)";
  if (val <= -0.3) return "var(--red)";
  return "var(--amber)";
}

function sentimentLabel(val) {
  if (val == null) return null;
  if (val >= 0.3) return "Positive";
  if (val <= -0.3) return "Negative";
  return "Neutral";
}

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SignalCard({ signal }) {
  const hasScore = signal.sentiment != null;
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.source}>{signal.source}</span>
        <span style={styles.ts}>{formatRelativeTime(signal.event_timestamp)}</span>
      </div>
      <p style={styles.summary}>{signal.summary_text || signal.title || "—"}</p>
      {hasScore && (
        <div style={styles.scoreRow}>
          <span
            style={{
              ...styles.scorePill,
              background: sentimentColor(signal.sentiment) + "22",
              color: sentimentColor(signal.sentiment),
              border: `1px solid ${sentimentColor(signal.sentiment)}44`,
            }}
          >
            {sentimentLabel(signal.sentiment)} &nbsp;
            <strong>{signal.sentiment >= 0 ? "+" : ""}{signal.sentiment?.toFixed(2)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

function CategorySection({ ticker, category }) {
  const { data, loading } = useSignals(ticker);
  const signals = (data?.signals || []).filter((s) => s.category === category);

  if (loading && !data) {
    return <div style={styles.empty}>Loading…</div>;
  }
  if (!signals.length) {
    return <div style={styles.empty}>No {CATEGORY_LABEL[category]} signals in the last 7 days.</div>;
  }
  return (
    <div style={styles.cardList}>
      {signals.map((s, i) => <SignalCard key={s.id ?? i} signal={s} />)}
    </div>
  );
}

export default function SignalCards({ ticker }) {
  const [activeTab, setActiveTab] = useState("sentiment");
  const { data } = useSignals(ticker);

  const countsByCategory = {};
  for (const cat of CATEGORIES) {
    countsByCategory[cat] = (data?.signals || []).filter((s) => s.category === cat).length;
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.heading}>
        <span style={styles.headingIcon}>📡</span> Signals
        {data?.source === "mock" && <span style={styles.mockBadge}>mock data</span>}
      </h2>

      <div style={styles.tabs}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            style={{
              ...styles.tab,
              ...(activeTab === cat ? styles.tabActive : {}),
            }}
          >
            {CATEGORY_ICON[cat]} {CATEGORY_LABEL[cat]}
            {countsByCategory[cat] > 0 && (
              <span style={styles.badge}>{countsByCategory[cat]}</span>
            )}
          </button>
        ))}
      </div>

      <CategorySection ticker={ticker} category={activeTab} />
    </section>
  );
}

const styles = {
  section: {
    background: "var(--surface)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    padding: "20px",
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
  headingIcon: { fontSize: "1.1rem" },
  mockBadge: {
    marginLeft: "auto",
    fontSize: "0.7rem",
    background: "var(--amber)22",
    color: "var(--amber)",
    border: "1px solid var(--amber)44",
    borderRadius: "99px",
    padding: "2px 8px",
    fontWeight: 500,
  },
  tabs: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    marginBottom: "16px",
    borderBottom: "1px solid var(--border)",
    paddingBottom: "12px",
  },
  tab: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "0.82rem",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "5px",
    transition: "all 0.15s",
  },
  tabActive: {
    background: "var(--teal-light)",
    color: "var(--teal-dark)",
    border: "1px solid var(--teal-mid)",
  },
  badge: {
    background: "var(--teal)",
    color: "#fff",
    borderRadius: "99px",
    padding: "0 6px",
    fontSize: "0.68rem",
    fontWeight: 700,
    lineHeight: "1.6",
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  card: {
    background: "var(--surface2)",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    padding: "12px 14px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "6px",
  },
  source: {
    fontSize: "0.72rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--teal)",
  },
  ts: { fontSize: "0.72rem", color: "var(--text-muted)" },
  summary: { fontSize: "0.88rem", color: "var(--text)", lineHeight: 1.55 },
  scoreRow: { marginTop: "8px" },
  scorePill: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "0.78rem",
    borderRadius: "99px",
    padding: "2px 10px",
    fontWeight: 500,
  },
  empty: {
    color: "var(--text-muted)",
    fontSize: "0.85rem",
    padding: "12px 0",
  },
};
