// Re-frames every stored cut-out onto the current listing ground (see
// src/lib/framing.ts), for when that colour changes. Each piece gets a new
// listing file and its old one is removed, since stored files are never
// rewritten in place. Pieces without a cut-out keep their blurred fallback.
//
//   npm run db:reframe
//
// Plain Node: the framing module has no server-only guard and only needs sharp.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { framedCutout } from "../src/lib/framing.ts";

const dbFile = (process.env.DATABASE_URL ?? "file:./data/fitr.db").replace(/^file:/, "");
const uploads = path.resolve(process.env.UPLOADS_DIR ?? "./data/uploads");
const db = new Database(dbFile);

type Row = { id: string; userId: string; imagePath: string; cutoutPath: string };
const rows = db.prepare("SELECT id, userId, imagePath, cutoutPath FROM Item WHERE cutoutPath IS NOT NULL").all() as Row[];
const update = db.prepare("UPDATE Item SET imagePath = ? WHERE id = ?");

let done = 0;
for (const row of rows) {
  try {
    const listing = await framedCutout(await readFile(path.join(uploads, row.cutoutPath)));
    const relative = `${row.userId}/item-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.jpg`;
    await mkdir(path.join(uploads, row.userId), { recursive: true });
    await writeFile(path.join(uploads, relative), listing);
    update.run(relative, row.id);
    await unlink(path.join(uploads, row.imagePath)).catch(() => undefined);
    done += 1;
  } catch (error) {
    console.error(`Skipped ${row.id}: ${error instanceof Error ? error.message : error}`);
  }
}
console.log(`Re-framed ${done} of ${rows.length} listings onto the current ground.`);
