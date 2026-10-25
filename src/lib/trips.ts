import "server-only";
import { z } from "zod";
import type { Item } from "@/generated/prisma/client";
import { parseList, type Season } from "./garment";
import { generateJson } from "./gemini";
import { shortDate, translator, type Locale, type MessageKey, type Translate } from "./i18n";
import { catalogueLine } from "./outfits";
import { dayKey, dayLabel, dayStart, inWash } from "./wardrobe";
import { FORECAST_DAYS, forecastFor, forecastSentence, rainLikely, type Reading } from "./weather";

/** One piece on a trip's packing list. `packed` is ticked off by hand while packing. */
export type PackedPiece = { itemId: string; reason: string; packed?: boolean };

/** Something worth buying for the trip, same shape as an outfit's "buy" advice. */
export type TripTip = { text: string; shopFor?: string | null };

export type TripInput = {
  name: string;
  placeName: string;
  latitude: number;
  startDate: string;
  endDate: string;
  notes: string | null;
};

/** Longer than this and it's a move, not a trip; the list would only repeat itself. */
export const MAX_TRIP_DAYS = 30;

export function parsePacking(json: string | null | undefined): PackedPiece[] {
  try {
    const value = JSON.parse(json ?? "[]");
    return Array.isArray(value)
      ? value.filter((p): p is PackedPiece => typeof p?.itemId === "string" && typeof p?.reason === "string")
      : [];
  } catch {
    return [];
  }
}

export function parseTips(json: string | null | undefined): TripTip[] {
  try {
    const value = JSON.parse(json ?? "[]");
    return Array.isArray(value) ? value.filter((a): a is TripTip => typeof a?.text === "string") : [];
  } catch {
    return [];
  }
}

/** A real calendar day written as "YYYY-MM-DD". */
export function isDayKey(key: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && dayKey(dayStart(key)) === key;
}

/** Every day of the stay, first and last included. */
export function tripDays(startDate: string, endDate: string) {
  const days: string[] = [];
  for (let d = dayStart(startDate); dayKey(d) <= endDate && days.length < MAX_TRIP_DAYS; d.setDate(d.getDate() + 1)) {
    days.push(dayKey(d));
  }
  return days;
}

/** The season a month falls in where the trip goes: the south has summer at Christmas. */
export function monthSeason(key: string, latitude: number): Season {
  const month = Number(key.slice(5, 7)) - 1;
  const shifted = latitude < 0 ? (month + 6) % 12 : month;
  return (["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"] as const)[shifted];
}

/**
 * What a day dresses like. The forecast wins where there is one, with the
 * same thresholds as `seasonFor` for outfits; a mild day stays in the
 * in-between season the month is closest to.
 */
export function daySeason(key: string, latitude: number, reading: Reading | null): Season {
  const month = monthSeason(key, latitude);
  if (!reading) return month;
  if (reading.max < 10) return "winter";
  if (reading.max > 22) return "summer";
  if (month === "spring" || month === "autumn") return month;
  return month === "winter" ? "autumn" : "spring";
}

export type StayDay = {
  date: string;
  /** "forecast" has a reading; "far" is beyond Open-Meteo's range; "past" is over; "unknown" means the fetch failed. */
  state: "forecast" | "far" | "past" | "unknown";
  reading: Reading | null;
  season: Season;
  /** "Mon 3 Nov: 12 to 19 °C, sunny", or the season for a day without a forecast. What the stylist reads. */
  sentence: string;
};

/** The stay day by day, with a forecast for the days Open-Meteo covers. Never throws. */
export async function stayWeather(
  trip: { latitude: number; longitude: number; startDate: string; endDate: string },
  locale: Locale,
  now = new Date(),
): Promise<StayDay[]> {
  const t = translator(locale);
  const dates = tripDays(trip.startDate, trip.endDate);
  const today = dayKey(now);
  const last = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + FORECAST_DAYS - 1));
  const inRange = dates.filter((d) => d >= today && d <= last);
  // Only ask for the weather when a day of the stay can have one.
  const readings = inRange.length ? await forecastFor(trip.latitude, trip.longitude, inRange) : new Map<string, Reading | null>();
  return dates.map((date) => {
    const reading = readings.get(date) ?? null;
    const state = date < today ? "past" : date > last ? "far" : reading ? "forecast" : "unknown";
    const season = daySeason(date, trip.latitude, reading);
    const label = dayLabel(date, now, t);
    const sentence = reading
      ? forecastSentence(reading, t, label)
      : `${label}: ${t("trips.noForecastFor", { season: t(`season.${season}` as MessageKey) })}`;
    return { date, state, reading, season, sentence };
  });
}

