"use client";

import { useState, useMemo, useEffect } from "react";
import { useToken, useClientInfo, useAllStatements } from "@/lib/hooks";
import SpendingChart from "@/components/SpendingChart";
import DailyChart from "@/components/DailyChart";
import AccountFilter from "@/components/AccountFilter";
import RefreshButton from "@/components/RefreshButton";
import { getMccCategory, getCategoryColor } from "@/lib/mcc";
import { formatAmount } from "@/lib/currency";
import { useRouter } from "next/navigation";

export default function AnalyticsPage() {
  const { token, ready } = useToken();
  const { data: client } = useClientInfo(token);
  const router = useRouter();

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [period, setPeriod] = useState(30);

  const from = useMemo(
    () => Math.floor(Date.now() / 1000) - period * 24 * 60 * 60,
    [period]
  );

  const allAccountIds = useMemo(
    () => (client?.accounts || []).map((a) => a.id),
    [client]
  );

  const currencyCode = client?.accounts[0]?.currencyCode || 980;

  const { loading, refresh, getFiltered } = useAllStatements(
    token,
    allAccountIds,
    from
  );

  const transactions = useMemo(
    () => getFiltered(selectedAccounts),
    [getFiltered, selectedAccounts]
  );

  const categoryBreakdown = useMemo(() => {
    const expenses = transactions.filter((tx) => tx.amount < 0);
    const map = new Map<string, { total: number; count: number }>();
    for (const tx of expenses) {
      const cat = getMccCategory(tx.mcc);
      const entry = map.get(cat) || { total: 0, count: 0 };
      entry.total += Math.abs(tx.amount);
      entry.count += 1;
      map.set(cat, entry);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const totalExpenses = categoryBreakdown.reduce((s, c) => s + c.total, 0);

  useEffect(() => {
    if (ready && !token) router.replace("/settings");
  }, [ready, token, router]);

  if (!ready || !token) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Аналітика витрат</h1>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      <div className="space-y-3">
        {client && (
          <AccountFilter
            accounts={client.accounts}
            selectedIds={selectedAccounts}
            onSelectionChange={setSelectedAccounts}
            hideEmpty={hideEmpty}
            onHideEmptyChange={setHideEmpty}
          />
        )}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {[
            { label: "7 днів", value: 7 },
            { label: "14 днів", value: 14 },
            { label: "30 днів", value: 30 },
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse text-gray-400 p-8 text-center">
          Завантаження аналітики...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Витрати за категоріями
              </h2>
              <SpendingChart
                transactions={transactions}
                currencyCode={currencyCode}
              />
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
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
                        style={{ backgroundColor: getCategoryColor(cat.name) }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700 truncate">
                            {cat.name}
                          </span>
                          <span className="text-sm text-gray-500">{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: getCategoryColor(cat.name),
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {formatAmount(cat.total, currencyCode)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {totalExpenses > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Всього</span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatAmount(totalExpenses, currencyCode)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Щоденні надходження та витрати
            </h2>
            <DailyChart
              transactions={transactions}
              currencyCode={currencyCode}
            />
          </div>
        </>
      )}
    </div>
  );
}
