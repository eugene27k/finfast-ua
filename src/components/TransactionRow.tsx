"use client";

import type { MonobankStatement } from "@/types/monobank";
import { formatAmount } from "@/lib/currency";
import { getMccCategory, getCategoryColor } from "@/lib/mcc";

interface TransactionRowProps {
  tx: MonobankStatement;
}

export default function TransactionRow({ tx }: TransactionRowProps) {
  const isExpense = tx.amount < 0;
  const category = getMccCategory(tx.mcc);
  const color = getCategoryColor(category);
  const date = new Date(tx.time * 1000);

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: color }}
      >
        {category.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {tx.description}
        </div>
        <div className="text-xs text-gray-500 flex gap-2">
          <span>{category}</span>
          {tx.comment && <span>· {tx.comment}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-semibold ${isExpense ? "text-red-600" : "text-green-600"}`}>
          {isExpense ? "" : "+"}{formatAmount(tx.amount, tx.currencyCode)}
        </div>
        <div className="text-xs text-gray-400">
          {date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}{" "}
          {date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
