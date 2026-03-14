"use client";

interface RefreshButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  cooldownLeft?: number;
}

export default function RefreshButton({ onClick, loading, disabled, cooldownLeft }: RefreshButtonProps) {
  const isDisabled = loading || disabled;
  const showCooldown = !loading && cooldownLeft && cooldownLeft > 0;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title={showCooldown ? `Доступно через ${cooldownLeft} сек` : "Оновити дані"}
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
      {showCooldown ? (
        <span className="tabular-nums">{cooldownLeft} сек</span>
      ) : (
        "Оновити дані"
      )}
    </button>
  );
}
