import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native SQLite bindings must stay external — never bundle them into the
  // server component / route handler graph.
  serverExternalPackages: [
    "better-sqlite3",
    "better-sqlite3-multiple-ciphers",
    "@prisma/adapter-better-sqlite3",
  ],
};

export default nextConfig;
