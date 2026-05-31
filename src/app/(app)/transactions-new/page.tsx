"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useData, type ManualAccountData, type ManualTransactionData, type FetchProgress } from "@/components/DataProvider";
import RefreshButton from "@/components/RefreshButton";
import CategoryDropdown from "@/components/CategoryDropdown";
import AiCategorizationPanel from "@/components/AiCategorizationPanel";
import { formatAmount, getCurrencyInfo } from "@/lib/currency";
import { CATEGORY_NAMES, getEffectiveCategory, getCategoryColor } from "@/lib/mcc";
import { useCurrencyRates } from "@/lib/hooks";
import type { MonobankAccount, MonobankStatement, MonobankCurrencyRate } from "@/types/monobank";

function getUahRate(currencyCode: number, rates: MonobankCurrencyRate[]): number {
  if (currencyCode === 980) return 1;
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

const MANUAL_CATEGORY_LABELS: Record<string, string> = {
  deposit: "Депозит",
  cash: "Готівка",
  investment: "Інвестиції",
  "other-asset": "Інший актив",
  installment: "Розстрочка",
  "buy-in-parts": "Покупки частинами",
  "short-loan": 'Кредит "До завтра"',
  mortgage: "Іпотека / кредит",
  "other-liability": "Інше зобов'язання",
};

const CARD_TYPE_LABELS: Record<string, string> = {
  black: "Чорна",
  white: "Біла",
  platinum: "Platinum",
  iron: "Iron",
  fop: "ФОП",
  yellow: "Жовта",
  eAid: "єПідтримка",
};

function getMonoAccountLabel(acc: MonobankAccount): string {
  const label = CARD_TYPE_LABELS[acc.type] || acc.type;
  const pan = acc.maskedPan[0];
  const suffix = pan ? ` •${pan.slice(-4)}` : "";
  return `${label}${suffix}`;
}

/* ── Unified types ─────────────────────────────────────── */

interface UnifiedAccount {
  id: string;
  name: string;
  currencyCode: number;
  source: "mono" | "manual";
}

interface UnifiedTx {
  id: string;
  time: number;
  amount: number;
  description: string;
  comment?: string | null;
  currencyCode: number;
  accountId: string;
  accountName: string;
  badgeText: string;
  badgeColor?: string;
  mcc?: number;
  source: "mono" | "manual";
  manualTx?: ManualTransactionData;
  manualAccount?: ManualAccountData;
}

/* ── Loading progress ──────────────────────────────────── */

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
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-blue-500" />
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
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {currentAccount && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Завантаження: {getMonoAccountLabel(currentAccount)}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-400">Підготовка до завантаження...</p>
      )}
    </div>
  );
}

/* ── Transaction form (manual only) ────────────────────── */

interface TxFormData {
  manualAccountId: string;
  direction: "in" | "out";
  amount: string;
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

  const [form, setForm] = useState<TxFormData>(() => {
    if (initial) {
      const date = new Date(initial.tx.time * 1000);
      return {
        manualAccountId: initial.accountId,
        direction: initial.tx.amount >= 0 ? "in" : "out",
        amount: (Math.abs(initial.tx.amount) / 100).toString(),
        description: initial.tx.description,
        category: "",
        date: date.toISOString().slice(0, 10),
      };
    }
    return {
      manualAccountId: defaultAccountId,
      direction: "in",
      amount: "",
      description: "",
      category: "",
      date: new Date().toISOString().slice(0, 10),
    };
  });

