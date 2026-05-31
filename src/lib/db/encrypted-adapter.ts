import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

type ConnectedAdapter = Awaited<ReturnType<PrismaBetterSqlite3["connect"]>>;

/**
 * Prisma driver adapter that opens the SQLite file with SQLCipher.
 *
 * `better-sqlite3` is aliased to `better-sqlite3-multiple-ciphers` via the
 * package.json `overrides`, so the underlying connection supports encryption.
 * We inject the cipher + key PRAGMAs immediately after the connection is
 * created and before Prisma issues any query — that's the only valid moment
 * to key a SQLCipher database.
 */
export class EncryptedSqlite3 extends PrismaBetterSqlite3 {
  readonly #keyHex: string;

  constructor(config: { url: string }, keyHex: string) {
    super(config);
    this.#keyHex = keyHex;
  }

  async connect(): Promise<ConnectedAdapter> {
    const adapter = await super.connect();
    const client = (adapter as unknown as { client: { pragma: (sql: string) => unknown } })
      .client;
    client.pragma("cipher='sqlcipher'");
    // Raw 32-byte key as hex — bypasses SQLCipher's own KDF (we derive it ourselves).
    client.pragma(`key="x'${this.#keyHex}'"`);
    return adapter;
  }
}
