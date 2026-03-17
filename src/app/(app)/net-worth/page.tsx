"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/DataProvider";
import { formatAmount, getCurrencyInfo } from "@/lib/currency";
import {
  useManualEntries,
  ASSET_CATEGORIES,
  LIABILITY_CATEGORIES,
  type EntryType,
  type EntryCategory,
  type ManualEntry,
} from "@/lib/manual-entries";
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
  const suffix = pan ? ` \u2022${pan.slice(-4)}` : "";
  return `${label}${suffix}`;
}

interface AssetItem {
  label: string;
  amount: number;
  currencyCode: number;
  kind: string;
  manualId?: string;
}

interface LiabilityItem {
  label: string;
  amount: number;
  currencyCode: number;
  kind: string;
  manualId?: string;
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

function addManualToLists(
  entries: ManualEntry[],
  assets: AssetItem[],
  liabilities: LiabilityItem[]
) {
  const allCategories = [...ASSET_CATEGORIES, ...LIABILITY_CATEGORIES];
  for (const e of entries) {
    const catLabel = allCategories.find((c) => c.value === e.category)?.label || e.category;
    if (e.type === "asset") {
      assets.push({
        label: e.label,
        amount: e.amount,
        currencyCode: e.currencyCode,
        kind: e.category,
        manualId: e.id,
      });
    } else {
      liabilities.push({
        label: e.label,
        amount: e.amount,
        currencyCode: e.currencyCode,
        kind: e.category,
        manualId: e.id,
      });
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

/* ── Add / Edit form panel ────────────────────────────────── */

function EntryForm({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (data: { type: EntryType; category: EntryCategory; label: string; amount: number; currencyCode: number }) => void;
  onCancel: () => void;
  initial?: ManualEntry;
}) {
  const [type, setType] = useState<EntryType>(initial?.type || "asset");
  const [category, setCategory] = useState<EntryCategory>(initial?.category || "deposit");
  const [label, setLabel] = useState(initial?.label || "");
  const [amountStr, setAmountStr] = useState(initial ? (initial.amount / 100).toString() : "");
  const ref = useRef<HTMLDivElement>(null);

  const categories = type === "asset" ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;

  // Reset category when type changes
  useEffect(() => {
    if (!initial) {
      setCategory(categories[0].value);
    }
  }, [type, categories, initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amountStr.replace(",", "."));
    if (!label.trim() || isNaN(parsed) || parsed <= 0) return;
    onSave({
      type,
      category,
      label: label.trim(),
      amount: Math.round(parsed * 100),
      currencyCode: 980,
    });
  };

  return (
    <div ref={ref} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
          {initial ? "Редагувати запис" : "Додати запис"}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector */}
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

        {/* Category */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Категорія</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as EntryCategory)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Label */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Назва</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Напр. Депозит у ПриватБанку"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Amount */}
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

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          {initial ? "Зберегти" : "Додати"}
        </button>
      </form>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */

export default function NetWorthPage() {
  const { token, tokenReady, client, clientLoading: loading, clientError: error } = useData();
  const { entries, addEntry, removeEntry, updateEntry } = useManualEntries();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ManualEntry | null>(null);

  useEffect(() => {
    if (tokenReady && !token) router.replace("/settings");
  }, [tokenReady, token, router]);

  const { assets, liabilities, totalAssets, totalLiabilities, netWorth, debtRatio } = useMemo(() => {
    if (!client) return { assets: [] as AssetItem[], liabilities: [] as LiabilityItem[], totalAssets: 0, totalLiabilities: 0, netWorth: 0, debtRatio: null as number | null };

    const { assets, liabilities } = classifyAccounts(client.accounts, client.jars || []);
    addManualToLists(entries, assets, liabilities);

    const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
    const netWorth = totalAssets - totalLiabilities;
    const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : null;

    return { assets, liabilities, totalAssets, totalLiabilities, netWorth, debtRatio };
  }, [client, entries]);

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

  const handleSave = (data: { type: EntryType; category: EntryCategory; label: string; amount: number; currencyCode: number }) => {
    if (editingEntry) {
      updateEntry(editingEntry.id, data);
      setEditingEntry(null);
    } else {
      addEntry(data);
    }
    setShowForm(false);
  };

  const handleEdit = (entry: ManualEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Чистий капітал</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Фінансовий стан на основі активів і зобов&apos;язань</p>
        </div>
        <button
          onClick={() => { setEditingEntry(null); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Ввести дані
        </button>
      </div>

      {/* Add/edit form */}
      {showForm && (
        <EntryForm
          onSave={handleSave}
          onCancel={handleCancel}
          initial={editingEntry || undefined}
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
              <div key={item.manualId || i} className="flex items-center justify-between px-5 py-3">
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
                      {item.manualId && " · вручну"}
                      {item.currencyCode !== 980 && ` · ${getCurrencyInfo(item.currencyCode).code}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {formatAmount(item.amount, item.currencyCode)}
                  </span>
                  {item.manualId && (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={() => {
                          const entry = entries.find((e) => e.id === item.manualId);
                          if (entry) handleEdit(entry);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        title="Редагувати"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeEntry(item.manualId!)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Видалити"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
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
              <div key={item.manualId || i} className="flex items-center justify-between px-5 py-3">
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
                      {item.manualId && " · вручну"}
                      {item.currencyCode !== 980 && ` · ${getCurrencyInfo(item.currencyCode).code}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {formatAmount(item.amount, item.currencyCode)}
                  </span>
                  {item.manualId && (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={() => {
                          const entry = entries.find((e) => e.id === item.manualId);
                          if (entry) handleEdit(entry);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        title="Редагувати"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeEntry(item.manualId!)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Видалити"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
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
