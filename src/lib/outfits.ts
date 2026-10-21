import "server-only";
import { z } from "zod";
import type { Item } from "@/generated/prisma/client";
import { FORMALITY, parseList, type Advice } from "./garment";
import { generateJson } from "./gemini";
import type { Locale } from "./i18n";

export type OutfitRequest = {
  occasion: string;
  weather: string;
  notes: string;
  anchorItemId: string | null;
  /** Build every look around a piece that has never been worn. */
  unwornFirst?: boolean;
};

export type DraftOutfit = {
  name: string;
  itemIds: string[];
  reasoning: string;
  advice: Advice[];
};

/** One line per piece: everything the stylist needs, nothing the image adds. */
export function catalogueLine(item: Item) {
  const parts = [
    `id=${item.id}`,
    item.category + (item.subcategory ? `/${item.subcategory}` : ""),
    item.name,
    `colours: ${parseList(item.colors).join(", ") || "unknown"}`,
    item.pattern && item.pattern !== "solid" ? `pattern: ${item.pattern}` : null,
    item.material ? `material: ${item.material}` : null,
    `style: ${parseList(item.styles).join(", ") || "-"}`,
    `seasons: ${parseList(item.seasons).join(", ") || "any"}`,
    `formality: ${FORMALITY[item.formality] ?? "Casual"}`,
    item.favourite ? "a favourite" : null,
    `worn ${item.wearCount}×`,
  ];
  return parts.filter(Boolean).join(" | ");
}

const outfitSchema = z.object({
  outfits: z
    .array(
      z.object({
        name: z.string().describe('A short, evocative name, e.g. "Sunday market", "Quiet confidence"'),
        itemIds: z.array(z.string()).describe("ids of the wardrobe pieces in this outfit, top to toe"),
        reasoning: z.string().describe("Two sentences on why these pieces work together: colour, proportion, mood"),
        advice: z
          .array(
            z.object({
              kind: z.enum(["add", "buy", "swap"]),
              text: z.string().describe("One concrete styling tip in a friendly shop-assistant voice"),
              itemId: z.string().nullable().describe("For add/swap: the id of the wardrobe piece to use"),
              shopFor: z.string().nullable().describe('For buy: a short shopping search, e.g. "tan suede loafers"'),
            }),
          )
          .describe("2–3 tips"),
      }),
    )
    .max(4),
});

const SYSTEM = `You are FITR's stylist: a warm, sharp personal stylist working only with the client's own wardrobe.
Rules for every outfit:
- Use only ids from the wardrobe list. Never invent ids.
- An outfit is complete: either a top and a bottom, or a dress; plus shoes when the wardrobe has any. Add outerwear when the weather calls for it.
- Respect the occasion's formality and the weather. Prefer combinations with a clear colour story.
- Vary the outfits; don't reuse the same main pieces across all of them. Favour pieces worn less often now and then.
Advice for each outfit, 2–3 tips:
- "add": an accessory, bag or layer from the wardrobe (give its itemId) that would lift the look.
- "swap": an alternative wardrobe piece (give its itemId) for a different mood.
- "buy": something the wardrobe lacks that would make this outfit sing; give a concrete shopFor search. Include at least one "buy" tip across the set when the wardrobe has a real gap.
Write in the language asked for at the end of the prompt.`;

