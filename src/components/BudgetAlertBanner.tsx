"use client";

import Link from "next/link";
import type { BudgetStatus } from "@/types/monobank";
import { getCategoryColor } from "@/lib/mcc";
import { formatAmount } from "@/lib/currency";

interface BudgetAlertBannerProps {
  statuses: BudgetStatus[];
  currencyCode: number;
}

export default function BudgetAlertBanner({
  statuses,
  currencyCode,
}: BudgetAlertBannerProps) {
  const alerts = statuses.filter(
    (s) => s.status === "warning" || s.status === "exceeded"
  );

  if (alerts.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Бюджети</h3>
        <Link
          href="/budgets"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Переглянути всі
        </Link>
      </div>
      {alerts.map((s) => (
        <div key={s.category} className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: getCategoryColor(s.category) }}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300 min-w-[100px]">
            {s.category}
          </span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.min(s.percentage, 100)}%`,
                backgroundColor:
                  s.status === "exceeded" ? "#ef4444" : "#f59e0b",
              }}
            />
          </div>
          <span
            className={`text-xs font-medium whitespace-nowrap ${
              s.status === "exceeded" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {s.status === "exceeded"
              ? `+${formatAmount(s.spent - s.limit, currencyCode)}`
              : `${s.percentage.toFixed(0)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}
