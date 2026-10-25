-- Every wear as its own row, so the item page can list the days and the
-- calendar can show a month. `wornOn` is a calendar day ("2026-10-25") in the
-- server's time zone rather than an instant: a wear belongs to a day, and a
-- plain string compares, groups and dedupes without time-zone surprises.
CREATE TABLE "Wear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "outfitId" TEXT,
    "wornOn" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wear_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Wear_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Wear_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Wear_itemId_wornOn_key" ON "Wear"("itemId", "wornOn");
CREATE INDEX "Wear_profileId_wornOn_idx" ON "Wear"("profileId", "wornOn");

-- Backfill: the only date known so far is the last wear, so each worn piece
-- gets one row on that day. Prisma has stored DateTime both as ISO text and as
-- epoch milliseconds over its versions; read either.
INSERT INTO "Wear" ("id", "profileId", "itemId", "wornOn")
SELECT
    lower(hex(randomblob(12))),
    "profileId",
    "id",
    CASE typeof("lastWornAt")
        WHEN 'text' THEN date("lastWornAt", 'localtime')
        ELSE date("lastWornAt" / 1000, 'unixepoch', 'localtime')
    END
FROM "Item"
WHERE "lastWornAt" IS NOT NULL;
