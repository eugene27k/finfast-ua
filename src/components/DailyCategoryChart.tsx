"use client";

import { useMemo, useState } from "react";
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
import type { MonobankStatement, MonobankCurrencyRate } from "@/types/monobank";
import { getCurrencyInfo } from "@/lib/currency";
import { useTheme } from "@/components/ThemeProvider";
import { aggregateDailyByCategory, type Overrides } from "@/lib/analytics";

/** Aggregates are normalised to UAH (see analytics.ts). */
const BASE = 980;
const TOP_N = 8;

interface DailyCategoryChartProps {
  transactions: MonobankStatement[];
  overrides: Overrides;
  rates: MonobankCurrencyRate[];
  /** txId → account currency, so amounts convert by the correct currency. */
  accountCurrencyByTxId: Map<string, number>;
}

export default function DailyCategoryChart({
  transactions,
  overrides,
  rates,
  accountCurrencyByTxId,
}: DailyCategoryChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const currency = getCurrencyInfo(BASE);
  const divisor = Math.pow(10, currency.digits);

  const { days, categories } = useMemo(
    () =>
      aggregateDailyByCategory(transactions, overrides, {
        rates,
        baseCurrency: BASE,
        topN: TOP_N,
        accountCurrencyByTxId,
      }),
    [transactions, overrides, rates, accountCurrencyByTxId]
  );

  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  if (days.length === 0) {
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
      <BarChart data={days}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="label" fontSize={12} tick={{ fill: textColor }} />
        <YAxis
          fontSize={12}
          tick={{ fill: textColor }}
          tickFormatter={(v: number) => (v / divisor).toLocaleString("uk-UA")}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `${(value / divisor).toLocaleString("uk-UA", {
              minimumFractionDigits: currency.digits,
              maximumFractionDigits: currency.digits,
            })} ${currency.symbol}`,
            name,
          ]}
          contentStyle={{
            backgroundColor: isDark ? "#1f2937" : "#fff",
            border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            borderRadius: "8px",
            color: isDark ? "#f3f4f6" : "#111827",
          }}
        />
        <Legend
          wrapperStyle={{ color: textColor, cursor: "pointer" }}
          onClick={(o) => {
            const key = (o as { dataKey?: unknown }).dataKey;
            if (typeof key === "string") toggle(key);
          }}
        />
        {categories.map((cat) => (
          <Bar
            key={cat.name}
            dataKey={cat.name}
            stackId="exp"
            name={cat.name}
            fill={cat.color}
            hide={hidden.has(cat.name)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
