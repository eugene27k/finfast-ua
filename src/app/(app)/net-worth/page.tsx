"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useData } from "@/components/DataProvider";
import { formatAmount, getCurrencyInfo } from "@/lib/currency";
import type { MonobankAccount, MonobankJar } from "@/types/monobank";

const TYPE_LABELS: Record<string, string> = {
  black: "Чорна картка",
  white: "Біла картка",
  platinum: "Platinum",
  iron: "Iron",
  fop: "ФОП",
  yellow: "Жовта картка",
  eAid: "єПідтримка",
};

function getAccountLabel(acc: MonobankAccount): string {
  const label = TYPE_LABELS[acc.type] || acc.type;
  const pan = acc.maskedPan[0];
  const suffix = pan ? ` •${pan.slice(-4)}` : "";
  return `${label}${suffix}`;
}

interface AssetItem {
  label: string;
  amount: number;
  currencyCode: number;
  kind: "card" | "account" | "deposit" | "jar";
}

interface LiabilityItem {
  label: string;
  amount: number;
  currencyCode: number;
  kind: "credit-limit" | "installment" | "loan";
}

function classifyAccounts(accounts: MonobankAccount[], jars: MonobankJar[]) {
  const assets: AssetItem[] = [];
  const liabilities: LiabilityItem[] = [];

  for (const acc of accounts) {
    const label = getAccountLabel(acc);
    // Own funds: how much of the balance is the user's own money
    const ownFunds = Math.max(0, acc.balance - acc.creditLimit);
    if (ownFunds > 0) {
      assets.push({
        label,
        amount: ownFunds,
        currencyCode: acc.currencyCode,
        kind: acc.maskedPan.length > 0 ? "card" : "account",
      });
    }

    // Liabilities: used credit = creditLimit - min(balance, creditLimit) when balance < creditLimit
    if (acc.creditLimit > 0) {
      const usedCredit = Math.max(0, acc.creditLimit - Math.max(0, acc.balance));
      if (usedCredit > 0) {
        liabilities.push({
          label: `Кредитний ліміт — ${label}`,
          amount: usedCredit,
          currencyCode: acc.currencyCode,
          kind: "credit-limit",
        });
      }
    }

    // Negative balance beyond credit = additional debt
    if (acc.balance < 0) {
      liabilities.push({
        label: `Борг — ${label}`,
        amount: Math.abs(acc.balance),
        currencyCode: acc.currencyCode,
        kind: "loan",
      });
    }
  }

  // Jars are pure assets
  for (const jar of jars) {
    if (jar.balance > 0) {
      assets.push({
        label: `Банка: ${jar.title}`,
        amount: jar.balance,
        currencyCode: jar.currencyCode,
        kind: "jar",
      });
    }
  }

  return { assets, liabilities };
}

function StatusBadge({ debtRatio }: { debtRatio: number | null }) {
  if (debtRatio === null) {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        N/A
      </span>
    );
  }
  if (debtRatio <= 0.5) {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        Стабільний
      </span>
    );
  }
  if (debtRatio < 1) {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
        Напружений
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
      Ризиковий
    </span>
  );
}

