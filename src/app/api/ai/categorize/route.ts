import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

interface TxInput {
  id: string;
  description: string;
  mcc: number;
  originalMcc: number;
  amount: number;
  counterName?: string;
  counterEdrpou?: string;
  comment?: string;
}

interface AiSuggestion {
  transactionId: string;
  suggestedCategory: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export async function POST(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { transactions, categories } = await request.json() as {
      transactions: TxInput[];
      categories: string[];
    };

    if (!transactions?.length || !categories?.length) {
      return NextResponse.json(
        { error: "transactions and categories are required" },
        { status: 400 }
      );
    }

    if (transactions.length > 25) {
      return NextResponse.json(
        { error: "Maximum 25 transactions per batch" },
        { status: 400 }
      );
    }

    const user = await getDb().user.findUnique({
      where: { id: auth.userId },
      select: { openaiApiKey: true },
    });

    if (!user?.openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API ключ не налаштовано. Додайте його у Налаштуваннях." },
        { status: 400 }
      );
    }

    const txList = transactions.map((tx, i) => {
      const parts = [
        `${i + 1}. ID: ${tx.id}`,
        `   Опис: ${tx.description}`,
        `   MCC: ${tx.mcc}${tx.originalMcc !== tx.mcc ? ` (оригінальний: ${tx.originalMcc})` : ""}`,
        `   Сума: ${(tx.amount / 100).toFixed(2)} грн`,
      ];
      if (tx.counterName) parts.push(`   Контрагент: ${tx.counterName}`);
      if (tx.counterEdrpou) parts.push(`   ЄДРПОУ: ${tx.counterEdrpou}`);
      if (tx.comment) parts.push(`   Коментар: ${tx.comment}`);
      return parts.join("\n");
    }).join("\n\n");

    const systemPrompt = `Ти — фінансовий помічник для українського застосунку управління фінансами.
Твоя задача — класифікувати банківські транзакції за категоріями.

Доступні категорії:
${categories.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Правила:
- Для кожної транзакції обери ОДНУ категорію зі списку вище.
- Якщо транзакція дійсно не підходить до жодної категорії — залиш "Інше".
- Використовуй опис магазину/послуги, MCC-код, суму та контрагента як підказки.
- MCC-коди: 5411=продукти, 5812=ресторани, 5541=АЗС, 5912=аптеки, 7230=салони краси і т.д.
- Типові патерни: "Сільпо/АТБ/Novus" = Продукти, "WOG/OKKO/Shell" = Пальне, "Bolt/Uber" = Транспорт, "Нова пошта" = інше або можна як Покупки.

Відповідай ТІЛЬКИ валідним JSON масивом об'єктів з полями:
- transactionId (string) — ID транзакції
- suggestedCategory (string) — назва категорії зі списку
- confidence ("high" | "medium" | "low") — впевненість
- reason (string) — коротке пояснення українською (до 15 слів)

Без додаткового тексту, тільки JSON масив.`;

    const userPrompt = `Класифікуй ці транзакції:\n\n${txList}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${user.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!openaiRes.ok) {
      const errData = await openaiRes.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `OpenAI API помилка: ${openaiRes.status}`;
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({ error: "Порожня відповідь від OpenAI" }, { status: 502 });
    }

    let suggestions: AiSuggestion[];
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      suggestions = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Не вдалося розпарсити відповідь AI", raw: content },
        { status: 502 }
      );
    }

    const validSuggestions = suggestions.filter(
      (s) =>
        s.transactionId &&
        s.suggestedCategory &&
        categories.includes(s.suggestedCategory) &&
        s.suggestedCategory !== "Інше"
    );

    return NextResponse.json({
      suggestions: validSuggestions,
      usage: openaiData.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
