"use client";

import Link from "next/link";
import type { BudgetStatus } from "@/types/monobank";
import { getCategoryColor } from "@/lib/mcc";
import { formatAmount } from "@/lib/currency";

interface BudgetAlertBannerProps {
  statuses: BudgetStatus[];
  currencyCode: number;
}

/** Right-hand label, colour and bar colour for a single alerting budget. */
function alertView(s: BudgetStatus, currencyCode: number) {
  if (s.status === "exceeded" || s.pace === "exceeded") {
    return {
      bar: "#ef4444",
      textClass: "text-red-600 dark:text-red-400",
      text: `+${formatAmount(Math.max(0, s.spent - s.limit), currencyCode)}`,
    };
  }
  if (s.pace === "projected_over") {
    return {
      bar: "#f97316",
      textClass: "text-orange-600 dark:text-orange-400",
      text: `прогноз ≈ ${formatAmount(Math.round(s.projectedMonthEnd ?? 0), currencyCode)}`,
    };
  }
  if (s.status === "warning") {
    return {
      bar: "#f59e0b",
      textClass: "text-amber-600 dark:text-amber-400",
      text: `${s.percentage.toFixed(0)}%`,
    };
  }
  // over_pace
  return {
    bar: "#f59e0b",
    textClass: "text-amber-600 dark:text-amber-400",
    text: "темп ↑",
  };
}

export default function BudgetAlertBanner({
  statuses,
  currencyCode,
}: BudgetAlertBannerProps) {
  const alerts = statuses.filter(
    (s) =>
      s.status === "warning" ||
      s.status === "exceeded" ||
      s.pace === "over_pace" ||
      s.pace === "projected_over"
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
      {alerts.map((s) => {
        const view = alertView(s, currencyCode);
        return (
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
                  backgroundColor: view.bar,
                }}
              />
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${view.textClass}`}>
              {view.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
