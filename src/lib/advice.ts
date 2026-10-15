import "server-only";
import { z } from "zod";
import type { Item } from "@/generated/prisma/client";
import { CATEGORY_KEYS } from "./garment";
import { generateJson } from "./gemini";
import { catalogueLine } from "./outfits";

const insightSchema = z.object({
  summary: z.string().describe("Two or three sentences describing this wardrobe's character, addressed to its owner"),
  styleWords: z.array(z.string()).describe("3–5 words that sum up their style"),
  palette: z.array(z.string()).describe("Their 3–6 core colours, as hex codes"),
  buy: z
    .array(
      z.object({
        title: z.string().describe('What to buy, e.g. "White leather trainers"'),
        category: z.enum(CATEGORY_KEYS),
        why: z.string().describe("One or two sentences: the gap it fills and what it would pair with"),
        shopFor: z.string().describe("A short shopping search for it"),
        pairsWith: z.array(z.string()).describe("ids of 2–4 wardrobe pieces it would pair with"),
      }),
    )
    .describe("3–5 purchases that would unlock the most new outfits, best first"),
  accessorise: z
    .array(
      z.object({
        text: z.string().describe("An accessory idea: what to add and how to wear it"),
        pairsWith: z.array(z.string()).describe("ids of the wardrobe pieces it lifts"),
      }),
    )
    .describe("2–4 accessory ideas"),
  rediscover: z
    .array(z.object({ itemId: z.string(), idea: z.string().describe("A fresh way to wear this piece") }))
    .describe("Up to 3 pieces worn rarely, with an idea for each"),
});

export type WardrobeInsight = z.infer<typeof insightSchema>;

export async function analyseWardrobe(items: Item[], styleNotes: string | null): Promise<WardrobeInsight> {
  const prompt = [
    `Wardrobe (${items.length} pieces):`,
    ...items.map(catalogueLine),
    styleNotes ? `\nThe client's taste: ${styleNotes}` : "",
    "\nAnalyse this wardrobe as their personal stylist. Recommend purchases that fit their existing style and would combine with many pieces they already own — not a generic capsule list. Be specific about colour and material. Use only ids from the list. British English.",
  ].join("\n");
  const insight = await generateJson({ prompt, schema: insightSchema });

  const known = new Set(items.map((i) => i.id));
  return {
    ...insight,
    palette: insight.palette.filter((hex) => /^#[0-9a-f]{6}$/i.test(hex)),
    buy: insight.buy.map((b) => ({ ...b, pairsWith: b.pairsWith.filter((id) => known.has(id)) })),
    accessorise: insight.accessorise.map((a) => ({ ...a, pairsWith: a.pairsWith.filter((id) => known.has(id)) })),
    rediscover: insight.rediscover.filter((r) => known.has(r.itemId)),
  };
}

export function parseInsight(json: string): WardrobeInsight | null {
  try {
    return JSON.parse(json) as WardrobeInsight;
  } catch {
    return null;
  }
}
