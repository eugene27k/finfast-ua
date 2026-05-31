-- RedefineTables: make User.monoToken nullable (identity moved to the auth keystore)
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monoToken" TEXT,
    "openaiApiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("id", "monoToken", "openaiApiKey", "createdAt")
SELECT "id", "monoToken", "openaiApiKey", "createdAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_monoToken_key" ON "User"("monoToken");
