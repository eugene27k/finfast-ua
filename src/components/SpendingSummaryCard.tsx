"use client";

import { useMemo } from "react";
import type { MonobankStatement, MonobankCurrencyRate } from "@/types/monobank";
import { formatAmount } from "@/lib/currency";
import {
  categoryTotals,
  averagePerDay,
  daysInRange,
  type Overrides,
} from "@/lib/analytics";

/** Aggregates are normalised to UAH (see analytics.ts). */
const BASE = 980;
const TOP_N = 6;

interface SpendingSummaryCardProps {
  /** Spendable transactions (internal transfers already excluded). */
  transactions: MonobankStatement[];
  overrides: Overrides;
  rates: MonobankCurrencyRate[];
  /** txId → account currency, so amounts convert by the correct currency. */
  accountCurrencyByTxId: Map<string, number>;
  from: number;
  to: number;
  /** When provided, each category gets a "set as daily budget" action. */
  onMakeBudget?: (category: string, dailyMinor: number) => void;
}

export default function SpendingSummaryCard({
  transactions,
  overrides,
  rates,
  accountCurrencyByTxId,
  from,
  to,
  onMakeBudget,
}: SpendingSummaryCardProps) {
  const totals = useMemo(
    () =>
      categoryTotals(transactions, overrides, {
        rates,
        baseCurrency: BASE,
        accountCurrencyByTxId,
      }),
    [transactions, overrides, rates, accountCurrencyByTxId]
  );

  const days = daysInRange(from, to);
  const totalExpense = totals.reduce((s, c) => s + c.total, 0);
  const avgOverall = averagePerDay(totalExpense, days);
  const top = totals.slice(0, TOP_N);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">
        Середні витрати за день
      </h2>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        За {days} {pluralDays(days)} · приблизно у грн
      </p>

      {totalExpense === 0 ? (
        <div className="flex items-center justify-center h-24 text-gray-400">
          Немає витрат за цей період
        </div>
      ) : (
        <>
          <div className="mb-5">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              ≈ {formatAmount(Math.round(avgOverall), BASE)}
              <span className="text-base font-medium text-gray-400 dark:text-gray-500">
                {" "}
                /день
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Усього за період: {formatAmount(totalExpense, BASE)}
            </div>
          </div>

          <div className="space-y-3">
            {top.map((cat) => {
              const catAvg = Math.round(averagePerDay(cat.total, days));
              const pct =
                totalExpense > 0 ? (cat.total / totalExpense) * 100 : 0;
              return (
                <div key={cat.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {cat.name}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        ≈ {formatAmount(catAvg, BASE)}/день
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                  {onMakeBudget && (
                    <button
                      onClick={() => onMakeBudget(cat.name, catAvg)}
                      title="Зробити денним бюджетом"
                      className="shrink-0 text-xs px-2 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors whitespace-nowrap"
                    >
                      У бюджет
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дні";
  return "днів";
}
