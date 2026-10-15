"use server";

import { revalidatePath } from "next/cache";
import { analyseWardrobe } from "./advice";
import { requireUser } from "./auth";
import { db } from "./db";
import { aiEnabled, describeAiError } from "./gemini";
import { normalisePhoto } from "./images";
import { deleteStored, saveFile } from "./storage";

export type FormState = { error?: string; saved?: boolean } | undefined;

export async function saveStyleNotes(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const notes = String(form.get("styleNotes") ?? "").trim().slice(0, 600);
  await db.user.update({ where: { id: user.id }, data: { styleNotes: notes || null } });
  revalidatePath("/me");
  return { saved: true };
}

export async function addSelfPhoto(form: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo of yourself." };
  try {
    const photo = await normalisePhoto(Buffer.from(await file.arrayBuffer()));
    const path = await saveFile(user.id, photo.data, "self");
    await db.selfPhoto.create({ data: { userId: user.id, path } });
  } catch {
    return { error: "That file isn't a photo Fitr can read. Use a JPEG or PNG." };
  }
  revalidatePath("/me");
  return {};
}

export async function deleteSelfPhoto(id: string) {
  const user = await requireUser();
  const photo = await db.selfPhoto.findFirst({ where: { id, userId: user.id }, include: { tryOns: true } });
  if (!photo) return;
  await db.selfPhoto.delete({ where: { id } });
  await deleteStored(photo.path, ...photo.tryOns.map((t) => t.resultPath));
  revalidatePath("/me");
}

export async function refreshInsight(): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!aiEnabled()) return { error: "Add a GEMINI_API_KEY to get wardrobe advice." };
  const items = await db.item.findMany({ where: { userId: user.id } });
  if (items.length < 3) return { error: "Add at least three pieces first, so there's something to go on." };
  try {
    const insight = await analyseWardrobe(items, user.styleNotes);
    await db.$transaction([
      db.insight.deleteMany({ where: { userId: user.id } }),
      db.insight.create({ data: { userId: user.id, content: JSON.stringify(insight), itemCount: items.length } }),
    ]);
  } catch (error) {
    return { error: describeAiError(error) };
  }
  revalidatePath("/tips");
  return {};
}
