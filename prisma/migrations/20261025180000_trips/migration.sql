-- Trips with a packing list. The list and the shopping tips are JSON on the
-- trip rather than a join table: they are read and rewritten whole, a round
-- with the stylist replaces them, and a deleted piece just stops matching.
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placeName" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "notes" TEXT,
    "packing" TEXT NOT NULL DEFAULT '[]',
    "advice" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trip_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Trip_profileId_startDate_idx" ON "Trip"("profileId", "startDate");
