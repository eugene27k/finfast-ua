"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface DateRange {
  /** Unix seconds, inclusive lower bound */
  from: number;
  /** Unix seconds, inclusive upper bound */
  to: number;
}

export type RangePreset =
  | "7"
  | "14"
  | "30"
  | "week"
  | "month"
  | "lastMonth"
  | "custom";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "7", label: "7 днів" },
  { value: "14", label: "14 днів" },
  { value: "30", label: "30 днів" },
  { value: "week", label: "Тиждень" },
  { value: "month", label: "Місяць" },
  { value: "lastMonth", label: "Минулий місяць" },
  { value: "custom", label: "Свій період" },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function ts(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

/** ISO yyyy-mm-dd in local time (for <input type="date"> values). */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Compute the {from,to} range for a non-custom preset. */
export function getPresetRange(preset: Exclude<RangePreset, "custom">): DateRange {
  const now = new Date();
  const nowTs = Math.floor(now.getTime() / 1000);

  switch (preset) {
    case "7":
      return { from: nowTs - 7 * 86400, to: ts(endOfDay(now)) };
    case "14":
      return { from: nowTs - 14 * 86400, to: ts(endOfDay(now)) };
    case "30":
      return { from: nowTs - 30 * 86400, to: ts(endOfDay(now)) };
    case "week": {
      // Current calendar week, Monday as first day.
      const day = now.getDay(); // 0 = Sun .. 6 = Sat
      const diff = (day + 6) % 7; // days since Monday
      const monday = startOfDay(new Date(now));
      monday.setDate(monday.getDate() - diff);
      return { from: ts(monday), to: ts(endOfDay(now)) };
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: ts(startOfDay(first)), to: ts(endOfDay(now)) };
    }
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0); // day 0 = last day of prev month
      return { from: ts(startOfDay(first)), to: ts(endOfDay(last)) };
    }
  }
}

/** Default range used to initialise consumers (matches the old "30 days" behaviour). */
export function getDefaultRange(): DateRange {
  return getPresetRange("30");
}

export default function DateRangeFilter({
  onChange,
  className = "",
}: {
  onChange: (range: DateRange) => void;
  className?: string;
}) {
  const [preset, setPreset] = useState<RangePreset>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Compute the effective range. Returns null while a custom range is incomplete/invalid.
  const range = useMemo<DateRange | null>(() => {
    if (preset !== "custom") return getPresetRange(preset);
    if (!customFrom || !customTo) return null;
    const f = new Date(customFrom);
    const t = new Date(customTo);
    if (isNaN(f.getTime()) || isNaN(t.getTime())) return null;
    // Tolerate reversed input (user picks "to" before "from").
    const lo = f <= t ? f : t;
    const hi = f <= t ? t : f;
    return { from: ts(startOfDay(lo)), to: ts(endOfDay(hi)) };
  }, [preset, customFrom, customTo]);

  // Emit to the parent only when the effective range actually changes.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastEmitted = useRef<string>("");

  useEffect(() => {
    if (!range) return;
    const key = `${range.from}-${range.to}`;
    if (key === lastEmitted.current) return;
    lastEmitted.current = key;
    onChangeRef.current(range);
  }, [range]);

  // When switching into custom mode with empty inputs, seed them from the current month.
  const selectPreset = (p: RangePreset) => {
    if (p === "custom" && (!customFrom || !customTo)) {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setCustomFrom(isoDate(first));
      setCustomTo(isoDate(now));
    }
    setPreset(p);
  };

  const inputCls =
    "rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => selectPreset(p.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              preset === p.value
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => setCustomFrom(e.target.value)}
            className={inputCls}
            aria-label="Дата від"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
            className={inputCls}
            aria-label="Дата до"
          />
        </div>
      )}
    </div>
  );
}
