"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useData, type ManualAccountData, type ManualTransactionData } from "@/components/DataProvider";
import { formatAmount, getCurrencyInfo } from "@/lib/currency";
import { CATEGORY_NAMES, getCategoryColor } from "@/lib/mcc";
import { useCurrencyRates } from "@/lib/hooks";
import type { MonobankCurrencyRate } from "@/types/monobank";

function getUahRate(currencyCode: number, rates: MonobankCurrencyRate[]): number {
  if (currencyCode === 980) return 1;
  // Find rate where currencyCodeA = foreign currency, currencyCodeB = 980 (UAH)
  const rate = rates.find(
    (r) => r.currencyCodeA === currencyCode && r.currencyCodeB === 980
  );
  if (rate) {
    return rate.rateSell || rate.rateCross || rate.rateBuy || 1;
  }
  return 1;
}

function toUah(amount: number, currencyCode: number, rates: MonobankCurrencyRate[]): number {
  return Math.round(amount * getUahRate(currencyCode, rates));
}

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

/* ── Transaction form ──────────────────────────────────── */

interface TxFormData {
  manualAccountId: string;
  direction: "in" | "out";
  amount: string;
  amountUah: string;
  description: string;
  category: string;
  date: string;
}

function TransactionFormPanel({
  accounts,
  onSave,
  onCancel,
  initial,
  initialAccountId,
}: {
  accounts: ManualAccountData[];
  onSave: (data: { manualAccountId: string; amount: number; description: string; time: number; category: string }) => void;
  onCancel: () => void;
  initial?: { tx: ManualTransactionData; accountId: string };
  initialAccountId?: string;
}) {
  const defaultAccountId = initial?.accountId || initialAccountId || accounts[0]?.id || "";
  const selectedAccount = accounts.find((a) => a.id === defaultAccountId);
  const isUah = selectedAccount?.currencyCode === 980;

  const [form, setForm] = useState<TxFormData>(() => {
    if (initial) {
      const date = new Date(initial.tx.time * 1000);
      return {
        manualAccountId: initial.accountId,
        direction: initial.tx.amount >= 0 ? "in" : "out",
        amount: (Math.abs(initial.tx.amount) / 100).toString(),
        amountUah: "",
        description: initial.tx.description,
        category: "",
        date: date.toISOString().slice(0, 10),
      };
    }
    return {
      manualAccountId: defaultAccountId,
      direction: "in",
      amount: "",
      amountUah: "",
      description: "",
      category: "",
      date: new Date().toISOString().slice(0, 10),
    };
  });

  const currentAccount = accounts.find((a) => a.id === form.manualAccountId);
  const currentIsUah = currentAccount?.currencyCode === 980;

  const allCategories = useMemo(() => {
    return ["", ...CATEGORY_NAMES];
  }, []);

  const update = (patch: Partial<TxFormData>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(form.amount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0 || !form.description.trim() || !form.manualAccountId) return;

    const amount = Math.round(parsed * 100) * (form.direction === "out" ? -1 : 1);
    const date = new Date(form.date);
    date.setHours(12, 0, 0, 0);
    const time = Math.floor(date.getTime() / 1000);

    onSave({
      manualAccountId: form.manualAccountId,
      amount,
      description: form.description.trim(),
      time,
      category: form.category,
    });
  };

  if (accounts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-3">Спочатку створіть рахунок на сторінці &quot;Рахунки&quot;</p>
        <a href="/accounts" className="text-blue-600 hover:underline text-sm">Перейти до рахунків</a>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
          {initial ? "Редагувати транзакцію" : "Нова транзакція"}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Account */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Рахунок</label>
          <select
            value={form.manualAccountId}
            onChange={(e) => update({ manualAccountId: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({getCurrencyInfo(acc.currencyCode).code}) — {formatAmount(acc.balance, acc.currencyCode)}
              </option>
            ))}
          </select>
        </div>

        {/* Direction */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update({ direction: "in" })}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              form.direction === "in"
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-700"
                : "bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            + Надходження
          </button>
          <button
            type="button"
            onClick={() => update({ direction: "out" })}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              form.direction === "out"
                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-700"
                : "bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            − Списання
          </button>
        </div>

        {/* Amount */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Сума ({getCurrencyInfo(currentAccount?.currencyCode || 980).code})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => update({ amount: e.target.value })}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {!currentIsUah && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Сума в UAH</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.amountUah}
                onChange={(e) => update({ amountUah: e.target.value })}
                placeholder="Авторозрахунок"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Дата</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => update({ date: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Опис</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Напр. Поповнення депозиту"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Категорія (необов&apos;язково)</label>
          <select
            value={form.category}
            onChange={(e) => update({ category: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Без категорії</option>
            {CATEGORY_NAMES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          {initial ? "Зберегти" : "Додати транзакцію"}
        </button>
      </form>
    </div>
  );
}

/* ── Transaction row ─────────────────────────────────────── */

function TxRow({
  tx,
  account,
  onEdit,
  onDelete,
  currencyRates,
}: {
  tx: ManualTransactionData;
  account: ManualAccountData;
  onEdit: () => void;
  onDelete: () => void;
  currencyRates: MonobankCurrencyRate[];
}) {
  const isExpense = tx.amount < 0;
  const date = new Date(tx.time * 1000);
  const isNotUah = account.currencyCode !== 980;
  const uahAmount = isNotUah ? toUah(tx.amount, account.currencyCode, currencyRates) : null;

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 last:border-0 group">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-gray-500">
        РЧ
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {tx.description}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            {account.name}
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {CATEGORY_LABELS[account.category] || account.category}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        <div>
          <div className={`text-sm font-semibold ${isExpense ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
            {isExpense ? "" : "+"}{formatAmount(tx.amount, account.currencyCode)}
          </div>
          {uahAmount !== null && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ≈ {formatAmount(uahAmount, 980)}
            </div>
          )}
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {date.toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
            title="Редагувати"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            title="Видалити"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */

export default function TransactionsNewPage() {
  const { token, tokenReady, manualAccounts, refreshManualAccounts } = useData();
  const { data: currencyRates } = useCurrencyRates();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<{ tx: ManualTransactionData; accountId: string } | null>(null);
  const [filterAccountId, setFilterAccountId] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (tokenReady && !token) router.replace("/settings");
  }, [tokenReady, token, router]);

  // Flatten all manual transactions with their account info
  const allTransactions = useMemo(() => {
    const items: { tx: ManualTransactionData; account: ManualAccountData }[] = [];
    for (const acc of manualAccounts) {
      if (filterAccountId && acc.id !== filterAccountId) continue;
      for (const tx of acc.transactions) {
        items.push({ tx, account: acc });
      }
    }
    // Sort by time desc
    items.sort((a, b) => b.tx.time - a.tx.time);

    // Apply search
    if (search) {
      const q = search.toLowerCase();
      return items.filter(
        (item) =>
          item.tx.description.toLowerCase().includes(q) ||
          item.account.name.toLowerCase().includes(q)
      );
    }

    return items;
  }, [manualAccounts, filterAccountId, search]);

  const totalIncome = allTransactions
    .filter((i) => i.tx.amount > 0)
    .reduce((sum, i) => sum + toUah(i.tx.amount, i.account.currencyCode, currencyRates), 0);
  const totalExpense = allTransactions
    .filter((i) => i.tx.amount < 0)
    .reduce((sum, i) => sum + toUah(Math.abs(i.tx.amount), i.account.currencyCode, currencyRates), 0);

  const handleCreate = async (data: { manualAccountId: string; amount: number; description: string; time: number }) => {
    const res = await fetch("/api/manual-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowForm(false);
      refreshManualAccounts();
    }
  };

  const handleUpdate = async (data: { manualAccountId: string; amount: number; description: string; time: number }) => {
    if (!editingTx) return;
    const res = await fetch("/api/manual-transactions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingTx.tx.id, amount: data.amount, description: data.description, time: data.time }),
    });
    if (res.ok) {
      setEditingTx(null);
      setShowForm(false);
      refreshManualAccounts();
    }
  };

  const handleDelete = async (txId: string) => {
    if (!confirm("Видалити цю транзакцію?")) return;
    await fetch(`/api/manual-transactions?id=${txId}`, { method: "DELETE" });
    refreshManualAccounts();
  };

  const handleEdit = (tx: ManualTransactionData, accountId: string) => {
    setEditingTx({ tx, accountId });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTx(null);
  };

  if (!tokenReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Транзакції NEW</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Ручні транзакції по рахунках</p>
        </div>
        <button
          onClick={() => { setEditingTx(null); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Нова транзакція
        </button>
      </div>

      {showForm && (
        <TransactionFormPanel
          accounts={manualAccounts}
          onSave={editingTx ? handleUpdate : handleCreate}
          onCancel={handleCancel}
          initial={editingTx || undefined}
          initialAccountId={filterAccountId || undefined}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterAccountId}
          onChange={(e) => setFilterAccountId(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Всі рахунки</option>
          {manualAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({getCurrencyInfo(acc.currencyCode).code})
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Пошук транзакцій..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Транзакцій</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{allTransactions.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Надходження</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            +{formatAmount(totalIncome, 980)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Списання</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            -{formatAmount(totalExpense, 980)}
          </p>
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {allTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {manualAccounts.length === 0 ? (
              <>
                Спочатку створіть рахунок.{" "}
                <a href="/accounts" className="text-blue-600 hover:underline">Перейти до рахунків</a>
              </>
            ) : (
              "Немає транзакцій"
            )}
          </div>
        ) : (
          allTransactions.map(({ tx, account }) => (
            <TxRow
              key={tx.id}
              tx={tx}
              account={account}
              onEdit={() => handleEdit(tx, account.id)}
              onDelete={() => handleDelete(tx.id)}
              currencyRates={currencyRates}
            />
          ))
        )}
      </div>
    </div>
  );
}
