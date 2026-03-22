import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/manual-transactions — create transaction on a manual account
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { manualAccountId, amount, description, time } = body;

  if (!manualAccountId || amount === undefined || !description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const tx = await prisma.manualTransaction.create({
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
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.manualTransaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// PUT /api/manual-transactions — update transaction
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, amount, description, time } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (amount !== undefined) data.amount = Math.round(amount);
  if (description) data.description = description.trim();
  if (time) data.time = time;

  const tx = await prisma.manualTransaction.update({
    where: { id },
    data,
  });

  return NextResponse.json({ transaction: tx });
}
