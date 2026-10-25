-- What the upload found wrong with a listing's photo or cut-out, so the
-- wardrobe can suggest a retake. Null once fine, kept, re-cut or re-shot.
ALTER TABLE "Item" ADD COLUMN "qualityIssue" TEXT;
ALTER TABLE "Item" ADD COLUMN "qualityNote" TEXT;
