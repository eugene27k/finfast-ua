-- AlterTable
ALTER TABLE "User" ADD COLUMN "openaiApiKey" TEXT;

-- CreateTable
CREATE TABLE "ManualAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "currencyCode" INTEGER NOT NULL DEFAULT 980,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manualAccountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "time" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualTransaction_manualAccountId_fkey" FOREIGN KEY ("manualAccountId") REFERENCES "ManualAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "time" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "mcc" INTEGER NOT NULL,
    "originalMcc" INTEGER NOT NULL,
    "hold" BOOLEAN NOT NULL,
    "amount" INTEGER NOT NULL,
    "operationAmount" INTEGER NOT NULL,
    "currencyCode" INTEGER NOT NULL,
    "commissionRate" INTEGER NOT NULL,
    "cashbackAmount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "comment" TEXT,
    "receiptId" TEXT,
    "invoiceId" TEXT,
    "counterEdrpou" TEXT,
    "counterIban" TEXT,
    "counterName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ManualAccount_userId_idx" ON "ManualAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualAccount_userId_name_key" ON "ManualAccount"("userId", "name");

-- CreateIndex
CREATE INDEX "ManualTransaction_manualAccountId_time_idx" ON "ManualTransaction"("manualAccountId", "time");

-- CreateIndex
CREATE INDEX "Transaction_userId_accountId_time_idx" ON "Transaction"("userId", "accountId", "time");

-- CreateIndex
CREATE INDEX "Transaction_userId_time_idx" ON "Transaction"("userId", "time");
