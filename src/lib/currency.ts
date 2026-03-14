const CURRENCY_MAP: Record<number, { code: string; symbol: string; digits: number }> = {
  980: { code: "UAH", symbol: "₴", digits: 2 },
  840: { code: "USD", symbol: "$", digits: 2 },
  978: { code: "EUR", symbol: "€", digits: 2 },
  826: { code: "GBP", symbol: "£", digits: 2 },
  985: { code: "PLN", symbol: "zł", digits: 2 },
  203: { code: "CZK", symbol: "Kč", digits: 2 },
  756: { code: "CHF", symbol: "Fr", digits: 2 },
  392: { code: "JPY", symbol: "¥", digits: 0 },
  949: { code: "TRY", symbol: "₺", digits: 2 },
};

export function getCurrencyInfo(code: number) {
  return CURRENCY_MAP[code] || { code: String(code), symbol: String(code), digits: 2 };
}

export function formatAmount(amount: number, currencyCode: number): string {
  const info = getCurrencyInfo(currencyCode);
  const value = amount / Math.pow(10, info.digits);
  return `${value.toLocaleString("uk-UA", { minimumFractionDigits: info.digits, maximumFractionDigits: info.digits })} ${info.symbol}`;
}
