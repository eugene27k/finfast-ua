import type { MonobankAccount } from "@/types/monobank";

const TYPE_ORDER: Record<string, number> = {
  white: 0,
  black: 1,
  platinum: 2,
  iron: 3,
  fop: 4,
  yellow: 5,
  eAid: 6,
};

export function sortAccounts(accounts: MonobankAccount[]): MonobankAccount[] {
  return [...accounts].sort((a, b) => {
    const orderA = TYPE_ORDER[a.type] ?? 99;
    const orderB = TYPE_ORDER[b.type] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return b.balance - a.balance;
  });
}

export function filterEmptyAccounts(
  accounts: MonobankAccount[],
  hideEmpty: boolean
): MonobankAccount[] {
  if (!hideEmpty) return accounts;
  return accounts.filter((a) => a.balance !== 0);
}
