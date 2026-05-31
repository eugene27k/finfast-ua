import { NextRequest, NextResponse } from "next/server";
import { login, needsSetup, SetupError } from "@/lib/auth/bootstrap";
import { InvalidCredentialsError } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/vault";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  if (needsSetup()) {
    return NextResponse.json({ error: "NOT_SETUP" }, { status: 409 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  try {
    const { userId } = login(email, password);
    const token = createSession(userId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    if (e instanceof InvalidCredentialsError) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    if (e instanceof SetupError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
