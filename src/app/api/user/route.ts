import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { monoToken } = await request.json();
    if (!monoToken || typeof monoToken !== "string") {
      return NextResponse.json({ error: "monoToken is required" }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { monoToken },
      update: {},
      create: { monoToken },
    });

    return NextResponse.json({ userId: user.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
