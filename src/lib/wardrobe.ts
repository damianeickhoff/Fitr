/**
 * The small notes the wardrobe shows under a piece, and the "last worn" words
 * on every card. Most pieces get no note: a note appears only when it says
 * something, so the few that do stand out. Pure, so it can be tested without
 * a database.
 */
import { capitalise, monthName, shortDate, translator, type Translate } from "./i18n";

/** Per-device settings, read on the server so the first paint already matches. */
export const FADE_COOKIE = "fitr_fade";
export const VIEW_COOKIE = "fitr_view";

export type NoteTone = "green" | "blue" | "amber";
export type WardrobeNote = { text: string; tone: NoteTone };

type NoteInput = { id: string; wearCount: number; lastWornAt: Date | null; createdAt: Date };

/** Not worn for this long and a piece counts as forgotten: it fades and gets a nudge. */
export const IDLE_DAYS = 60;
/** A piece that has never been worn is "new" for this long, then forgotten. */
const NEW_DAYS = 30;
/** A never-worn piece older than this goes in the overview's "over three months" group. */
export const LONG_UNWORN_DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;

const english = translator("en");

export function isIdle(item: NoteInput, now = new Date()) {
  const reference = item.lastWornAt ?? item.createdAt;
  const limit = item.lastWornAt ? IDLE_DAYS : NEW_DAYS;
  return now.getTime() - reference.getTime() > limit * DAY;
}

export function wardrobeNotes(items: NoteInput[], now = new Date(), t: Translate = english) {
  const notes = new Map<string, WardrobeNote>();
  const mostWorn = items.reduce<NoteInput | null>((best, i) => (i.wearCount > (best?.wearCount ?? 0) ? i : best), null);

  for (const item of items) {
    if (isIdle(item, now)) {
      notes.set(item.id, {
        text: item.lastWornAt ? t("note.notSince", { month: monthName(item.lastWornAt, now, t.locale) }) : t("note.neverYet"),
        tone: "amber",
      });
    } else if (item.wearCount === 0) {
      notes.set(item.id, { text: t("note.stillToWear"), tone: "blue" });
    } else if (item.id === mostWorn?.id && item.wearCount >= 3) {
      notes.set(item.id, { text: t("note.mostWorn"), tone: "green" });
    }
  }
  return notes;
}

/**
 * When a piece was last worn, as people say it: "Worn yesterday", "3 days
 * ago", "2 weeks ago", then the month once it is further back than a month.
 * `never` is true for a piece still waiting for its first outing, which the
 * cards colour in the accent so it stands out.
 */
export function wornLabel(item: { wearCount: number; lastWornAt: Date | null }, now = new Date(), t: Translate = english) {
  if (!item.lastWornAt || item.wearCount === 0) return { text: t("worn.never"), never: true };
  const days = Math.floor((now.getTime() - item.lastWornAt.getTime()) / DAY);
  if (days <= 0) return { text: t("worn.today"), never: false };
  if (days === 1) return { text: t("worn.yesterday"), never: false };
  if (days < 7) return { text: t("worn.days", { n: days }), never: false };
  if (days < 35) return { text: t.count("worn.weeks", Math.floor(days / 7)), never: false };
  return { text: capitalise(monthName(item.lastWornAt, now, t.locale)), never: false };
}

/** "Added 14 March": how long a never-worn piece has been waiting. */
export function addedLabel(item: { createdAt: Date }, now = new Date(), t: Translate = english) {
  return t("worn.added", { date: shortDate(item.createdAt, now, t.locale) });
}

/** Never-worn pieces, oldest first, split into the long-waiting and the recent. */
export function neverWorn<T extends NoteInput>(items: T[], now = new Date()) {
  const unworn = items.filter((i) => i.wearCount === 0).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const cutoff = now.getTime() - LONG_UNWORN_DAYS * DAY;
  return {
    old: unworn.filter((i) => i.createdAt.getTime() < cutoff),
    recent: unworn.filter((i) => i.createdAt.getTime() >= cutoff),
  };
}

/**
 * A piece left in the wash longer than this quietly counts as back: people
 * forget to flip the toggle, and a forgotten one must not hide a piece for good.
 */
export const WASH_DAYS = 14;

/** Whether a piece is in the wash right now. Every reader goes through this, never `inWashSince` alone. */
export function inWash(item: { inWashSince: Date | null }, now = new Date()) {
  return item.inWashSince !== null && now.getTime() - item.inWashSince.getTime() <= WASH_DAYS * DAY;
}

/** List view order: most recently worn first, never-worn pieces at the end, newest of those first. */
export function byLastWorn<T extends NoteInput>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.lastWornAt && b.lastWornAt) return b.lastWornAt.getTime() - a.lastWornAt.getTime();
    if (a.lastWornAt) return -1;
    if (b.lastWornAt) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
