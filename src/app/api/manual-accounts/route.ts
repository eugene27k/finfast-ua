import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/manual-accounts?userId=...
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const accounts = await prisma.manualAccount.findMany({
    where: { userId },
    include: { transactions: { orderBy: { time: "desc" } } },
    orderBy: { createdAt: "asc" },
  });

  // Compute balance for each account
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
  const body = await request.json();
  const { userId, name, type, category, currencyCode } = body;

  if (!userId || !name || !type || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const account = await prisma.manualAccount.create({
      data: {
        userId,
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
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.manualAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// PUT /api/manual-accounts — update account name/category
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, type, category } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: Record<string, string> = {};
  if (name) data.name = name.trim();
  if (type) data.type = type;
  if (category) data.category = category;

  const account = await prisma.manualAccount.update({
    where: { id },
    data,
  });

  return NextResponse.json({ account });
}
