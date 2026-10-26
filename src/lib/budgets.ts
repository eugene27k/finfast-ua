"use client";

import { useState, useEffect } from "react";
import type {
  MonobankStatement,
  BudgetStatus,
  MonobankCurrencyRate,
} from "@/types/monobank";
import { getEffectiveCategory } from "@/lib/mcc";
import { toBaseCurrencyMinor, type Overrides } from "@/lib/analytics";

const BUDGETS_KEY = "finfast_budgets";
/** Budgets are stored and compared in UAH (the base currency). */
const BASE = 980;

export type BudgetPeriod = "day" | "week" | "month";

/** A budget target: an amount (base-currency minor units) over a period. */
export interface BudgetEntry {
  amount: number;
  period: BudgetPeriod;
}

export type BudgetMap = Record<string, BudgetEntry>;

/**
 * Read a possibly-legacy stored value into the current shape. The old format was
 * `Record<string, number>` where the number was a MONTHLY limit in minor units.
 */
function coerceBudgets(raw: unknown): BudgetMap {
  if (!raw || typeof raw !== "object") return {};
  const out: BudgetMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number") {
      out[key] = { amount: value, period: "month" };
    } else if (
      value &&
      typeof value === "object" &&
      typeof (value as BudgetEntry).amount === "number"
    ) {
      const period = (value as BudgetEntry).period;
      out[key] = {
        amount: (value as BudgetEntry).amount,
        period:
          period === "day" || period === "week" || period === "month"
            ? period
            : "month",
      };
    }
  }
  return out;
}

export function useBudgets() {
  const [budgets, setBudgetsState] = useState<BudgetMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BUDGETS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const coerced = coerceBudgets(parsed);
        setBudgetsState(coerced);
        // Upgrade the stored shape once so later reads are clean.
        if (JSON.stringify(parsed) !== JSON.stringify(coerced)) {
          localStorage.setItem(BUDGETS_KEY, JSON.stringify(coerced));
        }
      }
    } catch {
      // ignore corrupt storage
    }
    setReady(true);
  }, []);

  const persist = (next: BudgetMap) => {
    setBudgetsState(next);
    localStorage.setItem(BUDGETS_KEY, JSON.stringify(next));
  };

  const setBudget = (category: string, amount: number, period: BudgetPeriod) => {
    persist({ ...budgets, [category]: { amount, period } });
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

/** Calendar days in the month of `d`. */
export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Daily limit (minor units) implied by a budget entry for a given month length. */
export function dailyLimitOf(entry: BudgetEntry, dim: number): number {
  switch (entry.period) {
    case "day":
      return entry.amount;
    case "week":
      return entry.amount / 7;
    case "month":
    default:
      return entry.amount / dim;
  }
}

export function getBudgetStatuses(
  budgets: BudgetMap,
  transactions: MonobankStatement[],
  overrides: Overrides = {},
  rates: MonobankCurrencyRate[] = [],
  accountCurrencyByTxId: Map<string, number> = new Map()
): BudgetStatus[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartUnix = Math.floor(monthStart.getTime() / 1000);
  const dim = daysInMonth(now);
  const daysElapsed = Math.max(1, now.getDate());
  const remainingDays = Math.max(0, dim - daysElapsed);

  const expenses = transactions.filter(
    (tx) => tx.amount < 0 && tx.time >= monthStartUnix
  );

  const fx = { rates, baseCurrency: BASE, accountCurrencyByTxId };
  const spentMap = new Map<string, number>();
  for (const tx of expenses) {
    const { name } = getEffectiveCategory(tx.mcc, tx.id, overrides);
    const accountCurrency = accountCurrencyByTxId.get(tx.id) ?? BASE;
    const value = Math.abs(toBaseCurrencyMinor(tx.amount, accountCurrency, fx));
    spentMap.set(name, (spentMap.get(name) || 0) + value);
  }

  return Object.entries(budgets)
    .map(([category, entry]) => {
      const dailyLimit = dailyLimitOf(entry, dim);
      const monthlyLimit = dailyLimit * dim;
      const spent = spentMap.get(category) || 0;
      const dailyAvgSoFar = spent / daysElapsed;
      const projectedMonthEnd = spent + dailyAvgSoFar * remainingDays;
      const percentage = monthlyLimit > 0 ? (spent / monthlyLimit) * 100 : 0;
      const status: BudgetStatus["status"] =
        percentage >= 100 ? "exceeded" : percentage >= 75 ? "warning" : "ok";
      const pace: BudgetStatus["pace"] =
        spent >= monthlyLimit
          ? "exceeded"
          : projectedMonthEnd > monthlyLimit
          ? "projected_over"
          : dailyAvgSoFar > dailyLimit
          ? "over_pace"
          : "on_track";
      return {
        category,
        limit: monthlyLimit,
        spent,
        percentage,
        status,
        period: entry.period,
        dailyLimit,
        monthlyLimit,
        dailyAvgSoFar,
        projectedMonthEnd,
        pace,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
}
