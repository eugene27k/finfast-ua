import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

/**
 * Minimal migration runner for the encrypted database.
 *
 * Prisma's CLI (`migrate deploy`) talks to the DB file directly and cannot
 * supply a SQLCipher key, so it can't operate on the encrypted file. This
 * runner replays the same `prisma/migrations/<name>/migration.sql` files
 * through a keyed connection and records them in `_prisma_migrations` using
 * Prisma's own table format (so a decrypted copy stays CLI-compatible).
 */
const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

const MIGRATIONS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "checksum" TEXT NOT NULL,
  "finished_at" DATETIME,
  "migration_name" TEXT NOT NULL,
  "logs" TEXT,
  "rolled_back_at" DATETIME,
  "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
  "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

interface Migration {
  name: string;
  sql: string;
}

function listMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"),
    }));
}

/**
 * Open a keyed connection to `dbPath`, apply any not-yet-applied migrations,
 * and close. Safe to call repeatedly — already-applied migrations are skipped.
 */
export function applyMigrations(dbPath: string, keyHex: string): void {
  const db = new Database(dbPath);
  try {
    db.pragma("cipher='sqlcipher'");
    db.pragma(`key="x'${keyHex}'"`);
    // Force a first read so a wrong/unkeyed file fails fast and loudly.
    db.exec(MIGRATIONS_TABLE_DDL);

    const appliedRows = db
      .prepare(`SELECT "migration_name" FROM "_prisma_migrations"`)
      .all() as Array<{ migration_name: string }>;
    const applied = new Set(appliedRows.map((r) => r.migration_name));

    const record = db.prepare(
      `INSERT INTO "_prisma_migrations"
       ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
       VALUES (?, ?, current_timestamp, ?, 1)`
    );

    for (const m of listMigrations()) {
      if (applied.has(m.name)) continue;
      const checksum = createHash("sha256").update(m.sql).digest("hex");
      db.exec(m.sql);
      record.run(randomUUID(), checksum, m.name);
    }
  } finally {
    db.close();
  }
}
