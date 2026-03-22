"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useData, type ManualAccountData } from "@/components/DataProvider";
import { formatAmount, getCurrencyInfo } from "@/lib/currency";

const ACCOUNT_TYPES = [
  {
    type: "asset" as const,
    label: "Активи",
    categories: [
      { value: "deposit", label: "Депозит" },
      { value: "cash", label: "Готівка" },
      { value: "investment", label: "Інвестиції" },
      { value: "other-asset", label: "Інший актив" },
    ],
  },
  {
    type: "liability" as const,
    label: "Зобов'язання",
    categories: [
      { value: "installment", label: "Розстрочка" },
      { value: "buy-in-parts", label: "Покупки частинами" },
      { value: "short-loan", label: 'Кредит "До завтра"' },
      { value: "mortgage", label: "Іпотека / кредит" },
      { value: "other-liability", label: "Інше зобов'язання" },
    ],
  },
];

const CURRENCIES = [
  { code: 980, label: "UAH — Гривня" },
  { code: 840, label: "USD — Долар" },
  { code: 978, label: "EUR — Євро" },
  { code: 826, label: "GBP — Фунт" },
  { code: 985, label: "PLN — Злотий" },
];

const CATEGORY_COLORS: Record<string, string> = {
  deposit: "bg-violet-500",
  cash: "bg-amber-500",
  investment: "bg-indigo-500",
  "other-asset": "bg-teal-500",
  installment: "bg-orange-500",
  "buy-in-parts": "bg-amber-600",
  "short-loan": "bg-pink-500",
  mortgage: "bg-purple-500",
  "other-liability": "bg-red-500",
};

const CATEGORY_LABELS: Record<string, string> = {
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

/* ── Create / Edit Account Form ─────────────────────────── */

function AccountForm({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (data: { name: string; type: string; category: string; currencyCode: number }) => void;
  onCancel: () => void;
  initial?: ManualAccountData;
}) {
  const [type, setType] = useState<"asset" | "liability">(
    (initial?.type as "asset" | "liability") || "asset"
  );
  const [category, setCategory] = useState(initial?.category || "deposit");
  const [name, setName] = useState(initial?.name || "");
  const [currencyCode, setCurrencyCode] = useState(initial?.currencyCode || 980);
  const [error, setError] = useState("");

  const group = ACCOUNT_TYPES.find((g) => g.type === type)!;

  useEffect(() => {
    if (!initial) {
      setCategory(group.categories[0].value);
    }
  }, [type, group, initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Введіть назву рахунку");
      return;
    }
    setError("");
    onSave({ name: name.trim(), type, category, currencyCode });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
          {initial ? "Редагувати рахунок" : "Новий рахунок"}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="flex gap-2">
          {ACCOUNT_TYPES.map((g) => (
            <button
              key={g.type}
              type="button"
              onClick={() => setType(g.type)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                type === g.type
                  ? g.type === "asset"
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-700"
                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-700"
                  : "bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Категорія</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {group.categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Назва</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="Напр. Депозит у ПриватБанку"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        {/* Currency */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Валюта</label>
          <select
            value={currencyCode}
            onChange={(e) => setCurrencyCode(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          {initial ? "Зберегти" : "Створити рахунок"}
        </button>
      </form>
    </div>
  );
}

/* ── Account card ────────────────────────────────────────── */

function AccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: ManualAccountData;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dotColor = CATEGORY_COLORS[account.category] || "bg-gray-400";
  const isAsset = account.type === "asset";
  const cur = getCurrencyInfo(account.currencyCode);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between group hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-3 h-3 rounded-full shrink-0 ${dotColor}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{account.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {CATEGORY_LABELS[account.category] || account.category}
            {" · "}
            {cur.code}
            {" · "}
            {account.transactions.length} тр.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-sm font-semibold ${isAsset ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {formatAmount(account.balance, account.currencyCode)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors rounded"
            title="Редагувати"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
            title="Видалити"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */

export default function AccountsPage() {
  const { token, tokenReady, userId, manualAccounts, manualAccountsLoading, refreshManualAccounts } = useData();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManualAccountData | null>(null);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (tokenReady && !token) router.replace("/settings");
  }, [tokenReady, token, router]);

  const assetAccounts = manualAccounts.filter((a) => a.type === "asset");
  const liabilityAccounts = manualAccounts.filter((a) => a.type === "liability");

  const handleCreate = async (data: { name: string; type: string; category: string; currencyCode: number }) => {
    if (!userId) return;
    setApiError("");
    const res = await fetch("/api/manual-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...data }),
    });
    if (res.ok) {
      setShowForm(false);
      refreshManualAccounts();
    } else {
      const err = await res.json();
      setApiError(err.error || "Помилка створення");
    }
  };

  const handleUpdate = async (data: { name: string; type: string; category: string; currencyCode: number }) => {
    if (!editingAccount) return;
    setApiError("");
    const res = await fetch("/api/manual-accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingAccount.id, ...data }),
    });
    if (res.ok) {
      setEditingAccount(null);
      setShowForm(false);
      refreshManualAccounts();
    } else {
      const err = await res.json();
      setApiError(err.error || "Помилка оновлення");
    }
  };

  const handleDelete = async (account: ManualAccountData) => {
    if (!confirm(`Видалити рахунок "${account.name}" та всі його транзакції?`)) return;
    await fetch(`/api/manual-accounts?id=${account.id}`, { method: "DELETE" });
    refreshManualAccounts();
  };

  const handleEdit = (account: ManualAccountData) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAccount(null);
    setApiError("");
  };

  if (!tokenReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Рахунки</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Ручні рахунки для активів та зобов&apos;язань
          </p>
        </div>
        <button
          onClick={() => { setEditingAccount(null); setShowForm(!showForm); setApiError(""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Новий рахунок
        </button>
      </div>

      {apiError && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
          {apiError}
        </div>
      )}

      {showForm && (
        <AccountForm
          onSave={editingAccount ? handleUpdate : handleCreate}
          onCancel={handleCancel}
          initial={editingAccount || undefined}
        />
      )}

      {manualAccountsLoading && manualAccounts.length === 0 && (
        <div className="animate-pulse text-gray-400 text-center py-8">Завантаження рахунків...</div>
      )}

      {!manualAccountsLoading && manualAccounts.length === 0 && !showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-400 mb-4">У вас ще немає ручних рахунків</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            Створити перший рахунок
          </button>
        </div>
      )}

      {/* Assets */}
      {assetAccounts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Активи
            <span className="ml-2 text-sm font-normal text-gray-400">({assetAccounts.length})</span>
          </h2>
          <div className="space-y-2">
            {assetAccounts.map((acc) => (
              <AccountCard
                key={acc.id}
                account={acc}
                onEdit={() => handleEdit(acc)}
                onDelete={() => handleDelete(acc)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Liabilities */}
      {liabilityAccounts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Зобов&apos;язання
            <span className="ml-2 text-sm font-normal text-gray-400">({liabilityAccounts.length})</span>
          </h2>
          <div className="space-y-2">
            {liabilityAccounts.map((acc) => (
              <AccountCard
                key={acc.id}
                account={acc}
                onEdit={() => handleEdit(acc)}
                onDelete={() => handleDelete(acc)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
