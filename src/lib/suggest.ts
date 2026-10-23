import { SEASONS, isCategory, parseList, type Season } from "./garment";

/**
 * A piece's details as the edit form holds them: lists joined into the text
 * the inputs show. Shared with the client, so a suggestion from the model can
 * be merged into the form before anything is saved.
 */
export type DetailValues = {
  name: string;
  category: string;
  subcategory: string;
  colors: string;
  colorHex: string;
  brand: string;
  material: string;
  pattern: string;
  styles: string;
  formality: number;
  seasons: Season[];
  description: string;
};

export type DetailKey = keyof DetailValues;

export const DETAIL_KEYS = [
  "name",
  "category",
  "subcategory",
  "colors",
  "colorHex",
  "brand",
  "material",
  "pattern",
  "styles",
  "formality",
  "seasons",
  "description",
] as const satisfies readonly DetailKey[];

type ItemLike = {
  name: string;
  category: string;
  subcategory: string | null;
  colors: string;
  colorHex: string | null;
  brand: string | null;
  material: string | null;
  pattern: string | null;
  styles: string;
  formality: number;
  seasons: string;
  description: string | null;
};

const asSeasons = (list: string[]) => SEASONS.filter((s) => list.includes(s));

export function detailValues(item: ItemLike): DetailValues {
  return {
    name: item.name,
    category: item.category,
    subcategory: item.subcategory ?? "",
    colors: parseList(item.colors).join(", "),
    colorHex: item.colorHex ?? "",
    brand: item.brand ?? "",
    material: item.material ?? "",
    pattern: item.pattern ?? "",
    styles: parseList(item.styles).join(", "),
    formality: item.formality,
    seasons: asSeasons(parseList(item.seasons)),
    description: item.description ?? "",
  };
}

/** The model's answer, shaped like the form. Anything it left blank stays out. */
export function suggestionValues(d: {
  name: string;
  category: string;
  subcategory: string;
  colors: string[];
  colorHex: string;
  pattern: string;
  material: string;
  styles: string[];
  seasons: string[];
  formality: number;
  brand: string | null;
  description: string;
}): Partial<DetailValues> {
  const out: Partial<DetailValues> = {
    name: d.name.trim(),
    category: isCategory(d.category) ? d.category : "",
    subcategory: d.subcategory.trim(),
    colors: d.colors.map((c) => c.trim()).filter(Boolean).slice(0, 3).join(", "),
    colorHex: /^#[0-9a-f]{6}$/i.test(d.colorHex) ? d.colorHex.toLowerCase() : "",
    pattern: d.pattern.trim(),
    material: d.material.trim(),
    styles: d.styles.map((s) => s.trim()).filter(Boolean).slice(0, 4).join(", "),
    seasons: asSeasons(d.seasons),
    formality: Number.isInteger(d.formality) && d.formality >= 1 && d.formality <= 5 ? d.formality : 0,
    brand: d.brand?.trim() ?? "",
    description: d.description.trim(),
  };
  for (const key of DETAIL_KEYS) if (isBlank(out[key])) delete out[key];
  return out;
}

function isBlank(value: unknown) {
  return value === undefined || value === "" || value === 0 || (Array.isArray(value) && value.length === 0);
}

const same = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, n) => v === b[n]) : a === b;

export type MergeMode = "replace" | "empty";

/**
 * "replace" takes every field the model filled in; "empty" only fills fields
 * that are still blank, for people who corrected things by hand. An untagged
 * piece's name, category and dress code are placeholders, so they count as
 * blank there. Returns the form's new values and which fields moved.
 */
export function mergeSuggestion(
  current: DetailValues,
  suggestion: Partial<DetailValues>,
  mode: MergeMode,
  options: { untagged?: boolean } = {},
): { values: DetailValues; changed: DetailKey[] } {
  const placeholder = new Set<DetailKey>(options.untagged ? ["name", "category", "formality"] : []);
  const values = { ...current };
  const changed: DetailKey[] = [];
  for (const key of DETAIL_KEYS) {
    const next = suggestion[key];
    if (isBlank(next)) continue;
    if (mode === "empty" && !isBlank(current[key]) && !placeholder.has(key)) continue;
    if (same(current[key], next)) continue;
    (values as Record<DetailKey, unknown>)[key] = next;
    changed.push(key);
  }
  return { values, changed };
}
