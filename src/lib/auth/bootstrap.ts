import Database from "better-sqlite3";
import { existsSync, renameSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  generateDEK,
  dekToSqlcipherHex,
  generateRecoveryKey,
  keystoreExists,
  readKeystore,
  writeKeystore,
  newKeystore,
  addUserEntry,
  findUser,
  unlockWithPassword,
  unlockWithRecovery,
  rewrapPassword,
  setRecovery,
  InvalidCredentialsError,
} from "./crypto";
import { applyMigrations } from "@/lib/db/migrator";
import { unlockVault } from "./vault";
import { DB_PATH } from "@/lib/prisma";

const ENC_TMP = `${DB_PATH}.enc`;
const PLAINTEXT_BAK = `${DB_PATH}.plaintext-bak`;

// FK-sane order; foreign_keys is off on raw connections so order is advisory.
const COPY_ORDER = [
  "User",
  "CustomCategory",
  "ManualAccount",
  "ManualTransaction",
  "Transaction",
  "TransactionOverride",
] as const;

export class SetupError extends Error {}

export function needsSetup(): boolean {
  return !keystoreExists();
}

function validateEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new SetupError("INVALID_EMAIL");
  }
  return e;
}

function validatePassword(password: string): void {
  if (typeof password !== "string" || password.length < 8) {
    throw new SetupError("WEAK_PASSWORD");
  }
}

function newUserId(): string {
  return `c${randomBytes(16).toString("hex")}`;
}

type RawDb = InstanceType<typeof Database>;

function openKeyed(dbPath: string, keyHex: string): RawDb {
  const db = new Database(dbPath);
  db.pragma("cipher='sqlcipher'");
  db.pragma(`key="x'${keyHex}'"`);
  return db;
}

function copyTable(src: RawDb, dst: RawDb, table: string): void {
  const rows = src.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const placeholders = cols.map(() => "?").join(", ");
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const stmt = dst.prepare(`INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`);
  const insertAll = dst.transaction((rs: Record<string, unknown>[]) => {
    for (const r of rs) stmt.run(...cols.map((c) => r[c] as never));
  });
  insertAll(rows);
}

function insertFreshUser(enc: RawDb): string {
  const id = newUserId();
  enc.prepare(`INSERT INTO "User" ("id") VALUES (?)`).run(id);
  return id;
}

/**
 * First-run setup: create the encrypted database, preserve any existing
 * plaintext data, write the keystore, and unlock the vault. Returns the
 * one-time recovery key (must be shown to the user exactly once).
 */
export function performSetup(
  emailRaw: string,
  password: string
): { recoveryKey: string; userId: string } {
  if (keystoreExists()) throw new SetupError("ALREADY_SETUP");
  const email = validateEmail(emailRaw);
  validatePassword(password);

  const dek = generateDEK();
  const keyHex = dekToSqlcipherHex(dek);
  const recoveryKey = generateRecoveryKey();

  // 1. Build a fresh encrypted DB at the latest schema.
  if (existsSync(ENC_TMP)) rmSync(ENC_TMP, { force: true });
  applyMigrations(ENC_TMP, keyHex);

  // 2. Copy existing plaintext data into it, or seed a fresh user.
  let userId: string;
  const enc = openKeyed(ENC_TMP, keyHex);
  try {
    if (existsSync(DB_PATH)) {
      const plain = new Database(DB_PATH);
      try {
        for (const table of COPY_ORDER) copyTable(plain, enc, table);
      } finally {
        plain.close();
      }
      const row = enc
        .prepare(`SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1`)
        .get() as { id: string } | undefined;
      userId = row?.id ?? insertFreshUser(enc);
    } else {
      userId = insertFreshUser(enc);
    }
  } finally {
    enc.close();
  }

  // 3. Swap the encrypted file into place, keeping the plaintext as a backup.
  if (existsSync(DB_PATH)) {
    if (existsSync(PLAINTEXT_BAK)) rmSync(PLAINTEXT_BAK, { force: true });
    renameSync(DB_PATH, PLAINTEXT_BAK);
  }
  renameSync(ENC_TMP, DB_PATH);

  // 4. Persist the keystore (wraps the DEK under password + recovery key).
  const ks = newKeystore();
  addUserEntry(ks, email, userId, password, dek);
  setRecovery(ks, recoveryKey, dek);
  writeKeystore(ks);

  // 5. Unlock for this session.
  unlockVault(dek);
  return { recoveryKey, userId };
}

/** Verify credentials, unlock the vault, and return the userId. */
export function login(emailRaw: string, password: string): { userId: string } {
  const ks = readKeystore();
  if (!ks) throw new SetupError("NOT_SETUP");
  const email = emailRaw.trim().toLowerCase();
  const entry = findUser(ks, email);
  if (!entry) throw new InvalidCredentialsError();
  const dek = unlockWithPassword(ks, email, password);
  unlockVault(dek);
  return { userId: entry.userId };
}

/** Reset a forgotten password using the recovery key; unlocks the vault too. */
export function resetPasswordWithRecovery(
  emailRaw: string,
  recoveryKey: string,
  newPassword: string
): { userId: string } {
  const ks = readKeystore();
  if (!ks) throw new SetupError("NOT_SETUP");
  const email = emailRaw.trim().toLowerCase();
  const entry = findUser(ks, email);
  if (!entry) throw new InvalidCredentialsError();
  validatePassword(newPassword);
  const dek = unlockWithRecovery(ks, recoveryKey);
  rewrapPassword(ks, email, newPassword, dek);
  writeKeystore(ks);
  unlockVault(dek);
  return { userId: entry.userId };
}

/** Change the password for a user who knows their current one. */
export function changePassword(
  emailRaw: string,
  oldPassword: string,
  newPassword: string
): void {
  const ks = readKeystore();
  if (!ks) throw new SetupError("NOT_SETUP");
  const email = emailRaw.trim().toLowerCase();
  validatePassword(newPassword);
  const dek = unlockWithPassword(ks, email, oldPassword); // throws if wrong
  rewrapPassword(ks, email, newPassword, dek);
  writeKeystore(ks);
}
