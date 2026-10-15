import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Photos live on disk under one root, each user in a folder named by their id.
 * Paths stored in the database are relative to the root, so the root can move.
 */
function root() {
  // The ignore hint stops the standalone build tracing the whole project
  // because it can't know which files a runtime path will touch.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOADS_DIR ?? "data/uploads");
}

function resolveSafe(relative: string) {
  const full = path.resolve(root(), relative);
  if (!full.startsWith(root() + path.sep)) throw new Error("Path escapes the uploads folder.");
  return full;
}

export async function saveFile(userId: string, data: Buffer, kind: string, ext = "jpg") {
  const relative = `${userId}/${kind}-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.${ext}`;
  const full = resolveSafe(relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return relative;
}

export async function readStored(relative: string) {
  return readFile(resolveSafe(relative));
}

/** Best effort: a missing file is already the state we wanted. */
export async function deleteStored(...relatives: (string | null | undefined)[]) {
  await Promise.all(
    relatives
      .filter((r): r is string => Boolean(r))
      .map((r) => unlink(resolveSafe(r)).catch(() => undefined)),
  );
}
