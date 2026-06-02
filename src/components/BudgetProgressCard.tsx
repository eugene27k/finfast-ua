"use client";

import type { BudgetStatus } from "@/types/monobank";
import { getCategoryColor } from "@/lib/mcc";
import { formatAmount } from "@/lib/currency";

interface BudgetProgressCardProps {
  status: BudgetStatus;
  currencyCode: number;
  color?: string;
  onEdit: () => void;
  onDelete: () => void;
}

export default function BudgetProgressCard({
  status,
  currencyCode,
  color,
  onEdit,
  onDelete,
}: BudgetProgressCardProps) {
  const categoryColor = color ?? getCategoryColor(status.category);
  const barColor =
    status.status === "exceeded"
      ? "#ef4444"
      : status.status === "warning"
      ? "#f59e0b"
      : categoryColor;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: categoryColor }}
          />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {status.category}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Редагувати"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Видалити"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-2">
        <div
          className="h-3 rounded-full transition-all"
          style={{
            width: `${Math.min(status.percentage, 100)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {formatAmount(status.spent, currencyCode)} /{" "}
          {formatAmount(status.limit, currencyCode)}
        </span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            status.status === "exceeded"
              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
              : status.status === "warning"
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          }`}
        >
          {status.percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
