"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "./auth";
import { db } from "./db";
import { CATEGORY_KEYS, SEASONS } from "./garment";
import { aiEnabled, describeAiError } from "./gemini";
import { translator } from "./i18n";
import { describeImageError, generateImage, imageAiEnabled } from "./image-gen";
import { makeListing, normalisePhoto, toJpeg, type Box } from "./images";
import { profileLocale } from "./locale";
import { deleteStored, readStored, saveFile } from "./storage";
import { detectItems } from "./vision";

export type AddedItem = { id: string; name: string; imagePath: string; category: string; colors: string[] };

export type AddPhotoResult =
  | { ok: true; items: AddedItem[]; warning?: string }
  | { ok: false; error: string };

/** Saves both images for one piece; the cut-out is optional. */
async function saveImages(userId: string, photo: { data: Buffer; width: number; height: number }, box?: Box) {
  const { listing, cutout } = await makeListing(photo.data, photo.width, photo.height, box);
  return {
    imagePath: await saveFile(userId, listing, "item"),
    cutoutPath: cutout ? await saveFile(userId, cutout, "cutout", "png") : null,
  };
}

const MAX_UPLOAD = 15 * 1024 * 1024;

/**
 * One photo in, one or more wardrobe items out. Without Gemini (no key, quota
 * spent) the photo still becomes a single item the user can tag by hand, so an
 * upload is never lost to an AI hiccup.
 */
export async function addPhoto(form: FormData): Promise<AddPhotoResult> {
  const { user, profile } = await requireProfile();
  const locale = profileLocale(profile);
  const t = translator(locale);
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: t("err.choosePhoto") };
  if (file.size > MAX_UPLOAD) return { ok: false, error: t("err.tooLarge") };

  let photo;
  try {
    photo = await normalisePhoto(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: t("err.notPhoto") };
  }
  const photoPath = await saveFile(user.id, photo.data, "photo");

  let warning: string | undefined;
  if (aiEnabled()) {
    try {
      const detected = await detectItems(photo.data, locale);
      if (detected.length === 0) {
        await deleteStored(photoPath);
        return { ok: false, error: t("err.noClothing") };
      }
      const created: AddedItem[] = [];
      for (const d of detected) {
        const images = await saveImages(user.id, photo, d.box as Box);
        const item = await db.item.create({
          data: {
            userId: user.id,
            profileId: profile.id,
            name: d.name,
            category: d.category,
            subcategory: d.subcategory || null,
            colors: JSON.stringify(d.colors.slice(0, 3)),
            colorHex: /^#[0-9a-f]{6}$/i.test(d.colorHex) ? d.colorHex : null,
            pattern: d.pattern || null,
            material: d.material || null,
            styles: JSON.stringify(d.styles.slice(0, 4)),
            seasons: JSON.stringify(d.seasons),
            formality: d.formality,
            brand: d.brand || null,
            description: d.description || null,
            photoPath,
            ...images,
            aiTagged: true,
          },
        });
        created.push({
          id: item.id,
          name: item.name,
          imagePath: item.imagePath,
          category: item.category,
          colors: d.colors.slice(0, 3),
        });
      }
      revalidatePath("/", "layout");
      return { ok: true, items: created };
    } catch (error) {
      warning = `${describeAiError(error)} ${t("err.untagged")}`;
    }
  }

  const item = await db.item.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      name: t("common.new"),
      category: "top",
      photoPath,
      ...(await saveImages(user.id, photo)),
    },
  });
  revalidatePath("/", "layout");
  return {
    ok: true,
    items: [{ id: item.id, name: item.name, imagePath: item.imagePath, category: item.category, colors: [] }],
    warning: warning ?? t("err.noAiTag"),
  };
}

async function ownItem(profileId: string, id: string) {
  const item = await db.item.findFirst({ where: { id, profileId } });
  if (!item) throw new Error("Item not found.");
  return item;
}

const splitWords = (value: string) =>
  value
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

