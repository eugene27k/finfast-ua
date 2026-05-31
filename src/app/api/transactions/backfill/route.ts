import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { getStatement } from "@/lib/monobank";

export async function POST(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;

  const body = await request.json();
  const { token, accountIds } = body as {
    token: string;
    accountIds: string[];
  };

  if (!token || !accountIds?.length) {
    return NextResponse.json(
      { error: "token and accountIds are required" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Calculate previous month range
  const now = new Date();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const from = Math.floor(prevMonthStart.getTime() / 1000);
  const to = Math.floor(prevMonthEnd.getTime() / 1000);

  // Check if we already have data for this period
  const existing = await db.transaction.count({
    where: {
      userId,
      time: { gte: from, lte: to },
    },
  });

  if (existing > 0) {
    return NextResponse.json({ status: "already_has_data", count: existing });
  }

  let totalPersisted = 0;

  try {
    for (let i = 0; i < accountIds.length; i++) {
      const accountId = accountIds[i];

      try {
        const data = await getStatement(token, accountId, from, to);

        if (data.length > 0) {
          for (const tx of data) {
            try {
              await db.transaction.upsert({
                where: { id: tx.id },
                create: {
                  id: tx.id,
                  userId,
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
              totalPersisted++;
            } catch {
              // Skip duplicate or other per-tx errors
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        // If rate limited, stop and return partial results
        if (msg.includes("429")) {
          return NextResponse.json(
            { status: "rate_limited", persisted: totalPersisted },
            { status: 429 }
          );
        }
        // Skip this account on other errors
        console.error(`Backfill failed for account ${accountId}:`, err);
      }

      // Rate limit delay between accounts
      if (i < accountIds.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return NextResponse.json({ status: "ok", persisted: totalPersisted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
