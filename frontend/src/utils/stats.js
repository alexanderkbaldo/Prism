// Compute the five headline signal stats for a company from its /series data.
// Mirrors the dashboard's StatRow aggregation (trailing 7 days) so the compare
// page and the dashboard never disagree.

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function agg(points, from, to) {
  let count = 0;
  let sentW = 0;
  let sentN = 0;
  let intSum = 0;
  let intN = 0;
  for (const p of points || []) {
    if (p.day < from || p.day > to) continue;
    const c = p.count || 0;
    count += c;
    if (p.avg_sentiment != null) {
      sentW += p.avg_sentiment * (c || 1);
      sentN += c || 1;
    }
    if (p.avg_interest != null) {
      intSum += p.avg_interest;
      intN += 1;
    }
  }
  return {
    count,
    sentiment: sentN ? sentW / sentN : null,
    interest: intN ? intSum / intN : null,
  };
}

const SIGNALS = [
  { key: "sentiment", label: "Social", metric: "count", unit: "mentions" },
  { key: "hiring", label: "Hiring", metric: "count", unit: "postings" },
  { key: "trends", label: "Search", metric: "index", unit: "index" },
  { key: "reviews", label: "App reviews", metric: "count", unit: "reviews" },
  { key: "filings", label: "Filings", metric: "count", unit: "filings" },
];

// Returns an array of { key, label, value, display, unit } for one company's
// series. `value` is the comparable number (higher = stronger this week).
export function computeStats(series) {
  const from = isoDaysAgo(6);
  const to = isoDaysAgo(0);
  return SIGNALS.map((s) => {
    const a = agg(series?.[s.key], from, to);
    if (s.metric === "index") {
      const v = a.interest == null ? null : Math.round(a.interest);
      return { key: s.key, label: s.label, value: v, display: v == null ? "-" : `${v}`, unit: "0–100" };
    }
    return { key: s.key, label: s.label, value: a.count, display: `${a.count}`, unit: s.unit };
  });
}

// A short "Company: Social 12, Hiring 4, …" line for the AI comparison prompt.
export function statsSummary(name, stats) {
  const parts = stats.map((s) => `${s.label} ${s.display}`).join(", ");
  return `${name}: ${parts}`;
}
