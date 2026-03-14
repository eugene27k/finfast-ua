"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToken, useClientInfo, useStatement } from "@/lib/hooks";
import { useBudgets, getBudgetStatuses } from "@/lib/budgets";
import { CATEGORY_NAMES, getCategoryColor } from "@/lib/mcc";
import { getCurrencyInfo } from "@/lib/currency";
import BudgetProgressCard from "@/components/BudgetProgressCard";

export default function BudgetsPage() {
  const { token, ready: tokenReady } = useToken();
  const { data: client } = useClientInfo(token);
  const { budgets, ready: budgetsReady, setBudget, removeBudget } = useBudgets();
  const router = useRouter();

  const [selectedAccount, setSelectedAccount] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState("");
  const [formAmount, setFormAmount] = useState("");

  useEffect(() => {
    if (tokenReady && !token) router.replace("/settings");
  }, [tokenReady, token, router]);

  const now = new Date();
  const monthStart = useMemo(
    () => Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.getMonth(), now.getFullYear()]
  );

  const accountId = selectedAccount || client?.accounts[0]?.id || "";
  const account = client?.accounts.find((a) => a.id === accountId);
  const currencyCode = account?.currencyCode || 980;

  const { data: transactions, loading } = useStatement(token, accountId, monthStart);

  const statuses = useMemo(
    () => getBudgetStatuses(budgets, transactions),
    [budgets, transactions]
  );

  const availableCategories = CATEGORY_NAMES.filter(
    (name) => !(name in budgets) || name === editCategory
  );

  const openAddForm = () => {
    setEditCategory(null);
    setFormCategory(availableCategories[0] || "");
    setFormAmount("");
    setShowForm(true);
  };

  const openEditForm = (category: string) => {
    setEditCategory(category);
    setFormCategory(category);
    const info = getCurrencyInfo(currencyCode);
    setFormAmount(String(budgets[category] / Math.pow(10, info.digits)));
    setShowForm(true);
  };

  const handleSave = () => {
    const amount = parseFloat(formAmount);
    if (!formCategory || isNaN(amount) || amount <= 0) return;
    const info = getCurrencyInfo(currencyCode);
    const minorUnits = Math.round(amount * Math.pow(10, info.digits));

    if (editCategory && editCategory !== formCategory) {
      removeBudget(editCategory);
    }
    setBudget(formCategory, minorUnits);
    setShowForm(false);
    setEditCategory(null);
  };

  const handleDelete = (category: string) => {
    removeBudget(category);
  };

  if (!tokenReady || !budgetsReady || !token) return null;

  const monthName = now.toLocaleDateString("uk-UA", { month: "long", year: "numeric" });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Бюджети</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">{monthName}</p>
        </div>
        <button
          onClick={openAddForm}
          disabled={availableCategories.length === 0}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          + Додати бюджет
        </button>
      </div>

      {client && (
        <select
          value={accountId}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {client.accounts.map((acc) => {
            const info = getCurrencyInfo(acc.currencyCode);
            return (
              <option key={acc.id} value={acc.id}>
                {acc.maskedPan[0] || acc.type} ({info.code})
              </option>
            );
          })}
        </select>
      )}

      {showForm && (
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">
            {editCategory ? "Редагувати бюджет" : "Новий бюджет"}
          </h3>
          <div className="flex flex-wrap gap-3">
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Сума"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="100"
              />
              <span className="text-sm text-gray-500">
                {getCurrencyInfo(currencyCode).symbol}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Зберегти
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditCategory(null);
                }}
                className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse text-gray-400 p-8 text-center">
          Завантаження...
        </div>
      ) : statuses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 mb-2">Немає встановлених бюджетів</p>
          <p className="text-sm text-gray-400">
            Натисніть &quot;Додати бюджет&quot; щоб встановити ліміт витрат на категорію
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statuses.map((s) => (
            <BudgetProgressCard
              key={s.category}
              status={s}
              currencyCode={currencyCode}
              onEdit={() => openEditForm(s.category)}
              onDelete={() => handleDelete(s.category)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
