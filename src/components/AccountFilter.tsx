"use client";

import { useState } from "react";
import type { MonobankAccount } from "@/types/monobank";
import { getCurrencyInfo } from "@/lib/currency";
import { sortAccounts } from "@/lib/accounts";

const TYPE_LABELS: Record<string, string> = {
  black: "Чорна",
  white: "Біла",
  platinum: "Platinum",
  iron: "Iron",
  fop: "ФОП",
  yellow: "Жовта",
  eAid: "єПідтримка",
};

interface AccountFilterProps {
  accounts: MonobankAccount[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  hideEmpty: boolean;
  onHideEmptyChange: (v: boolean) => void;
  showHideEmpty?: boolean;
}

export default function AccountFilter({
  accounts,
  selectedIds,
  onSelectionChange,
  hideEmpty,
  onHideEmptyChange,
  showHideEmpty = true,
}: AccountFilterProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sorted = sortAccounts(accounts);
  const displayed = hideEmpty ? sorted.filter((a) => a.balance !== 0) : sorted;

  const allSelected = selectedIds.length === 0;

  const toggleAccount = (id: string) => {
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((i) => i !== id);
      onSelectionChange(next);
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Рахунки
        </button>
        {showHideEmpty && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(e) => onHideEmptyChange(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            Приховати пусті
          </label>
        )}
      </div>

      {!collapsed && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={selectAll}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              allSelected
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            Всі
          </button>
          {displayed.map((acc) => {
            const info = getCurrencyInfo(acc.currencyCode);
            const selected = selectedIds.includes(acc.id);
            const label = TYPE_LABELS[acc.type] || acc.type;
            const pan = acc.maskedPan[0];
            const suffix = pan ? pan.slice(-4) : "";

            return (
              <button
                key={acc.id}
                onClick={() => toggleAccount(acc.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  selected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {label} {suffix && `•${suffix}`} ({info.code})
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
