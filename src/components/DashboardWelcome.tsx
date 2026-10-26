"use client";

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";

/**
 * First-run experience shown on the dashboard while no Monobank token is set.
 * Replaces the old silent redirect to Settings with a warm, guided activation:
 * connect Monobank inline in one step, or fall back to manual accounts.
 *
 * Setting the token re-renders the dashboard past the no-token guard, so this
 * screen unmounts on success. An invalid token surfaces in the dashboard's
 * error branch, which offers a "reconnect" path back here.
 */
export default function DashboardWelcome() {
  const { setToken } = useData();
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const connect = () => {
    const t = input.trim();
    if (!t) return;
    setSaving(true);
    setToken(t);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold">Вітаємо у FinFast UA 👋</h1>
        <p className="text-blue-100 mt-2 text-sm">
          Підключіть Monobank — і за хвилину побачите баланси, витрати за категоріями
          та бюджети. Дані залишаються лише у вас.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
            1
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Підключіть Monobank
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Отримайте персональний токен на{" "}
              <a
                href="https://api.monobank.ua/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                api.monobank.ua
              </a>{" "}
              і вставте його нижче. Токен зберігається лише у вашому браузері.
            </p>
            <div className="mt-3 space-y-2">
              <input
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && connect()}
                placeholder="Вставте ваш Monobank API токен"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <button
                onClick={connect}
                disabled={!input.trim() || saving}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Підключення…" : "Підключити"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-bold flex items-center justify-center">
            2
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Немає Monobank?
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Можна вести облік вручну — додайте рахунки для готівки, депозитів,
              кредитів та інших активів і зобов&apos;язань.
            </p>
            <Link
              href="/accounts"
              className="inline-block mt-3 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Додати рахунок вручну
            </Link>
          </div>
        </div>
      </div>

      <p className="text-xs text-center text-gray-400 dark:text-gray-500">
        Дані не передаються третім сторонам. Токен і база зберігаються лише на цьому пристрої.
      </p>
    </div>
  );
}
