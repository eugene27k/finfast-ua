"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useData } from "@/components/DataProvider";
import {
  decisionFromToggles,
  type TransferMark,
  type TransferDecision,
} from "@/lib/transfers";

interface TransferMenuProps {
  transactionId: string;
  mark: TransferMark;
  /** The user's raw stored decision, if any (used to offer "reset to auto"). */
  decision: TransferDecision | undefined;
}

/**
 * Per-transaction menu to mark money as an internal movement of funds
 * ("Внутрішнє переміщення коштів") and optionally as a transfer to/from the
 * user's own jar ("Власна банка"). Enabling the jar flag implies internal.
 */
export default function TransferMenu({
  transactionId,
  mark,
  decision,
}: TransferMenuProps) {
  const { refreshOverrides } = useData();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Right-align the menu under the trigger.
      setPos({ top: rect.bottom + 4, left: rect.right - 256 });
    }
    setOpen(!open);
  };

  const save = async (value: TransferDecision | null) => {
    setSaving(true);
    try {
      await fetch("/api/transactions/overrides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, transfer: value }),
      });
      refreshOverrides();
    } finally {
      setSaving(false);
    }
  };

  const setInternal = (next: boolean) => {
    // Turning off internal also turns off jar; jar implies internal.
    save(decisionFromToggles(next, next ? mark.jar : false));
  };
  const setJar = (next: boolean) => {
    save(decisionFromToggles(next ? true : mark.internal, next));
  };

  const isActive = mark.internal || mark.jar;

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        title="Внутрішнє переміщення коштів"
        className={`p-1.5 rounded transition-opacity ${
          isActive
            ? "text-blue-500 opacity-100"
            : `text-gray-400 hover:text-blue-500 ${open ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`
        }`}
      >
        {/* arrows-right-left (transfer) icon */}
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-[9999] overflow-hidden"
          style={{ top: pos.top, left: Math.max(8, pos.left) }}
        >
          {saving && (
            <div className="absolute inset-0 bg-white/70 dark:bg-gray-800/70 flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
            <span>Тип руху коштів</span>
            {mark.auto && (
              <span className="text-blue-500 normal-case font-medium">авто</span>
            )}
          </div>

          <label className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <input
              type="checkbox"
              checked={mark.internal}
              onChange={(e) => setInternal(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm text-gray-800 dark:text-gray-200">
                Внутрішнє переміщення коштів
              </span>
              <span className="block text-[11px] text-gray-400">
                Не рахується як дохід чи витрата
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
            <input
              type="checkbox"
              checked={mark.jar}
              onChange={(e) => setJar(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm text-gray-800 dark:text-gray-200">
                Власна банка
              </span>
              <span className="block text-[11px] text-gray-400">
                Переказ у вашу банку (теж внутрішнє переміщення)
              </span>
            </span>
          </label>

          {(mark.auto || decision !== undefined) && (
            <div className="border-t border-gray-100 dark:border-gray-700 flex">
              {mark.auto && isActive && (
                <button
                  onClick={() => save(decisionFromToggles(mark.internal, mark.jar))}
                  className="flex-1 px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  Підтвердити
                </button>
              )}
              {decision !== undefined && (
                <button
                  onClick={() => save(null)}
                  className="flex-1 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  Скинути до авто
                </button>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
