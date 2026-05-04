import { NextResponse } from "next/server";
import { getCurrencyRates } from "@/lib/monobank";
import type { MonobankCurrencyRate } from "@/types/monobank";

// Monobank rate-limits /bank/currency to 1 request per minute.
// Cache rates server-side so all clients share one fetch and survive rate-limit windows.
const FRESH_TTL = 60 * 60 * 1000; // 1 hour
const STALE_TTL = 24 * 60 * 60 * 1000; // serve stale up to 24h if Mono is unavailable

let cache: { data: MonobankCurrencyRate[]; fetchedAt: number } | null = null;
let inFlight: Promise<MonobankCurrencyRate[]> | null = null;

// Fallback approximate rates (used only if no cache and Mono is unreachable on first call).
// CurrencyCodeA → currencyCodeB(=980 UAH) → rateSell.
const FALLBACK: MonobankCurrencyRate[] = [
  { currencyCodeA: 840, currencyCodeB: 980, date: 0, rateSell: 41.5, rateBuy: 41.0, rateCross: 41.25 }, // USD
  { currencyCodeA: 978, currencyCodeB: 980, date: 0, rateSell: 45.5, rateBuy: 45.0, rateCross: 45.25 }, // EUR
  { currencyCodeA: 826, currencyCodeB: 980, date: 0, rateCross: 53 }, // GBP
  { currencyCodeA: 985, currencyCodeB: 980, date: 0, rateCross: 10.4 }, // PLN
];

export async function GET() {
  const now = Date.now();

  // Serve from fresh cache.
  if (cache && now - cache.fetchedAt < FRESH_TTL) {
    return NextResponse.json(cache.data);
  }

  // Coalesce concurrent refreshes.
  if (!inFlight) {
    inFlight = getCurrencyRates()
      .then((data) => {
        cache = { data, fetchedAt: Date.now() };
        return data;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  try {
    const data = await inFlight;
    return NextResponse.json(data);
  } catch (error) {
    // Fetch failed (likely 429). Serve stale cache if we have anything reasonable.
    if (cache && now - cache.fetchedAt < STALE_TTL) {
      return NextResponse.json(cache.data);
    }
    // No cache yet — return fallback so UI conversion still works.
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(FALLBACK, {
      headers: { "x-monobank-error": message.slice(0, 200) },
    });
  }
}
