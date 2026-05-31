import { NextRequest, NextResponse } from "next/server";
import { needsSetup } from "@/lib/auth/bootstrap";
import { currentUserId } from "@/lib/auth/session";

// Lightweight, unauthenticated probe used by the login/setup pages.
export async function GET(request: NextRequest) {
  return NextResponse.json({
    needsSetup: needsSetup(),
    authenticated: currentUserId(request) !== null,
  });
}
