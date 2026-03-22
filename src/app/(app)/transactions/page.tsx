"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useData, type FetchProgress, type ManualAccountData } from "@/components/DataProvider";
import TransactionRow from "@/components/TransactionRow";
import AccountFilter from "@/components/AccountFilter";
import RefreshButton from "@/components/RefreshButton";
import { formatAmount, getCurrencyInfo } from "@/lib/currency";
import { CATEGORY_NAMES, getEffectiveCategory, getCategoryColor } from "@/lib/mcc";
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
            className="text-gray-200 dark:text-gray-700"
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
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Рахунок {progress.current} з {progress.total}</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {currentAccount && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
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

interface UnifiedTransaction {
  id: string;
  time: number;
  description: string;
  amount: number;
  currencyCode: number;
  mcc: number;
  comment?: string | null;
  isManual: boolean;
  manualAccountName?: string;
}

function ManualTransactionRow({ tx }: { tx: UnifiedTransaction }) {
  const isExpense = tx.amount < 0;
  const date = new Date(tx.time * 1000);

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-gray-500">
        РЧ
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {tx.description}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            вручну
          </span>
          {tx.manualAccountName && (
            <span className="text-xs text-gray-500 dark:text-gray-400">· {tx.manualAccountName}</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-semibold ${isExpense ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
          {isExpense ? "" : "+"}{formatAmount(tx.amount, tx.currencyCode)}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}{" "}
          {date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
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
    lastRefreshedAt,
    overrides,
    customCategories,
    manualAccounts,
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const periodFrom = useMemo(
    () => Math.floor(Date.now() / 1000) - period * 24 * 60 * 60,
    [period]
  );

  const transactions = useMemo(() => {
    const mono = getFiltered(selectedAccounts)
      .filter((tx) => tx.time >= periodFrom)
      .map((tx): UnifiedTransaction => ({
        id: tx.id,
        time: tx.time,
        description: tx.description,
        amount: tx.amount,
        currencyCode: tx.currencyCode,
        mcc: tx.mcc,
        comment: tx.comment,
        isManual: false,
      }));

    // Add manual transactions
    const manual: UnifiedTransaction[] = [];
    for (const acc of manualAccounts) {
      for (const tx of acc.transactions) {
        if (tx.time >= periodFrom) {
          manual.push({
            id: `manual-${tx.id}`,
            time: tx.time,
            description: tx.description,
            amount: tx.amount,
            currencyCode: acc.currencyCode,
            mcc: 0,
            isManual: true,
            manualAccountName: acc.name,
          });
        }
      }
    }

    return [...mono, ...manual].sort((a, b) => b.time - a.time);
  }, [getFiltered, selectedAccounts, periodFrom, manualAccounts]);

  const allCategoryNames = useMemo(() => {
    const custom = customCategories.map((c) => c.name);
    const all = [...CATEGORY_NAMES, ...custom.filter((n) => !CATEGORY_NAMES.includes(n))];
    return all;
  }, [customCategories]);

  const filtered = useMemo(() => {
    let result = transactions;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.description.toLowerCase().includes(q) ||
          (tx.comment && tx.comment.toLowerCase().includes(q)) ||
          (tx.manualAccountName && tx.manualAccountName.toLowerCase().includes(q))
      );
    }
    if (selectedCategories.length > 0) {
      result = result.filter((tx) => {
        if (tx.isManual) return false; // manual transactions don't have categories
        const cat = getEffectiveCategory(tx.mcc, tx.id, overrides);
        return selectedCategories.includes(cat.name);
      });
    }
    return result;
  }, [transactions, search, selectedCategories, overrides]);

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Транзакції</h1>
        <RefreshButton onClick={refresh} loading={loading} lastRefreshedAt={lastRefreshedAt} />
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
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
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
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
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
          <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 top-6 w-56 bg-gray-800 dark:bg-gray-700 text-white text-[11px] leading-tight rounded-lg px-3 py-2 z-50 shadow-lg">
            Monobank API дозволяє отримати виписку максимум за 31 день за один запит.
          </span>
        </span>
        <input
          type="text"
          placeholder="Пошук транзакцій..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategories([])}
          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
            selectedCategories.length === 0
              ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
          }`}
        >
          Всі категорії
        </button>
        {allCategoryNames.map((cat) => {
          const color = getCategoryColor(cat);
          const isSelected = selectedCategories.includes(cat);
          return (
            <button
              key={cat}
              onClick={() =>
                setSelectedCategories((prev) =>
                  isSelected ? prev.filter((c) => c !== cat) : [...prev, cat]
                )
              }
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                isSelected
                  ? "text-white border-transparent"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
              }`}
              style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: color }}
              />
              {cat}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Транзакцій</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{filtered.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Надходження</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            +{formatAmount(totalIncome, currencyCode)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Витрати</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            -{formatAmount(totalExpense, currencyCode)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <LoadingProgress progress={progress} accounts={client?.accounts || []} />
        ) : error ? (
          <div className="p-4 text-red-600 dark:text-red-400 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Немає транзакцій за обраний період
          </div>
        ) : (
          filtered.map((tx) =>
            tx.isManual ? (
              <ManualTransactionRow key={tx.id} tx={tx} />
            ) : (
              <TransactionRow key={tx.id} tx={tx as unknown as import("@/types/monobank").MonobankStatement} />
            )
          )
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