export async function styleOutfits(items: Item[], request: OutfitRequest, styleNotes: string | null, locale: Locale = "en") {
  const anchor = request.anchorItemId ? items.find((i) => i.id === request.anchorItemId) : null;
  const prompt = [
    `Wardrobe (${items.length} pieces):`,
    ...items.map(catalogueLine),
    "",
    `Occasion: ${request.occasion || "everyday"}`,
    `Weather: ${request.weather || "mild"}`,
    request.notes ? `The client says: ${request.notes}` : null,
    styleNotes ? `The client's taste: ${styleNotes}` : null,
    anchor ? `Every outfit must include id=${anchor.id} (${anchor.name}).` : null,
    request.unwornFirst ? "Build each outfit around a different piece that has been worn 0 times; those are the point of this round." : null,
    "",
    "Put together 3 outfits.",
    locale === "nl" ? "Write every name, reasoning and tip in Dutch." : "Write in British English.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const result = await generateJson({ prompt, schema: outfitSchema, system: SYSTEM });
  return cleanOutfits(result.outfits, items);
}

/**
 * The model's ids are checked against the real wardrobe: unknown ids are
 * dropped, and an outfit left with fewer than two pieces is not an outfit.
 */
export function cleanOutfits(drafts: DraftOutfit[], items: Item[]): DraftOutfit[] {
  const known = new Set(items.map((i) => i.id));
  return drafts
    .map((o) => ({
      ...o,
      itemIds: [...new Set(o.itemIds)].filter((id) => known.has(id)),
      advice: o.advice
        .map((a) => ({ ...a, itemId: a.itemId && known.has(a.itemId) ? a.itemId : null }))
        .filter((a) => a.kind === "buy" || a.itemId),
    }))
    .filter((o) => o.itemIds.length >= 2);
}

// English and Dutch colour words, since a Dutch profile's pieces are tagged in Dutch.
const NEUTRALS =
  /black|white|grey|gray|navy|beige|cream|camel|tan|brown|denim|ecru|stone|khaki|charcoal|zwart|wit|grijs|marine|crème|creme|bruin|steen|kaki|antraciet|zand/i;

function seasonFor(weather: string) {
  if (/cold|freez|snow|winter/i.test(weather)) return "winter";
  if (/hot|warm|sun|summer/i.test(weather)) return "summer";
  return null;
}

/**
 * Without Gemini: simple rules that still give sensible outfits — a complete
 * base, at least one neutral piece so colours don't fight, and a jacket when
 * the weather is cold.
 */
export function ruleOutfits(items: Item[], request: OutfitRequest, count = 3): DraftOutfit[] {
  const season = seasonFor(request.weather);
  const suits = (i: Item) => {
    const seasons = parseList(i.seasons);
    return !season || seasons.length === 0 || seasons.includes(season);
  };
  const pool = (category: string) =>
    items.filter((i) => i.category === category && suits(i)).sort(() => Math.random() - 0.5);
  const neutral = (i: Item) => parseList(i.colors).some((c) => NEUTRALS.test(c));

  const tops = pool("top");
  const bottoms = pool("bottom");
  const dresses = pool("dress");
  const shoes = pool("shoes");
  const outer = pool("outerwear");
  const anchor = items.find((i) => i.id === request.anchorItemId);
  // Never-worn first when asked, so the simple matcher honours the overview's request too.
  if (request.unwornFirst) for (const list of [tops, bottoms, dresses]) list.sort((a, b) => Number(a.wearCount > 0) - Number(b.wearCount > 0));

  const outfits: DraftOutfit[] = [];
  for (let n = 0; n < count * 4 && outfits.length < count; n++) {
    let base: Item[] = [];
    const useDress = dresses.length > 0 && (tops.length === 0 || bottoms.length === 0 || n % 3 === 2);
    if (anchor?.category === "dress" || (useDress && anchor?.category !== "top" && anchor?.category !== "bottom")) {
      const dress = anchor?.category === "dress" ? anchor : dresses[n % dresses.length];
      if (dress) base = [dress];
    } else if (tops.length && bottoms.length) {
      const top = anchor?.category === "top" ? anchor : tops[n % tops.length];
      const bottom = anchor?.category === "bottom" ? anchor : bottoms[(n * 7) % bottoms.length];
      if (!neutral(top) && !neutral(bottom)) continue;
      base = [top, bottom];
    }
    if (base.length === 0) break;

    const pieces = [...base];
    if (season === "winter" && outer.length) pieces.unshift(outer[n % outer.length]);
    if (anchor?.category === "outerwear" && !pieces.includes(anchor)) pieces.unshift(anchor);
    const shoe = anchor?.category === "shoes" ? anchor : shoes[n % Math.max(1, shoes.length)];
    if (shoe) pieces.push(shoe);

    const key = pieces.map((p) => p.id).sort().join();
    if (outfits.some((o) => [...o.itemIds].sort().join() === key)) continue;
    outfits.push({
      name: `Look ${outfits.length + 1}`,
      itemIds: pieces.map((p) => p.id),
      reasoning: "Matched by simple colour rules: a complete base with at least one neutral to anchor it.",
      advice: [],
    });
  }
  return outfits;
}
