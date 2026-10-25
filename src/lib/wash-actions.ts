"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "./auth";
import { db } from "./db";
import { inWash } from "./wardrobe";

/** Into the wash or back out. A lapsed marker (see `inWash`) counts as out, so the toggle puts it back in. */
export async function toggleWash(id: string) {
  const { profile } = await requireProfile();
  const item = await db.item.findFirst({ where: { id, profileId: profile.id } });
  if (!item) throw new Error("Item not found.");
  await db.item.update({ where: { id }, data: { inWashSince: inWash(item) ? null : new Date() } });
  revalidatePath("/", "layout");
}

/** After wearing a look: every piece of it goes in the wash. */
export async function washOutfit(outfitId: string) {
  const { profile } = await requireProfile();
  const outfit = await db.outfit.findFirst({ where: { id: outfitId, profileId: profile.id }, include: { items: true } });
  if (!outfit) throw new Error("Outfit not found.");
  await db.item.updateMany({
    where: { id: { in: outfit.items.map((i) => i.itemId) }, profileId: profile.id },
    data: { inWashSince: new Date() },
  });
  revalidatePath("/", "layout");
}
