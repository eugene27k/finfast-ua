"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useData } from "@/components/DataProvider";
import { CATEGORY_NAMES, getMccCategory, getCategoryColor } from "@/lib/mcc";

interface CategoryDropdownProps {
  transactionId: string;
  mcc: number;
  currentCategory: string;
  currentColor: string;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#22c55e",
  "#14b8a6", "#3b82f6", "#6366f1", "#a855f7",
  "#ec4899", "#64748b",
];

const DROPDOWN_WIDTH = 256; // w-64

interface DropdownPos {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export default function CategoryDropdown({
  transactionId,
  mcc,
  currentCategory,
  currentColor,
}: CategoryDropdownProps) {
  const { userId, customCategories, overrides, refreshCategories, refreshOverrides } = useData();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState<DropdownPos>({ left: 0, top: 0, maxHeight: 320 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOverridden = !!overrides[transactionId];
  const monoCategory = getMccCategory(mcc);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setCreating(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Flip upward only when there's clearly not enough room below.
      const openUp = spaceBelow < 300 && spaceAbove > spaceBelow;
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - DROPDOWN_WIDTH - 8)
      );
      setPos({
        left,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: Math.max(180, (openUp ? spaceAbove : spaceBelow) - 16),
      });
    }
    setOpen(!open);
  };

  const putOverride = async (body: Record<string, unknown>) => {
    if (!userId) return;
    setSaving(true);
    try {
      await fetch("/api/transactions/overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, transactionId, ...body }),
      });
      refreshOverrides();
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  // Custom-category override (or reset when id is null).
  const handleSelect = (categoryId: string | null) =>
    putOverride({ customCategoryId: categoryId });

  // Clear any override → fall back to the automatic MCC category.
  const handleReset = () => putOverride({ customCategoryId: null, monoCategoryName: null });

  // Built-in Mono-category override. Selecting the MCC-derived one just resets
  // to automatic, keeping the "manually overridden" marker honest.
  const handleSelectMono = (name: string) =>
    name === monoCategory ? handleReset() : putOverride({ monoCategoryName: name });

  const handleCreate = async () => {
    if (!userId || !newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: newName.trim(), color: newColor }),
      });
      const data = await res.json();
      if (data.category) {
        refreshCategories();
        await handleSelect(data.category.id);
      }
    } finally {
      setSaving(false);
      setCreating(false);
      setNewName("");
    }
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="text-[11px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
        style={{ backgroundColor: `${currentColor}20`, color: currentColor }}
        title="Змінити категорію"
      >
        <span className={isOverridden ? "underline decoration-dotted" : ""}>
          {currentCategory}
        </span>
        <svg className="w-2.5 h-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-[9999] overflow-hidden"
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
        >
          {saving && (
            <div className="absolute inset-0 bg-white/70 dark:bg-gray-800/70 flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <div className="overflow-y-auto" style={{ maxHeight: pos.maxHeight }}>
            {isOverridden && (
              <button
                onClick={handleReset}
                className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                Скинути до авто (MCC {mcc})
              </button>
            )}

            {/* Built-in Monobank categories — selectable without duplicating them. */}
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900">
              Mono-категорії
            </div>
            {CATEGORY_NAMES.map((name) => {
              const color = getCategoryColor(name);
              const isAuto = name === monoCategory;
              const isActive = currentCategory === name;
              return (
                <button
                  key={name}
                  onClick={() => handleSelectMono(name)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
                    isActive ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="flex-1">{name}</span>
                  {isAuto && (
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider shrink-0">
                      авто
                    </span>
                  )}
                  {isActive && (
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}

            {customCategories.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
                  Мої категорії
                </div>
                {customCategories.map((cat) => {
                  const isActive = currentCategory === cat.name && isOverridden;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleSelect(cat.id)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
                        isActive ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="flex-1">{cat.name}</span>
                      {isActive && (
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            <div className="border-t border-gray-100 dark:border-gray-700">
              {creating ? (
                <div className="p-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Назва категорії"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={`w-5 h-5 rounded-full border-2 ${
                          newColor === c ? "border-gray-800 dark:border-white scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Створити
                    </button>
                    <button
                      onClick={() => { setCreating(false); setNewName(""); }}
                      className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Скасувати
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Нова категорія
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
