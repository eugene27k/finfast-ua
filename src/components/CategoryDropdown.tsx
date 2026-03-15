"use client";

import { useState, useRef, useEffect } from "react";
import { useData } from "@/components/DataProvider";
import { CATEGORY_NAMES, getCategoryColor } from "@/lib/mcc";

interface CategoryDropdownProps {
  transactionId: string;
  currentCategory: string;
  currentColor: string;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#22c55e",
  "#14b8a6", "#3b82f6", "#6366f1", "#a855f7",
  "#ec4899", "#64748b",
];

export default function CategoryDropdown({
  transactionId,
  currentCategory,
  currentColor,
}: CategoryDropdownProps) {
  const { userId, customCategories, overrides, refreshCategories, refreshOverrides } = useData();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = async (categoryId: string | null) => {
    if (!userId) return;
    setSaving(true);
    try {
      await fetch("/api/transactions/overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          transactionId,
          customCategoryId: categoryId,
        }),
      });
      refreshOverrides();
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

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

  const isOverridden = !!overrides[transactionId];
  const monoCategories = CATEGORY_NAMES.filter((n) => n !== "Інше");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors group"
        title="Змінити категорію"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: currentColor }}
        />
        <span className={isOverridden ? "underline decoration-dotted" : ""}>
          {currentCategory}
        </span>
        <svg
          className="w-3 h-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
          {saving && (
            <div className="absolute inset-0 bg-white/70 dark:bg-gray-800/70 flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {/* Reset to MCC */}
            {isOverridden && (
              <button
                onClick={() => handleSelect(null)}
                className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700"
              >
                Скинути до авто-категорії (MCC)
              </button>
            )}

            {/* Mono categories */}
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900">
              Категорії Mono
            </div>
            {monoCategories.map((name) => (
              <button
                key={name}
                onClick={() => {
                  handleSelect(null);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
                  currentCategory === name && !isOverridden ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: getCategoryColor(name) }}
                />
                {name}
              </button>
            ))}

            {/* Custom categories */}
            {customCategories.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
                  Ваші категорії
                </div>
                {customCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelect(cat.id)}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
                      currentCategory === cat.name && isOverridden ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </button>
                ))}
              </>
            )}

            {/* Create new */}
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
        </div>
      )}
    </div>
  );
}
