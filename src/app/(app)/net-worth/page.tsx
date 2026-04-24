"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useData, type ManualAccountData } from "@/components/DataProvider";
import { formatAmount, getCurrencyInfo } from "@/lib/currency";
import { useCurrencyRates } from "@/lib/hooks";
import type { MonobankAccount, MonobankJar, MonobankCurrencyRate } from "@/types/monobank";

function toUah(amount: number, currencyCode: number, rates: MonobankCurrencyRate[]): number {
  if (currencyCode === 980) return amount;
  const rate = rates.find(
    (r) => r.currencyCodeA === currencyCode && r.currencyCodeB === 980
  );
  if (rate) {
    const r = rate.rateSell || rate.rateCross || rate.rateBuy || 1;
    return Math.round(amount * r);
  }
  return amount;
}

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

const ASSET_CATEGORIES = [
  { value: "deposit", label: "Депозит" },
  { value: "cash", label: "Готівка" },
  { value: "investment", label: "Інвестиції" },
  { value: "other-asset", label: "Інший актив" },
];

const LIABILITY_CATEGORIES = [
  { value: "installment", label: "Розстрочка" },
  { value: "buy-in-parts", label: "Покупки частинами" },
  { value: "short-loan", label: 'Кредит "До завтра"' },
  { value: "mortgage", label: "Іпотека / кредит" },
  { value: "other-liability", label: "Інше зобов'язання" },
];

interface AssetItem {
  label: string;
  amount: number;
  currencyCode: number;
  kind: string;
  manualAccountId?: string;
}

interface LiabilityItem {
  label: string;
  amount: number;
  currencyCode: number;
  kind: string;
  manualAccountId?: string;
}

