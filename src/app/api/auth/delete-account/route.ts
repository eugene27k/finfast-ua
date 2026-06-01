import { NextRequest, NextResponse } from "next/server";
import { deleteAccount, SetupError } from "@/lib/auth/bootstrap";
import { InvalidCredentialsError, readKeystore } from "@/lib/auth/crypto";
import { requireUser, SESSION_COOKIE } from "@/lib/auth/session";

// The exact word the user must type to confirm an irreversible deletion.
const CONFIRM_WORD = "Видалити";

// Permanently delete the account and all data. Requires the password AND the
// literal confirmation word. After success the install is back to first-run
// state, so the user can register again from scratch.
export async function POST(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  // Sessions key by userId; resolve the caller's email from the keystore.
  const ks = readKeystore();
  const email = ks?.users.find((u) => u.userId === auth.userId)?.email;
  if (!email) {
    return NextResponse.json({ error: "NOT_SETUP" }, { status: 409 });
  }

  let body: { password?: string; confirm?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.password) {
    return NextResponse.json({ error: "password is required" }, { status: 400 });
  }
  if ((body.confirm ?? "").trim() !== CONFIRM_WORD) {
    return NextResponse.json({ error: "CONFIRM_MISMATCH" }, { status: 400 });
  }

  try {
    await deleteAccount(email, body.password);
    // Vault and DB are gone; also clear the (now meaningless) session cookie.
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
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
