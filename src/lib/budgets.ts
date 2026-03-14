"use client";

import { useState, useEffect } from "react";
import type { MonobankStatement, BudgetStatus } from "@/types/monobank";
import { getMccCategory } from "@/lib/mcc";

const BUDGETS_KEY = "finfast_budgets";

export function useBudgets() {
  const [budgets, setBudgetsState] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BUDGETS_KEY);
      if (raw) setBudgetsState(JSON.parse(raw));
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const persist = (next: Record<string, number>) => {
    setBudgetsState(next);
    localStorage.setItem(BUDGETS_KEY, JSON.stringify(next));
  };

  const setBudget = (category: string, amount: number) => {
    persist({ ...budgets, [category]: amount });
  };

  const removeBudget = (category: string) => {
    const next = { ...budgets };
    delete next[category];
    persist(next);
  };

  const clearAllBudgets = () => {
    persist({});
  };

  return { budgets, ready, setBudget, removeBudget, clearAllBudgets };
}

export function getBudgetStatuses(
  budgets: Record<string, number>,
  transactions: MonobankStatement[]
): BudgetStatus[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartUnix = Math.floor(monthStart.getTime() / 1000);

  const expenses = transactions.filter(
    (tx) => tx.amount < 0 && tx.time >= monthStartUnix
  );

  const spentMap = new Map<string, number>();
  for (const tx of expenses) {
    const cat = getMccCategory(tx.mcc);
    spentMap.set(cat, (spentMap.get(cat) || 0) + Math.abs(tx.amount));
  }

  return Object.entries(budgets)
    .map(([category, limit]) => {
      const spent = spentMap.get(category) || 0;
      const percentage = limit > 0 ? (spent / limit) * 100 : 0;
      return {
        category,
        limit,
        spent,
        percentage,
        status: (percentage >= 100 ? "exceeded" : percentage >= 75 ? "warning" : "ok") as BudgetStatus["status"],
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
}
