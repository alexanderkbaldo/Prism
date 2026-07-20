import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "../api";

async function apiFetch(path) {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useSignals(ticker, days = 7, category = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    // A category filter keeps sparse signals (e.g. filings) from being
    // truncated by the row limit behind hundreds of high-volume ones.
    const path =
      `/signals?company=${ticker}&days=${days}` + (category ? `&type=${category}` : "");
    apiFetch(path)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker, days, category]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { data, loading, error, refresh: fetch_ };
}

export function useAlerts(ticker, days = 7) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    apiFetch(`/alerts?company=${ticker}&days=${days}`)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker, days]);

  return { data, loading, error };
}

export function useBrief(ticker) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    apiFetch(`/brief?company=${ticker}`)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker]);

  return { data, loading, error };
}

export function useSeries(ticker, days = 30) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    apiFetch(`/series?company=${ticker}&days=${days}`)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker, days]);

  return { data, loading, error };
}

export function useEarnings(ticker) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) return;
    // `active` guards against out-of-order responses: if the company is switched
    // again before this request resolves, a stale response must not overwrite
    // the newer company's data. Also clear data up front so the previous
    // company's date never lingers on screen during the switch.
    let active = true;
    setData(null);
    setLoading(true);
    setError(null);
    apiFetch(`/earnings?company=${ticker}`)
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ticker]);

  return { data, loading, error };
}

export function useCorrelation(ticker) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    apiFetch(`/correlation?company=${ticker}`)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker]);

  return { data, loading, error };
}

// Historical backtest summaries for every company (or one, if `ticker` given).
export function useBacktest(ticker = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/backtest${ticker ? `?company=${ticker}` : ""}`)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker]);

  return { data, loading, error };
}

// The most recent weeks the backtest composite flagged as net-positive across
// all companies, each with its 5-day outcome vs the S&P (newest first).
export function useBacktestWeeks(limit = 12) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/backtest/weeks?limit=${limit}`)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [limit]);

  return { data, loading, error };
}

// The paper-trading agent's full record: summary, equity curve, trade log.
export function usePaperPortfolio() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiFetch("/paper/portfolio")
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

// One trade's memo, fetched lazily when a trade row is expanded.
export function fetchTradeMemo(company, week) {
  return apiFetch(
    `/paper/memo?company=${encodeURIComponent(company)}&week=${encodeURIComponent(week)}`
  );
}

// Composite weekly signal scores for one company (oldest week first).
export function useWeeklyScores(ticker) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    apiFetch(`/weekly?company=${ticker}`)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker]);

  return { data, loading, error };
}
