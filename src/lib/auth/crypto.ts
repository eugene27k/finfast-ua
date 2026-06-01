import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Crypto core for at-rest encryption.
 *
 * The whole SQLite file is encrypted with SQLCipher under a random 256-bit
 * Data Encryption Key (DEK). The DEK is never stored in the clear: it is
 * wrapped (AES-256-GCM) under a Key Encryption Key (KEK) derived from the
 * user's password via scrypt. The wrapped DEK + salt live in an unencrypted
 * keystore file that contains no plaintext secrets — without a password (or
 * the recovery key) it is useless, and without the DEK the database is noise.
 *
 * A successful login = derive KEK from the entered password, unwrap the DEK
 * (the GCM auth tag is the password check), and open SQLCipher with it.
 */

// --- Tunables ---
const KEYSTORE_VERSION = 1;
const DEK_BYTES = 32; // 256-bit SQLCipher key
const SALT_BYTES = 16;
const IV_BYTES = 12; // GCM nonce
const SCRYPT = { N: 1 << 16, r: 8, p: 1, keylen: 32, maxmem: 256 * 1024 * 1024 };

const KEYSTORE_PATH = path.join(process.cwd(), "prisma", "keystore.json");

// --- Types ---
export interface WrappedKey {
  iv: string; // base64
  tag: string; // base64 GCM auth tag
  ct: string; // base64 wrapped DEK
}

export interface KeystoreUser {
  email: string;
  userId: string; // links the credential to the User row inside the encrypted DB
  salt: string; // base64, per-user KDF salt
  wrap: WrappedKey; // DEK wrapped under scrypt(password, salt)
}

export interface KeystoreRecovery {
  salt: string;
  wrap: WrappedKey; // DEK wrapped under scrypt(recoveryKey, salt)
}

export interface Keystore {
  version: number;
  kdf: { name: "scrypt"; N: number; r: number; p: number; keylen: number };
  users: KeystoreUser[];
  recovery?: KeystoreRecovery;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("INVALID_CREDENTIALS");
    this.name = "InvalidCredentialsError";
  }
}

// --- KDF ---
export function deriveKEK(password: string, salt: Buffer): Buffer {
  return scryptSync(password.normalize("NFKC"), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });
}

// --- DEK ---
export function generateDEK(): Buffer {
  return randomBytes(DEK_BYTES);
}

/** Hex form for `PRAGMA key="x'<hex>'"` (raw key, bypasses SQLCipher's own KDF). */
export function dekToSqlcipherHex(dek: Buffer): string {
  return dek.toString("hex");
}

// --- AES-256-GCM key wrapping ---
export function wrapKey(dek: Buffer, kek: Buffer): WrappedKey {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", kek, iv);
  const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ct.toString("base64"),
  };
}

/** Unwrap a DEK. Throws if the GCM tag fails (i.e. wrong KEK / wrong password). */
export function unwrapKey(wrap: WrappedKey, kek: Buffer): Buffer {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    kek,
    Buffer.from(wrap.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(wrap.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(wrap.ct, "base64")),
    decipher.final(),
  ]);
}

// --- Recovery key (shown once at setup) ---
/** A human-typeable recovery secret: 20 random bytes as grouped uppercase hex. */
export function generateRecoveryKey(): string {
  const hex = randomBytes(20).toString("hex").toUpperCase();
  return (hex.match(/.{1,5}/g) ?? []).join("-");
}

function normalizeRecoveryKey(key: string): string {
  return key.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

// --- Keystore IO (atomic write) ---
export function keystoreExists(): boolean {
  return existsSync(KEYSTORE_PATH);
}

export function readKeystore(): Keystore | null {
  if (!existsSync(KEYSTORE_PATH)) return null;
  return JSON.parse(readFileSync(KEYSTORE_PATH, "utf8")) as Keystore;
}

export function writeKeystore(ks: Keystore): void {
  mkdirSync(path.dirname(KEYSTORE_PATH), { recursive: true });
  const tmp = `${KEYSTORE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(ks, null, 2), { mode: 0o600 });
  renameSync(tmp, KEYSTORE_PATH);
}

/** Permanently remove the keystore. After this, needsSetup() is true again. */
export function deleteKeystore(): void {
  rmSync(KEYSTORE_PATH, { force: true, maxRetries: 5, retryDelay: 100 });
}

export function newKeystore(): Keystore {
  return {
    version: KEYSTORE_VERSION,
    kdf: { name: "scrypt", N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, keylen: SCRYPT.keylen },
    users: [],
  };
}

// --- High-level operations ---
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findUser(ks: Keystore, email: string): KeystoreUser | undefined {
  const e = normalizeEmail(email);
  return ks.users.find((u) => u.email === e);
}

/** Add a user entry that wraps `dek` under the given password. Mutates `ks`. */
export function addUserEntry(
  ks: Keystore,
  email: string,
  userId: string,
  password: string,
  dek: Buffer
): KeystoreUser {
  const salt = randomBytes(SALT_BYTES);
  const kek = deriveKEK(password, salt);
  const entry: KeystoreUser = {
    email: normalizeEmail(email),
    userId,
    salt: salt.toString("base64"),
    wrap: wrapKey(dek, kek),
  };
  ks.users.push(entry);
  return entry;
}

/** Verify a password and return the DEK. Throws InvalidCredentialsError otherwise. */
export function unlockWithPassword(
  ks: Keystore,
  email: string,
  password: string
): Buffer {
  const u = findUser(ks, email);
  if (!u) throw new InvalidCredentialsError();
  const kek = deriveKEK(password, Buffer.from(u.salt, "base64"));
  try {
    return unwrapKey(u.wrap, kek);
  } catch {
    throw new InvalidCredentialsError();
  }
}

/** Re-wrap the DEK under a new password for an existing user. Mutates `ks`. */
export function rewrapPassword(
  ks: Keystore,
  email: string,
  newPassword: string,
  dek: Buffer
): void {
  const u = findUser(ks, email);
  if (!u) throw new InvalidCredentialsError();
  const salt = randomBytes(SALT_BYTES);
  u.salt = salt.toString("base64");
  u.wrap = wrapKey(dek, deriveKEK(newPassword, salt));
}

/** Store a recovery wrapping of the DEK. Mutates `ks`. */
export function setRecovery(ks: Keystore, recoveryKey: string, dek: Buffer): void {
  const salt = randomBytes(SALT_BYTES);
  const kek = deriveKEK(normalizeRecoveryKey(recoveryKey), salt);
  ks.recovery = { salt: salt.toString("base64"), wrap: wrapKey(dek, kek) };
}

/** Unlock the DEK via the recovery key. Throws InvalidCredentialsError otherwise. */
export function unlockWithRecovery(ks: Keystore, recoveryKey: string): Buffer {
  if (!ks.recovery) throw new InvalidCredentialsError();
  const kek = deriveKEK(
    normalizeRecoveryKey(recoveryKey),
    Buffer.from(ks.recovery.salt, "base64")
  );
  try {
    return unwrapKey(ks.recovery.wrap, kek);
  } catch {
    throw new InvalidCredentialsError();
  }
}
