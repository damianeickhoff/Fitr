// Converts the PNG cut-outs an install stored before cut-outs became lossless
// WebP (CUTOUT_WEBP in src/lib/images.ts, settings repeated below). Same
// pixels, about 60% of the bytes.
//
//   npm run db:webp-cutouts                                 from the repo (.env)
//   docker exec -u node FITR node scripts/webp-cutouts.mjs  in the container
//
// Plain JavaScript on sharp and better-sqlite3 only: both are traced into the
// standalone server, so the image ships this file and nothing else for it.
//
// Each cut-out becomes a new file, the database moves to it, then the PNG is
// deleted: the image route caches a path forever, so a file is never
// rewritten. A conversion that doesn't decode to exactly the PNG's pixels is
// skipped and reported. Only `.png` paths are picked up, so running it again
// carries on where it stopped and is otherwise a no-op. Safe beside a running
// server: a piece re-shot meanwhile keeps its new cut-out.
import { randomBytes } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import sharp from "sharp";

try {
  process.loadEnvFile();
} catch {
  // No .env: the container sets the environment itself.
}

// Unraid passes blank template fields as "", which must mean unset too.
const dbFile = (process.env.DATABASE_URL?.trim() || "file:./data/fitr.db").replace(/^file:/, "");
const uploads = path.resolve(process.env.UPLOADS_DIR?.trim() || "./data/uploads");
const db = new Database(dbFile, { fileMustExist: true, timeout: 10_000 });

const WEBP = { lossless: true, exact: true, effort: 6 };

function resolveSafe(relative) {
  const full = path.resolve(uploads, relative);
  if (!full.startsWith(uploads + path.sep)) throw new Error("path escapes the uploads folder");
  return full;
}

/** Decoded to 8-bit RGBA, so two encodings of one picture compare byte for byte. */
async function pixels(image) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, shape: `${info.width}x${info.height}x${info.channels}` };
}

async function samePixels(a, b) {
  const [pa, pb] = await Promise.all([pixels(a), pixels(b)]);
  return pa.shape === pb.shape && pa.data.equals(pb.data);
}

const paths = db
  .prepare("SELECT DISTINCT cutoutPath FROM Item WHERE cutoutPath LIKE '%.png'")
  .pluck()
  .all();
const move = db.prepare("UPDATE Item SET cutoutPath = ? WHERE cutoutPath = ?");
const stillUsed = db.prepare("SELECT COUNT(*) FROM Item WHERE ? IN (photoPath, imagePath, cutoutPath)").pluck();

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
let converted = 0;
let before = 0;
let after = 0;
const missing = [];
const mismatched = [];
const failed = [];

for (const old of paths) {
  let written = null;
  try {
    let png;
    try {
      png = await readFile(resolveSafe(old));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      missing.push(old);
      continue;
    }
    const webp = await sharp(png).webp(WEBP).toBuffer();
    if (!(await samePixels(png, webp))) {
      mismatched.push(old);
      continue;
    }

    const name = `cutout-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.webp`;
    const relative = path.posix.join(path.posix.dirname(old), name);
    await writeFile(resolveSafe(relative), webp, { flag: "wx" });
    written = relative;
    // Read back what landed on disk, not what was meant to.
    if (!(await samePixels(png, await readFile(resolveSafe(relative))))) {
      mismatched.push(old);
      continue;
    }

    if (move.run(relative, old).changes === 0) continue; // Replaced while we worked; ours is surplus.
    written = null;
    if (stillUsed.get(old) === 0) await unlink(resolveSafe(old)).catch(() => undefined);
    converted += 1;
    before += png.length;
    after += webp.length;
  } catch (error) {
    failed.push(`${old}: ${error instanceof Error ? error.message : error}`);
  } finally {
    if (written) await unlink(resolveSafe(written)).catch(() => undefined);
  }
}

console.log(`${paths.length} PNG cut-outs found in ${dbFile}, files under ${uploads}.`);
if (converted > 0) {
  console.log(
    `Converted ${converted}: ${mb(before)} → ${mb(after)}, ${mb(before - after)} saved (${Math.round((1 - after / before) * 100)}%).`,
  );
}
console.log(`Pixel mismatches: ${mismatched.length}.`);
for (const p of mismatched) console.log(`  kept as PNG: ${p}`);
if (missing.length) {
  console.log(`Missing on disk (left alone): ${missing.length}.`);
  for (const p of missing) console.log(`  ${p}`);
}
if (failed.length) {
  console.log(`Failed: ${failed.length}.`);
  for (const f of failed) console.log(`  ${f}`);
}
db.close();
if (mismatched.length || failed.length) process.exitCode = 1;
