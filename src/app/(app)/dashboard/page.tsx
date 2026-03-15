"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { useBudgets, getBudgetStatuses } from "@/lib/budgets";
import { useCurrencyRates } from "@/lib/hooks";
import AccountCard from "@/components/AccountCard";
import BudgetAlertBanner from "@/components/BudgetAlertBanner";
import { getCurrencyInfo, formatAmount } from "@/lib/currency";
import { sortAccounts } from "@/lib/accounts";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { token, tokenReady, client, clientLoading: loading, clientError: error, getFiltered, overrides } = useData();
  const { data: rates } = useCurrencyRates();
  const { budgets } = useBudgets();
  const router = useRouter();
  const [hideEmpty, setHideEmpty] = useState(false);

  const now = new Date();
  const monthStart = useMemo(
    () => Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.getMonth(), now.getFullYear()]
  );

  const monthTransactions = useMemo(() => {
    const all = getFiltered([]);
    return all.filter((tx) => tx.time >= monthStart);
  }, [getFiltered, monthStart]);

  const budgetStatuses = useMemo(
    () => getBudgetStatuses(budgets, monthTransactions, overrides),
    [budgets, monthTransactions, overrides]
  );

  useEffect(() => {
    if (tokenReady && !token) router.replace("/settings");
  }, [tokenReady, token, router]);

  if (!tokenReady || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Завантаження даних...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg">
        <p className="font-medium">Помилка завантаження</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!client) return null;

  const allSorted = sortAccounts(client.accounts);
  const uahAccounts = allSorted.filter((a) => a.currencyCode === 980);
  const foreignAccounts = allSorted.filter((a) => a.currencyCode !== 980);

  const visibleUah = hideEmpty ? uahAccounts.filter((a) => a.balance !== 0) : uahAccounts;
  const visibleForeign = hideEmpty ? foreignAccounts.filter((a) => a.balance !== 0) : foreignAccounts;

  const totalUah = uahAccounts.reduce((sum, a) => sum + a.balance, 0);

  const mainRates = rates
    .filter(
      (r) =>
        r.currencyCodeB === 980 &&
        [840, 978, 826, 985].includes(r.currencyCodeA)
    )
    .slice(0, 4);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Вітаю, {client.name}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Огляд ваших фінансів</p>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-2xl shadow-lg">
        <p className="text-sm text-blue-200">Загальний баланс (UAH)</p>
        <p className="text-4xl font-bold mt-2">
          {formatAmount(totalUah, 980)}
        </p>
      </div>

      <BudgetAlertBanner statuses={budgetStatuses} currencyCode={980} />

      {mainRates.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {mainRates.map((r) => {
            const info = getCurrencyInfo(r.currencyCodeA);
            return (
              <div
                key={r.currencyCodeA}
                className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                <div className="text-sm text-gray-500 dark:text-gray-400">{info.code}/UAH</div>
                <div className="text-lg font-semibold mt-1 dark:text-gray-100">
                  {r.rateBuy?.toFixed(2) || r.rateCross?.toFixed(2)} /{" "}
                  {r.rateSell?.toFixed(2) || r.rateCross?.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  купівля / продаж
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Рахунки</h2>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
          />
          Приховати пусті рахунки
        </label>
      </div>

      {visibleUah.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">UAH</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleUah.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onClick={() => router.push(`/transactions?account=${account.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {visibleForeign.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Валютні</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleForeign.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onClick={() =>
                  router.push(`/transactions?account=${account.id}`)
                }
              />
            ))}
          </div>
        </div>
      )}

      {client.jars && client.jars.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Банки</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {client.jars.map((jar) => {
              const progress = jar.goal > 0 ? (jar.balance / jar.goal) * 100 : 0;
              return (
                <div
                  key={jar.id}
                  className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700"
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {jar.title}
                  </div>
                  {jar.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {jar.description}
                    </div>
                  )}
                  <div className="text-xl font-bold mt-2 dark:text-gray-100">
                    {formatAmount(jar.balance, jar.currencyCode)}
                  </div>
                  {jar.goal > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
                        <span>Ціль: {formatAmount(jar.goal, jar.currencyCode)}</span>
                        <span>{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
