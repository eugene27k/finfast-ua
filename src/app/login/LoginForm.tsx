"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveToPasswordManager } from "@/lib/passwords";

type Mode = "login" | "recover";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorText = (code: string) => {
    switch (code) {
      case "INVALID_CREDENTIALS":
        return "Невірний email або пароль.";
      case "INVALID_RECOVERY":
        return "Невірний email або ключ відновлення.";
      case "WEAK_PASSWORD":
        return "Новий пароль має містити щонайменше 8 символів.";
      default:
        return code || "Сталася помилка.";
    }
  };

  const handleLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "LOGIN_FAILED");
      await saveToPasswordManager(email.trim(), password);
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : ""));
      setBusy(false);
    }
  };

  const handleRecover = async () => {
    setError(null);
    if (newPassword.length < 8) {
      setError("Новий пароль має містити щонайменше 8 символів.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          recoveryKey: recoveryKey.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "RECOVER_FAILED");
      await saveToPasswordManager(email.trim(), newPassword);
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : ""));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 space-y-5 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">FinFast UA</h1>
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
            {mode === "login" ? "Вхід" : "Відновлення доступу"}
          </h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            (mode === "login" ? handleLogin : handleRecover)();
          }}
          className="space-y-5"
        >
          <Field
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoFocus
          />

          {mode === "login" ? (
            <Field
              label="Пароль"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              placeholder="Ваш пароль"
            />
          ) : (
            <>
              <Field
                label="Ключ відновлення"
                type="text"
                name="recovery-key"
                autoComplete="off"
                value={recoveryKey}
                onChange={setRecoveryKey}
                placeholder="XXXXX-XXXXX-..."
              />
              <Field
                label="Новий пароль"
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Щонайменше 8 символів"
              />
            </>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "..." : mode === "login" ? "Увійти" : "Відновити та увійти"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "recover" : "login");
            setError(null);
          }}
          className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {mode === "login" ? "Забули пароль?" : "Згадали пароль? Увійти"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  name,
  autoComplete,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  type: string;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
      />
    </label>
  );
}
