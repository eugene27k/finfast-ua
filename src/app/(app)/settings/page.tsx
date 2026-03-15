"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";

export default function SettingsPage() {
  const { token, setToken, clearToken, client, clientLoading: loading, clientError: error } = useData();
  const [inputToken, setInputToken] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    const trimmed = inputToken.trim();
    if (!trimmed) return;
    setSaving(true);
    setToken(trimmed);
    setInputToken("");
    setTimeout(() => setSaving(false), 500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Налаштування</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Monobank API Token
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Отримайте ваш персональний токен на{" "}
          <a
            href="https://api.monobank.ua/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            api.monobank.ua
          </a>
          . Токен зберігається лише у вашому браузері.
        </p>

        {token ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 font-mono">
                {token.slice(0, 8)}{"•".repeat(20)}{token.slice(-4)}
              </div>
              <button
                onClick={clearToken}
                className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Видалити
              </button>
            </div>

            {loading && (
              <p className="text-sm text-gray-400 animate-pulse">
                Перевірка токена...
              </p>
            )}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            {client && (
              <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-3 rounded-lg text-sm">
                Токен дійсний. Підключено до акаунту: <strong>{client.name}</strong>
                <br />
                Кількість рахунків: {client.accounts.length}
                {client.jars && client.jars.length > 0 && (
                  <>, банок: {client.jars.length}</>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Вставте ваш Monobank API токен"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            <button
              onClick={handleSave}
              disabled={!inputToken.trim() || saving}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Збереження..." : "Зберегти"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Про додаток</h2>
        <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
          <p>
            <strong className="text-gray-700 dark:text-gray-300">FinFast UA</strong> — персональний додаток для управління
            фінансами з інтеграцією Monobank API.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Перегляд балансів всіх рахунків та банок</li>
            <li>Історія транзакцій з пошуком та фільтрацією</li>
            <li>Аналітика витрат за категоріями</li>
            <li>Графіки щоденних витрат та надходжень</li>
            <li>Курси валют Monobank</li>
          </ul>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Дані не передаються на сервери третіх сторін. Токен зберігається
            виключно у localStorage вашого браузера.
          </p>
        </div>
      </div>
    </div>
  );
}
