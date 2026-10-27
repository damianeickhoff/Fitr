import "server-only";
import { db } from "./db";
import { describeImageError, generateImage, imageAiEnabled } from "./image-gen";
import { CUTOUT_EXT, makeListing, toJpeg } from "./images";
import { deleteStored, readStored, saveFile } from "./storage";
import { studioPrompt } from "./studio";

type StudioSource = {
  id: string;
  userId: string;
  name: string;
  aiTagged: boolean;
  imagePath: string;
  cutoutPath: string | null;
};

/** On whenever an image model is set up, unless the instance turns it off. */
export function studioOnUpload() {
  return imageAiEnabled() && !/^(0|false|off|no)$/i.test(process.env.STUDIO_ON_UPLOAD?.trim() ?? "");
}

/**
 * Makes a picture of a piece the listing, cut out and framed like every other
 * listing whatever the model or the app framed. New files are written and the
 * old ones deleted, never rewritten. Returns false, keeping nothing, when the
 * piece was deleted or re-shot while the picture was being drawn.
 */
export async function swapInStudio(item: StudioSource, picture: Buffer, width = 0, height = 0) {
  const { listing, cutout } = await makeListing(picture, width, height);
  const imagePath = await saveFile(item.userId, listing, "studio");
  const cutoutPath = cutout ? await saveFile(item.userId, cutout, "cutout", CUTOUT_EXT) : null;
  const { count } = await db.item.updateMany({
    where: { id: item.id, imagePath: item.imagePath },
    // A studio photo replaces whatever the checks disliked about the cut-out.
    data: {
      imagePath,
      cutoutPath: cutoutPath ?? item.cutoutPath,
      studioAt: new Date(),
      studioRequestedAt: null,
      qualityIssue: null,
      qualityNote: null,
    },
  });
  if (count === 0) {
    await deleteStored(imagePath, cutoutPath);
    return false;
  }
  // The photo as taken must survive the swap, even where a listing is that
  // same file (the demo wardrobe's are).
  const original = await db.item.count({ where: { photoPath: item.imagePath } });
  await deleteStored(original ? null : item.imagePath, cutoutPath ? item.cutoutPath : null);
  return true;
}

/** One paid image-model call: the current listing in, a product photo out. */
export async function shootStudio(item: StudioSource, provider?: string | null) {
  const source = await readStored(item.imagePath);
  // An untagged piece is still called "New"; the prompt shouldn't say so.
  const result = await generateImage(studioPrompt(item.aiTagged ? item.name : null), [{ data: source }], provider);
  return swapInStudio(item, await toJpeg(result));
}

export type StudioProgress = { total: number; done: number; failed: number; error?: string };

/**
 * One queue for the whole server, one picture at a time: both providers limit
 * image requests per minute, and a new account's limit is low. It lives in
 * memory (on globalThis, so dev reloads don't fork it); a restart drops it and
 * `studioPending` stops trusting the markers it leaves behind.
 */
type QueueState = {
  chain: Promise<void>;
  queued: Set<string>;
  progress: Map<string, StudioProgress>;
};
const state: QueueState = ((globalThis as { __fitrStudioQueue?: QueueState }).__fitrStudioQueue ??= {
  chain: Promise.resolve(),
  queued: new Set(),
  progress: new Map(),
});

const settled = (p: StudioProgress) => p.done + p.failed >= p.total;

/** What the Me page shows: the latest batch of this profile since the server started. */
export function studioProgress(profileId: string): StudioProgress | null {
  return state.progress.get(profileId) ?? null;
}

async function clearMarker(id: string) {
  await db.item.updateMany({ where: { id }, data: { studioRequestedAt: null } }).catch(() => undefined);
}

async function runJob(profileId: string, id: string, progress: StudioProgress) {
  let ok = false;
  try {
    // A failure stops the rest of the batch: a 429 or an empty balance would
    // only repeat for every piece behind it.
    const item = progress.error || !imageAiEnabled() ? null : await db.item.findFirst({ where: { id, profileId } });
    // Read per job rather than once per batch, so a switch on the Me page takes effect mid-queue.
    const profile = item ? await db.profile.findUnique({ where: { id: profileId }, select: { imageProvider: true } }) : null;
    ok = item ? await shootStudio(item, profile?.imageProvider) : false;
  } catch (error) {
    progress.error ??= describeImageError(error);
  } finally {
    if (ok) progress.done += 1;
    else {
      progress.failed += 1;
      // The cut-out listing stays as it was: nothing for the user to clean up.
      await clearMarker(id);
    }
    state.queued.delete(id);
  }
}

/**
 * Marks the pieces as waiting for a studio photo and queues them. Resolves
 * once the marks are stored, so the page that answers already shows them;
 * the returned promise settles when the pictures are done, for `after()` to
 * hold the work past the response.
 */
export async function queueStudio(profileId: string, ids: string[]): Promise<{ count: number; finished: Promise<void> }> {
  const fresh = imageAiEnabled() ? ids.filter((id) => !state.queued.has(id)) : [];
  if (fresh.length === 0) return { count: 0, finished: Promise.resolve() };
  await db.item.updateMany({ where: { id: { in: fresh }, profileId }, data: { studioRequestedAt: new Date() } });

  let progress = state.progress.get(profileId);
  if (!progress || settled(progress)) {
    progress = { total: 0, done: 0, failed: 0 };
    state.progress.set(profileId, progress);
  }
  progress.total += fresh.length;
  const batch = progress;
  for (const id of fresh) {
    state.queued.add(id);
    state.chain = state.chain.then(() => runJob(profileId, id, batch));
  }
  return { count: fresh.length, finished: state.chain };
}
