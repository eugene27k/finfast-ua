"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToken, useClientInfo, useStatement } from "@/lib/hooks";
import TransactionRow from "@/components/TransactionRow";
import AccountCard from "@/components/AccountCard";
import { formatAmount } from "@/lib/currency";

function TransactionsContent() {
  const { token, ready } = useToken();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: client } = useClientInfo(token);

  const initialAccount = searchParams.get("account") || "";
  const [selectedAccount, setSelectedAccount] = useState(initialAccount);
  const [period, setPeriod] = useState(30);
  const [search, setSearch] = useState("");

  const from = useMemo(
    () => Math.floor(Date.now() / 1000) - period * 24 * 60 * 60,
    [period]
  );

  const accountId = selectedAccount || client?.accounts[0]?.id || "";
  const { data: transactions, loading, error } = useStatement(token, accountId, from);

  const filtered = useMemo(() => {
    if (!search) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.description.toLowerCase().includes(q) ||
        (tx.comment && tx.comment.toLowerCase().includes(q))
    );
  }, [transactions, search]);

  const account = client?.accounts.find((a) => a.id === accountId);

  const totalIncome = filtered
    .filter((tx) => tx.amount > 0)
    .reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = filtered
    .filter((tx) => tx.amount < 0)
    .reduce((s, tx) => s + Math.abs(tx.amount), 0);

  useEffect(() => {
    if (ready && !token) router.replace("/settings");
  }, [ready, token, router]);

  if (!ready || !token) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Транзакції</h1>

      {client && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {client.accounts.map((acc) => (
            <div key={acc.id} className="min-w-[200px]">
              <AccountCard
                account={acc}
                selected={acc.id === accountId}
                onClick={() => setSelectedAccount(acc.id)}
              />
            </div>
          ))}
        </div>
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
        <input
          type="text"
          placeholder="Пошук транзакцій..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {account && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">Транзакцій</p>
            <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">Надходження</p>
            <p className="text-2xl font-bold text-green-600">
              +{formatAmount(totalIncome, account.currencyCode)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">Витрати</p>
            <p className="text-2xl font-bold text-red-600">
              -{formatAmount(totalExpense, account.currencyCode)}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">
            Завантаження транзакцій...
          </div>
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
