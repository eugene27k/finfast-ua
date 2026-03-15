"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { MonobankStatement } from "@/types/monobank";
import { getEffectiveCategory } from "@/lib/mcc";
import { getCurrencyInfo } from "@/lib/currency";
import type { OverrideInfo } from "@/components/DataProvider";
import { useTheme } from "@/components/ThemeProvider";

interface SpendingChartProps {
  transactions: MonobankStatement[];
  currencyCode: number;
  overrides?: Record<string, OverrideInfo>;
}

export default function SpendingChart({ transactions, currencyCode, overrides = {} }: SpendingChartProps) {
  const currency = getCurrencyInfo(currencyCode);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const expenses = transactions.filter((tx) => tx.amount < 0);

  const categoryMap = new Map<string, { total: number; color: string }>();
  for (const tx of expenses) {
    const { name: cat, color } = getEffectiveCategory(tx.mcc, tx.id, overrides);
    const entry = categoryMap.get(cat) || { total: 0, color };
    entry.total += Math.abs(tx.amount);
    categoryMap.set(cat, entry);
  }

  const data = Array.from(categoryMap.entries())
    .map(([name, { total, color }]) => ({
      name,
      value: total / Math.pow(10, currency.digits),
      color,
    }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Немає витрат за цей період
      </div>
    );
  }

  const labelColor = isDark ? "#d1d5db" : "#374151";

  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={120}
          innerRadius={60}
          dataKey="value"
          label={({ name, percent }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          labelLine={true}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
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
        <Legend wrapperStyle={{ color: labelColor }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
