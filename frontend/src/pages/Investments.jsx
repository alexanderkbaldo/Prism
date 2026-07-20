import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import Disclaimer from "../components/Disclaimer";
import InfoTip from "../components/InfoTip";
import SubscribeForm from "../components/SubscribeForm";
import { Reveal } from "../anim";
import { useScoreboard } from "../hooks/useScoreboard";
import { useEarningsCalendar } from "../hooks/useEarningsCalendar";
import { useBacktest, useBacktestWeeks, useWeeklyScores } from "../hooks/useApi";
import { gloss } from "../utils/glossary";

// ---- formatting helpers -----------------------------------------------------

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const rankText = (r) => (r ? ordinal(r.rank) : "—");
const pct = (x) => (x == null ? "—" : `${(x * 100).toFixed(0)}%`);
const signedPts = (x) => (x == null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}pts`);
const signedPct2 = (x) => (x == null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`);

function scoreColor(score) {
  if (score == null) return "var(--muted)";
  if (score >= 55) return "var(--up)";
  if (score <= 45) return "var(--down)";
  return "var(--muted)";
}

function dayWord(n) {
  return `${n} ${Math.abs(n) === 1 ? "day" : "days"}`;
}
function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ---- scoreboard -------------------------------------------------------------

// Tiny inline trend line, no chart library: the last 8 weekly composite
// scores as an SVG polyline.
function Sparkline({ scores, width = 64, height = 20 }) {
  if (!scores || scores.length < 3) return <span style={styles.trendNone}>—</span>;
  const pts = scores.slice(-8);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const step = width / (pts.length - 1);
  const points = pts
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        style={{ stroke: "var(--sage)", strokeWidth: 1.4 }}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Trend cell: sparkline + week-over-week change in points, from /weekly.
function TrendCell({ ticker }) {
  const { data } = useWeeklyScores(ticker);
  const scores = (data?.scores || [])
    .filter((s) => s.composite_score != null)
    .map((s) => Number(s.composite_score));

  const delta =
    scores.length >= 2 ? Math.round((scores[scores.length - 1] - scores[scores.length - 2]) * 100) : null;

  return (
    <div style={styles.trendCell}>
      <Sparkline scores={scores} />
      {delta != null && (
        <span
          style={{
            ...styles.trendDelta,
            color: delta > 0 ? "var(--up)" : delta < 0 ? "var(--down)" : "var(--faint)",
          }}
          title="Change vs the prior week, in points"
        >
          {delta > 0 ? `+${delta}` : delta === 0 ? "·" : delta}
        </span>
      )}
    </div>
  );
}

function Scoreboard({ rows, source, earningsByTicker, onOpen }) {
  return (
    <section style={styles.block}>
      <div style={styles.blockHead}>
        <span className="eyebrow">This week's signal read</span>
        {source === "mock" && (
          <span style={styles.mockTag} title="Backend unreachable, showing sample data.">
            Sample data
          </span>
        )}
      </div>
      <h2 style={styles.h2}>Where the five stand today</h2>
      <p style={styles.lede}>
        A 0–100 read of each company's week across social mood and hiring (50 is
        neutral). A starting point for research: tap a company to open its full
        dashboard.
      </p>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, textAlign: "left" }}>Company</th>
              <th style={styles.th}>
                <span style={styles.thTip}>
                  Signal read <InfoTip label="signal read" text={gloss("signal-read")} />
                </span>
              </th>
              <th style={styles.th}>
                <span style={styles.thTip}>
                  Trend <InfoTip label="trend" text={gloss("trend")} />
                </span>
              </th>
              <th style={styles.th}>Sentiment</th>
              <th style={styles.th}>Buzz</th>
              <th style={styles.th}>Hiring</th>
              <th style={styles.th}>Earnings</th>
              <th style={styles.th} aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {(rows || Array.from({ length: 5 })).map((r, i) =>
              r ? (
                <tr
                  key={r.ticker}
                  onClick={() => onOpen(r.ticker)}
                  style={styles.row}
                  className="scoreboard-row"
                  tabIndex={0}
                  role="button"
                  aria-label={`Open the ${r.name} dashboard`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(r.ticker); }
                  }}
                >
                  <td style={{ ...styles.td, textAlign: "left" }}>
                    <span style={styles.coName}>{r.name}</span>
                    <span style={styles.coTicker}>{r.ticker}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.score, color: scoreColor(r.score) }}>
                      {r.score == null ? "—" : r.score}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <TrendCell ticker={r.ticker} />
                  </td>
                  <td style={styles.td}>{rankText(r.ranks.sentiment)}</td>
                  <td style={styles.td}>{rankText(r.ranks.mentions)}</td>
                  <td style={styles.td}>{rankText(r.ranks.hiring)}</td>
                  <td style={styles.td}>
                    {earningsByTicker[r.ticker]?.days != null
                      ? `in ${dayWord(earningsByTicker[r.ticker].days)}`
                      : "—"}
                  </td>
                  <td style={{ ...styles.td, ...styles.chevronCell }} aria-hidden="true">→</td>
                </tr>
              ) : (
                <tr key={i} style={styles.row}>
                  <td style={{ ...styles.td, textAlign: "left", color: "var(--faint)" }} colSpan={8}>
                    Loading…
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <p style={styles.foot}>
        Ranks are among the 5 fintechs Prism tracks. Sentiment = social + app-review
        mood · Buzz = mention volume · Hiring = job-posting volume.
      </p>
    </section>
  );
}

