"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useData } from "@/components/DataProvider";
import { generatePassword, saveToPasswordManager } from "@/lib/passwords";

const LOCAL_STORAGE_KEYS = [
  "finfast_budgets",
] as const;

export default function SettingsPage() {
  const { token, setToken, clearToken, client, clientLoading: loading, clientError: error, userId, refreshCategories, refreshOverrides, refreshManualAccounts } = useData();
  const [inputToken, setInputToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- AI settings ---
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [aiKeySaving, setAiKeySaving] = useState(false);
  const [aiKeyStatus, setAiKeyStatus] = useState<{ hasKey: boolean; keyPreview: string | null } | null>(null);
  const [aiKeyError, setAiKeyError] = useState<string | null>(null);

  // --- Password change ---
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdResult, setPwdResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleChangePassword = async () => {
    setPwdResult(null);
    if (newPassword.length < 8) {
      setPwdResult({ ok: false, message: "Новий пароль має містити щонайменше 8 символів." });
      return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error === "WRONG_PASSWORD"
            ? "Поточний пароль невірний."
            : data.error === "WEAK_PASSWORD"
            ? "Новий пароль має містити щонайменше 8 символів."
            : data.error || "Помилка зміни пароля";
        throw new Error(msg);
      }
      if (data.email) await saveToPasswordManager(data.email, newPassword);
      setPwdResult({ ok: true, message: "Пароль змінено. Збережіть новий пароль у менеджері браузера." });
      setOldPassword("");
      setNewPassword("");
      setShowNewPassword(false);
    } catch (e) {
      setPwdResult({ ok: false, message: e instanceof Error ? e.message : "Помилка зміни пароля" });
    } finally {
      setPwdSaving(false);
    }
  };

  const loadAiKeyStatus = useCallback(() => {
    if (!userId) return;
    fetch(`/api/settings/ai?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setAiKeyStatus({ hasKey: data.hasKey, keyPreview: data.keyPreview });
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    loadAiKeyStatus();
  }, [loadAiKeyStatus]);

  const handleSaveAiKey = async () => {
    const trimmed = aiKeyInput.trim();
    if (!trimmed || !userId) return;
    setAiKeySaving(true);
    setAiKeyError(null);
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, apiKey: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Помилка збереження");
      setAiKeyStatus({ hasKey: data.hasKey, keyPreview: data.keyPreview });
      setAiKeyInput("");
    } catch (e) {
      setAiKeyError(e instanceof Error ? e.message : "Помилка збереження");
    } finally {
      setAiKeySaving(false);
    }
  };

  const handleRemoveAiKey = async () => {
    if (!userId) return;
    setAiKeySaving(true);
    setAiKeyError(null);
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, apiKey: null }),
      });
      if (!res.ok) throw new Error("Помилка видалення");
      setAiKeyStatus({ hasKey: false, keyPreview: null });
    } catch (e) {
      setAiKeyError(e instanceof Error ? e.message : "Помилка видалення");
    } finally {
      setAiKeySaving(false);
    }
  };

  const handleExport = async () => {
    if (!userId) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/export?userId=${userId}`);
      if (!res.ok) throw new Error("Помилка експорту");
      const serverData = await res.json();

      // Merge localStorage data into the export payload
      const localData: Record<string, unknown> = {};
      for (const key of LOCAL_STORAGE_KEYS) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) localData[key] = JSON.parse(raw);
        } catch { /* skip corrupted */ }
      }
      const merged = { ...serverData, localStorage: localData };

      const blob = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finfast-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Помилка експорту");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    if (!userId) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Restore localStorage data if present
      let localRestored = 0;
      if (parsed.localStorage && typeof parsed.localStorage === "object") {
        for (const key of LOCAL_STORAGE_KEYS) {
          const val = parsed.localStorage[key];
          if (val !== undefined) {
            localStorage.setItem(key, JSON.stringify(val));
            localRestored++;
          }
        }
      }

      // Send server data (without localStorage section) to API
      const res = await fetch(`/api/import?userId=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Помилка імпорту");
      const s = data.stats;
      const localMsg = localRestored > 0 ? ` Відновлено локальних даних: ${localRestored}.` : "";
      const manualMsg = (s.manualAccountsCreated || 0) > 0 ? ` Ручних рахунків: ${s.manualAccountsCreated}, транзакцій: ${s.manualTransactionsCreated}.` : "";
      setImportResult({
        ok: true,
        message: `Імпортовано: ${s.transactionsCreated} транзакцій, ${s.categoriesCreated} категорій, ${s.overridesCreated} перевизначень. Пропущено дублікатів: ${s.transactionsSkipped}.${manualMsg}${localMsg}`,
      });
      refreshCategories();
      refreshOverrides();
      refreshManualAccounts();
    } catch (e) {
      setImportResult({
        ok: false,
        message: e instanceof Error ? e.message : "Помилка імпорту",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

      {userId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Пароль для входу
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Пароль шифрує вашу базу даних. Після зміни збережіть новий пароль у менеджері
            паролів браузера.
          </p>
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Поточний пароль</span>
              <input
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Ваш поточний пароль"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </label>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Новий пароль</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewPassword(generatePassword());
                    setShowNewPassword(true);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Згенерувати
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Щонайменше 8 символів"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
                >
                  {showNewPassword ? "Сховати" : "Показати"}
                </button>
              </div>
            </div>
            <button
              onClick={handleChangePassword}
              disabled={!oldPassword || !newPassword || pwdSaving}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pwdSaving ? "Зміна..." : "Змінити пароль"}
            </button>
            {pwdResult && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  pwdResult.ok
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                }`}
              >
                {pwdResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {userId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              AI Категоризація
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full uppercase tracking-wider">
              Beta
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Підключіть ключ OpenAI API для автоматичної категоризації транзакцій за описом, MCC-кодом та іншими ознаками.
            Ключ можна отримати на{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              platform.openai.com
            </a>
            .
          </p>

          {aiKeyStatus?.hasKey ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 font-mono flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {aiKeyStatus.keyPreview}
                </div>
                <button
                  onClick={handleRemoveAiKey}
                  disabled={aiKeySaving}
                  className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  Видалити
                </button>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-3 rounded-lg text-sm">
                Ключ підключено. AI-категоризація доступна для ваших транзакцій.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="password"
                placeholder="sk-..."
                value={aiKeyInput}
                onChange={(e) => setAiKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveAiKey()}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono"
              />
              <button
                onClick={handleSaveAiKey}
                disabled={!aiKeyInput.trim() || aiKeySaving}
                className="px-6 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {aiKeySaving ? "Збереження..." : "Зберегти ключ"}
              </button>
            </div>
          )}

          {aiKeyError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
              {aiKeyError}
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Ключ зберігається у базі даних додатка і використовується лише для запитів до OpenAI API.
          </p>
        </div>
      )}

      {userId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Експорт / Імпорт даних
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Вивантажте всі ваші дані (транзакції, категорії, перевизначення) у файл
            або завантажте раніше збережений файл в іншу копію додатка.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" /></svg>
                  Експорт...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" /><path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" /></svg>
                  Експортувати дані
                </>
              )}
            </button>

            <label
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer ${
                importing
                  ? "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
            >
              {importing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" /></svg>
                  Імпорт...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" /><path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" /></svg>
                  Імпортувати дані
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
              />
            </label>
          </div>

          {importResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                importResult.ok
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              }`}
            >
              {importResult.message}
            </div>
          )}
        </div>
      )}

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
