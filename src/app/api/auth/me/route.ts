import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { readKeystore } from "@/lib/auth/crypto";

export async function GET(request: NextRequest) {
  const userId = currentUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const ks = readKeystore();
  const email = ks?.users.find((u) => u.userId === userId)?.email ?? null;
  return NextResponse.json({ userId, email });
}
