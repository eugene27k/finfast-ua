import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const overrides = await prisma.transactionOverride.findMany({
      where: { userId },
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
  try {
    const { userId, transactionId, customCategoryId } = await request.json();
    if (!userId || !transactionId) {
      return NextResponse.json(
        { error: "userId and transactionId are required" },
        { status: 400 }
      );
    }

    if (!customCategoryId) {
      // Remove override — go back to MCC category
      await prisma.transactionOverride.deleteMany({
        where: { userId, transactionId },
      });
      return NextResponse.json({ ok: true, removed: true });
    }

    const override = await prisma.transactionOverride.upsert({
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
