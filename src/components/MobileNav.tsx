"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS, type NavItem } from "@/components/navItems";
import { useTheme } from "@/components/ThemeProvider";
import { useData } from "@/components/DataProvider";

const byHref = (href: string) => NAV_ITEMS.find((i) => i.href === href)!;

/** Visible bottom-bar tabs (the FAB sits between #2 and #3). */
const TAB_ITEMS = ["/dashboard", "/budgets", "/transactions-new"].map(byHref);
/** Everything else lives behind the "Ще" sheet. */
const MORE_ITEMS = ["/analytics", "/net-worth", "/accounts", "/settings"].map(byHref);

function NavIcon({ d, className = "w-6 h-6" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
        active
          ? "text-blue-600 dark:text-blue-400"
          : "text-gray-500 dark:text-gray-400"
      }`}
    >
      <NavIcon d={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

/**
 * Mobile-only bottom navigation: 4 tabs + a central FAB for the primary
 * "add transaction" action, plus a "Ще" sheet for the lower-frequency
 * sections, theme toggle and logout. Hidden on ≥lg, where the Sidebar takes
 * over. Pairs with `lg:pb-…` padding on <main> so content clears the bar.
 */
export default function MobileNav() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { logout } = useData();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname.startsWith(href);
  const moreActive = MORE_ITEMS.some((i) => isActive(i.href));

  return (
    <>
      <nav
        aria-label="Основна навігація"
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="relative grid grid-cols-5 h-16">
          <Tab item={TAB_ITEMS[0]} active={isActive("/dashboard")} />
          <Tab item={TAB_ITEMS[1]} active={isActive("/budgets")} />

          {/* spacer column — the raised FAB floats over it */}
          <div aria-hidden />

          <Tab item={TAB_ITEMS[2]} active={isActive("/transactions-new")} />

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Більше розділів"
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              moreActive
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            <NavIcon d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            <span>Ще</span>
          </button>

          {/* Central FAB → opens the new-transaction form */}
          <Link
            href="/transactions-new?add=1"
            aria-label="Додати транзакцію"
            className="absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-lg flex items-center justify-center ring-4 ring-gray-50 dark:ring-gray-900 transition-colors"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </Link>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute bottom-0 inset-x-0 bg-white dark:bg-gray-900 rounded-t-2xl p-4 shadow-xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
            <div className="grid grid-cols-4 gap-2">
              {MORE_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <NavIcon d={item.icon} />
                  <span className="text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
            <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3 flex gap-2">
              <button
                type="button"
                onClick={toggle}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {theme === "dark" ? "Світла тема" : "Темна тема"}
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Вийти
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
