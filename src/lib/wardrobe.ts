/**
 * The small notes the wardrobe shows under a piece. Most pieces get none: a
 * note appears only when it says something, so the few that do stand out.
 * Pure, so it can be tested without a database.
 */

/** The fade switch's setting, read on the server so the first paint already matches. */
export const FADE_COOKIE = "fitr_fade";

export type NoteTone ="green" | "blue" | "amber";
export type WardrobeNote = { text: string; tone: NoteTone };

type NoteInput = { id: string; wearCount: number; lastWornAt: Date | null; createdAt: Date };

/** Not worn for this long and a piece counts as forgotten: it fades and gets a nudge. */
export const IDLE_DAYS = 60;
/** A piece that has never been worn is "new" for this long, then forgotten. */
const NEW_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

function since(date: Date, now: Date) {
  const month = date.toLocaleString("en-GB", { month: "long" });
  return date.getFullYear() === now.getFullYear() ? month : `${month} ${date.getFullYear()}`;
}

export function isIdle(item: NoteInput, now = new Date()) {
  const reference = item.lastWornAt ?? item.createdAt;
  const limit = item.lastWornAt ? IDLE_DAYS : NEW_DAYS;
  return now.getTime() - reference.getTime() > limit * DAY;
}

export function wardrobeNotes(items: NoteInput[], now = new Date()) {
  const notes = new Map<string, WardrobeNote>();
  const mostWorn = items.reduce<NoteInput | null>((best, i) => (i.wearCount > (best?.wearCount ?? 0) ? i : best), null);

  for (const item of items) {
    if (isIdle(item, now)) {
      notes.set(item.id, {
        text: item.lastWornAt ? `Not worn since ${since(item.lastWornAt, now)}` : "Never worn yet",
        tone: "amber",
      });
    } else if (item.wearCount === 0) {
      notes.set(item.id, { text: "Still to wear", tone: "blue" });
    } else if (item.id === mostWorn?.id && item.wearCount >= 3) {
      notes.set(item.id, { text: "Most worn", tone: "green" });
    }
  }
  return notes;
}
