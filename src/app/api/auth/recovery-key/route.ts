import { NextRequest, NextResponse } from "next/server";
import { regenerateRecoveryKey, SetupError } from "@/lib/auth/bootstrap";
import { InvalidCredentialsError, readKeystore } from "@/lib/auth/crypto";
import { requireUser } from "@/lib/auth/session";

// Issue a fresh recovery key for the logged-in user (requires their password).
export async function POST(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const ks = readKeystore();
  const email = ks?.users.find((u) => u.userId === auth.userId)?.email;
  if (!email) {
    return NextResponse.json({ error: "NOT_SETUP" }, { status: 409 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.password) {
    return NextResponse.json({ error: "password is required" }, { status: 400 });
  }

  try {
    const { recoveryKey } = regenerateRecoveryKey(email, body.password);
    return NextResponse.json({ ok: true, recoveryKey });
  } catch (e) {
    if (e instanceof InvalidCredentialsError) {
      return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 401 });
    }
    if (e instanceof SetupError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
