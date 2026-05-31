import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

// POST /api/manual-transactions — create transaction on a manual account
export async function POST(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { manualAccountId, amount, description, time } = body;

  if (!manualAccountId || amount === undefined || !description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = getDb();
  // Verify the account belongs to the caller.
  const owned = await db.manualAccount.findFirst({
    where: { id: manualAccountId, userId: auth.userId },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const tx = await db.manualTransaction.create({
    data: {
      manualAccountId,
      amount: Math.round(amount),
      description: description.trim(),
      time: time || Math.floor(Date.now() / 1000),
    },
  });

  return NextResponse.json({ transaction: tx });
}

// DELETE /api/manual-transactions?id=...
export async function DELETE(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const deleted = await getDb().manualTransaction.deleteMany({
    where: { id, account: { userId: auth.userId } },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// PUT /api/manual-transactions — update transaction
export async function PUT(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { id, amount, description, time } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (amount !== undefined) data.amount = Math.round(amount);
  if (description) data.description = description.trim();
  if (time) data.time = time;

  const updated = await getDb().manualTransaction.updateMany({
    where: { id, account: { userId: auth.userId } },
    data,
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