  const currentAccount = accounts.find((a) => a.id === form.manualAccountId);

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
          {initial ? "Редагувати транзакцію" : "Нова ручна транзакція"}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Рахунок (ручний)</label>
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

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Дата</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => update({ date: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

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
  item,
  onEdit,
  onDelete,
  currencyRates,
}: {
  item: UnifiedTx;
  onEdit: () => void;
  onDelete: () => void;
  currencyRates: MonobankCurrencyRate[];
}) {
  const isExpense = item.amount < 0;
  const date = new Date(item.time * 1000);
  const isNotUah = item.currencyCode !== 980;
  const uahAmount = isNotUah ? toUah(item.amount, item.currencyCode, currencyRates) : null;
  const isManual = item.source === "manual";

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 last:border-0 group">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
          isManual ? "bg-blue-500" : "bg-gray-700"
        }`}
        title={isManual ? "Ручна" : "Monobank"}
      >
        {isManual ? "РЧ" : "МБ"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {item.description}
        </div>
        {item.comment && (
          <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.comment}</div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] px-1.5 py-0.5 rounded ${
            isManual
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}>
            {item.accountName}
          </span>
          {item.source === "mono" && item.badgeColor ? (
            <CategoryDropdown
              transactionId={item.id}
              mcc={item.mcc ?? 0}
              currentCategory={item.badgeText}
              currentColor={item.badgeColor}
            />
          ) : item.badgeColor ? (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${item.badgeColor}20`, color: item.badgeColor }}
            >
              {item.badgeText}
            </span>
          ) : (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              {item.badgeText}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        <div>
          <div className={`text-sm font-semibold ${isExpense ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
            {isExpense ? "" : "+"}{formatAmount(item.amount, item.currencyCode)}
          </div>
          {uahAmount !== null && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ≈ {formatAmount(uahAmount, 980)}
            </div>
          )}
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}{" "}
            {date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        {isManual && (
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
        )}
      </div>
    </div>
  );
}

/* ── Main page content ───────────────────────────────────── */

function TransactionsContent() {
  const {
    token, tokenReady, client, statements,
    statementsLoading, statementsError, progress,
    refresh, lastRefreshedAt,
    manualAccounts, refreshManualAccounts,
    overrides, customCategories,
  } = useData();
  const { data: currencyRates } = useCurrencyRates();
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialAccount = searchParams.get("account") || "";
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<{ tx: ManualTransactionData; accountId: string } | null>(null);
  const [filterAccountId, setFilterAccountId] = useState<string>(initialAccount);
  const [filterSource, setFilterSource] = useState<"all" | "mono" | "manual">("all");
  const [period, setPeriod] = useState(30);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const periodFrom = useMemo(
    () => Math.floor(Date.now() / 1000) - period * 24 * 60 * 60,
    [period]
  );

  useEffect(() => {
    if (tokenReady && !token) router.replace("/settings");
  }, [tokenReady, token, router]);

  const allCategoryNames = useMemo(() => {
    const custom = customCategories.map((c) => c.name);
    return [...CATEGORY_NAMES, ...custom.filter((n) => !CATEGORY_NAMES.includes(n))];
  }, [customCategories]);

  const filterAccounts = useMemo<UnifiedAccount[]>(() => {
    const items: UnifiedAccount[] = [];
    if (client) {
      for (const acc of client.accounts) {
        items.push({ id: acc.id, name: getMonoAccountLabel(acc), currencyCode: acc.currencyCode, source: "mono" });
      }
      for (const jar of client.jars || []) {
        items.push({ id: jar.id, name: `Банка: ${jar.title}`, currencyCode: jar.currencyCode, source: "mono" });
      }
    }
    for (const acc of manualAccounts) {
      items.push({ id: acc.id, name: acc.name, currencyCode: acc.currencyCode, source: "manual" });
    }
    return items;
  }, [client, manualAccounts]);

  const monoAccountMap = useMemo(() => {
    const map = new Map<string, { name: string; currencyCode: number }>();
    if (client) {
      for (const acc of client.accounts) {
        map.set(acc.id, { name: getMonoAccountLabel(acc), currencyCode: acc.currencyCode });
      }
      for (const jar of client.jars || []) {
        map.set(jar.id, { name: `Банка: ${jar.title}`, currencyCode: jar.currencyCode });
      }
    }
    return map;
  }, [client]);

  const allTransactions = useMemo<UnifiedTx[]>(() => {
    const items: UnifiedTx[] = [];

    if (filterSource !== "manual") {
      for (const [accId, txList] of Object.entries(statements)) {
        if (filterAccountId && accId !== filterAccountId) continue;
        const accInfo = monoAccountMap.get(accId);
        if (!accInfo) continue;
        for (const tx of txList as MonobankStatement[]) {
          if (tx.time < periodFrom) continue;
          const cat = getEffectiveCategory(tx.mcc, tx.id, overrides);
          items.push({
            id: tx.id,
            time: tx.time,
            amount: tx.amount,
            description: tx.description,
            comment: tx.comment,
            currencyCode: tx.currencyCode,
            accountId: accId,
            accountName: accInfo.name,
            badgeText: cat.name,
            badgeColor: cat.color,
            mcc: tx.mcc,
            source: "mono",
          });
        }
      }
    }

    if (filterSource !== "mono") {
      for (const acc of manualAccounts) {
        if (filterAccountId && acc.id !== filterAccountId) continue;
        for (const tx of acc.transactions) {
          if (tx.time < periodFrom) continue;
          items.push({
            id: tx.id,
            time: tx.time,
            amount: tx.amount,
            description: tx.description,
            currencyCode: acc.currencyCode,
            accountId: acc.id,
            accountName: acc.name,
            badgeText: MANUAL_CATEGORY_LABELS[acc.category] || acc.category,
            source: "manual",
            manualTx: tx,
            manualAccount: acc,
          });
        }
      }
    }

    items.sort((a, b) => b.time - a.time);
    return items;
  }, [statements, monoAccountMap, manualAccounts, filterAccountId, filterSource, periodFrom, overrides]);

  const filtered = useMemo(() => {
    let result = allTransactions;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.description.toLowerCase().includes(q) ||
          item.accountName.toLowerCase().includes(q) ||
          item.badgeText.toLowerCase().includes(q) ||
          (item.comment && item.comment.toLowerCase().includes(q))
      );
    }
    if (selectedCategories.length > 0) {
      result = result.filter((item) => {
        if (item.source === "manual") return false;
        return selectedCategories.includes(item.badgeText);
      });
    }
    return result;
  }, [allTransactions, search, selectedCategories]);

  const uncategorizedForAi = useMemo(() => {
    const result: { id: string; description: string; mcc: number; originalMcc: number; amount: number; counterName?: string; counterEdrpou?: string; comment?: string }[] = [];
    for (const [accId, txList] of Object.entries(statements)) {
      for (const tx of txList as MonobankStatement[]) {
        if (tx.time < periodFrom) continue;
        if (overrides[tx.id]) continue;
        const cat = getEffectiveCategory(tx.mcc, tx.id, overrides);
        if (cat.name !== "Інше") continue;
        if (tx.amount >= 0) continue;
        result.push({
          id: tx.id,
          description: tx.description,
          mcc: tx.mcc,
          originalMcc: tx.originalMcc,
          amount: tx.amount,
          counterName: tx.counterName || undefined,
          counterEdrpou: tx.counterEdrpou || undefined,
          comment: tx.comment || undefined,
        });
      }
    }
    return result;
  }, [statements, periodFrom, overrides]);

  const totalIncome = filtered
    .filter((i) => i.amount > 0)
    .reduce((sum, i) => sum + toUah(i.amount, i.currencyCode, currencyRates), 0);
  const totalExpense = filtered
    .filter((i) => i.amount < 0)
    .reduce((sum, i) => sum + toUah(Math.abs(i.amount), i.currencyCode, currencyRates), 0);

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

  if (!tokenReady || !token) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Транзакції</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Monobank + ручні рахунки</p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton onClick={refresh} loading={statementsLoading} lastRefreshedAt={lastRefreshedAt} />
          {uncategorizedForAi.length > 0 && (
            <button
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showAiPanel
                  ? "bg-purple-700 text-white"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              AI ({uncategorizedForAi.length})
            </button>
          )}
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
      </div>

      {showForm && (
        <TransactionFormPanel
          accounts={manualAccounts}
          onSave={editingTx ? handleUpdate : handleCreate}
          onCancel={handleCancel}
          initial={editingTx || undefined}
          initialAccountId={
            filterAccountId && manualAccounts.some((a) => a.id === filterAccountId)
              ? filterAccountId
              : undefined
          }
        />
      )}

      {showAiPanel && uncategorizedForAi.length > 0 && (
        <AiCategorizationPanel
          uncategorizedTxs={uncategorizedForAi}
          onClose={() => setShowAiPanel(false)}
          onApplied={() => {}}
        />
      )}

      {/* Filters row 1: source, account, period, search */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as "all" | "mono" | "manual")}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">Всі джерела</option>
          <option value="mono">Тільки Monobank</option>
          <option value="manual">Тільки ручні</option>
        </select>

        <select
          value={filterAccountId}
          onChange={(e) => setFilterAccountId(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Всі рахунки</option>
          {filterAccounts.filter((a) => a.source === "mono").length > 0 && (
            <optgroup label="Monobank">
              {filterAccounts.filter((a) => a.source === "mono").map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({getCurrencyInfo(acc.currencyCode).code})
                </option>
              ))}
            </optgroup>
          )}
          {filterAccounts.filter((a) => a.source === "manual").length > 0 && (
            <optgroup label="Ручні">
              {filterAccounts.filter((a) => a.source === "manual").map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({getCurrencyInfo(acc.currencyCode).code})
                </option>
              ))}
            </optgroup>
          )}
        </select>

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

        <input
          type="text"
          placeholder="Пошук транзакцій..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      {/* Category filter pills */}
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
              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />
              {cat}
            </button>
          );
        })}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Транзакцій</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{filtered.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Надходження</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            +{formatAmount(totalIncome, 980)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Витрати</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            -{formatAmount(totalExpense, 980)}
          </p>
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {statementsLoading ? (
          <LoadingProgress progress={progress} accounts={client?.accounts || []} />
        ) : statementsError ? (
          <div className="p-4 text-red-600 dark:text-red-400 text-sm">{statementsError}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Немає транзакцій за обраний період
          </div>
        ) : (
          filtered.map((item) => (
            <TxRow
              key={`${item.source}-${item.id}`}
              item={item}
              onEdit={() => item.manualTx && item.manualAccount && handleEdit(item.manualTx, item.manualAccount.id)}
              onDelete={() => handleDelete(item.id)}
              currencyRates={currencyRates}
            />
          ))
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
