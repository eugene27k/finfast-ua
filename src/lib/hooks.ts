"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  MonobankClientInfo,
  MonobankStatement,
  MonobankCurrencyRate,
} from "@/types/monobank";

const TOKEN_KEY = "finfast_mono_token";
const CLIENT_CACHE_KEY = "finfast_client_info";
const CLIENT_CACHE_TTL = 60_000; // 60 seconds (Monobank rate limit)
const STATEMENT_CACHE_KEY = "finfast_statements";
const STATEMENT_CACHE_TTL = 60_000;
const CURRENCY_CACHE_KEY = "finfast_currency";
const CURRENCY_CACHE_TTL = 5 * 60_000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

function getCache<T>(storageKey: string, cacheKey: string, ttl: number): T | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (entry.key !== cacheKey) return null;
    if (Date.now() - entry.timestamp > ttl) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function setCache<T>(storageKey: string, cacheKey: string, data: T) {
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ data, timestamp: Date.now(), key: cacheKey })
    );
  } catch {
    // sessionStorage full or unavailable
  }
}

export function useToken() {
  const [token, setTokenState] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) setTokenState(saved);
    setReady(true);
  }, []);

  const setToken = (t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setTokenState(t);
  };

  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(CLIENT_CACHE_KEY);
    setTokenState("");
  };

  return { token, setToken, clearToken, ready };
}

export function useClientInfo(token: string) {
  const [data, setData] = useState<MonobankClientInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async (skipCache = false) => {
    if (!token) return;

    if (!skipCache) {
      const cached = getCache<MonobankClientInfo>(CLIENT_CACHE_KEY, token, CLIENT_CACHE_TTL);
      if (cached) {
        setData(cached);
        return;
      }
    }

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
      const result = await res.json();
      setData(result);
      setCache(CLIENT_CACHE_KEY, token, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { data, loading, error, refetch: () => fetch_(true) };
}

export function useStatement(token: string, accountId: string, from: number, to?: number) {
  const [data, setData] = useState<MonobankStatement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `${accountId}:${from}:${to || ""}`;
  const storageKey = `${STATEMENT_CACHE_KEY}_${accountId}`;

  const fetch_ = useCallback(async (skipCache = false) => {
    if (!token || !accountId) return;

    if (!skipCache) {
      const cached = getCache<MonobankStatement[]>(storageKey, cacheKey, STATEMENT_CACHE_TTL);
      if (cached) {
        setData(cached);
        return;
      }
    }

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
      const result = await res.json();
      setData(result);
      setCache(storageKey, cacheKey, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token, accountId, from, to, cacheKey, storageKey]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { data, loading, error, refetch: () => fetch_(true) };
}

export function useMultiStatement(token: string, accountIds: string[], from: number, to?: number) {
  const [data, setData] = useState<MonobankStatement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsKey = accountIds.sort().join(",");

  const fetch_ = useCallback(async () => {
    if (!token || accountIds.length === 0) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results: MonobankStatement[][] = [];
      for (const accId of accountIds) {
        const storageKey = `${STATEMENT_CACHE_KEY}_${accId}`;
        const cacheKey = `${accId}:${from}:${to || ""}`;
        const cached = getCache<MonobankStatement[]>(storageKey, cacheKey, STATEMENT_CACHE_TTL);

        if (cached) {
          results.push(cached);
        } else {
          const params = new URLSearchParams({
            account: accId,
            from: String(from),
          });
          if (to) params.set("to", String(to));

          const res = await fetch(`/api/monobank/statement?${params}`, {
            headers: { "x-mono-token": token },
          });
          if (res.ok) {
            const result = await res.json();
            results.push(result);
            setCache(storageKey, cacheKey, result);
          }
        }
      }
      const merged = results.flat().sort((a, b) => b.time - a.time);
      setData(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, idsKey, from, to]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { data, loading, error };
}

export function useCurrencyRates() {
  const [data, setData] = useState<MonobankCurrencyRate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = getCache<MonobankCurrencyRate[]>(CURRENCY_CACHE_KEY, "rates", CURRENCY_CACHE_TTL);
    if (cached) {
      setData(cached);
      return;
    }

    setLoading(true);
    fetch("/api/monobank/currency")
      .then((r) => r.json())
      .then((result) => {
        if (Array.isArray(result)) {
          setData(result);
          setCache(CURRENCY_CACHE_KEY, "rates", result);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
