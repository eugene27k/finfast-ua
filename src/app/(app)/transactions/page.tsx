"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useData, type FetchProgress } from "@/components/DataProvider";
import TransactionRow from "@/components/TransactionRow";
import AccountFilter from "@/components/AccountFilter";
import RefreshButton from "@/components/RefreshButton";
import { formatAmount, getCurrencyInfo } from "@/lib/currency";
import type { MonobankAccount } from "@/types/monobank";

const TYPE_LABELS: Record<string, string> = {
  black: "Чорна",
  white: "Біла",
  platinum: "Platinum",
  iron: "Iron",
  fop: "ФОП",
  yellow: "Жовта",
  eAid: "єПідтримка",
};

function getAccountLabel(acc: MonobankAccount): string {
  const label = TYPE_LABELS[acc.type] || acc.type;
  const pan = acc.maskedPan[0];
  const suffix = pan ? ` •${pan.slice(-4)}` : "";
  const cur = getCurrencyInfo(acc.currencyCode).code;
  return `${label}${suffix} (${cur})`;
}

function LoadingProgress({
  progress,
  accounts,
}: {
  progress: FetchProgress | null;
  accounts: MonobankAccount[];
}) {
  const currentAccount = progress
    ? accounts.find((a) => a.id === progress.currentAccountId)
    : null;
  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="p-8 flex flex-col items-center gap-4">
      <div className="relative w-10 h-10">
        <svg className="w-10 h-10 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12" cy="12" r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="text-gray-200"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-blue-500"
          />
        </svg>
      </div>
      {progress ? (
        <>
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Рахунок {progress.current} з {progress.total}</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {currentAccount && (
            <p className="text-sm text-gray-500">
              Завантаження: {getAccountLabel(currentAccount)}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-400">Підготовка до завантаження...</p>
      )}
    </div>
  );
}

function TransactionsContent() {
  const {
    token,
    tokenReady,
    client,
    statementsLoading: loading,
    statementsError: error,
    progress,
    from,
    refresh,
    getFiltered,
  } = useData();

  const searchParams = useSearchParams();
  const router = useRouter();

  const initialAccount = searchParams.get("account") || "";
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    initialAccount ? [initialAccount] : []
  );
  const [hideEmpty, setHideEmpty] = useState(false);
  const [period, setPeriod] = useState(30);
  const [search, setSearch] = useState("");

  const periodFrom = useMemo(
    () => Math.floor(Date.now() / 1000) - period * 24 * 60 * 60,
    [period]
  );

  const transactions = useMemo(() => {
    const all = getFiltered(selectedAccounts);
    return all.filter((tx) => tx.time >= periodFrom);
  }, [getFiltered, selectedAccounts, periodFrom]);

  const filtered = useMemo(() => {
    if (!search) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.description.toLowerCase().includes(q) ||
        (tx.comment && tx.comment.toLowerCase().includes(q))
    );
  }, [transactions, search]);

  const currencyCode = client?.accounts[0]?.currencyCode || 980;

  const totalIncome = filtered
    .filter((tx) => tx.amount > 0)
    .reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = filtered
    .filter((tx) => tx.amount < 0)
    .reduce((s, tx) => s + Math.abs(tx.amount), 0);

  useEffect(() => {
    if (tokenReady && !token) router.replace("/settings");
  }, [tokenReady, token, router]);

  if (!tokenReady || !token) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Транзакції</h1>
        <RefreshButton onClick={refresh} loading={loading} />
      </div>

      {client && (
        <AccountFilter
          accounts={client.accounts}
          selectedIds={selectedAccounts}
          onSelectionChange={setSelectedAccounts}
          hideEmpty={hideEmpty}
          onHideEmptyChange={setHideEmpty}
        />
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
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
        <span className="relative group">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 cursor-help">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 .75.75 0 0 1 1.06 1.06ZM10 15a1 1 0 0 1-1-1v-4a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1Z" clipRule="evenodd" />
          </svg>
          <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 top-6 w-56 bg-gray-800 text-white text-[11px] leading-tight rounded-lg px-3 py-2 z-50 shadow-lg">
            Monobank API дозволяє отримати виписку максимум за 31 день за один запит.
          </span>
        </span>
        <input
          type="text"
          placeholder="Пошук транзакцій..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">Транзакцій</p>
          <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">Надходження</p>
          <p className="text-2xl font-bold text-green-600">
            +{formatAmount(totalIncome, currencyCode)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500">Витрати</p>
          <p className="text-2xl font-bold text-red-600">
            -{formatAmount(totalExpense, currencyCode)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingProgress progress={progress} accounts={client?.accounts || []} />
        ) : error ? (
          <div className="p-4 text-red-600 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Немає транзакцій за обраний період
          </div>
        ) : (
          filtered.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
        )}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400 p-8">Завантаження...</div>}>
      <TransactionsContent />
    </Suspense>
  );
}
