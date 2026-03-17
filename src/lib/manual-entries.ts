"use client";

import { useState, useEffect, useCallback } from "react";

export type EntryType = "asset" | "liability";

export type AssetCategory = "deposit" | "cash" | "investment" | "other-asset";
export type LiabilityCategory = "installment" | "buy-in-parts" | "short-loan" | "mortgage" | "other-liability";
export type EntryCategory = AssetCategory | LiabilityCategory;

export interface ManualEntry {
  id: string;
  type: EntryType;
  category: EntryCategory;
  label: string;
  amount: number; // in minor units (kopiyky)
  currencyCode: number;
  createdAt: number;
}

export const ASSET_CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: "deposit", label: "Депозит" },
  { value: "cash", label: "Готівка" },
  { value: "investment", label: "Інвестиції" },
  { value: "other-asset", label: "Інший актив" },
];

export const LIABILITY_CATEGORIES: { value: LiabilityCategory; label: string }[] = [
  { value: "installment", label: "Розстрочка" },
  { value: "buy-in-parts", label: "Покупки частинами" },
  { value: "short-loan", label: 'Кредит "До завтра"' },
  { value: "mortgage", label: "Іпотека / кредит" },
  { value: "other-liability", label: "Інше зобов'язання" },
];

const STORAGE_KEY = "finfast_manual_entries";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useManualEntries() {
  const [entries, setEntriesState] = useState<ManualEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntriesState(JSON.parse(raw));
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: ManualEntry[]) => {
    setEntriesState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addEntry = useCallback(
    (entry: Omit<ManualEntry, "id" | "createdAt">) => {
      const newEntry: ManualEntry = {
        ...entry,
        id: generateId(),
        createdAt: Date.now(),
      };
      setEntriesState((prev) => {
        const next = [...prev, newEntry];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const removeEntry = useCallback(
    (id: string) => {
      setEntriesState((prev) => {
        const next = prev.filter((e) => e.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<ManualEntry, "id" | "createdAt">>) => {
      setEntriesState((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const clearAll = useCallback(() => {
    persist([]);
  }, [persist]);

  return { entries, ready, addEntry, removeEntry, updateEntry, clearAll };
}