const editSchema = z.object({
  name: z.string().trim().min(1, "err.itemName").max(80, "err.itemName"),
  category: z.enum(CATEGORY_KEYS),
  subcategory: z.string().trim().max(60),
  brand: z.string().trim().max(60),
  colors: z.string().max(120),
  styles: z.string().max(160),
  material: z.string().trim().max(60),
  pattern: z.string().trim().max(60),
  formality: z.coerce.number().int().min(1).max(5),
  description: z.string().trim().max(600),
});

export type EditState = { error?: string; saved?: boolean } | undefined;

export async function updateItem(id: string, _: EditState, form: FormData): Promise<EditState> {
  const { profile } = await requireProfile();
  await ownItem(profile.id, id);
  const parsed = editSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const t = translator(profileLocale(profile));
    const issue = parsed.error.issues[0];
    return { error: issue.message === "err.itemName" ? t("err.itemName") : issue.message };
  }
  const v = parsed.data;
  const seasons = form.getAll("seasons").filter((s): s is (typeof SEASONS)[number] =>
    (SEASONS as readonly string[]).includes(String(s)),
  );
  await db.item.update({
    where: { id },
    data: {
      name: v.name,
      category: v.category,
      subcategory: v.subcategory || null,
      brand: v.brand || null,
      colors: JSON.stringify(splitWords(v.colors)),
      styles: JSON.stringify(splitWords(v.styles)),
      material: v.material || null,
      pattern: v.pattern || null,
      formality: v.formality,
      description: v.description || null,
      seasons: JSON.stringify(seasons),
      aiTagged: true,
    },
  });
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function toggleFavourite(id: string) {
  const { profile } = await requireProfile();
  const item = await ownItem(profile.id, id);
  await db.item.update({ where: { id }, data: { favourite: !item.favourite } });
  revalidatePath("/", "layout");
}

export async function markWorn(id: string) {
  const { profile } = await requireProfile();
  await ownItem(profile.id, id);
  await db.item.update({ where: { id }, data: { wearCount: { increment: 1 }, lastWornAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function deleteItem(id: string) {
  const { profile } = await requireProfile();
  const item = await ownItem(profile.id, id);
  await db.item.delete({ where: { id } });
  // Several items can share one original photo; only remove it with the last.
  const sharing = await db.item.count({ where: { photoPath: item.photoPath } });
  await deleteStored(item.imagePath, item.cutoutPath, sharing === 0 ? item.photoPath : null);
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Re-shoots the listing as a clean product photo with an image model. Paid with
 * every provider, so it is only offered when one is set up (see image-gen.ts).
 */
export async function makeStudioPhoto(id: string): Promise<{ error?: string }> {
  const { user, profile } = await requireProfile();
  const item = await ownItem(profile.id, id);
  if (!imageAiEnabled()) return { error: translator(profileLocale(profile))("err.studioKey") };
  try {
    const source = await readStored(item.imagePath);
    const result = await generateImage(
      `Turn this into a clean e-commerce product photo of only the ${item.name}. ` +
        "Show the piece alone, neatly presented as a ghost-mannequin or flat-lay shot, centred on a plain soft light-grey studio background with gentle shadow. " +
        "Keep its exact colours, fabric, proportions, logos and details. Portrait 4:5 framing. No text, no people, no props.",
      [{ data: source }],
    );
    // Cut out and framed like every other listing, whatever the model framed.
    const { listing, cutout } = await makeListing(await toJpeg(result), 0, 0);
    await db.item.update({
      where: { id },
      data: {
        imagePath: await saveFile(user.id, listing, "studio"),
        cutoutPath: cutout ? await saveFile(user.id, cutout, "cutout", "png") : item.cutoutPath,
      },
    });
    await deleteStored(item.imagePath, cutout ? item.cutoutPath : null);
    revalidatePath("/", "layout");
    return {};
  } catch (error) {
    return { error: describeImageError(error) };
  }
}
