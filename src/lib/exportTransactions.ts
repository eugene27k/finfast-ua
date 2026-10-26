import { getCurrencyInfo } from "@/lib/currency";
import type { Cell, Column } from "write-excel-file/browser";
import type { MonobankStatement, MonobankCurrencyRate } from "@/types/monobank";
import type { TransferMark } from "@/lib/transfers";

/**
 * The subset of a unified transaction row the exporter reads. `UnifiedTx` on the
 * transactions page is a structural superset, so its arrays pass in directly.
 */
export interface ExportableTx {
  id: string;
  time: number;
  amount: number;
  description: string;
  comment?: string | null;
  /** Account currency of `amount` (Monobank charges the card in it). */
  currencyCode: number;
  /** Original operation leg, present for foreign-currency purchases. */
  opAmount?: number;
  opCurrencyCode?: number;
  accountId: string;
  accountName: string;
  badgeText: string;
  source: "mono" | "manual";
  /** Raw Monobank statement — carries every technical field (mono rows only). */
  monoTx?: MonobankStatement;
}

/* ── FX + formatting helpers (mirror the transactions page) ─────────────── */

export function getUahRate(currencyCode: number, rates: MonobankCurrencyRate[]): number {
  if (currencyCode === 980) return 1;
  const rate = rates.find(
    (r) => r.currencyCodeA === currencyCode && r.currencyCodeB === 980
  );
  if (rate) return rate.rateSell || rate.rateCross || rate.rateBuy || 1;
  return 1;
}

/** Minor units → major units, honouring per-currency digits (e.g. JPY has 0). */
function toMajor(amount: number, currencyCode: number): number {
  const { digits } = getCurrencyInfo(currencyCode);
  return amount / Math.pow(10, digits);
}

/** Local "YYYY-MM-DD HH:MM" — the same wall-clock time shown on the page. */
function formatDateTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function transferLabel(mark: TransferMark | undefined): string {
  if (!mark || !mark.internal) return "";
  return mark.jar ? "Власна банка" : "Внутрішнє переміщення";
}

/** A foreign-currency operation has an operation leg in a different currency. */
function isForeignOp(tx: ExportableTx): boolean {
  return (
    tx.opAmount != null &&
    tx.opCurrencyCode != null &&
    tx.opCurrencyCode !== tx.currencyCode
  );
}

const MONEY_FORMAT = "#,##0.00";

/** A number cell with a thousands/decimals format, or an empty cell for null. */
function money(value: number | null): Cell {
  return value == null ? null : { type: Number, value, format: MONEY_FORMAT };
}

/** A bold header cell. */
function header(name: string): Cell {
  return { value: name, fontWeight: "bold" };
}

/* ── Export ─────────────────────────────────────────────────────────────── */

/**
 * Build and download an `.xlsx` file of the given transactions.
 *
 * Columns lead with the report's visible fields (date, description, amount,
 * currency, category, account, source, comment, transfer mark, foreign leg, UAH
 * equivalent) and are followed by every technical field we receive/store per
 * transaction (ids, raw amounts, currency codes, mcc, hold, commission,
 * cashback, balance, counterparty…). The `write-excel-file` library is loaded
 * on demand to keep it out of the page's initial bundle.
 */
export async function exportTransactionsXlsx(
  items: ExportableTx[],
  transferInfo: Map<string, TransferMark>,
  currencyRates: MonobankCurrencyRate[]
): Promise<void> {
  const uahMinor = (tx: ExportableTx): number =>
    tx.currencyCode === 980
      ? tx.amount
      : Math.round(tx.amount * getUahRate(tx.currencyCode, currencyRates));

  const columns: Column<ExportableTx>[] = [
    /* ── Visible report fields ── */
    { width: 17, header: header("Дата і час"), cell: (r) => formatDateTime(r.time) },
    { width: 40, header: header("Опис"), cell: (r) => r.description || null },
    { width: 14, header: header("Сума"), cell: (r) => money(toMajor(r.amount, r.currencyCode)) },
    { width: 9, header: header("Валюта"), cell: (r) => getCurrencyInfo(r.currencyCode).code },
    { width: 18, header: header("Категорія"), cell: (r) => r.badgeText || null },
    { width: 22, header: header("Рахунок"), cell: (r) => r.accountName || null },
    { width: 11, header: header("Джерело"), cell: (r) => (r.source === "manual" ? "Ручна" : "Monobank") },
    { width: 28, header: header("Коментар"), cell: (r) => r.comment || null },
    { width: 22, header: header("Тип переказу"), cell: (r) => transferLabel(transferInfo.get(r.id)) || null },
    { width: 14, header: header("Сума операції"), cell: (r) => (isForeignOp(r) ? money(toMajor(r.opAmount!, r.opCurrencyCode!)) : null) },
    { width: 15, header: header("Валюта операції"), cell: (r) => (isForeignOp(r) ? getCurrencyInfo(r.opCurrencyCode!).code : null) },
    { width: 15, header: header("Сума у грн (≈)"), cell: (r) => money(toMajor(uahMinor(r), 980)) },

    /* ── Technical fields (everything we receive/store) ── */
    { width: 22, header: header("ID транзакції"), cell: (r) => r.id },
    { width: 22, header: header("ID рахунку"), cell: (r) => r.accountId },
    { width: 12, header: header("Час (Unix)"), cell: (r) => r.time },
    { width: 14, header: header("Сума (мін. од.)"), cell: (r) => r.amount },
    { width: 12, header: header("Код валюти"), cell: (r) => r.currencyCode },
    { width: 18, header: header("Сума операції (мін. од.)"), cell: (r) => r.monoTx?.operationAmount ?? null },
    { width: 16, header: header("Код валюти операції"), cell: (r) => r.monoTx?.currencyCode ?? null },
    { width: 8, header: header("MCC"), cell: (r) => r.monoTx?.mcc ?? null },
    { width: 12, header: header("MCC (ориг.)"), cell: (r) => r.monoTx?.originalMcc ?? null },
    { width: 11, header: header("Утримання"), cell: (r) => (r.monoTx ? r.monoTx.hold : null) },
    { width: 10, header: header("Комісія"), cell: (r) => r.monoTx?.commissionRate ?? null },
    { width: 11, header: header("Кешбек"), cell: (r) => r.monoTx?.cashbackAmount ?? null },
    { width: 14, header: header("Баланс після"), cell: (r) => r.monoTx?.balance ?? null },
    { width: 18, header: header("ID чека"), cell: (r) => r.monoTx?.receiptId ?? null },
    { width: 18, header: header("ID інвойсу"), cell: (r) => r.monoTx?.invoiceId ?? null },
    { width: 16, header: header("ЄДРПОУ контрагента"), cell: (r) => r.monoTx?.counterEdrpou ?? null },
    { width: 30, header: header("IBAN контрагента"), cell: (r) => r.monoTx?.counterIban ?? null },
    { width: 24, header: header("Назва контрагента"), cell: (r) => r.monoTx?.counterName ?? null },
  ];

  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;

  await writeXlsxFile(items, { columns, sheet: "Транзакції" }).toFile(
    `transactions-${stamp}.xlsx`
  );
}