export default function NetWorthPage() {
  const { token, tokenReady, client, clientLoading: loading, clientError: error } = useData();
  const router = useRouter();

  useEffect(() => {
    if (tokenReady && !token) router.replace("/settings");
  }, [tokenReady, token, router]);

  const { assets, liabilities, totalAssets, totalLiabilities, netWorth, debtRatio } = useMemo(() => {
    if (!client) return { assets: [], liabilities: [], totalAssets: 0, totalLiabilities: 0, netWorth: 0, debtRatio: null as number | null };

    const { assets, liabilities } = classifyAccounts(client.accounts, client.jars || []);

    // Sum only UAH for now (main currency); foreign accounts included at face value
    // TODO: convert foreign currencies via exchange rates
    const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
    const netWorth = totalAssets - totalLiabilities;
    const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : null;

    return { assets, liabilities, totalAssets, totalLiabilities, netWorth, debtRatio };
  }, [client]);

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

  const maxBar = Math.max(totalAssets, totalLiabilities, 1);
  const assetsPct = (totalAssets / maxBar) * 100;
  const liabilitiesPct = (totalLiabilities / maxBar) * 100;

  // Use 980 (UAH) as primary display currency
  const mainCurrency = 980;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Чистий капітал</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Фінансовий стан на основі активів і зобов&apos;язань</p>
      </div>

      {/* Main net worth card */}
      <div className={`p-6 rounded-2xl shadow-lg ${
        netWorth >= 0
          ? "bg-gradient-to-r from-emerald-600 to-emerald-800"
          : "bg-gradient-to-r from-red-600 to-red-800"
      } text-white`}>
        <div className="flex items-center justify-between">
          <p className="text-sm opacity-80">Чистий капітал</p>
          <StatusBadge debtRatio={debtRatio} />
        </div>
        <p className="text-4xl font-bold mt-2">
          {formatAmount(netWorth, mainCurrency)}
        </p>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div>
            <p className="text-sm opacity-70">Активи</p>
            <p className="text-xl font-semibold mt-0.5">
              {formatAmount(totalAssets, mainCurrency)}
            </p>
          </div>
          <div>
            <p className="text-sm opacity-70">Зобов&apos;язання</p>
            <p className="text-xl font-semibold mt-0.5">
              {formatAmount(totalLiabilities, mainCurrency)}
            </p>
          </div>
        </div>
      </div>

      {/* Debt ratio */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">Частка боргу</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {debtRatio !== null ? `${(debtRatio * 100).toFixed(1)}%` : "N/A"}
          </p>
        </div>
        {debtRatio !== null && (
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 mt-2">
            <div
              className={`h-2.5 rounded-full transition-all ${
                debtRatio <= 0.5
                  ? "bg-green-500"
                  : debtRatio < 1
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${Math.min(debtRatio * 100, 100)}%` }}
            />
          </div>
        )}
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Comparison bars */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Порівняння</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-300">Активи</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{formatAmount(totalAssets, mainCurrency)}</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4">
              <div
                className="bg-emerald-500 h-4 rounded-full transition-all"
                style={{ width: `${assetsPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-300">Зобов&apos;язання</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{formatAmount(totalLiabilities, mainCurrency)}</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4">
              <div
                className="bg-red-500 h-4 rounded-full transition-all"
                style={{ width: `${liabilitiesPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Asset details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Активи
            <span className="ml-2 text-sm font-normal text-gray-400">({assets.length})</span>
          </h2>
        </div>
        {assets.length === 0 ? (
          <div className="p-6 text-center text-gray-400">Немає активів</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {assets.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    item.kind === "jar" ? "bg-blue-500" : item.kind === "card" ? "bg-emerald-500" : "bg-teal-500"
                  }`} />
                  <div>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{item.label}</p>
                    <p className="text-xs text-gray-400">
                      {item.kind === "jar" ? "Банка" : item.kind === "card" ? "Картка" : "Рахунок"}
                      {item.currencyCode !== 980 && ` · ${getCurrencyInfo(item.currencyCode).code}`}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {formatAmount(item.amount, item.currencyCode)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Liability details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Зобов&apos;язання
            <span className="ml-2 text-sm font-normal text-gray-400">({liabilities.length})</span>
          </h2>
        </div>
        {liabilities.length === 0 ? (
          <div className="p-6 text-center text-gray-400">Немає зобов&apos;язань</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {liabilities.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    item.kind === "credit-limit" ? "bg-yellow-500" : item.kind === "installment" ? "bg-orange-500" : "bg-red-500"
                  }`} />
                  <div>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{item.label}</p>
                    <p className="text-xs text-gray-400">
                      {item.kind === "credit-limit" ? "Кредитний ліміт" : item.kind === "installment" ? "Розстрочка" : "Кредит"}
                      {item.currencyCode !== 980 && ` · ${getCurrencyInfo(item.currencyCode).code}`}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {formatAmount(item.amount, item.currencyCode)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
