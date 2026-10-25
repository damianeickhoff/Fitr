-- Where a profile lives, so outfits can follow the forecast (src/lib/weather.ts).
-- All three are null until they pick a place on the Me page.
ALTER TABLE "Profile" ADD COLUMN "placeName" TEXT;
ALTER TABLE "Profile" ADD COLUMN "latitude" REAL;
ALTER TABLE "Profile" ADD COLUMN "longitude" REAL;
