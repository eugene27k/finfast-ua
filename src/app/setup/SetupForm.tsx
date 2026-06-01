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
  const [copied, setCopied] = useState(false);

  // Offer a strong password by default — the user can keep, regenerate, or replace it.
  useEffect(() => {
    setPassword(generatePassword());
  }, []);

  // The recovery key is shown only once. While it's on screen and not yet
  // acknowledged, warn before the page is reloaded/closed so it can't be lost.
  useEffect(() => {
    if (!recoveryKey || acknowledged) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [recoveryKey, acknowledged]);

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
    const downloadKey = () => {
      const text = `FinFast UA — ключ відновлення\n\n${recoveryKey}\n\nЦей ключ потрібен, щоб відновити доступ, якщо ви забудете пароль.\nЗберігайте його в безпечному місці й нікому не показуйте.`;
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "finfast-recovery-key.txt";
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <Shell title="Збережіть ключ відновлення">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-sm">
          ⚠️ Цей ключ показується <strong>лише один раз</strong>. Якщо ви забудете пароль — це{" "}
          <strong>єдиний</strong> спосіб відновити доступ до даних. Збережіть його зараз.
        </div>

        <div className="bg-gray-900 dark:bg-black text-green-400 font-mono text-base tracking-wider p-4 rounded-lg break-all select-all text-center">
          {recoveryKey}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard?.writeText(recoveryKey);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* clipboard blocked — use Download instead */
              }
            }}
            className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
          >
            {copied ? "✓ Скопійовано" : "Скопіювати"}
          </button>
          <button
            type="button"
            onClick={downloadKey}
            className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
          >
            Завантажити файлом
          </button>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer pt-1">
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
          {acknowledged ? "Перейти до додатку" : "Спершу збережіть ключ ↑"}
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Загубили? Новий ключ можна згенерувати будь-коли в Налаштуваннях.
        </p>
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
