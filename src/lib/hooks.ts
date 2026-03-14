"use client";

import { useState, useEffect } from "react";
import type { MonobankCurrencyRate } from "@/types/monobank";

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
