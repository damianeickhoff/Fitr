"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "./auth";
import { db } from "./db";
import { aiEnabled, describeAiError } from "./gemini";
import { translator } from "./i18n";
import { describeImageError, generateImage, imageAiEnabled, imageProvider } from "./image-gen";
import { normalisePhoto, toJpeg } from "./images";
import { profileLocale } from "./locale";
import { ruleOutfits, styleOutfits, type DraftOutfit, type OutfitRequest } from "./outfits";
import { deleteStored, readStored, saveFile } from "./storage";
import { tryOnPrompt } from "./try-on";

export type GenerateState = { error?: string; notice?: string } | undefined;

export async function generateOutfits(_: GenerateState, form: FormData): Promise<GenerateState> {
  const { user, profile } = await requireProfile();
  const locale = profileLocale(profile);
  const t = translator(locale);
  const items = await db.item.findMany({ where: { profileId: profile.id } });

  const hasBase =
    items.some((i) => i.category === "dress") ||
    (items.some((i) => i.category === "top") && items.some((i) => i.category === "bottom"));
  if (!hasBase) return { error: t("err.needBase") };

  const request: OutfitRequest = {
    occasion: String(form.get("occasion") ?? "").slice(0, 80),
    weather: String(form.get("weather") ?? "").slice(0, 80),
    notes: String(form.get("notes") ?? "").slice(0, 300),
    anchorItemId: String(form.get("anchor") ?? "") || null,
    // From the never-worn overview: every look is built around a piece still waiting for its first outing.
    unwornFirst: form.get("focus") === "unworn",
  };

  let drafts: DraftOutfit[];
  let notice: string | undefined;
  if (aiEnabled()) {
    try {
      drafts = await styleOutfits(items, request, profile.styleNotes, locale);
    } catch (error) {
      drafts = ruleOutfits(items, request);
      notice = `${describeAiError(error)} ${t("err.rulesInstead")}`;
    }
  } else {
    drafts = ruleOutfits(items, request);
    notice = t("err.rulesOnly");
  }
  if (drafts.length === 0) return { error: t("err.noOutfit") };

  // A new round replaces the last round's suggestions the user didn't keep.
  // Stamps step back a millisecond each so newest-first keeps the stylist's order.
  const now = Date.now();
  await db.$transaction([
    db.outfit.deleteMany({ where: { profileId: profile.id, saved: false } }),
    ...drafts.map((d, n) =>
      db.outfit.create({
        data: {
          userId: user.id,
          profileId: profile.id,
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

async function ownOutfit(profileId: string, id: string) {
  const outfit = await db.outfit.findFirst({ where: { id, profileId }, include: { items: true } });
  if (!outfit) throw new Error("Outfit not found.");
  return outfit;
}

export async function toggleSaved(id: string) {
  const { profile } = await requireProfile();
  const outfit = await ownOutfit(profile.id, id);
  await db.outfit.update({ where: { id }, data: { saved: !outfit.saved } });
  revalidatePath("/outfits");
  revalidatePath(`/outfits/${id}`);
}

export async function deleteOutfit(id: string) {
  const { profile } = await requireProfile();
  await ownOutfit(profile.id, id);
  const tryOns = await db.tryOn.findMany({ where: { outfitId: id } });
  await db.outfit.delete({ where: { id } });
  await deleteStored(...tryOns.map((t) => t.resultPath));
  revalidatePath("/outfits");
  redirect("/outfits");
}

/** Takes up an "add" tip: the suggested piece joins the look for good. */
export async function addToOutfit(outfitId: string, itemId: string) {
  const { profile } = await requireProfile();
  const outfit = await ownOutfit(profile.id, outfitId);
  const item = await db.item.findFirst({ where: { id: itemId, profileId: profile.id } });
  if (!item || outfit.items.some((i) => i.itemId === itemId)) return;
  await db.outfitItem.create({ data: { outfitId, itemId, position: outfit.items.length } });
  revalidatePath(`/outfits/${outfitId}`);
  revalidatePath("/outfits");
}

/** "Wore it today": counts towards every piece, which steers future suggestions. */
export async function woreOutfit(id: string) {
  const { profile } = await requireProfile();
  const outfit = await ownOutfit(profile.id, id);
  await db.item.updateMany({
    where: { id: { in: outfit.items.map((i) => i.itemId) }, profileId: profile.id },
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
  const { user, profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  if (!imageAiEnabled()) return { error: t("err.tryOnKey") };
  const outfit = await db.outfit.findFirst({
    where: { id: outfitId, profileId: profile.id },
    include: { items: { include: { item: true }, orderBy: { position: "asc" } } },
  });
  const self = await db.selfPhoto.findFirst({ where: { id: String(form.get("selfPhoto")), profileId: profile.id } });
  if (!outfit || !self) return { error: t("err.pickPhoto") };

  try {
    const person = await readStored(self.path);
    const pieces = await Promise.all(outfit.items.map((oi) => readStored(oi.item.imagePath)));
    const result = await generateImage(
      tryOnPrompt(outfit.items.map((oi) => oi.item.name)),
      [{ data: person }, ...pieces.map((data) => ({ data }))],
      profile.imageProvider,
    );
    const resultPath = await saveFile(user.id, await toJpeg(result), "tryon");
    await db.tryOn.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        outfitId,
        selfPhotoId: self.id,
        resultPath,
        source: imageProvider(profile.imageProvider) ?? "openai",
      },
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
  const { user, profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const outfit = await db.outfit.findFirst({ where: { id: outfitId, profileId: profile.id } });
  const self = await db.selfPhoto.findFirst({ where: { id: String(form.get("selfPhoto")), profileId: profile.id } });
  if (!outfit || !self) return { error: t("err.pickPhoto") };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: t("err.chooseResult") };

  try {
    const photo = await normalisePhoto(Buffer.from(await file.arrayBuffer()));
    const resultPath = await saveFile(user.id, photo.data, "tryon");
    await db.tryOn.create({
      data: { userId: user.id, profileId: profile.id, outfitId, selfPhotoId: self.id, resultPath, source: "chatgpt-app" },
    });
  } catch {
    return { error: t("err.notResult") };
  }
  revalidatePath(`/outfits/${outfitId}`);
  return {};
}

export async function deleteTryOn(id: string) {
  const { profile } = await requireProfile();
  const tryOn = await db.tryOn.findFirst({ where: { id, profileId: profile.id } });
  if (!tryOn) return;
  await db.tryOn.delete({ where: { id } });
  await deleteStored(tryOn.resultPath);
  revalidatePath(`/outfits/${tryOn.outfitId}`);
}
