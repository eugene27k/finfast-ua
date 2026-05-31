import { NextResponse } from "next/server";

// Deprecated: identity is now established via /api/auth/* (email + password).
// The old monoToken-based upsert has been removed.
export async function POST() {
  return NextResponse.json(
    { error: "GONE", message: "Use /api/auth/login or /api/auth/setup" },
    { status: 410 }
  );
}
