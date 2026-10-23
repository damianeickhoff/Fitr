-- Which image model a profile wants its studio photos and try-ons drawn by,
-- when the server has both set up. Null means the instance default.
ALTER TABLE "Profile" ADD COLUMN "imageProvider" TEXT;
