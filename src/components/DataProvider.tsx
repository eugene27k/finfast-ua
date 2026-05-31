"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type {
  MonobankClientInfo,
  MonobankStatement,
  MonobankAccount,
} from "@/types/monobank";

export interface CustomCategoryData {
  id: string;
  name: string;
  color: string;
}

export interface OverrideInfo {
  categoryName: string;
  color: string;
}

export interface ManualTransactionData {
  id: string;
  amount: number;
  description: string;
  time: number;
}

export interface ManualAccountData {
  id: string;
  name: string;
  type: string;
  category: string;
  currencyCode: number;
  createdAt: string;
  balance: number;
  transactions: ManualTransactionData[];
}

const TOKEN_KEY = "finfast_mono_token";
const CLIENT_CACHE_KEY = "finfast_client_info";
const CLIENT_CACHE_TTL = 60_000;
const STATEMENT_CACHE_KEY = "finfast_stmt";
const STATEMENT_CACHE_TTL = 5 * 60_000;

const PERIOD_DAYS = 30;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

function getCache<T>(
  storageKey: string,
  cacheKey: string,
  ttl: number
): T | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (entry.key !== cacheKey) return null;
    if (Date.now() - entry.timestamp > ttl) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function setCache<T>(storageKey: string, cacheKey: string, data: T) {
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ data, timestamp: Date.now(), key: cacheKey })
    );
  } catch {
    // sessionStorage full or unavailable
  }
}

export interface FetchProgress {
  current: number;
  total: number;
  currentAccountId: string;
}

