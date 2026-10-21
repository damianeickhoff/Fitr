"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { analyseWardrobe } from "./advice";
import { rememberProfile, requireProfile } from "./auth";
import { accentIsReadable } from "./colour";
import { db } from "./db";
import { aiEnabled, describeAiError } from "./gemini";
import { isLocale, translator } from "./i18n";
import { normalisePhoto } from "./images";
import { profileLocale } from "./locale";
import { deleteStored, saveFile } from "./storage";

export type FormState = { error?: string; saved?: boolean } | undefined;

export async function saveStyleNotes(_: FormState, form: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  const notes = String(form.get("styleNotes") ?? "").trim().slice(0, 600);
  await db.profile.update({ where: { id: profile.id }, data: { styleNotes: notes || null } });
  revalidatePath("/me");
  return { saved: true };
}

export async function addSelfPhoto(form: FormData): Promise<{ error?: string }> {
  const { user, profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: t("err.selfPhoto") };
  try {
    const photo = await normalisePhoto(Buffer.from(await file.arrayBuffer()));
    const path = await saveFile(user.id, photo.data, "self");
    await db.selfPhoto.create({ data: { userId: user.id, profileId: profile.id, path } });
  } catch {
    return { error: t("err.notPhoto") };
  }
  revalidatePath("/me");
  return {};
}

export async function deleteSelfPhoto(id: string) {
  const { profile } = await requireProfile();
  const photo = await db.selfPhoto.findFirst({ where: { id, profileId: profile.id }, include: { tryOns: true } });
  if (!photo) return;
  await db.selfPhoto.delete({ where: { id } });
  await deleteStored(photo.path, ...photo.tryOns.map((t) => t.resultPath));
  revalidatePath("/me");
}

export async function refreshInsight(): Promise<{ error?: string }> {
  const { user, profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  if (!aiEnabled()) return { error: t("err.adviceKey") };
  const items = await db.item.findMany({ where: { profileId: profile.id } });
  if (items.length < 3) return { error: t("err.threePieces") };
  try {
    const insight = await analyseWardrobe(items, profile.styleNotes, profileLocale(profile));
    await db.$transaction([
      db.insight.deleteMany({ where: { profileId: profile.id } }),
      db.insight.create({
        data: { userId: user.id, profileId: profile.id, content: JSON.stringify(insight), itemCount: items.length },
      }),
    ]);
  } catch (error) {
    return { error: describeAiError(error) };
  }
  revalidatePath("/tips");
  return {};
}

/** Another member of the household takes over this device: no password, just their name. */
export async function switchProfile(id: string) {
  const { user } = await requireProfile();
  const profile = await db.profile.findFirst({ where: { id, userId: user.id } });
  if (!profile) return;
  await rememberProfile(profile.id);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function createProfile(_: FormState, form: FormData): Promise<FormState> {
  const { user, profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: t("err.profileName") };
  // A new profile starts in the language of whoever made it; they can change it on its own Me page.
  const created = await db.profile.create({ data: { userId: user.id, name, locale: profile.locale } });
  await rememberProfile(created.id);
  revalidatePath("/", "layout");
  redirect("/me");
}

export async function renameProfile(_: FormState, form: FormData): Promise<FormState> {
  const { profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: t("err.profileName") };
  await db.profile.update({ where: { id: profile.id }, data: { name } });
  revalidatePath("/", "layout");
  return { saved: true };
}

/** Removes the open profile with everything it owns, photos on disk included. The last profile stays. */
export async function deleteProfile(): Promise<{ error?: string }> {
  const { user, profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const others = await db.profile.count({ where: { userId: user.id, id: { not: profile.id } } });
  if (others === 0) return { error: t("err.lastProfile") };

  const [items, selfPhotos, tryOns] = await Promise.all([
    db.item.findMany({ where: { profileId: profile.id }, select: { photoPath: true, imagePath: true, cutoutPath: true } }),
    db.selfPhoto.findMany({ where: { profileId: profile.id }, select: { path: true } }),
    db.tryOn.findMany({ where: { profileId: profile.id }, select: { resultPath: true } }),
  ]);
  await db.profile.delete({ where: { id: profile.id } });
  await deleteStored(
    ...items.flatMap((i) => [i.photoPath, i.imagePath, i.cutoutPath]),
    ...selfPhotos.map((p) => p.path),
    ...tryOns.map((r) => r.resultPath),
  );
  const next = await db.profile.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  if (next) await rememberProfile(next.id);
  revalidatePath("/", "layout");
  redirect("/me");
}

export type AppearanceState = { error?: string; saved?: boolean } | undefined;

/** The accent colour and language of the open profile. Saved as soon as they change. */
export async function saveAppearance(_: AppearanceState, form: FormData): Promise<AppearanceState> {
  const { profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const accent = String(form.get("accent") ?? profile.accent).toLowerCase();
  const locale = form.get("locale");
  if (!accentIsReadable(accent)) return { error: t("err.accent") };
  await db.profile.update({
    where: { id: profile.id },
    data: { accent, locale: isLocale(locale) ? locale : profile.locale },
  });
  revalidatePath("/", "layout");
  return { saved: true };
}