/** "12 to 19 °C, rain on 2 days" over the days with a forecast; null when there are none. */
export function weatherSummary(days: StayDay[], t: Translate) {
  const known = days.flatMap((d) => (d.reading ? [d.reading] : []));
  if (known.length === 0) return null;
  const min = Math.min(...known.map((r) => r.min));
  const max = Math.max(...known.map((r) => r.max));
  const wet = known.filter(rainLikely).length;
  const range = t("weather.range", { min, max });
  return wet ? `${range}, ${t.count("trips.rainDays", wet)}` : `${range}, ${t("trips.dry")}`;
}

export type PackingDraft = { packing: PackedPiece[]; advice: TripTip[] };

/** Words in the notes that call for something smarter than everyday clothes. */
const DRESSY = /dinner|wedding|party|meeting|work|business|conference|theatre|opera|gala|diner|bruiloft|feest|vergadering|werk|zakelijk|congres|theater/i;

/**
 * Without Gemini: a sensible suitcase from simple rules. Pieces must suit the
 * seasons of the stay (by forecast where there is one, by month otherwise),
 * counts follow the length (about a top a day, bottoms for every two or
 * three days, two pairs of shoes), a layer comes when it is cool or wet, and
 * plans that sound dressy bring one smarter piece.
 */
export function packRules(
  items: Item[],
  trip: Pick<TripInput, "notes">,
  days: Pick<StayDay, "season" | "reading">[],
  t: Translate,
  now = new Date(),
): PackingDraft {
  const length = Math.max(1, days.length);
  const seasons = new Set(days.map((d) => d.season));
  const wet = days.some((d) => d.reading && rainLikely(d.reading));
  const dressy = DRESSY.test(trip.notes ?? "");
  const target = dressy ? 3 : 2;

  const suits = (i: Item) => {
    const own = parseList(i.seasons);
    return own.length === 0 || own.some((s) => seasons.has(s as Season));
  };
  // Favourites and reliable pieces first; laundry last, since it may not be clean in time.
  const score = (i: Item) =>
    (i.favourite ? 1 : 0) - (inWash(i, now) ? 2 : 0) - Math.abs(i.formality - target) * 0.5 + Math.min(i.wearCount, 20) / 40;
  const pick = (category: string, count: number, strict = false) => {
    const all = items.filter((i) => i.category === category);
    const suiting = all.filter(suits);
    const pool = suiting.length || strict ? suiting : all;
    return [...pool].sort((a, b) => score(b) - score(a)).slice(0, count);
  };

  const chosen: { item: Item; reason: MessageKey; vars?: Record<string, number> }[] = [];
  const dresses = length >= 2 ? pick("dress", 1, true) : [];
  const topCount = Math.min(Math.max(length, 1), 7) - (dresses.length && length > 2 ? 1 : 0);
  const tops = pick("top", topCount);
  for (const top of tops) chosen.push({ item: top, reason: "trips.why.top", vars: { n: tops.length } });
  for (const bottom of pick("bottom", Math.min(Math.max(1, Math.ceil(length / 2.5)), 4))) chosen.push({ item: bottom, reason: "trips.why.bottom" });
  for (const dress of dresses) chosen.push({ item: dress, reason: "trips.why.dress" });
  if (wet || [...seasons].some((s) => s !== "summer")) {
    for (const layer of pick("outerwear", 1)) chosen.push({ item: layer, reason: wet ? "trips.why.rain" : "trips.why.layer" });
  }
  pick("shoes", length >= 2 ? 2 : 1).forEach((shoe, n) => chosen.push({ item: shoe, reason: n === 0 ? "trips.why.shoes" : "trips.why.shoes2" }));
  for (const bag of pick("bag", 1, true)) chosen.push({ item: bag, reason: "trips.why.bag" });
  for (const extra of pick("accessory", length >= 3 ? 2 : 1, true)) chosen.push({ item: extra, reason: "trips.why.accessory" });

  // Dressy plans want at least one piece that can go out to dinner.
  if (dressy && !chosen.some((c) => c.item.formality >= 3 && ["top", "dress", "bottom"].includes(c.item.category))) {
    const smart = items
      .filter((i) => i.formality >= 3 && ["dress", "top", "bottom"].includes(i.category) && !chosen.some((c) => c.item.id === i.id))
      .sort((a, b) => Number(suits(b)) - Number(suits(a)) || score(b) - score(a))[0];
    if (smart) chosen.push({ item: smart, reason: "trips.why.smart" });
  }

  return cleanPacking(
    { packing: chosen.map((c) => ({ itemId: c.item.id, reason: t(c.reason, c.vars) })), advice: [] },
    items,
    t,
    now,
  );
}

