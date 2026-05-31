import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

// GET /api/manual-accounts
export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const accounts = await getDb().manualAccount.findMany({
    where: { userId: auth.userId },
    include: { transactions: { orderBy: { time: "desc" } } },
    orderBy: { createdAt: "asc" },
  });

  const result = accounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    category: acc.category,
    currencyCode: acc.currencyCode,
    createdAt: acc.createdAt.toISOString(),
    balance: acc.transactions.reduce((sum, tx) => sum + tx.amount, 0),
    transactions: acc.transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      description: tx.description,
      time: tx.time,
    })),
  }));

  return NextResponse.json({ accounts: result });
}

// POST /api/manual-accounts — create new account
export async function POST(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { name, type, category, currencyCode } = body;

  if (!name || !type || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const account = await getDb().manualAccount.create({
      data: {
        userId: auth.userId,
        name: name.trim(),
        type,
        category,
        currencyCode: currencyCode || 980,
      },
    });
    return NextResponse.json({ account });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Рахунок з такою назвою вже існує" }, { status: 409 });
    }
    throw e;
  }
}

// DELETE /api/manual-accounts?id=...
export async function DELETE(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Scope by userId so a caller can only delete their own account.
  const deleted = await getDb().manualAccount.deleteMany({
    where: { id, userId: auth.userId },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// PUT /api/manual-accounts — update account name/category
export async function PUT(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { id, name, type, category } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: Record<string, string> = {};
  if (name) data.name = name.trim();
  if (type) data.type = type;
  if (category) data.category = category;

  // updateMany lets us scope by userId in the same statement.
  const updated = await getDb().manualAccount.updateMany({
    where: { id, userId: auth.userId },
    data,
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
