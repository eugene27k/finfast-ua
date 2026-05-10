import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { openaiApiKey: true },
    });

    return NextResponse.json({
      hasKey: !!user?.openaiApiKey,
      keyPreview: user?.openaiApiKey
        ? `${user.openaiApiKey.slice(0, 7)}..${user.openaiApiKey.slice(-4)}`
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, apiKey } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (apiKey) {
      const trimmed = apiKey.trim();
      if (!trimmed.startsWith("sk-")) {
        return NextResponse.json(
          { error: "Невірний формат ключа OpenAI (має починатися з sk-)" },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: { openaiApiKey: trimmed },
      });

      return NextResponse.json({
        ok: true,
        hasKey: true,
        keyPreview: `${trimmed.slice(0, 7)}..${trimmed.slice(-4)}`,
      });
    }

    // Remove key
    await prisma.user.update({
      where: { id: userId },
      data: { openaiApiKey: null },
    });

    return NextResponse.json({ ok: true, hasKey: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
