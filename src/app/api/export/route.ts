import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

const FORMAT_VERSION = 1;

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;

  try {
    const db = getDb();
    const [transactions, categories, overrides, manualAccountsRaw] = await Promise.all([
      db.transaction.findMany({
        where: { userId },
        orderBy: { time: "desc" },
      }),
      db.customCategory.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      db.transactionOverride.findMany({
        where: { userId },
      }),
      db.manualAccount.findMany({
        where: { userId },
        include: { transactions: { orderBy: { time: "desc" } } },
      }),
    ]);

    // Strip internal DB fields (userId, createdAt on transactions) to keep export lean
    const txData = transactions.map(
      ({ userId: _u, createdAt: _c, ...rest }) => rest
    );

    const catData = categories.map(({ userId: _u, ...rest }) => ({
      id: rest.id,
      name: rest.name,
      color: rest.color,
    }));

    // Map overrides: keep transactionId + categoryName (resolved by name on import)
    const catIdToName: Record<string, string> = {};
    for (const c of categories) catIdToName[c.id] = c.name;

    const overrideData = overrides
      .filter((o) => o.customCategoryId)
      .map((o) => ({
        transactionId: o.transactionId,
        categoryName: catIdToName[o.customCategoryId!] || null,
      }))
      .filter((o) => o.categoryName);

    const manualAccountsData = manualAccountsRaw.map((acc) => ({
      name: acc.name,
      type: acc.type,
      category: acc.category,
      currencyCode: acc.currencyCode,
      transactions: acc.transactions.map((tx) => ({
        amount: tx.amount,
        description: tx.description,
        time: tx.time,
      })),
    }));

    const payload = {
      v: FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      transactions: txData,
      categories: catData,
      overrides: overrideData,
      manualAccounts: manualAccountsData,
    };

    const json = JSON.stringify(payload);

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="finfast-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
