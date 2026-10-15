/**
 * The wardrobe's vocabulary, shared by the AI prompts, the forms and the
 * filters so all three agree on what a "category" is.
 */
export const CATEGORIES = {
  top: { label: "Tops", one: "Top" },
  bottom: { label: "Bottoms", one: "Bottom" },
  dress: { label: "Dresses", one: "Dress" },
  outerwear: { label: "Outerwear", one: "Outerwear" },
  shoes: { label: "Shoes", one: "Shoes" },
  bag: { label: "Bags", one: "Bag" },
  accessory: { label: "Accessories", one: "Accessory" },
} as const;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && value in CATEGORIES;
}

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const FORMALITY = ["", "Lounge", "Casual", "Smart casual", "Business", "Formal"] as const;

export type AdviceKind = "add" | "buy" | "swap";

/** One styling note attached to an outfit. */
export type Advice = {
  kind: AdviceKind;
  text: string;
  /** For `add` and `swap`: the wardrobe piece being suggested. */
  itemId?: string | null;
  /** For `buy`: a short shopping search, "white leather low-top trainers". */
  shopFor?: string | null;
};

export function parseList(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function parseAdvice(json: string | null | undefined): Advice[] {
  if (!json) return [];
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? (value as Advice[]) : [];
  } catch {
    return [];
  }
}

/** A shopping search the user can open in a new tab; no affiliate, no tracking. */
export function shopUrl(query: string) {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}
