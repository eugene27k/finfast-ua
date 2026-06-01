"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import type { MonobankStatement } from "@/types/monobank";

/** A persisted transaction row: a statement plus the account it belongs to. */
export type StoredStatement = MonobankStatement & { accountId: string };

/**
 * Fetches persisted transactions from the local DB for an arbitrary range.
 *
 * Live statements in DataProvider only cover the last ~30 days, so this is used
 * to fill in older portions of a selected range (e.g. "минулий місяць" or a
 * custom range in the past). It only reads what has already been stored — it
 * never triggers a new Monobank fetch.
 *
 * Pass `enabled = false` (typically when the range stays within the live window)
 * to skip the request entirely.
 */
export function useDbHistory(
  from: number,
  to: number,
  accountIds: string[],
  enabled: boolean
): { history: StoredStatement[]; loading: boolean } {
  const { userId } = useData();
  const [history, setHistory] = useState<StoredStatement[]>([]);
  const [loading, setLoading] = useState(false);

  const accKey = useMemo(
    () => [...accountIds].sort().join(","),
    [accountIds]
  );

  useEffect(() => {
    if (!userId || !enabled) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      userId,
      from: String(from),
      to: String(to),
    });
    if (accKey) params.set("accountId", accKey);

    fetch(`/api/transactions/history?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: StoredStatement[]) => {
        if (!cancelled) setHistory(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, enabled, from, to, accKey]);

  return { history, loading };
}
