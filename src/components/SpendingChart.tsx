"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { MonobankStatement } from "@/types/monobank";
import { getMccCategory, getCategoryColor } from "@/lib/mcc";
import { getCurrencyInfo } from "@/lib/currency";

interface SpendingChartProps {
  transactions: MonobankStatement[];
  currencyCode: number;
}

export default function SpendingChart({ transactions, currencyCode }: SpendingChartProps) {
  const currency = getCurrencyInfo(currencyCode);
  const expenses = transactions.filter((tx) => tx.amount < 0);

  const categoryMap = new Map<string, number>();
  for (const tx of expenses) {
    const cat = getMccCategory(tx.mcc);
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + Math.abs(tx.amount));
  }

  const data = Array.from(categoryMap.entries())
    .map(([name, value]) => ({
      name,
      value: value / Math.pow(10, currency.digits),
      color: getCategoryColor(name),
    }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Немає витрат за цей період
      </div>
    );
  }

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
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
