import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "../api";

async function apiFetch(path) {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useSignals(ticker, days = 7) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    apiFetch(`/signals?company=${ticker}&days=${days}`)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker, days]);

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
