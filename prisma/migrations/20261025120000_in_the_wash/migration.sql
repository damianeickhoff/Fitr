-- When a piece went in the wash. Null when it is in the wardrobe; ignored
-- after a fortnight, so a forgotten toggle quietly lapses.
ALTER TABLE "Item" ADD COLUMN "inWashSince" DATETIME;
