"use client";

import { useState, useMemo, useEffect } from "react";
import { useData } from "@/components/DataProvider";
import SpendingChart from "@/components/SpendingChart";
import DailyChart from "@/components/DailyChart";
import AccountFilter from "@/components/AccountFilter";
import RefreshButton from "@/components/RefreshButton";
import DateRangeFilter, { getDefaultRange, type DateRange } from "@/components/DateRangeFilter";
import { useDbHistory } from "@/lib/useDbHistory";
import { getEffectiveCategory } from "@/lib/mcc";
import { formatAmount } from "@/lib/currency";
import { useMonthComparison } from "@/lib/useMonthComparison";
import MonthComparison from "@/components/MonthComparison";
import { useRouter } from "next/navigation";

export default function AnalyticsPage() {
  const {
    token,
    tokenReady,
    client,
    statementsLoading: loading,
    refresh,
    getFiltered,
    from: liveFrom,
    lastRefreshedAt,
    overrides,
    getTransferInfo,
  } = useData();
  const router = useRouter();

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [hideInactive, setHideInactive] = useState(true);
  const [range, setRange] = useState<DateRange>(getDefaultRange);

  const currencyCode = client?.accounts[0]?.currencyCode || 980;

  // Older portions of the range come from persisted DB history (live data is ~30 days).
  const needHistory = range.from < liveFrom;
  const { history, loading: historyLoading } = useDbHistory(
    range.from,
    range.to,
    selectedAccounts,
    needHistory
  );

  const transactions = useMemo(() => {
    const live = getFiltered(selectedAccounts).filter(
      (tx) => tx.time >= range.from && tx.time <= range.to
    );
    if (!needHistory) return live;
    // Merge in stored history, de-duplicating by transaction id.
    const seen = new Set(live.map((tx) => tx.id));
    const extra = history.filter(
      (tx) => !seen.has(tx.id) && tx.time >= range.from && tx.time <= range.to
    );
    return [...live, ...extra].sort((a, b) => b.time - a.time);
  }, [getFiltered, selectedAccounts, range.from, range.to, needHistory, history]);

  // Internal movements (jar/own-card transfers) are never income or expense, so
  // they are excluded from every analytic view.
  const spendable = useMemo(() => {
    const info = getTransferInfo(transactions);
    return transactions.filter((tx) => !info.get(tx.id)?.internal);
  }, [transactions, getTransferInfo]);

  const categoryBreakdown = useMemo(() => {
    const expenses = spendable.filter((tx) => tx.amount < 0);
    const map = new Map<string, { total: number; count: number; color: string }>();
    for (const tx of expenses) {
      const { name: cat, color } = getEffectiveCategory(tx.mcc, tx.id, overrides);
      const entry = map.get(cat) || { total: 0, count: 0, color };
      entry.total += Math.abs(tx.amount);
      entry.count += 1;
      map.set(cat, entry);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [spendable, overrides]);

  const totalExpenses = categoryBreakdown.reduce((s, c) => s + c.total, 0);

  const comparison = useMonthComparison(selectedAccounts);

  useEffect(() => {
    if (tokenReady && !token) router.replace("/settings");
  }, [tokenReady, token, router]);

  if (!tokenReady || !token) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Аналітика витрат</h1>
        <RefreshButton onClick={refresh} loading={loading} lastRefreshedAt={lastRefreshedAt} />
      </div>

      <div className="space-y-3">
        {client && (
          <AccountFilter
            accounts={client.accounts}
            selectedIds={selectedAccounts}
            onSelectionChange={setSelectedAccounts}
            hideInactive={hideInactive}
            onHideInactiveChange={setHideInactive}
          />
        )}
        <div className="flex items-center gap-2">
          <DateRangeFilter onChange={setRange} />
          <span className="relative group">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 cursor-help">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 .75.75 0 0 1 1.06 1.06ZM10 15a1 1 0 0 1-1-1v-4a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1Z" clipRule="evenodd" />
            </svg>
            <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 top-6 w-64 bg-gray-800 dark:bg-gray-700 text-white text-[11px] leading-tight rounded-lg px-3 py-2 z-50 shadow-lg">
              Свіжі дані охоплюють останні ~30 днів. За старіші періоди показуються транзакції, які вже збережені у застосунку.
            </span>
          </span>
        </div>
      </div>

      {loading || historyLoading ? (
        <div className="animate-pulse text-gray-400 p-8 text-center">
          Завантаження аналітики...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Витрати за категоріями
              </h2>
              <SpendingChart
                transactions={spendable}
                currencyCode={currencyCode}
                overrides={overrides}
              />
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Деталі за категоріями
              </h2>
              <div className="space-y-3">
                {categoryBreakdown.map((cat) => {
                  const pct =
                    totalExpenses > 0
                      ? ((cat.total / totalExpenses) * 100).toFixed(1)
                      : "0";
                  return (
                    <div key={cat.name} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {cat.name}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatAmount(cat.total, currencyCode)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {totalExpenses > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Всього</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatAmount(totalExpenses, currencyCode)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Щоденні надходження та витрати
            </h2>
            <DailyChart
              transactions={spendable}
              currencyCode={currencyCode}
            />
          </div>

          <MonthComparison
            currentMonth={comparison.currentMonth}
            previousMonth={comparison.previousMonth}
            currencyCode={currencyCode}
            loading={comparison.loading}
            backfilling={comparison.backfilling}
          />
        </>
      )}
    </div>
  );
}
