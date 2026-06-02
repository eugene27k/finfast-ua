-- AlterTable
-- Stores a built-in Monobank category name (e.g. "Продукти") chosen by the user
-- as a category override, so Mono categories can be reused without creating a
-- duplicate custom category. NULL = override is by customCategoryId or absent.
ALTER TABLE "TransactionOverride" ADD COLUMN "categoryName" TEXT;
