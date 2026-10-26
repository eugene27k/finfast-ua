import { getEffectiveCategory, getCategoryColor } from "@/lib/mcc";
import { getUahRate } from "@/lib/exportTransactions";
import type { MonobankStatement, MonobankCurrencyRate } from "@/types/monobank";

/** Map of transaction id → user-chosen category override. */
export type Overrides = Record<string, { categoryName: string; color: string }>;

/** Optional FX context so aggregates can be normalised to one base currency. */
export interface FxContext {
  rates?: MonobankCurrencyRate[];
  /** ISO-4217 numeric code of the base currency. Defaults to UAH (980). */
  baseCurrency?: number;
  /**
   * txId → the ACCOUNT currency of that transaction's `amount`. This is required
   * for correct conversion: a Monobank statement's `currencyCode` is the
   * OPERATION currency (e.g. 840/USD for a foreign purchase on a UAH card), NOT
   * the currency of `amount`. `amount` is always in the account currency. Ids
   * missing from the map fall back to the base currency (safe — most accounts
   * are UAH and `amount` is already in the account currency).
   */
  accountCurrencyByTxId?: Map<string, number>;
}

export interface CategoryTotal {
  name: string;
  /** Base-currency minor units. */
  total: number;
  count: number;
  color: string;
}

export interface CatMeta {
  name: string;
  color: string;
  /** Base-currency minor units. */
  total: number;
}

/** One row per day, with a numeric key per category — consumed by recharts. */
export type DayRow = {
  /** Sortable local YYYY-MM-DD. */
  dayKey: string;
  /** DD.MM axis label. */
  label: string;
  /** Total expense that day (base-currency minor units). */
  total: number;
} & Record<string, number | string>;

export interface DailyByCategory {
  days: DayRow[];
  categories: CatMeta[];
}

export const OTHER_CATEGORY = "Інше";
const DEFAULT_BASE = 980;
const DAY_SECONDS = 86_400;

/** Local YYYY-MM-DD — the single source of truth for the day bucket. */
export function dayKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** DD.MM axis label, matching DailyChart. */
export function dayLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Calendar days covered by an inclusive [from, to] range (never below 1). */
export function daysInRange(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 1;
  return Math.max(1, Math.floor((to - from) / DAY_SECONDS) + 1);
}

/** Safe average — never divides by zero. */
export function averagePerDay(total: number, dayCount: number): number {
  return total / Math.max(1, dayCount);
}

/**
 * Minor units in a transaction's ACCOUNT currency → minor units in the base
 * currency. `accountCurrencyCode` MUST be the account currency (the currency of
 * `amount`), never the statement's operation `currencyCode`. Mirrors the
 * exporter's FX rule; a no-op for base-currency rows and a best-effort 1:1
 * fallback when rates are unavailable (UAH-only users unaffected).
 */
export function toBaseCurrencyMinor(
  amount: number,
  accountCurrencyCode: number,
  fx?: FxContext
): number {
  const base = fx?.baseCurrency ?? DEFAULT_BASE;
  if (accountCurrencyCode === base) return amount;
  if (base === DEFAULT_BASE && fx?.rates && fx.rates.length > 0) {
    return Math.round(amount * getUahRate(accountCurrencyCode, fx.rates));
  }
  return amount;
}

/** Resolve a transaction's account currency from the FX context (default base). */
function accountCurrencyOf(txId: string, fx?: FxContext): number {
  return fx?.accountCurrencyByTxId?.get(txId) ?? fx?.baseCurrency ?? DEFAULT_BASE;
}

/**
 * Build a txId → account-currency map from live statements (keyed by accountId)
 * and, optionally, DB-history rows (which carry their own accountId). This is the
 * piece that lets aggregates convert `amount` by the correct ACCOUNT currency.
 */
export function buildAccountCurrencyMap(
  statements: Record<string, MonobankStatement[]>,
  accounts: { id: string; currencyCode: number }[],
  history: { id: string; accountId: string }[] = []
): Map<string, number> {
  const accCurrency = new Map(accounts.map((a) => [a.id, a.currencyCode]));
  const map = new Map<string, number>();
  for (const [accId, txs] of Object.entries(statements)) {
    const cur = accCurrency.get(accId) ?? DEFAULT_BASE;
    for (const tx of txs) map.set(tx.id, cur);
  }
  for (const tx of history) {
    if (!map.has(tx.id)) {
      map.set(tx.id, accCurrency.get(tx.accountId) ?? DEFAULT_BASE);
    }
  }
  return map;
}

/**
 * Expense totals per category across the whole set, sorted descending.
 * Income (amount ≥ 0) is ignored. Values are base-currency minor units.
 */
export function categoryTotals(
  txns: MonobankStatement[],
  overrides: Overrides,
  fx?: FxContext
): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const tx of txns) {
    if (tx.amount >= 0) continue;
    const { name, color } = getEffectiveCategory(tx.mcc, tx.id, overrides);
    const value = Math.abs(toBaseCurrencyMinor(tx.amount, accountCurrencyOf(tx.id, fx), fx));
    const entry = map.get(name) || { name, color, total: 0, count: 0 };
    entry.total += value;
    entry.count += 1;
    map.set(name, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/**
 * Pivot expenses into one row per day with a numeric key per category — exactly
 * what a stacked recharts BarChart consumes. When `topN` is set and there are
 * more categories, the smallest are folded into an "Інше" bucket so the legend
 * stays readable. Values are base-currency minor units.
 */
export function aggregateDailyByCategory(
  txns: MonobankStatement[],
  overrides: Overrides,
  opts: FxContext & { topN?: number } = {}
): DailyByCategory {
  const expenses = txns.filter((tx) => tx.amount < 0);
  const totals = categoryTotals(expenses, overrides, opts);

  const topN = opts.topN ?? 0;
  const fold = topN > 0 && totals.length > topN;
  const kept = fold ? totals.slice(0, topN) : totals;
  const keepSet = new Set(kept.map((c) => c.name));

  const rows = new Map<string, DayRow>();
  for (const tx of expenses) {
    const key = dayKey(tx.time);
    let row = rows.get(key);
    if (!row) {
      row = { dayKey: key, label: dayLabel(tx.time), total: 0 };
      rows.set(key, row);
    }
    const { name } = getEffectiveCategory(tx.mcc, tx.id, overrides);
    const bucket = keepSet.has(name) ? name : OTHER_CATEGORY;
    const value = Math.abs(toBaseCurrencyMinor(tx.amount, accountCurrencyOf(tx.id, opts), opts));
    row[bucket] = ((row[bucket] as number) || 0) + value;
    row.total += value;
  }

  const days = Array.from(rows.values()).sort((a, b) =>
    a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0
  );

  const categories: CatMeta[] = kept.map((c) => ({
    name: c.name,
    color: c.color,
    total: c.total,
  }));
  if (fold) {
    const foldedTotal = totals.slice(topN).reduce((s, c) => s + c.total, 0);
    const existing = categories.find((c) => c.name === OTHER_CATEGORY);
    if (existing) {
      existing.total += foldedTotal;
    } else {
      categories.push({
        name: OTHER_CATEGORY,
        color: getCategoryColor(OTHER_CATEGORY),
        total: foldedTotal,
      });
    }
    categories.sort((a, b) => b.total - a.total);
  }

  return { days, categories };
}
