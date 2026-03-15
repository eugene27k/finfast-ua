"use client";

import type { MonobankAccount } from "@/types/monobank";
import { formatAmount, getCurrencyInfo } from "@/lib/currency";

const TYPE_LABELS: Record<string, string> = {
  black: "Чорна картка",
  white: "Біла картка",
  platinum: "Platinum",
  iron: "Iron",
  fop: "ФОП",
  yellow: "Жовта картка",
  eAid: "єПідтримка",
};

interface AccountCardProps {
  account: MonobankAccount;
  onClick?: () => void;
  selected?: boolean;
}

export default function AccountCard({ account, onClick, selected }: AccountCardProps) {
  const currency = getCurrencyInfo(account.currencyCode);
  const balance = account.balance / Math.pow(10, currency.digits);
  const isPositive = balance >= 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        selected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {TYPE_LABELS[account.type] || account.type}
        </span>
        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
          {currency.code}
        </span>
      </div>
      <div className={`text-2xl font-bold ${isPositive ? "text-gray-900 dark:text-gray-100" : "text-red-600 dark:text-red-400"}`}>
        {formatAmount(account.balance, account.currencyCode)}
      </div>
      {account.creditLimit > 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Кредитний ліміт: {formatAmount(account.creditLimit, account.currencyCode)}
        </div>
      )}
      {account.maskedPan.length > 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {account.maskedPan[0]}
        </div>
      )}
    </button>
  );
}
