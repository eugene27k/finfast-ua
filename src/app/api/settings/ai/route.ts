import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const user = await getDb().user.findUnique({
      where: { id: auth.userId },
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
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { apiKey } = await request.json();

    if (apiKey) {
      const trimmed = apiKey.trim();
      if (!trimmed.startsWith("sk-")) {
        return NextResponse.json(
          { error: "Невірний формат ключа OpenAI (має починатися з sk-)" },
          { status: 400 }
        );
      }

      await getDb().user.update({
        where: { id: auth.userId },
        data: { openaiApiKey: trimmed },
      });

      return NextResponse.json({
        ok: true,
        hasKey: true,
        keyPreview: `${trimmed.slice(0, 7)}..${trimmed.slice(-4)}`,
      });
    }

    // Remove key
    await getDb().user.update({
      where: { id: auth.userId },
      data: { openaiApiKey: null },
    });

    return NextResponse.json({ ok: true, hasKey: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
