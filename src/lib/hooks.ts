"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  MonobankClientInfo,
  MonobankStatement,
  MonobankCurrencyRate,
} from "@/types/monobank";

const TOKEN_KEY = "finfast_mono_token";

export function useToken() {
  const [token, setTokenState] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) setTokenState(saved);
  }, []);

  const setToken = (t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setTokenState(t);
  };

  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    setTokenState("");
  };

  return { token, setToken, clearToken };
}

export function useClientInfo(token: string) {
  const [data, setData] = useState<MonobankClientInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/monobank/client-info", {
        headers: { "x-mono-token": token },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch");
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

export function useStatement(token: string, accountId: string, from: number, to?: number) {
  const [data, setData] = useState<MonobankStatement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!token || !accountId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        account: accountId,
        from: String(from),
      });
      if (to) params.set("to", String(to));

      const res = await fetch(`/api/monobank/statement?${params}`, {
        headers: { "x-mono-token": token },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch");
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token, accountId, from, to]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

export function useCurrencyRates() {
  const [data, setData] = useState<MonobankCurrencyRate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/monobank/currency")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
