-- AlterTable
ALTER TABLE "Item" ADD COLUMN "studioAt" DATETIME;
ALTER TABLE "Item" ADD COLUMN "studioRequestedAt" DATETIME;

-- Listings already re-shot by hand are stored as "studio-…" files.
UPDATE "Item" SET "studioAt" = "createdAt" WHERE "imagePath" LIKE '%/studio-%';
