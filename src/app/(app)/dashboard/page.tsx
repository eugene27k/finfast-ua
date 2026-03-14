"use client";

import { useToken, useClientInfo, useCurrencyRates } from "@/lib/hooks";
import AccountCard from "@/components/AccountCard";
import { getCurrencyInfo, formatAmount } from "@/lib/currency";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { token, ready } = useToken();
  const { data: client, loading, error } = useClientInfo(token);
  const { data: rates } = useCurrencyRates();
  const router = useRouter();

  useEffect(() => {
    if (ready && !token) router.replace("/settings");
  }, [ready, token, router]);

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Завантаження даних...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        <p className="font-medium">Помилка завантаження</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!client) return null;

  const uahAccounts = client.accounts.filter((a) => a.currencyCode === 980);
  const foreignAccounts = client.accounts.filter((a) => a.currencyCode !== 980);

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
        <h1 className="text-2xl font-bold text-gray-900">
          Вітаю, {client.name}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Огляд ваших фінансів</p>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-2xl shadow-lg">
        <p className="text-sm text-blue-200">Загальний баланс (UAH)</p>
        <p className="text-4xl font-bold mt-2">
          {formatAmount(totalUah, 980)}
        </p>
      </div>

      {mainRates.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {mainRates.map((r) => {
            const info = getCurrencyInfo(r.currencyCodeA);
            return (
              <div
                key={r.currencyCodeA}
                className="bg-white p-4 rounded-xl border border-gray-200"
              >
                <div className="text-sm text-gray-500">{info.code}/UAH</div>
                <div className="text-lg font-semibold mt-1">
                  {r.rateBuy?.toFixed(2) || r.rateCross?.toFixed(2)} /{" "}
                  {r.rateSell?.toFixed(2) || r.rateCross?.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400">
                  купівля / продаж
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Рахунки UAH
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {uahAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onClick={() => router.push(`/transactions?account=${account.id}`)}
            />
          ))}
        </div>
      </div>

      {foreignAccounts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Валютні рахунки
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {foreignAccounts.map((account) => (
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
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Банки</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {client.jars.map((jar) => {
              const currency = getCurrencyInfo(jar.currencyCode);
              const progress = jar.goal > 0 ? (jar.balance / jar.goal) * 100 : 0;
              return (
                <div
                  key={jar.id}
                  className="bg-white p-4 rounded-xl border border-gray-200"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {jar.title}
                  </div>
                  {jar.description && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {jar.description}
                    </div>
                  )}
                  <div className="text-xl font-bold mt-2">
                    {formatAmount(jar.balance, jar.currencyCode)}
                  </div>
                  {jar.goal > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Ціль: {formatAmount(jar.goal, jar.currencyCode)}</span>
                        <span>{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
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
