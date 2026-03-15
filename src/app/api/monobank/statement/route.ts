import { NextRequest, NextResponse } from "next/server";
import { getStatement } from "@/lib/monobank";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-mono-token");
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!accountId || !from) {
    return NextResponse.json(
      { error: "account and from parameters are required" },
      { status: 400 }
    );
  }

  try {
    const data = await getStatement(
      token,
      accountId,
      parseInt(from),
      to ? parseInt(to) : undefined
    );

    // Persist transactions to DB (fire-and-forget)
    persistTransactions(token, accountId, data);

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Detect Monobank 429 rate limit and proxy status correctly
    if (message.includes("429")) {
      return NextResponse.json(
        { error: "Too many requests", rateLimited: true },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function persistTransactions(
  token: string,
  accountId: string,
  data: Array<{
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
  }>
) {
  try {
    if (data.length === 0) return;

    const user = await prisma.user.findUnique({
      where: { monoToken: token },
      select: { id: true },
    });
    if (!user) return;

    // SQLite adapter doesn't support skipDuplicates, use individual upserts
    for (const tx of data) {
      await prisma.transaction.upsert({
        where: { id: tx.id },
        create: {
          id: tx.id,
          userId: user.id,
          accountId,
          time: tx.time,
          description: tx.description,
          mcc: tx.mcc,
          originalMcc: tx.originalMcc,
          hold: tx.hold,
          amount: tx.amount,
          operationAmount: tx.operationAmount,
          currencyCode: tx.currencyCode,
          commissionRate: tx.commissionRate,
          cashbackAmount: tx.cashbackAmount,
          balance: tx.balance,
          comment: tx.comment ?? null,
          receiptId: tx.receiptId ?? null,
          invoiceId: tx.invoiceId ?? null,
          counterEdrpou: tx.counterEdrpou ?? null,
          counterIban: tx.counterIban ?? null,
          counterName: tx.counterName ?? null,
        },
        update: {
          hold: tx.hold,
          balance: tx.balance,
        },
      });
    }
  } catch (err) {
    console.error("Failed to persist transactions:", err);
  }
}
