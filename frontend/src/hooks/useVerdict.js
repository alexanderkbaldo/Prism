import { useSeries } from "./useApi";

// Derives a single directional read of the week from the same alternative-data
// signals the dashboard shows: count-weighted sentiment (social + app reviews)
// and hiring momentum (this week vs last). Shared by the page-top verdict chip
// and the brief's bottom-line rating so the two never disagree.

// N days before an anchor date (YYYY-MM-DD), in UTC.
function isoDaysBefore(anchor, n) {
  const d = new Date(anchor + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Freshest day present across all series categories; windows anchor to this
// rather than the viewer's clock so the verdict tracks the data, not the clock.
function latestDay(series) {
  let m = null;
  for (const pts of Object.values(series || {}))
    for (const p of pts || []) if (!m || p.day > m) m = p.day;
  return m;
}

function weekAgg(points, from, to) {
  let count = 0;
  let sentW = 0;
  let sentN = 0;
  for (const p of points || []) {
    if (p.day < from || p.day > to) continue;
    const c = p.count || 0;
    count += c;
    if (p.avg_sentiment != null) {
      sentW += p.avg_sentiment * (c || 1);
      sentN += c || 1;
    }
  }
  return { count, sentiment: sentN ? sentW / sentN : null };
}

export function useVerdict(ticker) {
  const { data } = useSeries(ticker, 14);
  if (!data) return null;

  const series = data.series || {};
  const anchor = latestDay(series) || new Date().toISOString().slice(0, 10);
  const curFrom = isoDaysBefore(anchor, 6);
  const today = anchor; // most recent day with data
  const priorFrom = isoDaysBefore(anchor, 13);
  const priorTo = isoDaysBefore(anchor, 7);

  let sw = 0;
  let sn = 0;
  for (const k of ["sentiment", "reviews"]) {
    const a = weekAgg(series[k], curFrom, today);
    if (a.sentiment != null) {
      sw += a.sentiment * (a.count || 1);
      sn += a.count || 1;
    }
  }
  const sentiment = sn ? sw / sn : null;

  const hireCur = weekAgg(series.hiring, curFrom, today).count;
  const hirePrior = weekAgg(series.hiring, priorFrom, priorTo).count;

  let score = 0;
  let sentText = "little chatter online";
  if (sentiment != null) {
    if (sentiment >= 0.15) { score += 1; sentText = "people are upbeat"; }
    else if (sentiment <= -0.15) { score -= 1; sentText = "people are downbeat"; }
    else { sentText = "the mood is mixed"; }
  }

  let hireText = "hiring is steady";
  if (hireCur > hirePrior) { score += 1; hireText = "hiring is growing"; }
  else if (hireCur < hirePrior) { score -= 1; hireText = "hiring is slowing"; }

  // Plain words, not finance jargon, Maya should know what it means instantly.
  let label = "Mixed";
  let color = "var(--muted)";
  if (score >= 1) { label = "Looking positive"; color = "var(--up)"; }
  else if (score <= -1) { label = "Looking weak"; color = "var(--down)"; }

  return { label, color, sentText, hireText, score };
}
