"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { CATEGORY_NAMES, getCategoryColor } from "@/lib/mcc";
import { formatAmount } from "@/lib/currency";

interface TxForAi {
  id: string;
  description: string;
  mcc: number;
  originalMcc: number;
  amount: number;
  counterName?: string;
  counterEdrpou?: string;
  comment?: string;
}

interface AiSuggestion {
  transactionId: string;
  suggestedCategory: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

interface Props {
  uncategorizedTxs: TxForAi[];
  onClose: () => void;
  onApplied: () => void;
}

const BATCH_SIZE = 15;

const CONFIDENCE_BADGE: Record<string, { label: string; className: string }> = {
  high: { label: "Висока", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  medium: { label: "Середня", className: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" },
  low: { label: "Низька", className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
};

export default function AiCategorizationPanel({ uncategorizedTxs, onClose, onApplied }: Props) {
  const { userId, customCategories, refreshOverrides } = useData();
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [applying, setApplying] = useState<Record<string, boolean>>({});
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const allCategories = [
    ...CATEGORY_NAMES,
    ...customCategories.map((c) => c.name).filter((n) => !CATEGORY_NAMES.includes(n)),
  ];

  const handleAnalyze = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setApplied(new Set());
    setDismissed(new Set());

    const batches: TxForAi[][] = [];
    for (let i = 0; i < uncategorizedTxs.length; i += BATCH_SIZE) {
      batches.push(uncategorizedTxs.slice(i, i + BATCH_SIZE));
    }
    setTotalBatches(batches.length);

    const allSuggestions: AiSuggestion[] = [];

    for (let i = 0; i < batches.length; i++) {
      setProcessed(i + 1);
      try {
        const res = await fetch("/api/ai/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            transactions: batches[i],
            categories: allCategories,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Помилка AI");
          break;
        }
        if (data.suggestions) {
          allSuggestions.push(...data.suggestions);
          setSuggestions([...allSuggestions]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Мережева помилка");
        break;
      }
    }

    setLoading(false);
  };

  const handleApply = async (suggestion: AiSuggestion) => {
    if (!userId) return;
    setApplying((prev) => ({ ...prev, [suggestion.transactionId]: true }));

    const customCat = customCategories.find((c) => c.name === suggestion.suggestedCategory);

    let categoryId: string | null = customCat?.id || null;

    if (!categoryId) {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name: suggestion.suggestedCategory,
          color: getCategoryColor(suggestion.suggestedCategory),
        }),
      });
      const data = await res.json();
      if (data.category) categoryId = data.category.id;
    }

    if (categoryId) {
      await fetch("/api/transactions/overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          transactionId: suggestion.transactionId,
          customCategoryId: categoryId,
        }),
      });
      setApplied((prev) => new Set(prev).add(suggestion.transactionId));
      refreshOverrides();
      onApplied();
    }

    setApplying((prev) => ({ ...prev, [suggestion.transactionId]: false }));
  };

  const handleApplyAll = async () => {
    const toApply = suggestions.filter(
      (s) => !applied.has(s.transactionId) && !dismissed.has(s.transactionId)
    );
    for (const s of toApply) {
      await handleApply(s);
    }
  };

  const handleDismiss = (txId: string) => {
    setDismissed((prev) => new Set(prev).add(txId));
  };

  const pendingSuggestions = suggestions.filter(
    (s) => !applied.has(s.transactionId) && !dismissed.has(s.transactionId)
  );
  const txMap = new Map(uncategorizedTxs.map((t) => [t.id, t]));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              AI-категоризація
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {uncategorizedTxs.length} транзакцій у &quot;Інше&quot; для аналізу
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!suggestions.length && !loading && (
        <div className="text-center py-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            AI проаналізує {uncategorizedTxs.length} транзакцій пачками по {BATCH_SIZE} і запропонує категорії.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Дані, що відправляються: опис, MCC-код, сума, контрагент. Ви зможете прийняти або відхилити кожну пропозицію.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={!userId}
            className="px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Аналізувати
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-4 justify-center">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Обробка пачки {processed} з {totalBatches}...
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Пропозицій: <span className="font-semibold">{suggestions.length}</span>
              {applied.size > 0 && (
                <span className="text-green-600 dark:text-green-400 ml-2">
                  (прийнято: {applied.size})
                </span>
              )}
            </p>
            {pendingSuggestions.length > 1 && (
              <button
                onClick={handleApplyAll}
                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Прийняти всі ({pendingSuggestions.length})
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {suggestions.map((s) => {
              const tx = txMap.get(s.transactionId);
              if (!tx) return null;
              const isApplied = applied.has(s.transactionId);
              const isDismissed = dismissed.has(s.transactionId);
              if (isDismissed) return null;

              const catColor = getCategoryColor(s.suggestedCategory);
              const conf = CONFIDENCE_BADGE[s.confidence] || CONFIDENCE_BADGE.low;

              return (
                <div
                  key={s.transactionId}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isApplied
                      ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
                      : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {tx.description}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatAmount(tx.amount, 980)}
                      </span>
                      <span className="text-xs">→</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${catColor}20`, color: catColor }}
                      >
                        {s.suggestedCategory}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${conf.className}`}>
                        {conf.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {s.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isApplied ? (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium px-2">
                        ✓
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApply(s)}
                          disabled={applying[s.transactionId]}
                          className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
                          title="Прийняти"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDismiss(s.transactionId)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Відхилити"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
