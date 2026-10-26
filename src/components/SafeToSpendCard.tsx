"use client";

import Link from "next/link";
import type { BudgetStatus } from "@/types/monobank";
import { formatAmount } from "@/lib/currency";

/** Ukrainian plural for "день" (1 день / 2-4 дні / 5+ днів). */
function pluralDays(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "днів";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дні";
  return "днів";
}

/**
 * Forward-looking hero for the dashboard: answers "how much can I still spend?"
 * instead of "how much do I have?". Derived from the same budget statuses the
 * rest of the dashboard already computes (monthly-equivalent limits, spend so
 * far and the projected month-end pace).
 *
 * With no budgets set it degrades into a "create your first budget" CTA, which
 * doubles as a dashboard empty state.
 */
export default function SafeToSpendCard({
  statuses,
  currencyCode,
}: {
  statuses: BudgetStatus[];
  currencyCode: number;
}) {
  if (statuses.length === 0) {
    return (
      <Link
        href="/budgets"
        className="block bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-6 hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Скільки можна витратити?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Створіть перший бюджет — і тут з&apos;явиться безпечна сума на день і на місяць.
            </p>
          </div>
          <span className="shrink-0 px-4 py-2 rounded-lg bg-blue-600 group-hover:bg-blue-700 text-white text-sm font-medium transition-colors">
            Створити бюджет
          </span>
        </div>
      </Link>
    );
  }

  const totalBudget = statuses.reduce((s, b) => s + (b.monthlyLimit ?? b.limit), 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);
  const totalProjected = statuses.reduce(
    (s, b) => s + (b.projectedMonthEnd ?? b.spent),
    0
  );
  const remaining = totalBudget - totalSpent;
  const safe = Math.max(0, remaining);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  // Days left to spend, today included.
  const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1);
  const perDay = Math.round(safe / remainingDays);

  const isOver = remaining < 0;
  const willOver = !isOver && totalProjected > totalBudget;
  const spentPct =
    totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  const gradient = isOver
    ? "from-rose-600 to-red-700"
    : willOver
    ? "from-amber-500 to-orange-600"
    : "from-emerald-600 to-teal-700";

  return (
    <div
      className={`bg-gradient-to-r ${gradient} text-white p-6 rounded-2xl shadow-lg`}
    >
      <p className="text-sm text-white/80">
        {isOver ? "Бюджет на місяць перевищено" : "Безпечно витратити цього місяця"}
      </p>
      <p className="text-4xl font-bold mt-2">
        {isOver ? "−" : ""}
        {formatAmount(Math.abs(remaining), currencyCode)}
      </p>

      <p className="text-sm text-white/90 mt-1">
        {isOver
          ? "Витрати перевищили заплановані бюджети на цей місяць."
          : `≈ ${formatAmount(perDay, currencyCode)}/день · залишилось ${remainingDays} ${pluralDays(remainingDays)}`}
      </p>

      <div className="mt-4 space-y-2">
        <div className="flex rounded-full h-3 overflow-hidden bg-black/20">
          <div
            className="bg-white/90 h-full transition-all"
            style={{ width: `${spentPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/80 gap-2">
          <span>
            Витрачено {formatAmount(totalSpent, currencyCode)} з{" "}
            {formatAmount(totalBudget, currencyCode)}
          </span>
          {willOver && (
            <span className="text-white font-medium whitespace-nowrap">
              На цьому темпі вийдете за межі
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
