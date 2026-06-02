import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { CATEGORY_NAMES, getCategoryColor } from "@/lib/mcc";

const MONO_CATEGORY_SET = new Set(CATEGORY_NAMES);

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const overrides = await getDb().transactionOverride.findMany({
      where: { userId: auth.userId },
      include: { customCategory: true },
    });

    const result: Record<string, { categoryName: string; color: string }> = {};
    const transfers: Record<string, string> = {};
    for (const o of overrides) {
      // A custom category takes precedence; otherwise fall back to a chosen
      // built-in Mono category. Both resolve to the same { categoryName, color }
      // shape, so every consumer (transactions, analytics, charts, budgets)
      // treats Mono and custom overrides identically.
      if (o.customCategory) {
        result[o.transactionId] = {
          categoryName: o.customCategory.name,
          color: o.customCategory.color,
        };
      } else if (o.categoryName) {
        result[o.transactionId] = {
          categoryName: o.categoryName,
          color: getCategoryColor(o.categoryName),
        };
      }
      if (o.transfer) {
        transfers[o.transactionId] = o.transfer;
      }
    }

    return NextResponse.json({ overrides: result, transfers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { transactionId, customCategoryId, monoCategoryName } =
      await request.json();
    if (!transactionId) {
      return NextResponse.json(
        { error: "transactionId is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const userId = auth.userId;

    if (!customCategoryId && !monoCategoryName) {
      // Remove override — fall back to the automatic MCC category. The transfer
      // decision lives on the same row, so only clear the category fields if a
      // transfer decision still needs to be kept.
      const existing = await db.transactionOverride.findUnique({
        where: { userId_transactionId: { userId, transactionId } },
        select: { transfer: true },
      });
      if (existing?.transfer) {
        await db.transactionOverride.update({
          where: { userId_transactionId: { userId, transactionId } },
          data: { customCategoryId: null, categoryName: null },
        });
      } else {
        await db.transactionOverride.deleteMany({
          where: { userId, transactionId },
        });
      }
      return NextResponse.json({ ok: true, removed: true });
    }

    // Built-in Mono category override — no custom category needed.
    if (monoCategoryName && !customCategoryId) {
      if (!MONO_CATEGORY_SET.has(monoCategoryName)) {
        return NextResponse.json(
          { error: "Unknown Mono category" },
          { status: 400 }
        );
      }
      const override = await db.transactionOverride.upsert({
        where: { userId_transactionId: { userId, transactionId } },
        update: { categoryName: monoCategoryName, customCategoryId: null },
        create: { userId, transactionId, categoryName: monoCategoryName },
      });
      return NextResponse.json({ override });
    }

    // Custom category override — ensure the target category belongs to the caller.
    const ownedCat = await db.customCategory.findFirst({
      where: { id: customCategoryId, userId },
      select: { id: true },
    });
    if (!ownedCat) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const override = await db.transactionOverride.upsert({
      where: { userId_transactionId: { userId, transactionId } },
      update: { customCategoryId, categoryName: null },
      create: { userId, transactionId, customCategoryId },
      include: { customCategory: true },
    });

    return NextResponse.json({ override });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const TRANSFER_VALUES = new Set(["none", "internal", "jar"]);

/**
 * Set (or clear) the internal-transfer decision for a transaction.
 * Body: { transactionId, transfer: "none" | "internal" | "jar" | null }.
 * A null `transfer` clears the user's decision so auto-detection applies again.
 * Works for both Monobank and manual transactions (transactionId is free-form).
 */
export async function PATCH(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { transactionId, transfer } = await request.json();
    if (!transactionId) {
      return NextResponse.json(
        { error: "transactionId is required" },
        { status: 400 }
      );
    }
    if (transfer !== null && transfer !== undefined && !TRANSFER_VALUES.has(transfer)) {
      return NextResponse.json({ error: "Invalid transfer value" }, { status: 400 });
    }

    const db = getDb();
    const userId = auth.userId;
    const value: string | null = transfer ?? null;

    await db.transactionOverride.upsert({
      where: { userId_transactionId: { userId, transactionId } },
      update: { transfer: value },
      create: { userId, transactionId, transfer: value },
    });

    return NextResponse.json({ ok: true, transfer: value });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
