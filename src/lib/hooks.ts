"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  MonobankClientInfo,
  MonobankStatement,
  MonobankCurrencyRate,
} from "@/types/monobank";

const TOKEN_KEY = "finfast_mono_token";
const CLIENT_CACHE_KEY = "finfast_client_info";
const CLIENT_CACHE_TTL = 60_000;
const STATEMENT_CACHE_KEY = "finfast_stmt";
const STATEMENT_CACHE_TTL = 5 * 60_000; // 5 min — load once, filter locally
const CURRENCY_CACHE_KEY = "finfast_currency";
const CURRENCY_CACHE_TTL = 5 * 60_000;

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

export interface FetchProgress {
  current: number;
  total: number;
  currentAccountId: string;
}

export interface FetchResult {
  status: "success" | "partial" | "rate_limited" | "error" | "cache";
  loaded: number;
  total: number;
  txCount: number;
  errorMessage?: string;
}

// Fetches statements for ALL accounts once, caches per-account.
// Filtering by selected accounts is done locally via `filtered`.
export function useAllStatements(
  token: string,
  accountIds: string[],
  from: number,
  to?: number
) {
  // allData: map of accountId -> statements
  const [allData, setAllData] = useState<Record<string, MonobankStatement[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<FetchResult | null>(null);
  const [progress, setProgress] = useState<FetchProgress | null>(null);

  const idsKey = [...accountIds].sort().join(",");

  const fetchAll = useCallback(async (skipCache = false) => {
    if (!token || accountIds.length === 0) {
      setAllData({});
      return;
    }

    setLoading(true);
    setError(null);
    setLastResult(null);
    setProgress(null);
    const result: Record<string, MonobankStatement[]> = {};
    let rateLimited = false;
    let allFromCache = true;
    let fetchedCount = 0;
    let apiError: string | null = null;

    try {
      for (let i = 0; i < accountIds.length; i++) {
        const accId = accountIds[i];
        const storageKey = `${STATEMENT_CACHE_KEY}_${accId}`;
        const cacheKey = `${accId}:${from}:${to || ""}`;

        if (!skipCache) {
          const cached = getCache<MonobankStatement[]>(storageKey, cacheKey, STATEMENT_CACHE_TTL);
          if (cached) {
            result[accId] = cached;
            fetchedCount++;
            continue;
          }
        }

        allFromCache = false;
        setProgress({ current: i + 1, total: accountIds.length, currentAccountId: accId });

        const params = new URLSearchParams({
          account: accId,
          from: String(from),
        });
        if (to) params.set("to", String(to));

        const res = await fetch(`/api/monobank/statement?${params}`, {
          headers: { "x-mono-token": token },
        });

        if (res.status === 429) {
          rateLimited = true;
          break;
        }

        if (res.ok) {
          const data = await res.json();
          result[accId] = data;
          setCache(storageKey, cacheKey, data);
          fetchedCount++;
        } else {
          try {
            const err = await res.json();
            apiError = err.error || `HTTP ${res.status}`;
          } catch {
            apiError = `HTTP ${res.status}`;
          }
        }

        // Small delay between requests to avoid rate limiting
        if (i < accountIds.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      setProgress(null);
      // Merge: update accounts we fetched, keep previous data for the rest
      setAllData((prev) => {
        if (Object.keys(result).length === 0) return prev;
        return { ...prev, ...result };
      });

      const txCount = Object.values(result).reduce((s, arr) => s + arr.length, 0);

      if (rateLimited) {
        setLastResult({ status: "rate_limited", loaded: fetchedCount, total: accountIds.length, txCount });
      } else if (apiError) {
        setLastResult({ status: "error", loaded: fetchedCount, total: accountIds.length, txCount, errorMessage: apiError });
      } else if (allFromCache) {
        setLastResult({ status: "cache", loaded: fetchedCount, total: accountIds.length, txCount });
      } else if (fetchedCount < accountIds.length) {
        setLastResult({ status: "partial", loaded: fetchedCount, total: accountIds.length, txCount });
      } else {
        setLastResult({ status: "success", loaded: fetchedCount, total: accountIds.length, txCount });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setLastResult({ status: "error", loaded: 0, total: accountIds.length, txCount: 0, errorMessage: msg });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, idsKey, from, to]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getFiltered = useCallback(
    (selectedIds: string[]): MonobankStatement[] => {
      const ids = selectedIds.length === 0 ? accountIds : selectedIds;
      return ids
        .flatMap((id) => allData[id] || [])
        .sort((a, b) => b.time - a.time);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allData, idsKey]
  );

  return {
    allData,
    loading,
    progress,
    error,
    lastResult,
    refresh: () => fetchAll(true),
    getFiltered,
  };
}

// Keep simple single-account hook for dashboard budget alerts
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
