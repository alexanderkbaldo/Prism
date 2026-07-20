// One shared source of truth for what Prism's numbers mean. Consumed by the
// Guide's "numbers, defined" section and by InfoTips on the Investments page,
// so definitions never drift between the two.

export const GLOSSARY = [
  {
    id: "signal-read",
    term: "Signal read",
    def:
      "A 0–100 composite of the week's social sentiment and hiring signals. " +
      "50 is neutral; above ~55 reads positive, below ~45 reads negative.",
  },
  {
    id: "sentiment",
    term: "Sentiment",
    def:
      "The mood of social posts and app reviews, ranked among the five " +
      "companies Prism tracks.",
  },
  {
    id: "buzz",
    term: "Buzz",
    def: "Volume of social mentions, ranked among the five companies.",
  },
  {
    id: "hiring",
    term: "Hiring",
    def: "Volume of open job postings, ranked among the five companies.",
  },
  {
    id: "trend",
    term: "Trend",
    def: "The company's signal read over recent weeks, oldest to newest.",
  },
  {
    id: "anomaly",
    term: "Anomaly (2σ)",
    def:
      "A signal more than two standard deviations outside its own recent " +
      "pattern: a statistically unusual move worth a closer look.",
  },
  {
    id: "flagged-week",
    term: "Flagged week",
    def:
      "A week the two signals with real historical depth (search interest " +
      "and SEC filings) scored net-positive relative to their trailing " +
      "pattern.",
  },
  {
    id: "paper-trade",
    term: "Paper trade",
    def:
      "A simulated position with imaginary money, recorded at real market " +
      "prices. It tracks what a rule would have done without risking a cent.",
  },
  {
    id: "hit-rate",
    term: "Hit rate",
    def:
      "Of the weeks the signals flagged as net-positive, the share where the " +
      "stock beat the S&P 500 over the next five trading days.",
  },
  {
    id: "base-rate",
    term: "Base rate",
    def:
      "How often any week beat the S&P 500 over the same window. This is the " +
      "bar the hit rate has to clear to mean anything.",
  },
  {
    id: "edge",
    term: "Edge",
    def:
      "Hit rate minus base rate, in points. Positive means flagged weeks did " +
      "better than a typical week did. Historical, not a forecast.",
  },
  {
    id: "avg-5d",
    term: "Avg 5d vs S&P",
    def:
      "The average return relative to the S&P 500 in the five trading days " +
      "after a flagged week.",
  },
];

// Convenience lookup: gloss("hit-rate") -> definition string.
const byId = Object.fromEntries(GLOSSARY.map((g) => [g.id, g.def]));
export const gloss = (id) => byId[id] || "";
