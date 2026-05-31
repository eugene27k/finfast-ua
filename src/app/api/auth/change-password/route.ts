import { NextRequest, NextResponse } from "next/server";
import { changePassword, SetupError } from "@/lib/auth/bootstrap";
import { InvalidCredentialsError, readKeystore } from "@/lib/auth/crypto";
import { requireUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const auth = requireUser(request);
  if (auth instanceof NextResponse) return auth;

  // Resolve the caller's email from the keystore (sessions key by userId).
  const ks = readKeystore();
  const email = ks?.users.find((u) => u.userId === auth.userId)?.email;
  if (!email) {
    return NextResponse.json({ error: "NOT_SETUP" }, { status: 409 });
  }

  let body: { oldPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { oldPassword, newPassword } = body;
  if (!oldPassword || !newPassword) {
    return NextResponse.json(
      { error: "oldPassword and newPassword are required" },
      { status: 400 }
    );
  }

  try {
    changePassword(email, oldPassword, newPassword);
    // DEK is unchanged (only re-wrapped), so the session/vault stay valid.
    return NextResponse.json({ ok: true, email });
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
