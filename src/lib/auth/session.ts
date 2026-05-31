import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isUnlocked, sessionUserId, SESSION_TTL_SECONDS } from "./vault";

export const SESSION_COOKIE = "finfast_session";

export function sessionCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Resolve the current userId from a route-handler request, or null. */
export function currentUserId(req: NextRequest): string | null {
  if (!isUnlocked()) return null;
  return sessionUserId(req.cookies.get(SESSION_COOKIE)?.value);
}

/**
 * Route-handler guard. Returns `{ userId }` when authenticated, otherwise a
 * ready-to-return 401 response.
 *
 *   const auth = requireUser(req);
 *   if (auth instanceof NextResponse) return auth;
 *   const { userId } = auth;
 */
export function requireUser(req: NextRequest): { userId: string } | NextResponse {
  const userId = currentUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", locked: !isUnlocked() },
      { status: 401 }
    );
  }
  return { userId };
}

/** Resolve the current userId inside a server component (uses the cookie store). */
export async function serverUserId(): Promise<string | null> {
  if (!isUnlocked()) return null;
  const store = await cookies();
  return sessionUserId(store.get(SESSION_COOKIE)?.value);
}
