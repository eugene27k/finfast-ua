"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useData, type OverrideInfo } from "@/components/DataProvider";
import { getEffectiveCategory } from "@/lib/mcc";
import type { MonobankStatement } from "@/types/monobank";

export interface CategoryTotal {
  name: string;
  color: string;
  total: number;
  count: number;
}

export interface MonthComparisonData {
  currentMonth: CategoryTotal[];
  previousMonth: CategoryTotal[];
  loading: boolean;
  backfilling: boolean;
  error: string | null;
}

function getMonthRange(year: number, month: number): { from: number; to: number } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  return {
    from: Math.floor(start.getTime() / 1000),
    to: Math.floor(end.getTime() / 1000),
  };
}

function aggregateByCategory(
  transactions: Array<{ mcc: number; id: string; amount: number }>,
  overrides: Record<string, OverrideInfo>
): CategoryTotal[] {
  const expenses = transactions.filter((tx) => tx.amount < 0);
  const map = new Map<string, { total: number; count: number; color: string }>();

  for (const tx of expenses) {
    const { name: cat, color } = getEffectiveCategory(tx.mcc, tx.id, overrides);
    const entry = map.get(cat) || { total: 0, count: 0, color };
    entry.total += Math.abs(tx.amount);
    entry.count += 1;
    map.set(cat, entry);
  }

  return Array.from(map.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);
}

export function useMonthComparison(
  selectedAccounts: string[]
): MonthComparisonData {
  const { userId, token, client, getFiltered, overrides, getTransferInfo } = useData();

  const [previousMonth, setPreviousMonth] = useState<CategoryTotal[]>([]);
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const currentRange = useMemo(
    () => getMonthRange(now.getFullYear(), now.getMonth()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.getMonth(), now.getFullYear()]
  );
  const prevRange = useMemo(
    () => getMonthRange(now.getFullYear(), now.getMonth() - 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.getMonth(), now.getFullYear()]
  );

  // Current month: from already-loaded statements (internal transfers excluded)
  const currentMonth = useMemo(() => {
    const all = getFiltered(selectedAccounts);
    const filtered = all.filter(
      (tx) => tx.time >= currentRange.from && tx.time <= currentRange.to
    );
    const info = getTransferInfo(filtered);
    const spendable = filtered.filter((tx) => !info.get(tx.id)?.internal);
    return aggregateByCategory(spendable, overrides);
  }, [getFiltered, selectedAccounts, currentRange, overrides, getTransferInfo]);

  const accountIds = useMemo(
    () => client?.accounts.map((a) => a.id) || [],
    [client]
  );
  const accountIdsKey = useMemo(
    () => (selectedAccounts.length > 0 ? selectedAccounts : accountIds).sort().join(","),
    [selectedAccounts, accountIds]
  );

  const doBackfill = useCallback(async () => {
    if (!userId || !token || accountIds.length === 0) return;
    setBackfilling(true);
    try {
      const res = await fetch("/api/transactions/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token, accountIds }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.persisted > 0 || data.status === "already_has_data";
      }
      return false;
    } catch {
      return false;
    } finally {
      setBackfilling(false);
    }
  }, [userId, token, accountIds]);

  // Previous month: from DB
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const filterIds = selectedAccounts.length > 0 ? selectedAccounts : accountIds;

    async function fetchPrevMonth(isRetryAfterBackfill = false) {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          userId: userId!,
          from: String(prevRange.from),
          to: String(prevRange.to),
        });
        if (filterIds.length > 0) {
          params.set("accountId", filterIds.join(","));
        }

        const res = await fetch(`/api/transactions/history?${params}`);
        if (!res.ok) throw new Error("Failed to fetch history");

        const data: MonobankStatement[] = await res.json();

        if (data.length === 0 && !isRetryAfterBackfill) {
          // Try backfill, then retry
          const backfilled = await doBackfill();
          if (backfilled && !cancelled) {
            return fetchPrevMonth(true);
          }
        }

        if (!cancelled) {
          const info = getTransferInfo(data);
          const spendable = data.filter((tx) => !info.get(tx.id)?.internal);
          setPreviousMonth(aggregateByCategory(spendable, overrides));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPrevMonth();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, prevRange.from, prevRange.to, accountIdsKey, overrides, doBackfill, getTransferInfo]);

  return { currentMonth, previousMonth, loading, backfilling, error };
}
