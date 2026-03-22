import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SUPPORTED_VERSIONS = [1];

interface ImportTransaction {
  id: string;
  accountId: string;
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
  comment?: string | null;
  receiptId?: string | null;
  invoiceId?: string | null;
  counterEdrpou?: string | null;
  counterIban?: string | null;
  counterName?: string | null;
}

interface ImportCategory {
  name: string;
  color: string;
}

interface ImportOverride {
  transactionId: string;
  categoryName: string;
}

interface ImportManualTransaction {
  amount: number;
  description: string;
  time: number;
}

interface ImportManualAccount {
  name: string;
  type: string;
  category: string;
  currencyCode: number;
  transactions: ImportManualTransaction[];
}

interface ImportPayload {
  v: number;
  transactions?: ImportTransaction[];
  categories?: ImportCategory[];
  overrides?: ImportOverride[];
  manualAccounts?: ImportManualAccount[];
}

export async function POST(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  let payload: ImportPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.v || !SUPPORTED_VERSIONS.includes(payload.v)) {
    return NextResponse.json(
      { error: `Unsupported format version: ${payload.v}` },
      { status: 400 }
    );
  }

  try {
    const stats = { transactionsCreated: 0, transactionsSkipped: 0, categoriesCreated: 0, overridesCreated: 0, manualAccountsCreated: 0, manualTransactionsCreated: 0 };

    // 1. Import transactions — skip duplicates by ID
    const transactions = payload.transactions || [];
    if (transactions.length > 0) {
      // Get existing transaction IDs for this user in one query
      const existingTxs = await prisma.transaction.findMany({
        where: {
          userId,
          id: { in: transactions.map((tx) => tx.id) },
        },
        select: { id: true },
      });
      const existingIds = new Set(existingTxs.map((t) => t.id));

      const newTxs = transactions.filter((tx) => !existingIds.has(tx.id));
      stats.transactionsSkipped = transactions.length - newTxs.length;

      if (newTxs.length > 0) {
        // Batch create in chunks to avoid SQLite limits
        const CHUNK = 500;
        for (let i = 0; i < newTxs.length; i += CHUNK) {
          const chunk = newTxs.slice(i, i + CHUNK);
          await prisma.transaction.createMany({
            data: chunk.map((tx) => ({
              id: tx.id,
              userId,
              accountId: tx.accountId,
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
            })),
            skipDuplicates: true as never,
          });
          stats.transactionsCreated += chunk.length;
        }
      }
    }

    // 2. Import custom categories — skip existing by name
    const categories = payload.categories || [];
    const categoryNameToId: Record<string, string> = {};

    if (categories.length > 0) {
      const existingCats = await prisma.customCategory.findMany({
        where: { userId },
        select: { id: true, name: true },
      });
      const existingNames = new Map(existingCats.map((c) => [c.name, c.id]));

      for (const cat of categories) {
        if (existingNames.has(cat.name)) {
          categoryNameToId[cat.name] = existingNames.get(cat.name)!;
        } else {
          const created = await prisma.customCategory.create({
            data: { userId, name: cat.name, color: cat.color },
          });
          categoryNameToId[cat.name] = created.id;
          stats.categoriesCreated++;
        }
      }
    }

    // 3. Import overrides — skip existing
    const overrides = payload.overrides || [];
    if (overrides.length > 0) {
      // Build category name→id map (include already-existing)
      if (Object.keys(categoryNameToId).length === 0) {
        const allCats = await prisma.customCategory.findMany({
          where: { userId },
          select: { id: true, name: true },
        });
        for (const c of allCats) categoryNameToId[c.name] = c.id;
      }

      const existingOverrides = await prisma.transactionOverride.findMany({
        where: { userId },
        select: { transactionId: true },
      });
      const existingOverrideIds = new Set(existingOverrides.map((o) => o.transactionId));

      for (const ov of overrides) {
        if (existingOverrideIds.has(ov.transactionId)) continue;
        const catId = categoryNameToId[ov.categoryName];
        if (!catId) continue;

        await prisma.transactionOverride.create({
          data: {
            userId,
            transactionId: ov.transactionId,
            customCategoryId: catId,
          },
        });
        stats.overridesCreated++;
      }
    }

    // 4. Import manual accounts + their transactions
    const manualAccounts = payload.manualAccounts || [];
    if (manualAccounts.length > 0) {
      const existingAccounts = await prisma.manualAccount.findMany({
        where: { userId },
        select: { id: true, name: true },
      });
      const existingNames = new Map(existingAccounts.map((a) => [a.name, a.id]));

      for (const acc of manualAccounts) {
        let accountId = existingNames.get(acc.name);
        if (!accountId) {
          const created = await prisma.manualAccount.create({
            data: {
              userId,
              name: acc.name,
              type: acc.type,
              category: acc.category,
              currencyCode: acc.currencyCode || 980,
            },
          });
          accountId = created.id;
          stats.manualAccountsCreated++;
        }

        if (acc.transactions && acc.transactions.length > 0) {
          for (const tx of acc.transactions) {
            await prisma.manualTransaction.create({
              data: {
                manualAccountId: accountId,
                amount: tx.amount,
                description: tx.description,
                time: tx.time,
              },
            });
            stats.manualTransactionsCreated++;
          }
        }
      }
    }

    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
