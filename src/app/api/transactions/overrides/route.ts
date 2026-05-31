import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const overrides = await getDb().transactionOverride.findMany({
      where: { userId: auth.userId },
      include: { customCategory: true },
    });

    const result: Record<string, { categoryName: string; color: string }> = {};
    for (const o of overrides) {
      if (o.customCategory) {
        result[o.transactionId] = {
          categoryName: o.customCategory.name,
          color: o.customCategory.color,
        };
      }
    }

    return NextResponse.json({ overrides: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { transactionId, customCategoryId } = await request.json();
    if (!transactionId) {
      return NextResponse.json(
        { error: "transactionId is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const userId = auth.userId;

    if (!customCategoryId) {
      // Remove override — fall back to MCC category
      await db.transactionOverride.deleteMany({
        where: { userId, transactionId },
      });
      return NextResponse.json({ ok: true, removed: true });
    }

    // Ensure the target category belongs to the caller.
    const ownedCat = await db.customCategory.findFirst({
      where: { id: customCategoryId, userId },
      select: { id: true },
    });
    if (!ownedCat) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const override = await db.transactionOverride.upsert({
      where: { userId_transactionId: { userId, transactionId } },
      update: { customCategoryId },
      create: { userId, transactionId, customCategoryId },
      include: { customCategory: true },
    });

    return NextResponse.json({ override });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
