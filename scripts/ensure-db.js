#!/usr/bin/env node
// The database is now encrypted (SQLCipher) and its lifecycle is owned by the
// app: the first-run /setup flow creates and migrates the encrypted file, and
// the runtime migrator applies pending migrations through a keyed connection.
// The Prisma CLI cannot open the encrypted file, so we only generate the client.
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");

execSync("npx prisma generate", { cwd: root, stdio: "inherit" });
