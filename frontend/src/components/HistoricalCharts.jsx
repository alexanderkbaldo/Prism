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

function MiniChart({ title, points, field, domain, unit }) {
  const data = (points || [])
    .map((p) => ({ day: fmtDay(p.day), value: p[field] }))
    .filter((p) => p.value != null);

  return (
    <div style={styles.card}>
      <span className="eyebrow" style={styles.title}>{title}</span>
      {data.length === 0 ? (
        <div style={styles.empty}>No data in the last 30 days.</div>
      ) : (
        <ResponsiveContainer width="100%" height={132}>
          <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -16 }}>
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
              width={34}
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
      <div style={styles.grid}>
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
};