function classifyAccounts(accounts: MonobankAccount[], jars: MonobankJar[]) {
  const assets: AssetItem[] = [];
  const liabilities: LiabilityItem[] = [];

  for (const acc of accounts) {
    const label = getAccountLabel(acc);
    const ownFunds = Math.max(0, acc.balance - acc.creditLimit);
    if (ownFunds > 0) {
      assets.push({
        label,
        amount: ownFunds,
        currencyCode: acc.currencyCode,
        kind: acc.maskedPan.length > 0 ? "card" : "account",
      });
    }

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

    if (acc.balance < 0) {
      liabilities.push({
        label: `Борг — ${label}`,
        amount: Math.abs(acc.balance),
        currencyCode: acc.currencyCode,
        kind: "loan",
      });
    }
  }

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

function addManualAccountsToLists(
  manualAccounts: ManualAccountData[],
  assets: AssetItem[],
  liabilities: LiabilityItem[]
) {
  for (const acc of manualAccounts) {
    if (acc.balance === 0) continue; // skip zero-balance accounts in net worth
    const item = {
      label: acc.name,
      amount: Math.abs(acc.balance),
      currencyCode: acc.currencyCode,
      kind: acc.category,
      manualAccountId: acc.id,
    };
    if (acc.type === "asset") {
      assets.push(item);
    } else {
      liabilities.push(item);
    }
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  card: "Картка",
  account: "Рахунок",
  jar: "Банка",
  "credit-limit": "Кредитний ліміт",
  loan: "Кредит",
  deposit: "Депозит",
  cash: "Готівка",
  investment: "Інвестиції",
  "other-asset": "Інший актив",
  installment: "Розстрочка",
  "buy-in-parts": "Покупки частинами",
  "short-loan": 'Кредит "До завтра"',
  mortgage: "Іпотека / кредит",
  "other-liability": "Інше зобов\u2019язання",
};

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

/* ── Create account form ────────────────────────────────── */

type EntryType = "asset" | "liability";

function AccountForm({
  onSave,
  onCancel,
}: {
  onSave: (data: { type: EntryType; category: string; name: string; currencyCode: number }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<EntryType>("asset");
  const [category, setCategory] = useState("deposit");
  const [name, setName] = useState("");

  const categories = type === "asset" ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;

  useEffect(() => {
    setCategory(categories[0].value);
  }, [type, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ type, category, name: name.trim(), currencyCode: 980 });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
          Новий рахунок
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("asset")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              type === "asset"
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-700"
                : "bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            Актив
          </button>
          <button
            type="button"
            onClick={() => setType("liability")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              type === "liability"
                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-700"
                : "bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            Зобов&apos;язання
          </button>
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Категорія</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Назва рахунку</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Напр. Депозит у ПриватБанку"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          Створити рахунок
        </button>
      </form>
    </div>
  );
}

/* ── Add transaction to account form ─────────────────────── */

function TransactionForm({
  account,
  onSave,
  onCancel,
}: {
  account: ManualAccountData;
  onSave: (data: { manualAccountId: string; amount: number; description: string }) => void;
  onCancel: () => void;
}) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amountStr.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0 || !description.trim()) return;
    const amount = Math.round(parsed * 100) * (direction === "out" ? -1 : 1);
    onSave({ manualAccountId: account.id, amount, description: description.trim() });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
          Транзакція: {account.name}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDirection("in")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              direction === "in"
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-700"
                : "bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            + Надходження
          </button>
          <button
            type="button"
            onClick={() => setDirection("out")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              direction === "out"
                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-700"
                : "bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            − Списання
          </button>
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Сума (UAH)</label>
          <input
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Опис</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Напр. Поповнення депозиту"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          Додати транзакцію
        </button>
      </form>
    </div>
  );
}

/* ── Account detail panel ────────────────────────────────── */

function AccountDetail({
  account,
  onClose,
  onAddTransaction,
  onDeleteTransaction,
  onDeleteAccount,
}: {
  account: ManualAccountData;
  onClose: () => void;
  onAddTransaction: () => void;
  onDeleteTransaction: (txId: string) => void;
  onDeleteAccount: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">{account.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {CATEGORY_LABELS[account.category] || account.category} · вручну
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${account.type === "asset" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {formatAmount(account.balance, account.currencyCode)}
          </span>
          <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <button
          onClick={onAddTransaction}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Додати транзакцію
        </button>
        <button
          onClick={onDeleteAccount}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Видалити рахунок
        </button>
      </div>

      {account.transactions.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">
          Немає транзакцій. Додайте першу транзакцію, щоб зафіксувати баланс.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-64 overflow-y-auto">
          {account.transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-5 py-2.5">
              <div>
                <p className="text-sm text-gray-900 dark:text-gray-100">{tx.description}</p>
                <p className="text-xs text-gray-400">
                  {new Date(tx.time * 1000).toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${tx.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {tx.amount >= 0 ? "+" : ""}{formatAmount(tx.amount, account.currencyCode)}
                </span>
                <button
                  onClick={() => onDeleteTransaction(tx.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Видалити транзакцію"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */

export default function NetWorthPage() {
  const { token, tokenReady, client, clientLoading: loading, clientError: error, userId, manualAccounts, refreshManualAccounts } = useData();
  const { data: currencyRates } = useCurrencyRates();
  const router = useRouter();
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showTxForm, setShowTxForm] = useState(false);
  const [txFormAccountId, setTxFormAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (tokenReady && !token) router.replace("/settings");
  }, [tokenReady, token, router]);

  const { assets, liabilities, totalAssets, totalLiabilities, netWorth, debtRatio } = useMemo(() => {
    if (!client) return { assets: [] as AssetItem[], liabilities: [] as LiabilityItem[], totalAssets: 0, totalLiabilities: 0, netWorth: 0, debtRatio: null as number | null };

    const { assets, liabilities } = classifyAccounts(client.accounts, client.jars || []);
    addManualAccountsToLists(manualAccounts, assets, liabilities);

    const totalAssets = assets.reduce((sum, a) => sum + toUah(a.amount, a.currencyCode, currencyRates), 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + toUah(l.amount, l.currencyCode, currencyRates), 0);
    const netWorth = totalAssets - totalLiabilities;
    const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : null;

    return { assets, liabilities, totalAssets, totalLiabilities, netWorth, debtRatio };
  }, [client, manualAccounts, currencyRates]);

  const selectedAccount = manualAccounts.find((a) => a.id === selectedAccountId) || null;
  const txFormAccount = manualAccounts.find((a) => a.id === txFormAccountId) || null;

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
  const mainCurrency = 980;

  const handleCreateAccount = async (data: { type: EntryType; category: string; name: string; currencyCode: number }) => {
    if (!userId) return;
    const res = await fetch("/api/manual-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...data }),
    });
    if (res.ok) {
      setShowAccountForm(false);
      refreshManualAccounts();
    } else {
      const err = await res.json();
      alert(err.error || "Помилка створення рахунку");
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Видалити рахунок та всі його транзакції?")) return;
    await fetch(`/api/manual-accounts?id=${accountId}`, { method: "DELETE" });
    setSelectedAccountId(null);
    refreshManualAccounts();
  };

  const handleAddTransaction = async (data: { manualAccountId: string; amount: number; description: string }) => {
    const res = await fetch("/api/manual-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowTxForm(false);
      setTxFormAccountId(null);
      refreshManualAccounts();
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    await fetch(`/api/manual-transactions?id=${txId}`, { method: "DELETE" });
    refreshManualAccounts();
  };

  const handleItemClick = (manualAccountId?: string) => {
    if (manualAccountId) {
      setSelectedAccountId(manualAccountId === selectedAccountId ? null : manualAccountId);
    }
  };

  const openTxForm = (accountId: string) => {
    setTxFormAccountId(accountId);
    setShowTxForm(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Чистий капітал</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Фінансовий стан на основі активів і зобов&apos;язань</p>
        </div>
        <button
          onClick={() => setShowAccountForm(!showAccountForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Новий рахунок
        </button>
      </div>

      {/* Create account form */}
      {showAccountForm && (
        <AccountForm
          onSave={handleCreateAccount}
          onCancel={() => setShowAccountForm(false)}
        />
      )}

      {/* Transaction form */}
      {showTxForm && txFormAccount && (
        <TransactionForm
          account={txFormAccount}
          onSave={handleAddTransaction}
          onCancel={() => { setShowTxForm(false); setTxFormAccountId(null); }}
        />
      )}

      {/* Account detail panel */}
      {selectedAccount && !showTxForm && (
        <AccountDetail
          account={selectedAccount}
          onClose={() => setSelectedAccountId(null)}
          onAddTransaction={() => openTxForm(selectedAccount.id)}
          onDeleteTransaction={handleDeleteTransaction}
          onDeleteAccount={() => handleDeleteAccount(selectedAccount.id)}
        />
      )}

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

      {/* Manual accounts list */}
      {manualAccounts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Ручні рахунки
              <span className="ml-2 text-sm font-normal text-gray-400">({manualAccounts.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {manualAccounts.map((acc) => (
              <div
                key={acc.id}
                onClick={() => handleItemClick(acc.id)}
                className={`flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  selectedAccountId === acc.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    acc.category === "deposit" ? "bg-violet-500"
                    : acc.category === "cash" ? "bg-amber-500"
                    : acc.category === "investment" ? "bg-indigo-500"
                    : acc.category === "installment" ? "bg-orange-500"
                    : acc.category === "mortgage" ? "bg-purple-500"
                    : acc.type === "asset" ? "bg-teal-500"
                    : "bg-red-500"
                  }`} />
                  <div>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{acc.name}</p>
                    <p className="text-xs text-gray-400">
                      {CATEGORY_LABELS[acc.category] || acc.category} · вручну · {acc.transactions.length} тр.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${acc.type === "asset" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {formatAmount(acc.balance, acc.currencyCode)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openTxForm(acc.id); }}
                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                    title="Додати транзакцію"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <div
                key={item.manualAccountId || i}
                onClick={() => handleItemClick(item.manualAccountId)}
                className={`flex items-center justify-between px-5 py-3 ${
                  item.manualAccountId ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50" : ""
                } transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    item.kind === "jar" ? "bg-blue-500"
                    : item.kind === "card" ? "bg-emerald-500"
                    : item.kind === "deposit" ? "bg-violet-500"
                    : item.kind === "cash" ? "bg-amber-500"
                    : item.kind === "investment" ? "bg-indigo-500"
                    : "bg-teal-500"
                  }`} />
                  <div>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{item.label}</p>
                    <p className="text-xs text-gray-400">
                      {CATEGORY_LABELS[item.kind] || item.kind}
                      {item.manualAccountId && " · вручну"}
                      {item.currencyCode !== 980 && ` · ${getCurrencyInfo(item.currencyCode).code}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {formatAmount(item.amount, item.currencyCode)}
                  </span>
                  {item.currencyCode !== 980 && (
                    <p className="text-xs text-gray-400">
                      ≈ {formatAmount(toUah(item.amount, item.currencyCode, currencyRates), 980)}
                    </p>
                  )}
                </div>
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
              <div
                key={item.manualAccountId || i}
                onClick={() => handleItemClick(item.manualAccountId)}
                className={`flex items-center justify-between px-5 py-3 ${
                  item.manualAccountId ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50" : ""
                } transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    item.kind === "credit-limit" ? "bg-yellow-500"
                    : item.kind === "installment" ? "bg-orange-500"
                    : item.kind === "buy-in-parts" ? "bg-amber-500"
                    : item.kind === "short-loan" ? "bg-pink-500"
                    : item.kind === "mortgage" ? "bg-purple-500"
                    : "bg-red-500"
                  }`} />
                  <div>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{item.label}</p>
                    <p className="text-xs text-gray-400">
                      {CATEGORY_LABELS[item.kind] || item.kind}
                      {item.manualAccountId && " · вручну"}
                      {item.currencyCode !== 980 && ` · ${getCurrencyInfo(item.currencyCode).code}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {formatAmount(item.amount, item.currencyCode)}
                  </span>
                  {item.currencyCode !== 980 && (
                    <p className="text-xs text-gray-400">
                      ≈ {formatAmount(toUah(item.amount, item.currencyCode, currencyRates), 980)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
