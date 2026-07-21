import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import Footer from "../components/Footer";
import Disclaimer from "../components/Disclaimer";
import InfoTip from "../components/InfoTip";
import { Reveal } from "../anim";
import { usePaperPortfolio, fetchTradeMemo } from "../hooks/useApi";
import { gloss } from "../utils/glossary";

// Hex palette for recharts (SVG attributes don't resolve CSS vars).
const C = { sage: "#6B8F71", faint: "#8A7D6B", hairline: "#CBBDA8", ink: "#1A2018" };

const fmtUsd = (x) =>
  x == null ? "—" : `${x < 0 ? "−" : ""}$${Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtPct = (x) => (x == null ? "—" : `${(x * 100).toFixed(0)}%`);
const signedPct2 = (x) => (x == null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`);
const pnlColor = (x) => (x > 0 ? "var(--up)" : x < 0 ? "var(--down)" : "var(--muted)");

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ---- summary stats ----------------------------------------------------------

function SummaryRow({ s }) {
  if (!s) return null;
  const perTrade = (s.notional_per_trade || 10000).toLocaleString("en-US");
  const cells = [
    { label: "Paper trades", value: s.trades, tip: gloss("paper-trade") },
    { label: "Agent P&L", value: fmtUsd(s.pnl), color: pnlColor(s.pnl),
      tip: `Realized P&L across all closed trades, at $${perTrade} of simulated money per trade.` },
    { label: "Same money in the S&P", value: fmtUsd(s.sp_pnl), color: pnlColor(s.sp_pnl),
      tip: "The identical notional placed in the S&P 500 over the identical dates." },
    { label: "Win rate vs S&P", value: fmtPct(s.win_rate), tip: gloss("hit-rate") },
  ];
  return (
    <div style={styles.statRow}>
      {cells.map((c) => (
        <div key={c.label} style={styles.statCell}>
          <div style={styles.statLabel}>
            {c.label} {c.tip && <InfoTip label={c.label} text={c.tip} />}
          </div>
          <div style={{ ...styles.statValue, ...(c.color ? { color: c.color } : {}) }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- equity curve -----------------------------------------------------------

function EquityCurve({ curve }) {
  const data = (curve || []).map((p) => ({
    week: p.week_start,
    Agent: Math.round(p.agent_pnl),
    "S&P 500": Math.round(p.sp_pnl),
  }));
  if (data.length < 2) return null;
  return (
    <div style={styles.chartWrap}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: C.faint }}
            tickFormatter={(w) => formatDate(w).replace(", 2026", "").replace(", 2025", "")}
            axisLine={{ stroke: C.hairline }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: C.faint }}
            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(v, name) => [fmtUsd(v), name]}
            labelFormatter={(w) => `Week of ${formatDate(w)}`}
            contentStyle={{ fontSize: 12, border: `0.5px solid ${C.hairline}`, borderRadius: 8, background: "var(--paper-raised)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="Agent" stroke={C.sage} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="S&P 500" stroke={C.faint} strokeWidth={1.4} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <p style={styles.chartFoot}>
        Cumulative realized P&L, agent vs the same dollars in the S&P 500 over
        the same dates. Simulated money.
      </p>
    </div>
  );
}

// ---- trade log with expandable memos ----------------------------------------

function MemoPanel({ company, week }) {
  const [state, setState] = useState({ status: "loading" });

  React.useEffect(() => {
    let active = true;
    fetchTradeMemo(company, week)
      .then((d) => active && setState({ status: "done", memo: d }))
      .catch(() => active && setState({ status: "error" }));
    return () => { active = false; };
  }, [company, week]);

  if (state.status === "loading") return <p style={styles.memoLoading}>Writing…</p>;
  if (state.status === "error" || !state.memo?.available) {
    return (
      <p style={styles.memoLoading}>
        {state.memo?.reason || "The memo isn't available right now."}
      </p>
    );
  }
  return (
    <div>
      <p style={styles.memoText}>{state.memo.memo_text}</p>
      <p style={styles.memoMeta}>
        Written retrospectively by {state.memo.model === "mock" ? "a sample template" : `Claude (${state.memo.model})`} after the trade closed. Explanation, not advice.
      </p>
    </div>
  );
}

function TradeLog({ trades }) {
  const [open, setOpen] = useState(null); // `${ticker}-${week}` of expanded row

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, textAlign: "left" }}>Week of</th>
            <th style={{ ...styles.th, textAlign: "left" }}>Company</th>
            <th style={styles.th}>Stock 5d</th>
            <th style={styles.th}>vs S&amp;P</th>
            <th style={styles.th}>P&amp;L</th>
            <th style={{ ...styles.th, textAlign: "left", paddingLeft: 22 }}>Memo</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const key = `${t.ticker}-${t.week_start}`;
            const expanded = open === key;
            return (
              <React.Fragment key={key}>
                <tr
                  style={styles.row}
                  className="scoreboard-row"
                  onClick={() => setOpen(expanded ? null : key)}
                  tabIndex={0}
                  role="button"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Hide" : "Read"} the memo for ${t.company}, week of ${formatDate(t.week_start)}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(expanded ? null : key); }
                  }}
                >
                  <td style={{ ...styles.td, textAlign: "left" }}>{formatDate(t.week_start)}</td>
                  <td style={{ ...styles.td, textAlign: "left" }}>
                    <span style={styles.coName}>{t.company}</span>
                    <span style={styles.coTicker}>{t.ticker}</span>
                  </td>
                  <td style={{ ...styles.td, color: pnlColor(t.stock_return) }}>{signedPct2(t.stock_return)}</td>
                  <td style={{ ...styles.td, color: pnlColor(t.relative_return), fontWeight: 500 }}>
                    {signedPct2(t.relative_return)}
                  </td>
                  <td style={{ ...styles.td, color: pnlColor(t.pnl) }}>{fmtUsd(t.pnl)}</td>
                  <td style={{ ...styles.td, textAlign: "left", paddingLeft: 22, color: "var(--sage)", fontSize: 13 }}>
                    {expanded ? "Hide ↑" : "Read ↓"}
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={6} style={styles.memoCell}>
                      <MemoPanel company={t.ticker || t.company} week={t.week_start} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- connect your own agent ---------------------------------------------------

const MCP_SNIPPET = `# Claude Code
claude mcp add prism -- python -m prism.mcp_server

# Claude Desktop (claude_desktop_config.json)
{
  "mcpServers": {
    "prism": {
      "command": "python",
      "args": ["-m", "prism.mcp_server"],
      "env": { "PRISM_API_URL": "https://prism-production-8655.up.railway.app" }
    }
  }
}`;

const DEMO_PROMPT = `Using the Prism tools, pull the scoreboard, the flagged weeks, and the
earnings calendar. If a brokerage connector is available, pull live quotes
for the five tickers (read-only). Then write me a one-page pre-earnings
watchlist: where the signals and the market seem to disagree, and what to
watch next week. Do not place, prepare, or recommend any real trades.`;

function ConnectSection() {
  return (
    <section style={styles.block}>
      <span className="eyebrow">Bring your own agent</span>
      <h2 style={styles.h2}>Connect Claude (or any LLM) to Prism</h2>
      <p style={styles.lede}>
        Prism ships an MCP server, so any MCP-capable agent can pull the same
        signals this page is built on and reason across them alongside other
        connectors, like a brokerage's read-only market data. The tools serve
        research data only; nothing here places orders.
      </p>
      <pre style={styles.code}><code>{MCP_SNIPPET}</code></pre>
      <p style={{ ...styles.lede, marginTop: 20 }}>A demo prompt to try once connected:</p>
      <pre style={styles.code}><code>{DEMO_PROMPT}</code></pre>
    </section>
  );
}

// ---- page -------------------------------------------------------------------

export default function Agent() {
  const { data, error } = usePaperPortfolio();
  const isMock = data?.source === "mock";
  const trades = data?.trades || (error ? [] : null);
  const prelaunch = data?.prelaunch;
  const inception = data?.inception;

  return (
    <div className="page" style={styles.column}>
      <div style={styles.header}>
        <span className="eyebrow" style={{ color: "var(--sage)" }}>The agent</span>
        <h1 style={styles.title}>A paper-trading agent, in public.</h1>
        <p style={styles.sub}>
          The agent's rule is mechanical: every week the search-interest and
          SEC-filing signals score net-positive against their own trailing
          pattern, it opens a fixed $10,000 <em>simulated</em> position and
          closes it five trading days later. Claude writes a short memo on each
          closed trade. Every trade, win or lose, is published below.
        </p>
        <Disclaimer style={{ marginTop: "24px" }} />
      </div>

      <Reveal>
        <section style={styles.block}>
          <div style={styles.blockHead}>
            <span className="eyebrow">Live record</span>
            {isMock && (
              <span style={styles.mockTag} title="Backend unreachable, showing sample data.">
                Sample data
              </span>
            )}
          </div>
          <h2 style={styles.h2}>How it's doing</h2>
          {inception && (
            <p style={styles.lede}>
              The agent went live on {formatDate(inception)}. Everything in this
              section starts at $0 from that day; what the same rule did on
              historical data before go-live is published in full further down.
            </p>
          )}
          {data == null && !error ? (
            <p style={styles.empty}>Loading…</p>
          ) : trades && trades.length === 0 ? (
            <p style={styles.empty}>
              No live trades yet. The agent opens its first position the next
              week the signals flag net-positive; results appear here as trades
              close.
            </p>
          ) : (
            <>
              <SummaryRow s={data.summary} />
              <EquityCurve curve={data.curve} />
              <p style={styles.quality}>{data.summary?.data_quality}</p>
            </>
          )}
        </section>
      </Reveal>

      {trades && trades.length > 0 && (
        <Reveal>
          <section style={styles.block}>
            <span className="eyebrow">Trade log</span>
            <h2 style={styles.h2}>Every live trade, with the agent's memo</h2>
            <p style={styles.lede}>
              Tap a row to read the memo Claude wrote after that trade closed:
              what the signals showed, how it played out, and the caveat.
            </p>
            <TradeLog trades={trades} />
          </section>
        </Reveal>
      )}

      {prelaunch && prelaunch.trades.length > 0 && (
        <Reveal>
          <section style={styles.block}>
            <span className="eyebrow">Before go-live</span>
            <h2 style={styles.h2}>The pre-launch backtest</h2>
            <p style={styles.lede}>
              Before the agent went live, the same rule was run backward over
              Prism's signal history. Those simulated trades are published here
              in full — including the result: across{" "}
              {prelaunch.summary.trades} trades it finished{" "}
              <strong style={{ color: pnlColor(prelaunch.summary.pnl) }}>
                {fmtUsd(prelaunch.summary.pnl)}
              </strong>{" "}
              ({fmtPct(prelaunch.summary.win_rate)} of trades beat the S&amp;P
              leg). A losing backtest on a sample this small says as little as
              a winning one would; it's shown because a track record you can't
              audit isn't a track record.
            </p>
            <TradeLog trades={prelaunch.trades} />
          </section>
        </Reveal>
      )}

      <Reveal><ConnectSection /></Reveal>

      <Reveal>
        <section style={styles.block}>
          <span className="eyebrow">The fine print</span>
          <h2 style={styles.h2}>Simulated, and deliberately so</h2>
          <p style={styles.lede}>
            No real money is involved anywhere on this page, and the record is
            short: treat it as a transparent experiment, not evidence of an
            edge. The rule behind the trades and its full history live on the{" "}
            <Link to="/investments" style={styles.link}>Investments page</Link>;
            how to read the underlying signals is in the{" "}
            <Link to="/guide" style={styles.link}>Guide</Link>.
          </p>
        </section>
      </Reveal>

      <Footer />
    </div>
  );
}

const styles = {
  column: { maxWidth: "1100px", margin: "0 auto", padding: "0 40px 80px" },

  header: { paddingTop: "48px", maxWidth: "720px" },
  title: {
    fontFamily: "var(--serif)",
    fontSize: "40px",
    fontWeight: 400,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
    marginTop: "14px",
  },
  sub: { fontSize: "16px", lineHeight: 1.6, color: "var(--muted)", marginTop: "18px" },

  block: { marginTop: "64px" },
  blockHead: { display: "flex", alignItems: "center", gap: "12px" },
  h2: {
    fontFamily: "var(--serif)",
    fontSize: "26px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
    marginTop: "10px",
  },
  lede: { fontSize: "15px", lineHeight: 1.65, color: "var(--muted)", marginTop: "12px", maxWidth: "640px" },
  empty: {
    fontSize: "15px",
    color: "var(--muted)",
    marginTop: "20px",
    padding: "20px 24px",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "10px",
  },
  mockTag: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--ink)",
    background: "var(--sage-soft)",
    padding: "2px 8px",
    borderRadius: "99px",
  },
  quality: { fontSize: "12px", lineHeight: 1.6, color: "var(--faint)", marginTop: "14px" },

  // summary stats
  statRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "18px",
    marginTop: "24px",
    maxWidth: "760px",
  },
  statCell: {
    background: "var(--paper)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "10px",
    padding: "16px 18px",
  },
  statLabel: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--faint)",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  statValue: { fontFamily: "var(--serif)", fontSize: "26px", color: "var(--ink)", marginTop: "6px" },

  chartWrap: { marginTop: "28px", maxWidth: "760px" },
  chartFoot: { fontSize: "12px", color: "var(--faint)", marginTop: "8px" },

  // trade log
  tableWrap: { marginTop: "24px", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "640px", fontSize: "14px" },
  th: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--faint)",
    textAlign: "right",
    padding: "0 14px 12px",
  },
  row: { borderTop: "0.5px solid var(--hairline)", cursor: "pointer" },
  td: { padding: "15px 14px", textAlign: "right", color: "var(--ink)" },
  coName: { fontFamily: "var(--serif)", fontSize: "16px", color: "var(--ink)" },
  coTicker: { fontSize: "11px", letterSpacing: "0.08em", color: "var(--faint)", marginLeft: "10px" },
  memoCell: {
    padding: "4px 14px 20px",
    background: "var(--paper)",
    borderTop: "0.5px solid var(--hairline)",
  },
  memoLoading: { fontSize: "13.5px", color: "var(--faint)", padding: "12px 8px", margin: 0 },
  memoText: {
    fontFamily: "var(--serif)",
    fontSize: "15.5px",
    lineHeight: 1.65,
    color: "var(--ink)",
    padding: "14px 8px 0",
    margin: 0,
    maxWidth: "68ch",
  },
  memoMeta: { fontSize: "11.5px", color: "var(--faint)", padding: "10px 8px 6px", margin: 0 },

  // connect section
  code: {
    marginTop: "18px",
    padding: "18px 20px",
    background: "var(--ink)",
    color: "var(--bg)",
    borderRadius: "10px",
    fontSize: "12.5px",
    lineHeight: 1.6,
    overflowX: "auto",
    maxWidth: "760px",
  },

  link: { color: "var(--sage)", textDecoration: "none", fontWeight: 500 },
};
