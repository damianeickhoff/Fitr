import "server-only";
import { z } from "zod";
import { CATEGORY_KEYS, SEASONS } from "./garment";
import { generateJson } from "./gemini";

const detectedItem = z.object({
  name: z.string().describe('Shop-listing title, 2–5 words, e.g. "Navy wool crewneck jumper"'),
  category: z.enum(CATEGORY_KEYS),
  subcategory: z.string().describe('Specific type, e.g. "chelsea boots", "oxford shirt", "midi skirt"'),
  colors: z.array(z.string()).describe("Plain colour names, most dominant first, at most 3"),
  colorHex: z.string().describe("Hex code of the dominant colour, e.g. #1f2a44"),
  pattern: z.string().describe('"solid", "striped", "checked", "floral", "graphic print", …'),
  material: z.string().describe("Best guess at the fabric, e.g. cotton, denim, wool, leather"),
  styles: z.array(z.string()).describe('2–4 style words, e.g. "minimal", "streetwear", "preppy", "boho"'),
  seasons: z.array(z.enum(SEASONS)),
  formality: z.number().int().min(1).max(5).describe("1 lounge, 2 casual, 3 smart casual, 4 business, 5 formal"),
  brand: z.string().nullable().describe("Only if a logo or label is clearly readable, else null"),
  description: z.string().describe("One or two sentences in the voice of a clothing shop: fit, details, how to wear it"),
  box: z
    .array(z.number())
    .length(4)
    .describe("Bounding box of this piece as [ymin, xmin, ymax, xmax], each normalised to 0–1000"),
});

const analysisSchema = z.object({ items: z.array(detectedItem).max(8) });

export type DetectedItem = z.infer<typeof detectedItem>;

const PROMPT = `This photo shows clothing from someone's own wardrobe. They want each piece listed in their personal wardrobe app as if it were a product in a clothing shop.

Find every distinct wearable piece that is clearly the subject of the photo: a garment laid flat or on a hanger, shoes, a bag, a belt, jewellery, a hat. If a person is wearing an outfit, list each visible piece they wear separately. Ignore furniture, hangers, mannequins, background clutter and pieces that are mostly out of frame. If there is no clothing at all, return an empty list.

Describe what you can see; don't invent details. Use British English.`;

export async function detectItems(photo: Buffer): Promise<DetectedItem[]> {
  const result = await generateJson({
    prompt: PROMPT,
    schema: analysisSchema,
    images: [{ data: photo }],
  });
  return result.items;
}
