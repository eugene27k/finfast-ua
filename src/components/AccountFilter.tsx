"use client";

import { useState } from "react";
import type { MonobankAccount } from "@/types/monobank";
import { getCurrencyInfo } from "@/lib/currency";
import { sortAccounts, filterInactiveAccounts } from "@/lib/accounts";
import { useData } from "@/components/DataProvider";

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
  hideInactive: boolean;
  onHideInactiveChange: (v: boolean) => void;
  showHideInactive?: boolean;
}

export default function AccountFilter({
  accounts,
  selectedIds,
  onSelectionChange,
  hideInactive,
  onHideInactiveChange,
  showHideInactive = true,
}: AccountFilterProps) {
  const { activeAccountIds } = useData();
  const [collapsed, setCollapsed] = useState(false);
  const sorted = sortAccounts(accounts);
  const displayed = filterInactiveAccounts(sorted, activeAccountIds, hideInactive);

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
        {showHideInactive && (
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideInactive}
                onChange={(e) => onHideInactiveChange(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              Приховати неактивні
            </label>
            <span className="relative group flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-400 cursor-help">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 .75.75 0 0 1 1.06 1.06ZM10 15a1 1 0 0 1-1-1v-4a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1Z" clipRule="evenodd" />
              </svg>
              <span className="invisible group-hover:visible absolute right-0 top-6 w-64 bg-gray-800 dark:bg-gray-700 text-white text-[11px] leading-tight rounded-lg px-3 py-2 z-50 shadow-lg">
                Неактивні — рахунки, на яких одночасно немає коштів і немає рухів (транзакцій) за останні 60 днів.
              </span>
            </span>
          </div>
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
