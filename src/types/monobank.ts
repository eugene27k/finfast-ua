export interface MonobankAccount {
  id: string;
  sendId: string;
  balance: number;
  creditLimit: number;
  type: string;
  currencyCode: number;
  cashbackType: string;
  maskedPan: string[];
  iban: string;
}

export interface MonobankJar {
  id: string;
  sendId: string;
  title: string;
  description: string;
  currencyCode: number;
  balance: number;
  goal: number;
}

export interface MonobankClientInfo {
  clientId: string;
  name: string;
  webHookUrl: string;
  permissions: string;
  accounts: MonobankAccount[];
  jars: MonobankJar[];
}

export interface MonobankStatement {
  id: string;
  time: number;
  description: string;
  mcc: number;
  originalMcc: number;
  hold: boolean;
  amount: number;
  operationAmount: number;
  currencyCode: number;
  commissionRate: number;
  cashbackAmount: number;
  balance: number;
  comment?: string;
  receiptId?: string;
  invoiceId?: string;
  counterEdrpou?: string;
  counterIban?: string;
  counterName?: string;
}

export interface MonobankCurrencyRate {
  currencyCodeA: number;
  currencyCodeB: number;
  date: number;
  rateSell?: number;
  rateBuy?: number;
  rateCross?: number;
}

export interface SpendingCategory {
  mcc: number;
  categoryName: string;
  total: number;
  count: number;
}

export interface BudgetStatus {
  category: string;
  /** Monthly-equivalent limit (base-currency minor units) — drives the bar. */
  limit: number;
  spent: number;
  percentage: number;
  status: "ok" | "warning" | "exceeded";
  // ── Daily-rate fields (optional for backward compatibility) ──
  period?: "day" | "week" | "month";
  /** Implied daily limit (minor units). */
  dailyLimit?: number;
  /** Monthly-equivalent limit (minor units); mirrors `limit`. */
  monthlyLimit?: number;
  /** Average daily spend so far this month (minor units). */
  dailyAvgSoFar?: number;
  /** Projected month-end spend at the current pace (minor units). */
  projectedMonthEnd?: number;
  /** Spending pace relative to the target. */
  pace?: "on_track" | "over_pace" | "projected_over" | "exceeded";
}
