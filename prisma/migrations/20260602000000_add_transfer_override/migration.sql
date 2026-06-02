-- AlterTable
-- Stores the user's explicit decision about whether a transaction is an internal
-- movement of funds (not income/expense). Values: "none" | "internal" | "jar".
-- NULL means no user decision yet — auto-detection applies.
ALTER TABLE "TransactionOverride" ADD COLUMN "transfer" TEXT;