/**
 * The model's ids are checked against the real wardrobe: unknown ids and
 * repeats are dropped. A piece in the wash may come along (there is time to
 * wash it before leaving), but its reason says so whoever chose it.
 */
export function cleanPacking(draft: PackingDraft, items: Item[], t: Translate, now = new Date()): PackingDraft {
  const byId = new Map(items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const packing: PackedPiece[] = [];
  for (const p of draft.packing) {
    const item = byId.get(p.itemId);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    const reason = p.reason.trim().slice(0, 140) || t("trips.why.default");
    const flag = t("trips.inWash");
    packing.push({
      itemId: item.id,
      reason: inWash(item, now) && !reason.toLowerCase().includes(flag.toLowerCase()) ? t("trips.reasonInWash", { reason }) : reason,
    });
  }
  const advice = draft.advice
    .map((a) => ({ text: a.text.trim().slice(0, 240), shopFor: a.shopFor?.trim().slice(0, 80) || null }))
    .filter((a) => a.text)
    .slice(0, 3);
  return { packing, advice };
}

const packingSchema = z.object({
  packing: z
    .array(
      z.object({
        itemId: z.string().describe("id of a wardrobe piece to pack"),
        reason: z.string().describe('One short line on why it comes along, e.g. "warm layer for the evenings"'),
      }),
    )
    .describe("The whole suitcase, one entry per piece"),
  advice: z
    .array(
      z.object({
        text: z.string().describe("One concrete tip about something the wardrobe lacks for this trip"),
        shopFor: z.string().nullable().describe('A short shopping search, e.g. "packable rain jacket"'),
      }),
    )
    .max(3)
    .describe("0–3 things worth buying; only for real gaps"),
});

const SYSTEM = `You are FITR's stylist, packing a suitcase for the client from their own wardrobe.
Rules:
- Use only ids from the wardrobe list. Never invent ids. Each piece at most once.
- Cover tops, bottoms (or dresses), shoes, outerwear when the weather or evenings call for it, and a bag and accessories when the wardrobe has them.
- Sensible counts for the length: roughly one top per day, bottoms for every 2–3 days, two pairs of shoes (one comfortable for walking). Cap at about a week's worth: longer trips do laundry.
- Pieces should mix and match into outfits; respect the forecast and the plans in the notes (formal plans need a smarter piece).
- Pieces marked "in the wash now" may come if they matter, but prefer others.
- Each reason is one short line, specific to this trip.
Worth buying: up to three things the wardrobe lacks for this trip (e.g. no rain layer with rain forecast), each with a concrete shopFor search. None when nothing is missing.
Write in the language asked for at the end of the prompt.`;

/** The stylist's packing list for a stay. Throws on AI failure; the caller falls back to `packRules`. */
export async function packTrip(
  items: Item[],
  trip: TripInput,
  forecastSentences: string[],
  styleNotes: string | null,
  locale: Locale = "en",
): Promise<PackingDraft> {
  const now = new Date();
  const days = tripDays(trip.startDate, trip.endDate).length;
  const prompt = [
    `Wardrobe (${items.length} pieces):`,
    ...items.map((i) => catalogueLine(i) + (inWash(i, now) ? " | in the wash now" : "")),
    "",
    `Trip: ${trip.name} to ${trip.placeName}, ${trip.startDate} to ${trip.endDate} (${days} ${days === 1 ? "day" : "days"}).`,
    "Weather day by day:",
    ...forecastSentences,
    trip.notes ? `The client's plans: ${trip.notes}` : null,
    styleNotes ? `The client's taste: ${styleNotes}` : null,
    "",
    locale === "nl" ? "Write every reason and tip in Dutch." : "Write in British English.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const result = await generateJson({ prompt, schema: packingSchema, system: SYSTEM });
  return cleanPacking(result, items, translator(locale), now);
}

/** "2 November – 6 November", with the year where it isn't this one. */
export function tripDates(trip: { startDate: string; endDate: string }, t: Translate, now = new Date()) {
  const start = shortDate(dayStart(trip.startDate), now, t.locale);
  return trip.startDate === trip.endDate ? start : t("trips.dates", { start, end: shortDate(dayStart(trip.endDate), now, t.locale) });
}

/** Whether a trip is under way, still to come (and in how many days), or over. */
export function tripTiming(trip: { startDate: string; endDate: string }, now = new Date()) {
  const today = dayKey(now);
  if (trip.endDate < today) return { kind: "past" as const, days: 0 };
  if (trip.startDate <= today) return { kind: "now" as const, days: 0 };
  const days = Math.round((dayStart(trip.startDate).getTime() - dayStart(today).getTime()) / (24 * 60 * 60 * 1000));
  return { kind: "soon" as const, days };
}
