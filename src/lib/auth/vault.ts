import { randomBytes } from "node:crypto";
import { openDb, closeDb, closeDbAndWait, DB_PATH } from "@/lib/prisma";
import { applyMigrations } from "@/lib/db/migrator";

/**
 * In-memory vault: holds the active encryption key (DEK) and live sessions.
 *
 * Both live only in server process memory. A server restart clears them, so
 * the database is sealed again until someone logs in with their password —
 * that's the whole point of password-derived encryption. Kept on globalThis
 * so route handlers and server components share one instance (and it survives
 * HMR in dev).
 */
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

interface Session {
  userId: string;
  expiresAt: number;
}

interface VaultState {
  dekHex: string | null;
  sessions: Map<string, Session>;
}

const globalForVault = globalThis as unknown as { __finfastVault?: VaultState };

function vault(): VaultState {
  if (!globalForVault.__finfastVault) {
    globalForVault.__finfastVault = { dekHex: null, sessions: new Map() };
  }
  return globalForVault.__finfastVault;
}

/** Unlock the vault with a decrypted DEK and open the database. */
export function unlockVault(dek: Buffer): void {
  const v = vault();
  v.dekHex = dek.toString("hex");
  // Apply any pending migrations now that we hold the key — this is the only
  // moment the encrypted DB can be migrated. Idempotent: already-applied
  // migrations are skipped. Must run before the Prisma client issues queries.
  applyMigrations(DB_PATH, v.dekHex);
  openDb(v.dekHex);
}

/** Seal the vault: drop the key, clear sessions, close the database. */
export function lockVault(): void {
  const v = vault();
  v.dekHex = null;
  v.sessions.clear();
  closeDb();
}

/**
 * Seal the vault and fully release the database file handle. Use this (instead
 * of lockVault) when the DB file is about to be deleted, so Windows does not
 * keep it locked.
 */
export async function destroyVault(): Promise<void> {
  const v = vault();
  v.dekHex = null;
  v.sessions.clear();
  await closeDbAndWait();
}

export function isUnlocked(): boolean {
  return vault().dekHex !== null;
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  vault().sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function sessionUserId(token: string | undefined | null): string | null {
  if (!token) return null;
  const v = vault();
  const s = v.sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    v.sessions.delete(token);
    return null;
  }
  return s.userId;
}

export function destroySession(token: string | undefined | null): void {
  if (token) vault().sessions.delete(token);
}

export const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
