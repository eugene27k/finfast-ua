"use client";

import { formatAmount } from "@/lib/currency";
import type { CategoryTotal } from "@/lib/useMonthComparison";

interface MonthComparisonProps {
  currentMonth: CategoryTotal[];
  previousMonth: CategoryTotal[];
  currencyCode: number;
  loading: boolean;
  backfilling: boolean;
}

function ChangeIndicator({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous === 0 && current === 0) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  }
  if (previous === 0) {
    return (
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
        Нова
      </span>
    );
  }
  if (current === 0) {
    return (
      <span className="text-xs font-medium text-green-600 dark:text-green-400">
        -100%
      </span>
    );
  }

  const pctChange = ((current - previous) / previous) * 100;
  const increased = pctChange > 0;
  const sign = increased ? "+" : "";

  // For expenses: increase is bad (red), decrease is good (green)
  const colorClass = increased
    ? "text-red-600 dark:text-red-400"
    : "text-green-600 dark:text-green-400";

  return (
    <span className={`text-xs font-semibold ${colorClass} flex items-center gap-0.5`}>
      <svg
        className={`w-3 h-3 ${increased ? "" : "rotate-180"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
      {sign}{pctChange.toFixed(1)}%
    </span>
  );
}

export default function MonthComparison({
  currentMonth,
  previousMonth,
  currencyCode,
  loading,
  backfilling,
}: MonthComparisonProps) {
  if (loading || backfilling) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Порівняння з минулим місяцем
        </h2>
        <div className="animate-pulse text-gray-400 text-center py-8">
          {backfilling
            ? "Завантажуємо дані за минулий місяць..."
            : "Завантаження..."}
        </div>
      </div>
    );
  }

  // Merge categories from both months
  const allCategories = new Map<
    string,
    { color: string; current: number; previous: number }
  >();

  for (const cat of previousMonth) {
    allCategories.set(cat.name, {
      color: cat.color,
      current: 0,
      previous: cat.total,
    });
  }
  for (const cat of currentMonth) {
    const existing = allCategories.get(cat.name);
    if (existing) {
      existing.current = cat.total;
      existing.color = cat.color;
    } else {
      allCategories.set(cat.name, {
        color: cat.color,
        current: cat.total,
        previous: 0,
      });
    }
  }

  const rows = Array.from(allCategories.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => Math.max(b.current, b.previous) - Math.max(a.current, a.previous));

  const totalPrev = previousMonth.reduce((s, c) => s + c.total, 0);
  const totalCurr = currentMonth.reduce((s, c) => s + c.total, 0);

  const now = new Date();
  const prevMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toLocaleDateString("uk-UA", { month: "long" });
  const currMonthName = new Date(now.getFullYear(), now.getMonth(), 1)
    .toLocaleDateString("uk-UA", { month: "long" });

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
        Порівняння з минулим місяцем
      </h2>

      {rows.length === 0 && previousMonth.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">
            Дані за минулий місяць ще недоступні.
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Вони з&apos;являться після накопичення історії транзакцій.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left py-2 font-medium">Категорія</th>
                <th className="text-right py-2 font-medium capitalize">{prevMonthName}</th>
                <th className="text-right py-2 font-medium capitalize">{currMonthName}</th>
                <th className="text-right py-2 font-medium">Зміна</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  className="border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                >
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {row.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-2.5">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {row.previous > 0 ? formatAmount(row.previous, currencyCode) : "—"}
                    </span>
                  </td>
                  <td className="text-right py-2.5">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {row.current > 0 ? formatAmount(row.current, currencyCode) : "—"}
                    </span>
                  </td>
                  <td className="text-right py-2.5">
                    <ChangeIndicator current={row.current} previous={row.previous} />
                  </td>
                </tr>
              ))}
            </tbody>
            {(totalPrev > 0 || totalCurr > 0) && (
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-gray-600">
                  <td className="py-2.5">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Всього
                    </span>
                  </td>
                  <td className="text-right py-2.5">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {formatAmount(totalPrev, currencyCode)}
                    </span>
                  </td>
                  <td className="text-right py-2.5">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {formatAmount(totalCurr, currencyCode)}
                    </span>
                  </td>
                  <td className="text-right py-2.5">
                    <ChangeIndicator current={totalCurr} previous={totalPrev} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
