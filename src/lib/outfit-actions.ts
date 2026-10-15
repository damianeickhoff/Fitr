"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import { db } from "./db";
import { aiEnabled, describeAiError } from "./gemini";
import { describeImageError, generateImage, imageAiEnabled, imageProvider } from "./image-gen";
import { normalisePhoto, toJpeg } from "./images";
import { ruleOutfits, styleOutfits, type DraftOutfit, type OutfitRequest } from "./outfits";
import { deleteStored, readStored, saveFile } from "./storage";
import { tryOnPrompt } from "./try-on";

export type GenerateState = { error?: string; notice?: string } | undefined;

export async function generateOutfits(_: GenerateState, form: FormData): Promise<GenerateState> {
  const user = await requireUser();
  const items = await db.item.findMany({ where: { userId: user.id } });

  const hasBase =
    items.some((i) => i.category === "dress") ||
    (items.some((i) => i.category === "top") && items.some((i) => i.category === "bottom"));
  if (!hasBase) return { error: "Add at least a top and a bottom (or a dress) to get outfits." };

  const request: OutfitRequest = {
    occasion: String(form.get("occasion") ?? "").slice(0, 80),
    weather: String(form.get("weather") ?? "").slice(0, 80),
    notes: String(form.get("notes") ?? "").slice(0, 300),
    anchorItemId: String(form.get("anchor") ?? "") || null,
  };

  let drafts: DraftOutfit[];
  let notice: string | undefined;
  if (aiEnabled()) {
    try {
      drafts = await styleOutfits(items, request, user.styleNotes);
    } catch (error) {
      drafts = ruleOutfits(items, request);
      notice = `${describeAiError(error)} These were matched by simple rules instead.`;
    }
  } else {
    drafts = ruleOutfits(items, request);
    notice = "Matched by simple rules. Add a GEMINI_API_KEY for styled outfits with advice.";
  }
  if (drafts.length === 0) return { error: "Couldn't put a complete outfit together from these pieces. Add a few more." };

  // A new round replaces the last round's suggestions the user didn't keep.
  // Stamps step back a millisecond each so newest-first keeps the stylist's order.
  const now = Date.now();
  await db.$transaction([
    db.outfit.deleteMany({ where: { userId: user.id, saved: false } }),
    ...drafts.map((d, n) =>
      db.outfit.create({
        data: {
          userId: user.id,
          createdAt: new Date(now - n),
          name: d.name,
          occasion: request.occasion || null,
          reasoning: d.reasoning,
          advice: JSON.stringify(d.advice),
          items: { create: d.itemIds.map((itemId, position) => ({ itemId, position })) },
        },
      }),
    ),
  ]);
  revalidatePath("/outfits");
  return { notice };
}

async function ownOutfit(userId: string, id: string) {
  const outfit = await db.outfit.findFirst({ where: { id, userId }, include: { items: true } });
  if (!outfit) throw new Error("Outfit not found.");
  return outfit;
}

export async function toggleSaved(id: string) {
  const user = await requireUser();
  const outfit = await ownOutfit(user.id, id);
  await db.outfit.update({ where: { id }, data: { saved: !outfit.saved } });
  revalidatePath("/outfits");
  revalidatePath(`/outfits/${id}`);
}

export async function deleteOutfit(id: string) {
  const user = await requireUser();
  await ownOutfit(user.id, id);
  const tryOns = await db.tryOn.findMany({ where: { outfitId: id } });
  await db.outfit.delete({ where: { id } });
  await deleteStored(...tryOns.map((t) => t.resultPath));
  revalidatePath("/outfits");
  redirect("/outfits");
}

/** Takes up an "add" tip: the suggested piece joins the look for good. */
export async function addToOutfit(outfitId: string, itemId: string) {
  const user = await requireUser();
  const outfit = await ownOutfit(user.id, outfitId);
  const item = await db.item.findFirst({ where: { id: itemId, userId: user.id } });
  if (!item || outfit.items.some((i) => i.itemId === itemId)) return;
  await db.outfitItem.create({ data: { outfitId, itemId, position: outfit.items.length } });
  revalidatePath(`/outfits/${outfitId}`);
  revalidatePath("/outfits");
}

/** "Wore it today": counts towards every piece, which steers future suggestions. */
export async function woreOutfit(id: string) {
  const user = await requireUser();
  const outfit = await ownOutfit(user.id, id);
  await db.item.updateMany({
    where: { id: { in: outfit.items.map((i) => i.itemId) }, userId: user.id },
    data: { wearCount: { increment: 1 }, lastWornAt: new Date() },
  });
  if (!outfit.saved) await db.outfit.update({ where: { id }, data: { saved: true } });
  revalidatePath("/", "layout");
}

export type TryOnState = { error?: string } | undefined;

/**
 * Dresses the user's own photo in the outfit with an image model. The pieces
 * go in as their listing images, in outfit order, after the person.
 */
export async function tryOn(outfitId: string, _: TryOnState, form: FormData): Promise<TryOnState> {
  const user = await requireUser();
  if (!imageAiEnabled()) return { error: "Try-on needs an image model. Add an OPENAI_API_KEY." };
  const outfit = await db.outfit.findFirst({
    where: { id: outfitId, userId: user.id },
    include: { items: { include: { item: true }, orderBy: { position: "asc" } } },
  });
  const self = await db.selfPhoto.findFirst({ where: { id: String(form.get("selfPhoto")), userId: user.id } });
  if (!outfit || !self) return { error: "Pick one of your photos first." };

  try {
    const person = await readStored(self.path);
    const pieces = await Promise.all(outfit.items.map((oi) => readStored(oi.item.imagePath)));
    const result = await generateImage(
      tryOnPrompt(outfit.items.map((oi) => oi.item.name)),
      [{ data: person }, ...pieces.map((data) => ({ data }))],
    );
    const resultPath = await saveFile(user.id, await toJpeg(result), "tryon");
    await db.tryOn.create({
      data: { userId: user.id, outfitId, selfPhotoId: self.id, resultPath, source: imageProvider() ?? "openai" },
    });
    revalidatePath(`/outfits/${outfitId}`);
    return {};
  } catch (error) {
    return { error: describeImageError(error) };
  }
}

/**
 * The free route: the user made the picture in the ChatGPT app on their own
 * subscription and brings it back. Stored exactly like an API result.
 */
export async function addTryOnFromApp(outfitId: string, form: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const outfit = await db.outfit.findFirst({ where: { id: outfitId, userId: user.id } });
  const self = await db.selfPhoto.findFirst({ where: { id: String(form.get("selfPhoto")), userId: user.id } });
  if (!outfit || !self) return { error: "Pick one of your photos first." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the picture ChatGPT made." };

  try {
    const photo = await normalisePhoto(Buffer.from(await file.arrayBuffer()));
    const resultPath = await saveFile(user.id, photo.data, "tryon");
    await db.tryOn.create({ data: { userId: user.id, outfitId, selfPhotoId: self.id, resultPath, source: "chatgpt-app" } });
  } catch {
    return { error: "That file isn't a picture FITR can read. Save it from ChatGPT as an image and try again." };
  }
  revalidatePath(`/outfits/${outfitId}`);
  return {};
}

export async function deleteTryOn(id: string) {
  const user = await requireUser();
  const tryOn = await db.tryOn.findFirst({ where: { id, userId: user.id } });
  if (!tryOn) return;
  await db.tryOn.delete({ where: { id } });
  await deleteStored(tryOn.resultPath);
  revalidatePath(`/outfits/${tryOn.outfitId}`);
}
