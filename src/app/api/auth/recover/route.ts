import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithRecovery, needsSetup, SetupError } from "@/lib/auth/bootstrap";
import { InvalidCredentialsError } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/vault";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  if (needsSetup()) {
    return NextResponse.json({ error: "NOT_SETUP" }, { status: 409 });
  }

  let body: { email?: string; recoveryKey?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, recoveryKey, newPassword } = body;
  if (!email || !recoveryKey || !newPassword) {
    return NextResponse.json(
      { error: "email, recoveryKey and newPassword are required" },
      { status: 400 }
    );
  }

  try {
    const { userId } = resetPasswordWithRecovery(email, recoveryKey, newPassword);
    const token = createSession(userId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    if (e instanceof InvalidCredentialsError) {
      return NextResponse.json({ error: "INVALID_RECOVERY" }, { status: 401 });
    }
    if (e instanceof SetupError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
