import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useSeries } from "../hooks/useApi";

// Palette (hex, not CSS vars — recharts sets SVG attributes which don't resolve
// var()). Mirrors src/index.css.
const C = {
  sage: "#6B8F71",
  ink: "#1A2018",
  hairline: "#CBBDA8",
  faint: "#8A7D6B",
  bg: "#E7DCCB",
};

// One chart per signal, each plotting the field that fits it.
const CHARTS = [
  { key: "sentiment", title: "Sentiment", field: "avg_sentiment", domain: [-1, 1], unit: "" },
  { key: "hiring", title: "Hiring", field: "count", domain: [0, "auto"], unit: " postings" },
  { key: "trends", title: "Search interest", field: "avg_interest", domain: [0, 100], unit: "/100" },
  { key: "reviews", title: "App reviews", field: "avg_sentiment", domain: [-1, 1], unit: "" },
];

function fmtDay(d) {
  const [, m, day] = d.split("-");
  return `${parseInt(m, 10)}/${parseInt(day, 10)}`;
}

function tooltipFormatter(value, _name, { payload }, unit) {
  const v = typeof value === "number" ? value.toFixed(2).replace(/\.00$/, "") : value;
  return [`${v}${unit}`, undefined];
}

// Faint skeleton for a signal with no data — a dashed baseline plus muted
// "Awaiting data" reads as intentional rather than broken.
function ChartSkeleton() {
  return (
    <div style={styles.skeleton}>
      <div style={styles.skeletonBaseline} />
      <span style={styles.skeletonLabel}>Awaiting data</span>
    </div>
  );
}

function MiniChart({ title, points, field, domain, unit }) {
  const data = (points || [])
    .map((p) => ({ day: fmtDay(p.day), value: p[field] }))
    .filter((p) => p.value != null);

  // A line needs a few points to mean anything; 1-2 points reads as broken, so
  // show an intentional "building history" state instead of a near-empty chart.
  return (
    <div style={styles.card}>
      <span className="eyebrow" style={styles.title}>{title}</span>
      {data.length === 0 ? (
        <ChartSkeleton />
      ) : data.length < 3 ? (
        <div style={styles.empty}>
          {`Building history — ${data.length} day${data.length === 1 ? "" : "s"} so far.`}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={132}>
          <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -4 }}>
            <CartesianGrid stroke={C.hairline} strokeDasharray="2 3" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: C.faint }}
              tickLine={false}
              axisLine={{ stroke: C.hairline }}
              minTickGap={24}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 10, fill: C.faint }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: C.hairline }}
              contentStyle={{
                background: C.bg,
                border: `0.5px solid ${C.hairline}`,
                borderRadius: 8,
                fontSize: 12,
                color: C.ink,
              }}
              labelStyle={{ color: C.faint, fontSize: 11 }}
              formatter={(value, name, entry) =>
                tooltipFormatter(value, name, entry, unit)
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={C.sage}
              strokeWidth={1.6}
              dot={data.length <= 3 ? { r: 2.5, fill: C.sage, strokeWidth: 0 } : false}
              activeDot={{ r: 3.5, fill: C.sage, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function HistoricalCharts({ ticker }) {
  const { data } = useSeries(ticker, 30);
  const series = data?.series || {};

  return (
    <section style={styles.wrap}>
      <span className="eyebrow" style={styles.heading}>Last 30 days</span>
      <div className="chart-grid" style={styles.grid}>
        {CHARTS.map((c) => (
          <MiniChart
            key={c.key}
            title={c.title}
            points={series[c.key]}
            field={c.field}
            domain={c.domain}
            unit={c.unit}
          />
        ))}
      </div>
    </section>
  );
}

const styles = {
  wrap: { marginTop: "56px" },
  heading: { color: "var(--faint)" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "20px",
    marginTop: "20px",
  },
  card: {
    padding: "16px 18px 12px",
    background: "var(--surface)",
    border: "0.5px solid var(--hairline)",
    borderRadius: "14px",
  },
  title: { color: "var(--muted)", display: "block", marginBottom: "10px" },
  empty: {
    height: "132px",
    display: "flex",
    alignItems: "center",
    fontSize: "13px",
    color: "var(--faint)",
  },
  skeleton: {
    height: "132px",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonBaseline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "26px",
    borderTop: "1px dashed var(--hairline)",
  },
  skeletonLabel: {
    position: "relative",
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--faint)",
    background: "var(--surface)",
    padding: "0 8px",
  },
};
