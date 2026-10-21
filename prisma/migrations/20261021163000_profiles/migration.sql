-- Profiles: several wardrobes under one sign-in. Every existing account gets
-- one profile carrying its name and style notes, and everything the account
-- owned moves under that profile. Hand-edited from `prisma migrate diff`:
-- the generated script could not fill a NOT NULL column on existing rows.

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accent" TEXT NOT NULL DEFAULT '#7a2e2e',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "styleNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One profile per existing account.
INSERT INTO "Profile" ("id", "userId", "name", "styleNotes", "createdAt")
SELECT 'p' || "id", "id", "name", "styleNotes", "createdAt" FROM "User";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Insight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Insight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Insight_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Insight" ("content", "createdAt", "id", "itemCount", "userId", "profileId")
SELECT "content", "createdAt", "id", "itemCount", "userId", 'p' || "userId" FROM "Insight";
DROP TABLE "Insight";
ALTER TABLE "new_Insight" RENAME TO "Insight";
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "colors" TEXT NOT NULL DEFAULT '[]',
    "colorHex" TEXT,
    "pattern" TEXT,
    "material" TEXT,
    "styles" TEXT NOT NULL DEFAULT '[]',
    "seasons" TEXT NOT NULL DEFAULT '[]',
    "formality" INTEGER NOT NULL DEFAULT 2,
    "brand" TEXT,
    "description" TEXT,
    "photoPath" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "cutoutPath" TEXT,
    "aiTagged" BOOLEAN NOT NULL DEFAULT false,
    "favourite" BOOLEAN NOT NULL DEFAULT false,
    "wearCount" INTEGER NOT NULL DEFAULT 0,
    "lastWornAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Item_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("aiTagged", "brand", "category", "colorHex", "colors", "createdAt", "cutoutPath", "description", "favourite", "formality", "id", "imagePath", "lastWornAt", "material", "name", "pattern", "photoPath", "seasons", "styles", "subcategory", "userId", "wearCount", "profileId")
SELECT "aiTagged", "brand", "category", "colorHex", "colors", "createdAt", "cutoutPath", "description", "favourite", "formality", "id", "imagePath", "lastWornAt", "material", "name", "pattern", "photoPath", "seasons", "styles", "subcategory", "userId", "wearCount", 'p' || "userId" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_profileId_category_idx" ON "Item"("profileId", "category");
CREATE TABLE "new_Outfit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occasion" TEXT,
    "reasoning" TEXT,
    "advice" TEXT NOT NULL DEFAULT '[]',
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Outfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Outfit_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Outfit" ("advice", "createdAt", "id", "name", "occasion", "reasoning", "saved", "userId", "profileId")
SELECT "advice", "createdAt", "id", "name", "occasion", "reasoning", "saved", "userId", 'p' || "userId" FROM "Outfit";
DROP TABLE "Outfit";
ALTER TABLE "new_Outfit" RENAME TO "Outfit";
CREATE INDEX "Outfit_profileId_saved_idx" ON "Outfit"("profileId", "saved");
CREATE TABLE "new_SelfPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SelfPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SelfPhoto_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SelfPhoto" ("createdAt", "id", "path", "userId", "profileId")
SELECT "createdAt", "id", "path", "userId", 'p' || "userId" FROM "SelfPhoto";
DROP TABLE "SelfPhoto";
ALTER TABLE "new_SelfPhoto" RENAME TO "SelfPhoto";
CREATE TABLE "new_TryOn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "selfPhotoId" TEXT NOT NULL,
    "resultPath" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'openai',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TryOn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TryOn_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TryOn_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TryOn_selfPhotoId_fkey" FOREIGN KEY ("selfPhotoId") REFERENCES "SelfPhoto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TryOn" ("createdAt", "id", "outfitId", "resultPath", "selfPhotoId", "source", "userId", "profileId")
SELECT "createdAt", "id", "outfitId", "resultPath", "selfPhotoId", "source", "userId", 'p' || "userId" FROM "TryOn";
DROP TABLE "TryOn";
ALTER TABLE "new_TryOn" RENAME TO "TryOn";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "tokenVersion") SELECT "createdAt", "email", "id", "name", "passwordHash", "tokenVersion" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");