// ---- earnings calendar ------------------------------------------------------

function EarningsCalendar({ rows, onOpen }) {
  return (
    <section style={styles.block}>
      <span className="eyebrow">Earnings calendar</span>
      <h2 style={styles.h2}>What's reporting next</h2>
      <p style={styles.lede}>
        Signals matter most in the run-up to a print. Companies closest to
        earnings first; tap one to review its signals before the call.
      </p>
      <ul style={styles.calList}>
        {(rows || []).map((r) => {
          const urgent = r.days != null && r.days <= 14;
          const veryClose = r.days != null && r.days <= 3;
          return (
            <li
              key={r.ticker}
              style={styles.calRow}
              className="scoreboard-row"
              onClick={() => onOpen(r.ticker)}
              tabIndex={0}
              role="button"
              aria-label={`Open the ${r.name} dashboard`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(r.ticker); }
              }}
            >
              <div>
                <span style={styles.coName}>{r.name}</span>
                <span style={styles.coTicker}>{r.ticker}</span>
              </div>
              <div style={styles.calAction}>
                <div style={styles.calRight}>
                  <span style={{
                    ...styles.calWhen,
                    ...(urgent ? { color: "var(--clay)" } : {}),
                    ...(veryClose ? { fontWeight: 600 } : {}),
                  }}>
                    {r.days == null
                      ? "Date unknown"
                      : r.days <= 0
                      ? "Reporting today"
                      : `in ${dayWord(r.days)}`}
                  </span>
                  <span style={styles.calDate}>{formatDate(r.date)}</span>
                </div>
                <span style={styles.chevron} aria-hidden="true">→</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---- track record (backtest) ------------------------------------------------

// The evidence rows behind the aggregate cards: the most recent weeks the
// backtest composite flagged, and what the stock did over the next 5 days.
function FlaggedWeeks({ onOpen }) {
  const { data, error } = useBacktestWeeks(12);
  // On error (e.g. an API that predates this endpoint), fall through to the
  // empty state rather than loading forever.
  const weeks = data?.weeks || (error ? [] : null);
  const isMock = data?.source === "mock";

  return (
    <div style={styles.flaggedWrap}>
      <div style={styles.blockHead}>
        <h3 style={styles.h3}>
          The weeks behind the numbers{" "}
          <InfoTip label="flagged weeks" text={gloss("flagged-week")} />
        </h3>
        {isMock && (
          <span style={styles.mockTag} title="Backend unreachable, showing sample data.">
            Sample data
          </span>
        )}
      </div>
      <p style={styles.lede}>
        Every row is one flagged week: the signals read net-positive, and this
        is what the stock actually did against the S&P 500 over the next five
        trading days.
      </p>

      {weeks == null ? (
        <p style={styles.empty}>Loading…</p>
      ) : weeks.length === 0 ? (
        <p style={styles.empty}>
          No flagged weeks with price history yet. The pipeline is still
          building history.
        </p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={{ ...styles.table, minWidth: "520px" }}>
            <thead>
              <tr>
                <th style={{ ...styles.th, textAlign: "left" }}>Week of</th>
                <th style={{ ...styles.th, textAlign: "left" }}>Company</th>
                <th style={styles.th}>5d vs S&amp;P</th>
                <th style={styles.th}>
                  <span style={styles.thTip}>
                    Result{" "}
                    <InfoTip
                      label="result"
                      text="Beat = the stock's five-day return exceeded the S&P 500's over the same dates."
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr
                  key={`${w.ticker}-${w.week_start}`}
                  style={styles.row}
                  className="scoreboard-row"
                  onClick={() => onOpen(w.ticker)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open the ${w.company} dashboard`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(w.ticker); }
                  }}
                >
                  <td style={{ ...styles.td, textAlign: "left" }}>{formatDate(w.week_start)}</td>
                  <td style={{ ...styles.td, textAlign: "left" }}>
                    <span style={styles.flaggedName}>{w.company}</span>
                    <span style={styles.coTicker}>{w.ticker}</span>
                  </td>
                  <td style={{
                    ...styles.td,
                    color: w.relative_return > 0 ? "var(--up)" : w.relative_return < 0 ? "var(--down)" : "var(--muted)",
                    fontWeight: 500,
                  }}>
                    {signedPct2(w.relative_return)}
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: w.outperformed ? "var(--up)" : "var(--down)", fontWeight: 500 }}>
                      {w.outperformed ? "✓ Beat" : "✗ Trailed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TrackRecord({ onOpen }) {
  const { data } = useBacktest();
  const results = data?.results || null;
  const isMock = data?.source === "mock";

  return (
    <section style={styles.block}>
      <div style={styles.blockHead}>
        <span className="eyebrow">Track record</span>
        {isMock && (
          <span style={styles.mockTag} title="Backend unreachable, showing sample data.">
            Sample data
          </span>
        )}
      </div>
      <h2 style={styles.h2}>Has the signal had an edge?</h2>
      <p style={styles.lede}>
        On the weeks the signals flagged a company as net-positive, did the stock
        beat the S&amp;P 500 over the next five trading days? We show the hit rate
        against the base rate (how often <em>any</em> week beat the market).
        Historical and preliminary: <strong>not predictive, not advice</strong>.
      </p>
      <p style={styles.readingKey}>
        How to read it: a 67% hit rate against a 53% base rate means flagged
        weeks beat the market more often than a typical week did. The gap is
        the edge; hover any label for its definition.
      </p>

      {results == null ? (
        <p style={styles.empty}>Loading…</p>
      ) : results.length === 0 ? (
        <p style={styles.empty}>
          The backtest is still being computed. Check back once the daily pipeline
          has built enough price and signal history.
        </p>
      ) : (
        <div style={styles.cardGrid}>
          {results.map((r) => {
            const edge =
              r.hit_rate != null && r.base_rate != null ? r.hit_rate - r.base_rate : null;
            const noHistory = !r.total_weeks_tested && r.hit_rate == null;
            if (noHistory) {
              // A company with nothing computable yet gets one quiet line, not
              // a full card of dashes.
              return (
                <div key={r.company} style={styles.cardEmpty}>
                  <span style={styles.coName}>{r.company}</span>
                  <span style={styles.coTicker}>{r.ticker || "—"}</span>
                  <span style={styles.cardEmptyNote}>Not enough history to test yet.</span>
                </div>
              );
            }
            return (
              <div key={r.company} style={styles.card}>
                <div style={styles.cardHead}>
                  <span style={styles.coName}>{r.company}</span>
                  <span style={styles.coTicker}>{r.ticker || "—"}</span>
                </div>
                <div style={styles.metricRow}>
                  <Metric label="Hit rate" tip={gloss("hit-rate")} value={pct(r.hit_rate)} />
                  <Metric label="Base rate" tip={gloss("base-rate")} value={pct(r.base_rate)} />
                </div>
                <div style={styles.metricRow}>
                  <Metric label="Edge" tip={gloss("edge")} value={signedPts(edge)}
                          color={edge == null ? undefined : edge > 0 ? "var(--up)" : edge < 0 ? "var(--down)" : undefined} />
                  <Metric label="Avg 5d vs S&P" tip={gloss("avg-5d")} value={signedPct2(r.avg_relative_return)}
                          color={r.avg_relative_return == null ? undefined
                            : r.avg_relative_return > 0 ? "var(--up)"
                            : r.avg_relative_return < 0 ? "var(--down)" : undefined} />
                </div>
                <div style={styles.cardMeta}>
                  {r.net_positive_weeks} net-positive of {r.total_weeks_tested} weeks tested
                </div>
                <div style={styles.quality}>
                  {r.small_sample && <span style={styles.warn}>⚠ </span>}
                  {r.data_quality}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FlaggedWeeks onOpen={onOpen} />

      <p style={{ ...styles.lede, marginTop: "28px" }}>
        These flagged weeks also drive a paper-trading agent that publishes its
        simulated P&L and a memo on every trade.{" "}
        <Link to="/agent" style={styles.link}>See the agent's record →</Link>
      </p>
    </section>
  );
}

function Metric({ label, value, color, tip }) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>
        {label}
        {tip && <> <InfoTip label={label} text={tip} /></>}
      </div>
      <div style={{ ...styles.metricValue, ...(color ? { color } : {}) }}>{value}</div>
    </div>
  );
}

// ---- page -------------------------------------------------------------------

export default function Investments({ ticker, onTickerChange }) {
  const navigate = useNavigate();
  const { rows: scoreRows, source: scoreSource } = useScoreboard();
  const { rows: earningsRows } = useEarningsCalendar();

  const earningsByTicker = {};
  for (const e of earningsRows || []) earningsByTicker[e.ticker] = e;

  // The company reporting soonest, for the alerts pitch below the calendar.
  const next = (earningsRows || []).find((r) => r.days != null && r.days > 0);

  const openCompany = (t) => {
    if (onTickerChange) onTickerChange(t);
    navigate("/dashboard");
  };

  return (
    <div className="page" style={styles.column}>
      <div style={styles.header}>
        <span className="eyebrow" style={{ color: "var(--sage)" }}>Investments</span>
        <h1 style={styles.title}>The five fintechs, at a glance.</h1>
        <p style={styles.sub}>
          A cross-company read for anyone researching these names: the week's
          signals, what's reporting next, and how the signals have held up
          historically.
        </p>
        <Disclaimer style={{ marginTop: "24px" }} />
      </div>

      <Reveal><Scoreboard rows={scoreRows} source={scoreSource} earningsByTicker={earningsByTicker} onOpen={openCompany} /></Reveal>
      <Reveal><EarningsCalendar rows={earningsRows} onOpen={openCompany} /></Reveal>

      <Reveal>
        <section style={styles.block}>
          <span className="eyebrow">Alerts</span>
          <h2 style={styles.h2}>Get a heads-up before the print</h2>
          <p style={styles.lede}>
            {next
              ? `${next.name} reports in ${dayWord(next.days)}. `
              : ""}
            Anomaly alerts email you when a signal breaks from its pattern, so
            you can look before the quarter is public.
          </p>
          <div style={styles.subscribeWrap}>
            <SubscribeForm />
          </div>
        </section>
      </Reveal>

      <Reveal><TrackRecord onOpen={openCompany} /></Reveal>

      <Reveal>
        <section style={styles.block}>
          <span className="eyebrow">Use it responsibly</span>
          <h2 style={styles.h2}>A research tool, not a tip sheet</h2>
          <p style={styles.lede}>
            Prism surfaces alternative-data signals and explains them; it doesn't
            tell you what to buy or sell. Treat every score here as one input into
            your own research, alongside fundamentals, filings, and your own view
            of risk. New to reading the signals?{" "}
            <Link to="/guide" style={styles.link}>See how to read a company →</Link>
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
  sub: {
    fontSize: "16px",
    lineHeight: 1.6,
    color: "var(--muted)",
    marginTop: "18px",
  },

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
  lede: {
    fontSize: "15px",
    lineHeight: 1.65,
    color: "var(--muted)",
    marginTop: "12px",
    maxWidth: "640px",
  },
  foot: {
    fontSize: "12px",
    lineHeight: 1.6,
    color: "var(--faint)",
    marginTop: "14px",
  },
  readingKey: {
    fontSize: "13.5px",
    lineHeight: 1.6,
    color: "var(--faint)",
    marginTop: "10px",
    maxWidth: "640px",
    fontStyle: "italic",
  },

  // scoreboard table
  tableWrap: { marginTop: "24px", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "700px", fontSize: "14px" },
  thTip: { display: "inline-flex", alignItems: "center", gap: "5px" },
  trendCell: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
  },
  trendDelta: { fontSize: "12px", fontWeight: 600, minWidth: "22px", textAlign: "left" },
  trendNone: { color: "var(--faint)" },
  chevronCell: { color: "var(--faint)", fontSize: "15px", width: "34px", paddingLeft: 0 },
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
  td: { padding: "16px 14px", textAlign: "right", color: "var(--ink)" },
  coName: { fontFamily: "var(--serif)", fontSize: "18px", color: "var(--ink)" },
  coTicker: { fontSize: "11px", letterSpacing: "0.08em", color: "var(--faint)", marginLeft: "10px" },
  score: { fontFamily: "var(--serif)", fontSize: "24px", lineHeight: 1 },
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

  // earnings calendar
  calList: { listStyle: "none", margin: "20px 0 0", padding: 0 },
  calRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 4px",
    borderTop: "0.5px solid var(--hairline)",
  },
  calRight: { textAlign: "right", display: "flex", flexDirection: "column", gap: "3px" },
  calWhen: { fontSize: "14px", color: "var(--ink)" },
  calDate: { fontSize: "12px", color: "var(--faint)" },
  calAction: { display: "flex", alignItems: "center", gap: "14px" },
  chevron: { color: "var(--faint)", fontSize: "15px" },

  // alerts CTA
  subscribeWrap: { marginTop: "24px", maxWidth: "560px" },

  // track record cards
  empty: {
    fontSize: "15px",
    color: "var(--muted)",
    marginTop: "20px",
    padding: "20px 24px",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "10px",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px",
    marginTop: "24px",
  },
  card: {
    background: "var(--paper-raised)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "12px",
    padding: "22px 24px",
    boxShadow: "var(--shadow-card)",
  },
  cardHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px" },
  metricRow: { display: "flex", gap: "20px", marginBottom: "12px" },
  metric: { flex: 1 },
  metricLabel: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--faint)",
  },
  metricValue: {
    fontFamily: "var(--serif)",
    fontSize: "22px",
    color: "var(--ink)",
    marginTop: "4px",
  },
  cardMeta: { fontSize: "12.5px", color: "var(--muted)", marginTop: "6px" },
  quality: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "var(--faint)",
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "0.5px solid var(--hairline)",
  },
  warn: { color: "var(--clay)", fontWeight: 600 },

  cardEmpty: {
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "12px",
    padding: "18px 24px",
    alignSelf: "start",
  },
  cardEmptyNote: { fontSize: "13px", color: "var(--faint)", marginLeft: "10px" },

  // flagged weeks (evidence table under the aggregate cards)
  flaggedWrap: { marginTop: "48px" },
  h3: {
    fontFamily: "var(--serif)",
    fontSize: "20px",
    fontWeight: 400,
    letterSpacing: "-0.01em",
    color: "var(--ink)",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  flaggedName: { fontFamily: "var(--serif)", fontSize: "16px", color: "var(--ink)" },

  link: { color: "var(--sage)", textDecoration: "none", fontWeight: 500, whiteSpace: "nowrap" },
};
