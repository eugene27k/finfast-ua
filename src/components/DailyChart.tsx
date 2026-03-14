"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonobankStatement } from "@/types/monobank";
import { getCurrencyInfo } from "@/lib/currency";

interface DailyChartProps {
  transactions: MonobankStatement[];
  currencyCode: number;
}

export default function DailyChart({ transactions, currencyCode }: DailyChartProps) {
  const currency = getCurrencyInfo(currencyCode);
  const divisor = Math.pow(10, currency.digits);

  const dailyMap = new Map<string, { income: number; expense: number }>();

  for (const tx of transactions) {
    const date = new Date(tx.time * 1000).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
    });
    const entry = dailyMap.get(date) || { income: 0, expense: 0 };
    if (tx.amount >= 0) {
      entry.income += tx.amount / divisor;
    } else {
      entry.expense += Math.abs(tx.amount) / divisor;
    }
    dailyMap.set(date, entry);
  }

  const data = Array.from(dailyMap.entries())
    .map(([date, values]) => ({ date, ...values }))
    .reverse();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Немає даних за цей період
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip
          formatter={(value: number) =>
            `${value.toLocaleString("uk-UA", { minimumFractionDigits: 2 })} ${currency.symbol}`
          }
        />
        <Legend />
        <Bar dataKey="income" name="Надходження" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Витрати" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
