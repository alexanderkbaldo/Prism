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
    setLoading(true);
    apiFetch(`/earnings?company=${ticker}`)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
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
