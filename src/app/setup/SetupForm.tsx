"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generatePassword, saveToPasswordManager } from "@/lib/passwords";

export default function SetupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  // Offer a strong password by default — the user can keep, regenerate, or replace it.
  useEffect(() => {
    setPassword(generatePassword());
  }, []);

  const errorText = (code: string) => {
    switch (code) {
      case "INVALID_EMAIL":
        return "Невірний формат email.";
      case "WEAK_PASSWORD":
        return "Пароль має містити щонайменше 8 символів.";
      case "ALREADY_SETUP":
        return "Акаунт вже створено. Перейдіть до входу.";
      default:
        return code || "Помилка створення акаунта.";
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Пароль має містити щонайменше 8 символів.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "SETUP_FAILED");
      // Ask the browser to save the credential to its password manager.
      await saveToPasswordManager(email.trim(), password);
      setRecoveryKey(data.recoveryKey);
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  // Step 2 — show the one-time recovery key.
  if (recoveryKey) {
    return (
      <Shell title="Збережіть ключ відновлення">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Це ваш <strong>єдиний</strong> спосіб відновити доступ, якщо ви забудете пароль.
          Ваші дані зашифровані цим паролем — без нього і без цього ключа їх неможливо
          розшифрувати. Запишіть ключ і зберігайте в безпечному місці.
        </p>
        <div className="bg-gray-900 dark:bg-black text-green-400 font-mono text-sm tracking-wider p-4 rounded-lg break-all select-all">
          {recoveryKey}
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(recoveryKey)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Скопіювати ключ
        </button>
        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          Я зберіг(ла) ключ відновлення в безпечному місці.
        </label>
        <button
          type="button"
          onClick={() => {
            router.replace("/dashboard");
            router.refresh();
          }}
          disabled={!acknowledged}
          className="w-full px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Перейти до додатку
        </button>
      </Shell>
    );
  }

  // Step 1 — create credentials.
  return (
    <Shell title="Створення акаунта" subtitle="Перший запуск — задайте логін і пароль">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-5"
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email (логін)</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            autoFocus
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="block space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Пароль</span>
            <button
              type="button"
              onClick={() => {
                setPassword(generatePassword());
                setShowPassword(true);
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Згенерувати інший
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type={showPassword ? "text" : "password"}
              name="new-password"
              autoComplete="new-password"
              value={password}
              placeholder="Надійний пароль"
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} font-mono`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
              title={showPassword ? "Сховати" : "Показати"}
            >
              {showPassword ? "Сховати" : "Показати"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(password)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Скопіювати пароль
          </button>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Пароль шифрує вашу локальну базу даних. Збережіть його у менеджері паролів браузера
          (Chrome запропонує зберегти). Він ніде більше не зберігається — якщо забудете, дані
          можна відновити лише ключем відновлення.
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!email.trim() || !password || busy}
          className="w-full px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? "Створення..." : "Створити акаунт"}
        </button>
      </form>
    </Shell>
  );
}

const inputClass =
  "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500";

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 space-y-5 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">FinFast UA</h1>
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
