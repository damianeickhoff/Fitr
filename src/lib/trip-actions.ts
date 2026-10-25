"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Item, Profile, Trip } from "@/generated/prisma/client";
import { requireProfile } from "./auth";
import { db } from "./db";
import { aiEnabled, describeAiError } from "./gemini";
import { translator, type Translate } from "./i18n";
import { profileLocale } from "./locale";
import { MAX_TRIP_DAYS, isDayKey, packRules, packTrip, parsePacking, stayWeather, tripDays, type PackedPiece, type PackingDraft } from "./trips";

export type TripFormState = { error?: string } | undefined;

/** The trip form's fields, checked. The place comes back from the browser, so only coordinates that make sense are kept. */
function readTrip(form: FormData, t: Translate) {
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const placeName = String(form.get("placeName") ?? "").trim().slice(0, 120);
  const latitude = Number(form.get("latitude"));
  const longitude = Number(form.get("longitude"));
  const startDate = String(form.get("startDate") ?? "");
  const endDate = String(form.get("endDate") ?? "");
  const notes = String(form.get("notes") ?? "").trim().slice(0, 300) || null;
  if (!name) return { error: t("trips.err.name") };
  const placed =
    placeName && form.get("latitude") && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  if (!placed) return { error: t("trips.err.place") };
  if (!isDayKey(startDate) || !isDayKey(endDate) || endDate < startDate) return { error: t("trips.err.dates") };
  if (tripDays(startDate, endDate).at(-1) !== endDate) return { error: t("trips.err.tooLong", { n: MAX_TRIP_DAYS }) };
  return { data: { name, placeName, latitude, longitude, startDate, endDate, notes } };
}

/**
 * A new list for the trip: the stylist when there is a key, the rules when
 * there isn't or it fails, so a trip always has something packed. Ticks on
 * pieces that stay on the list are kept.
 */
async function pack(profile: Profile, trip: Trip): Promise<{ draft: PackingDraft; notice?: string }> {
  const locale = profileLocale(profile);
  const t = translator(locale);
  const now = new Date();
  const [items, days] = await Promise.all([db.item.findMany({ where: { profileId: profile.id } }), stayWeather(trip, locale, now)]);
  const rules = (wardrobe: Item[]) => packRules(wardrobe, trip, days, t, now);

  let draft: PackingDraft;
  let notice: string | undefined;
  if (!aiEnabled()) {
    draft = rules(items);
    notice = t("trips.rulesOnly");
  } else {
    try {
      draft = await packTrip(items, trip, days.map((d) => d.sentence), profile.styleNotes, locale);
      if (draft.packing.length === 0) throw new Error("The stylist packed nothing the wardrobe has.");
    } catch (error) {
      draft = rules(items);
      notice = `${describeAiError(error)} ${t("trips.rulesInstead")}`;
    }
  }
  const ticked = new Set(parsePacking(trip.packing).filter((p) => p.packed).map((p) => p.itemId));
  draft.packing = draft.packing.map((p) => (ticked.has(p.itemId) ? { ...p, packed: true } : p));
  await db.trip.update({
    where: { id: trip.id },
    data: { packing: JSON.stringify(draft.packing), advice: JSON.stringify(draft.advice) },
  });
  return { draft, notice };
}

export async function createTrip(_: TripFormState, form: FormData): Promise<TripFormState> {
  const { profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const read = readTrip(form, t);
  if (!read.data) return { error: read.error };
  const trip = await db.trip.create({ data: { profileId: profile.id, ...read.data } });
  // Packed straight away, so the trip opens on a list rather than an empty page.
  const { notice } = await pack(profile, trip);
  revalidatePath("/trips");
  redirect(`/trips/${trip.id}${notice ? "?rules=1" : ""}`);
}

export async function updateTrip(id: string, _: TripFormState, form: FormData): Promise<TripFormState> {
  const { profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const read = readTrip(form, t);
  if (!read.data) return { error: read.error };
  const { count } = await db.trip.updateMany({ where: { id, profileId: profile.id }, data: read.data });
  if (count === 0) return { error: t("trips.err.gone") };
  revalidatePath("/trips");
  revalidatePath(`/trips/${id}`);
  return {};
}

export async function deleteTrip(id: string) {
  const { profile } = await requireProfile();
  await db.trip.deleteMany({ where: { id, profileId: profile.id } });
  revalidatePath("/trips");
  redirect("/trips");
}

export async function repackTrip(id: string): Promise<{ error?: string; notice?: string }> {
  const { profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const trip = await db.trip.findFirst({ where: { id, profileId: profile.id } });
  if (!trip) return { error: t("trips.err.gone") };
  const { draft, notice } = await pack(profile, trip);
  revalidatePath(`/trips/${id}`);
  revalidatePath("/trips");
  if (draft.packing.length === 0) return { error: t("trips.err.empty") };
  return { notice };
}

/** Rewrites one trip's list, for the profile that owns it only. */
async function editPacking(id: string, change: (packing: PackedPiece[], profile: Profile) => PackedPiece[] | Promise<PackedPiece[]>) {
  const { profile } = await requireProfile();
  const trip = await db.trip.findFirst({ where: { id, profileId: profile.id }, select: { packing: true } });
  if (!trip) return;
  const packing = await change(parsePacking(trip.packing), profile);
  await db.trip.update({ where: { id }, data: { packing: JSON.stringify(packing) } });
  revalidatePath(`/trips/${id}`);
  revalidatePath("/trips");
}

export async function setPacked(id: string, itemId: string, packed: boolean) {
  await editPacking(id, (list) => list.map((p) => (p.itemId === itemId ? { ...p, packed: packed || undefined } : p)));
}

export async function removeFromTrip(id: string, itemId: string) {
  await editPacking(id, (list) => list.filter((p) => p.itemId !== itemId));
}

export async function addToTrip(id: string, itemId: string) {
  await editPacking(id, async (list, profile) => {
    if (list.some((p) => p.itemId === itemId)) return list;
    const item = await db.item.findFirst({ where: { id: itemId, profileId: profile.id }, select: { id: true } });
    if (!item) return list;
    return [...list, { itemId: item.id, reason: translator(profileLocale(profile))("trips.why.added") }];
  });
}
