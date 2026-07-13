import { useState, useEffect } from "react";
import { apiUrl } from "../api";

// Next-earnings date for all five fintechs at once, sorted soonest first.
// Fans out /earnings per company (mirrors usePeerRanks' Promise.all pattern);
// each response already carries the API's own mock fallback, so this always
// resolves to a full calendar.

const COMPANIES = [
  ["HOOD", "Robinhood"],
  ["AFRM", "Affirm"],
  ["XYZ", "Block"],
  ["KLAR", "Klarna"],
  ["CHYM", "Chime"],
];

export function useEarningsCalendar() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      COMPANIES.map(([t]) =>
        fetch(apiUrl(`/earnings?company=${t}`))
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const out = COMPANIES.map(([ticker, name], i) => {
        const d = results[i] || {};
        return {
          ticker,
          name,
          date: d.next_earnings_date ?? null,
          days: d.days_until ?? null,
        };
      });
      // Soonest first; unknown dates sink to the bottom.
      out.sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));
      setRows(out);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows };
}
