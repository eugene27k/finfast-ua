import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const accountIdParam = searchParams.get("accountId");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to are required" },
      { status: 400 }
    );
  }

  const fromTs = parseInt(from);
  const toTs = parseInt(to);
  const accountIds = accountIdParam
    ? accountIdParam.split(",").filter(Boolean)
    : undefined;

  try {
    const transactions = await getDb().transaction.findMany({
      where: {
        userId: auth.userId,
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
