#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const dbPath = path.join(root, "prisma", "dev.db");

if (!fs.existsSync(dbPath)) {
  console.log("[FinFast] БД не знайдено — створюю...");
  execSync("npx prisma migrate deploy", { cwd: root, stdio: "inherit" });
  console.log("[FinFast] БД створено.");
} else {
  execSync("npx prisma generate", { cwd: root, stdio: "inherit" });
}
