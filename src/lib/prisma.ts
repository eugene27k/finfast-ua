import { PrismaClient } from "@/generated/prisma/client";
import { EncryptedSqlite3 } from "./db/encrypted-adapter";
import path from "node:path";

export const DB_PATH = path.join(process.cwd(), "prisma", "dev.db");

/**
 * The Prisma client is bound to the encryption key (DEK) and therefore can
 * only exist while the vault is unlocked. It is created on login/unlock and
 * torn down on logout or server restart. Kept on globalThis so it survives
 * HMR in dev and is shared between route handlers and server components.
 */
const globalForDb = globalThis as unknown as {
  __finfastDb?: { client: PrismaClient; keyHex: string } | null;
};

export class DbLockedError extends Error {
  constructor() {
    super("DB_LOCKED");
    this.name = "DbLockedError";
  }
}

/** Open (or reuse) the encrypted client for the given key. */
export function openDb(keyHex: string): PrismaClient {
  const existing = globalForDb.__finfastDb;
  if (existing && existing.keyHex === keyHex) return existing.client;
  if (existing) void existing.client.$disconnect();

  const client = new PrismaClient({
    adapter: new EncryptedSqlite3({ url: `file:${DB_PATH}` }, keyHex),
  });
  globalForDb.__finfastDb = { client, keyHex };
  return client;
}

export function closeDb(): void {
  if (globalForDb.__finfastDb) {
    void globalForDb.__finfastDb.client.$disconnect();
    globalForDb.__finfastDb = null;
  }
}

export function isDbOpen(): boolean {
  return !!globalForDb.__finfastDb;
}

/** Get the live client. Throws DbLockedError if the vault is locked. */
export function getDb(): PrismaClient {
  if (!globalForDb.__finfastDb) throw new DbLockedError();
  return globalForDb.__finfastDb.client;
}
