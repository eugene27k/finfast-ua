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
import { useTheme } from "@/components/ThemeProvider";

interface DailyChartProps {
  transactions: MonobankStatement[];
  currencyCode: number;
}

export default function DailyChart({ transactions, currencyCode }: DailyChartProps) {
  const currency = getCurrencyInfo(currencyCode);
  const divisor = Math.pow(10, currency.digits);
  const { theme } = useTheme();
  const isDark = theme === "dark";

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

  const textColor = isDark ? "#9ca3af" : "#6b7280";
  const gridColor = isDark ? "#374151" : "#e5e7eb";

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="date" fontSize={12} tick={{ fill: textColor }} />
        <YAxis fontSize={12} tick={{ fill: textColor }} />
        <Tooltip
          formatter={(value: number) =>
            `${value.toLocaleString("uk-UA", { minimumFractionDigits: 2 })} ${currency.symbol}`
          }
          contentStyle={{
            backgroundColor: isDark ? "#1f2937" : "#fff",
            border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            borderRadius: "8px",
            color: isDark ? "#f3f4f6" : "#111827",
          }}
        />
        <Legend wrapperStyle={{ color: textColor }} />
        <Bar dataKey="income" name="Надходження" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Витрати" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
