-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TryOn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "selfPhotoId" TEXT NOT NULL,
    "resultPath" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'openai',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TryOn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TryOn_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TryOn_selfPhotoId_fkey" FOREIGN KEY ("selfPhotoId") REFERENCES "SelfPhoto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TryOn" ("createdAt", "id", "outfitId", "resultPath", "selfPhotoId", "userId") SELECT "createdAt", "id", "outfitId", "resultPath", "selfPhotoId", "userId" FROM "TryOn";
DROP TABLE "TryOn";
ALTER TABLE "new_TryOn" RENAME TO "TryOn";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
