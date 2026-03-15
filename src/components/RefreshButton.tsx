"use client";

import { useState, useEffect } from "react";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

interface RefreshButtonProps {
  onClick: () => void;
  loading?: boolean;
  lastRefreshedAt?: Date | null;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

export default function RefreshButton({ onClick, loading, lastRefreshedAt }: RefreshButtonProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lastRefreshedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [lastRefreshedAt]);

  const elapsed = lastRefreshedAt ? now - lastRefreshedAt.getTime() : Infinity;
  const onCooldown = elapsed < COOLDOWN_MS;
  const remainingSec = onCooldown ? Math.ceil((COOLDOWN_MS - elapsed) / 1000) : 0;
  const remainingMin = Math.ceil(remainingSec / 60);

  const isDisabled = loading || onCooldown;

  const title = loading
    ? "Завантаження..."
    : onCooldown
      ? `Оновлення доступне через ${remainingMin} хв`
      : "Оновити дані";

  return (
    <div className="flex items-center gap-2">
      {lastRefreshedAt && (
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          оновлено о {formatTime(lastRefreshedAt)}
        </span>
      )}
      <button
        onClick={onClick}
        disabled={isDisabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={title}
      >
        <svg
          className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183"
          />
        </svg>
        Оновити
      </button>
    </div>
  );
}
