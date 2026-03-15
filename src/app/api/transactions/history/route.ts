import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const accountIdParam = searchParams.get("accountId");

  if (!userId || !from || !to) {
    return NextResponse.json(
      { error: "userId, from, and to are required" },
      { status: 400 }
    );
  }

  const fromTs = parseInt(from);
  const toTs = parseInt(to);
  const accountIds = accountIdParam
    ? accountIdParam.split(",").filter(Boolean)
    : undefined;

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        time: { gte: fromTs, lte: toTs },
        ...(accountIds && accountIds.length > 0
          ? { accountId: { in: accountIds } }
          : {}),
      },
      orderBy: { time: "desc" },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
