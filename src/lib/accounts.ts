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

/**
 * Days of inactivity after which a zero-balance account is treated as
 * "inactive" (and hidden by default). An account counts as active if it has at
 * least one transaction within this window.
 */
export const ACTIVITY_WINDOW_DAYS = 60;

/**
 * An account is "inactive" when it holds no money AND has had no movement in
 * the recent window — see {@link ACTIVITY_WINDOW_DAYS}. `activeAccountIds` is
 * the set of account ids that have at least one transaction within that window.
 */
export function isAccountInactive(
  account: MonobankAccount,
  activeAccountIds: Set<string>
): boolean {
  return account.balance === 0 && !activeAccountIds.has(account.id);
}

export function filterInactiveAccounts(
  accounts: MonobankAccount[],
  activeAccountIds: Set<string>,
  hideInactive: boolean
): MonobankAccount[] {
  if (!hideInactive) return accounts;
  return accounts.filter((a) => !isAccountInactive(a, activeAccountIds));
}