interface DataContextValue {
  token: string;
  setToken: (t: string) => void;
  clearToken: () => void;
  logout: () => void;
  tokenReady: boolean;
  client: MonobankClientInfo | null;
  clientLoading: boolean;
  clientError: string | null;
  statements: Record<string, MonobankStatement[]>;
  statementsLoading: boolean;
  statementsError: string | null;
  progress: FetchProgress | null;
  from: number;
  refresh: () => void;
  getFiltered: (selectedIds: string[]) => MonobankStatement[];
  lastRefreshedAt: Date | null;
  userId: string | null;
  customCategories: CustomCategoryData[];
  overrides: Record<string, OverrideInfo>;
  refreshCategories: () => void;
  refreshOverrides: () => void;
  manualAccounts: ManualAccountData[];
  manualAccountsLoading: boolean;
  refreshManualAccounts: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

export default function DataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- Token ---
  const [token, setTokenState] = useState("");
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) setTokenState(saved);
    setTokenReady(true);
  }, []);

  const setToken = useCallback((t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setTokenState(t);
  }, []);

  // Removes only the Monobank token; account data (categories, overrides) stays.
  const clearToken = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(CLIENT_CACHE_KEY);
    setTokenState("");
  }, []);

  // Full sign-out: end the server session and return to the login screen.
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — navigate away regardless
    }
    window.location.href = "/login";
  }, []);

  // --- User ID (from the authenticated session) ---
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) setUserId(data.userId);
      })
      .catch(() => {});
  }, []);

  // --- Custom categories ---
  const [customCategories, setCustomCategories] = useState<CustomCategoryData[]>([]);

  const refreshCategories = useCallback(() => {
    if (!userId) return;
    fetch(`/api/categories?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.categories) setCustomCategories(data.categories);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  // --- Transaction overrides ---
  const [overrides, setOverrides] = useState<Record<string, OverrideInfo>>({});

  const refreshOverrides = useCallback(() => {
    if (!userId) return;
    fetch(`/api/transactions/overrides?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.overrides) setOverrides(data.overrides);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    refreshOverrides();
  }, [refreshOverrides]);

  // --- Manual accounts ---
  const [manualAccounts, setManualAccounts] = useState<ManualAccountData[]>([]);
  const [manualAccountsLoading, setManualAccountsLoading] = useState(false);

  const refreshManualAccounts = useCallback(() => {
    if (!userId) return;
    setManualAccountsLoading(true);
    fetch(`/api/manual-accounts?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.accounts) setManualAccounts(data.accounts);
      })
      .catch(() => {})
      .finally(() => setManualAccountsLoading(false));
  }, [userId]);

  useEffect(() => {
    refreshManualAccounts();
  }, [refreshManualAccounts]);

  // --- Client info ---
  const [client, setClient] = useState<MonobankClientInfo | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const fetchClient = useCallback(
    async (skipCache = false) => {
      if (!token) return;
      if (!skipCache) {
        const cached = getCache<MonobankClientInfo>(
          CLIENT_CACHE_KEY,
          token,
          CLIENT_CACHE_TTL
        );
        if (cached) {
          setClient(cached);
          return;
        }
      }
      setClientLoading(true);
      setClientError(null);
      try {
        const res = await fetch("/api/monobank/client-info", {
          headers: { "x-mono-token": token },
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to fetch");
        }
        const result = await res.json();
        setClient(result);
        setCache(CLIENT_CACHE_KEY, token, result);
      } catch (e) {
        setClientError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setClientLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  // --- Statements (30 days, all accounts, loaded once) ---
  const from = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - PERIOD_DAYS);
    return Math.floor(d.getTime() / 1000);
  }, []);

  const accountIds = useMemo(
    () => (client?.accounts || []).map((a: MonobankAccount) => a.id),
    [client]
  );
  const idsKey = useMemo(() => [...accountIds].sort().join(","), [accountIds]);

  const [statements, setStatements] = useState<
    Record<string, MonobankStatement[]>
  >({});
  const [statementsLoading, setStatementsLoading] = useState(false);
  const [statementsError, setStatementsError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const fetchStatements = useCallback(
    async (skipCache = false) => {
      if (!token || accountIds.length === 0) {
        setStatements({});
        return;
      }

      setStatementsLoading(true);
      setStatementsError(null);
      setProgress(null);
      const result: Record<string, MonobankStatement[]> = {};

      try {
        for (let i = 0; i < accountIds.length; i++) {
          const accId = accountIds[i];
          const storageKey = `${STATEMENT_CACHE_KEY}_${accId}`;
          const cacheKey = `${accId}:${from}:`;

          if (!skipCache) {
            const cached = getCache<MonobankStatement[]>(
              storageKey,
              cacheKey,
              STATEMENT_CACHE_TTL
            );
            if (cached) {
              result[accId] = cached;
              continue;
            }
          }

          setProgress({
            current: i + 1,
            total: accountIds.length,
            currentAccountId: accId,
          });

          const params = new URLSearchParams({
            account: accId,
            from: String(from),
          });

          const res = await fetch(`/api/monobank/statement?${params}`, {
            headers: { "x-mono-token": token },
          });

          if (res.ok) {
            const data = await res.json();
            result[accId] = data;
            setCache(storageKey, cacheKey, data);
          } else if (res.status === 429) {
            // Rate limited — save what we have and stop
            break;
          }

          // Small delay between requests
          if (i < accountIds.length - 1) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        setStatements((prev) =>
          Object.keys(result).length === 0 ? prev : { ...prev, ...result }
        );
        setProgress(null);
        setLastRefreshedAt(new Date());
      } catch (e) {
        setStatementsError(
          e instanceof Error ? e.message : "Unknown error"
        );
      } finally {
        setStatementsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, idsKey, from]
  );

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  const refresh = useCallback(() => {
    fetchClient(true);
    fetchStatements(true);
  }, [fetchClient, fetchStatements]);

  const getFiltered = useCallback(
    (selectedIds: string[]): MonobankStatement[] => {
      const ids =
        selectedIds.length === 0 ? accountIds : selectedIds;
      return ids
        .flatMap((id) => statements[id] || [])
        .sort((a, b) => b.time - a.time);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statements, idsKey]
  );

  const value = useMemo<DataContextValue>(
    () => ({
      token,
      setToken,
      clearToken,
      logout,
      tokenReady,
      client,
      clientLoading,
      clientError,
      statements,
      statementsLoading,
      statementsError,
      progress,
      from,
      refresh,
      getFiltered,
      lastRefreshedAt,
      userId,
      customCategories,
      overrides,
      refreshCategories,
      refreshOverrides,
      manualAccounts,
      manualAccountsLoading,
      refreshManualAccounts,
    }),
    [
      token,
      setToken,
      clearToken,
      logout,
      tokenReady,
      client,
      clientLoading,
      clientError,
      statements,
      statementsLoading,
      statementsError,
      progress,
      from,
      refresh,
      getFiltered,
      lastRefreshedAt,
      userId,
      customCategories,
      overrides,
      refreshCategories,
      refreshOverrides,
      manualAccounts,
      manualAccountsLoading,
      refreshManualAccounts,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
