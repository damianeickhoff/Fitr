import "server-only";
import { db } from "./db";
import { dayStart } from "./wardrobe";

/**
 * Logs pieces as worn on a day and keeps Item's `wearCount` and `lastWornAt`
 * in step, so every card that reads them stays right. A piece already logged
 * that day is left alone: logging twice is a no-op, not a second wear.
 * Callers check the pieces belong to the profile.
 */
export async function logWears(profileId: string, itemIds: string[], wornOn: string, outfitId: string | null = null) {
  if (itemIds.length === 0) return;
  const existing = await db.wear.findMany({ where: { itemId: { in: itemIds }, wornOn }, select: { itemId: true } });
  const done = new Set(existing.map((w) => w.itemId));
  const fresh = [...new Set(itemIds)].filter((id) => !done.has(id));
  if (fresh.length === 0) return;
  await db.$transaction([
    db.wear.createMany({ data: fresh.map((itemId) => ({ profileId, itemId, outfitId, wornOn })) }),
    db.item.updateMany({ where: { id: { in: fresh } }, data: { wearCount: { increment: 1 } } }),
  ]);
  await syncLastWorn(fresh);
}

/** Takes one day off a piece's history. */
export async function removeWear(itemId: string, wornOn: string) {
  const { count } = await db.wear.deleteMany({ where: { itemId, wornOn } });
  if (count === 0) return;
  const left = await db.wear.count({ where: { itemId } });
  // The count can run ahead of the rows (wears from before the history), but
  // with no day left it has nothing to stand on and would read "worn 3×, never".
  await db.item.update({
    where: { id: itemId },
    data: left === 0 ? { wearCount: 0 } : { wearCount: { decrement: 1 } },
  });
  await syncLastWorn([itemId]);
}

/** `lastWornAt` is always the latest logged day, so logging a past day never moves it backwards. */
async function syncLastWorn(itemIds: string[]) {
  const latest = await db.wear.groupBy({ by: ["itemId"], where: { itemId: { in: itemIds } }, _max: { wornOn: true } });
  const byItem = new Map(latest.map((l) => [l.itemId, l._max.wornOn]));
  await db.$transaction(
    itemIds.map((id) => {
      const day = byItem.get(id);
      return db.item.update({ where: { id }, data: { lastWornAt: day ? dayStart(day) : null } });
    }),
  );
}
