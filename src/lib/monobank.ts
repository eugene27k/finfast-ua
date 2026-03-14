import type {
  MonobankClientInfo,
  MonobankStatement,
  MonobankCurrencyRate,
} from "@/types/monobank";

const BASE_URL = "https://api.monobank.ua";

async function monoFetch<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["X-Token"] = token;
  }

  const res = await fetch(`${BASE_URL}${path}`, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Monobank API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function getClientInfo(
  token: string
): Promise<MonobankClientInfo> {
  return monoFetch<MonobankClientInfo>("/personal/client-info", token);
}

export async function getStatement(
  token: string,
  accountId: string,
  from: number,
  to?: number
): Promise<MonobankStatement[]> {
  const toParam = to ?? Math.floor(Date.now() / 1000);
  return monoFetch<MonobankStatement[]>(
    `/personal/statement/${accountId}/${from}/${toParam}`,
    token
  );
}

export async function getCurrencyRates(): Promise<MonobankCurrencyRate[]> {
  return monoFetch<MonobankCurrencyRate[]>("/bank/currency");
}

export async function setWebhook(
  token: string,
  url: string
): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/personal/webhook`, {
    method: "POST",
    headers: {
      "X-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ webHookUrl: url }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Monobank API error ${res.status}: ${text}`);
  }

  return res.json();
}
