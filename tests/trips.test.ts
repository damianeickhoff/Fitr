import { describe, expect, it } from "vitest";
import type { Item } from "@/generated/prisma/client";
import { translator } from "@/lib/i18n";
import { cleanPacking, daySeason, monthSeason, packRules, tripDays, tripTiming, type StayDay } from "@/lib/trips";
import type { Reading } from "@/lib/weather";

const t = translator("en");
const now = new Date(2026, 9, 25, 12);

let n = 0;
function item(category: string, extra: Partial<Item> = {}): Item {
  n += 1;
  return {
    id: `i${n}`,
    userId: "u",
    profileId: "p",
    name: `${category} ${n}`,
    category,
    subcategory: null,
    colors: '["black"]',
    colorHex: null,
    pattern: null,
    material: null,
    styles: "[]",
    seasons: "[]",
    formality: 2,
    brand: null,
    description: null,
    photoPath: "p.jpg",
    imagePath: "i.jpg",
    cutoutPath: null,
    lastWornAt: null,
    studioAt: null,
    studioRequestedAt: null,
    inWashSince: null,
    qualityIssue: null,
    qualityNote: null,
    aiTagged: true,
    favourite: false,
    wearCount: 0,
    createdAt: new Date(2026, 0, 1),
    ...extra,
  };
}

const mild: Reading = { max: 18, min: 12, rainChance: 10, wind: 10, condition: "clear" };
const stay = (count: number, season: StayDay["season"], reading: Reading | null = null) =>
  Array.from({ length: count }, () => ({ season, reading }));
const ids = (list: { itemId: string }[]) => list.map((p) => p.itemId);
const many = (category: string, count: number, extra: Partial<Item> = {}) => Array.from({ length: count }, () => item(category, extra));

describe("trip days and seasons", () => {
  it("lists every day of the stay, first and last included, across a month end", () => {
    expect(tripDays("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(tripDays("2026-11-02", "2026-11-02")).toEqual(["2026-11-02"]);
  });

  it("flips the month's season south of the equator", () => {
    expect(monthSeason("2026-11-02", 38.7)).toBe("autumn");
    expect(monthSeason("2026-12-20", -33.9)).toBe("summer");
  });

  it("lets the forecast override the month when it is clearly warm or cold", () => {
    expect(daySeason("2026-11-02", 38.7, { ...mild, max: 26 })).toBe("summer");
    expect(daySeason("2026-11-02", 38.7, { ...mild, max: 6 })).toBe("winter");
    expect(daySeason("2026-11-02", 38.7, mild)).toBe("autumn");
    expect(daySeason("2026-07-02", 52.4, mild)).toBe("spring");
  });

  it("knows whether a trip is coming, under way or over", () => {
    expect(tripTiming({ startDate: "2026-11-02", endDate: "2026-11-06" }, now)).toEqual({ kind: "soon", days: 8 });
    expect(tripTiming({ startDate: "2026-10-24", endDate: "2026-10-26" }, now).kind).toBe("now");
    expect(tripTiming({ startDate: "2026-10-01", endDate: "2026-10-03" }, now).kind).toBe("past");
  });
});

describe("packRules", () => {
  const wardrobe = [
    ...many("top", 8),
    ...many("bottom", 5),
    ...many("shoes", 3),
    item("outerwear", { seasons: '["autumn","winter"]' }),
    item("bag"),
    ...many("accessory", 3),
  ];

  it("packs about a top a day, bottoms every few days and two pairs of shoes", () => {
    const { packing } = packRules(wardrobe, { notes: null }, stay(5, "autumn", mild), t, now);
    const count = (category: string) => packing.filter((p) => wardrobe.find((i) => i.id === p.itemId)?.category === category).length;
    expect(count("top")).toBe(5);
    expect(count("bottom")).toBe(2);
    expect(count("shoes")).toBe(2);
    expect(count("outerwear")).toBe(1);
    expect(count("bag")).toBe(1);
    expect(count("accessory")).toBe(2);
    expect(new Set(ids(packing)).size).toBe(packing.length);
    expect(packing.every((p) => p.reason.length > 0)).toBe(true);
  });

  it("caps a long trip at a week's worth of tops", () => {
    const { packing } = packRules(wardrobe, { notes: null }, stay(12, "autumn"), t, now);
    expect(packing.filter((p) => wardrobe.find((i) => i.id === p.itemId)?.category === "top")).toHaveLength(7);
  });

  it("keeps out-of-season pieces at home and leaves the coat behind in summer", () => {
    const knit = item("top", { seasons: '["winter"]' });
    const tee = item("top", { seasons: '["summer"]' });
    const coat = item("outerwear", { seasons: '["winter"]' });
    const { packing } = packRules([knit, tee, coat, item("bottom"), item("shoes")], { notes: null }, stay(2, "summer"), t, now);
    expect(ids(packing)).toContain(tee.id);
    expect(ids(packing)).not.toContain(knit.id);
    expect(ids(packing)).not.toContain(coat.id);
  });

  it("brings a layer for the rain, even in summer", () => {
    const mac = item("outerwear");
    const { packing } = packRules([item("top"), item("bottom"), mac], { notes: null }, stay(2, "summer", { ...mild, rainChance: 80, condition: "rain" }), t, now);
    expect(packing.find((p) => p.itemId === mac.id)?.reason).toBe(t("trips.why.rain"));
  });

  it("adds a smarter piece when the plans sound dressy", () => {
    const blouse = item("top", { formality: 4 });
    const casual = [...many("top", 3), item("bottom"), item("shoes")];
    const plain = packRules([...casual, blouse], { notes: "museums" }, stay(2, "autumn"), t, now);
    const dinner = packRules([...casual, blouse], { notes: "beach and two dinners" }, stay(2, "autumn"), t, now);
    expect(ids(plain.packing)).not.toContain(blouse.id);
    expect(ids(dinner.packing)).toContain(blouse.id);
  });

  it("allows laundry but says so, and picks clean pieces first", () => {
    const washing = item("top", { inWashSince: new Date(2026, 9, 24), favourite: true });
    const clean = item("top");
    const one = packRules([washing, clean, item("bottom")], { notes: null }, stay(1, "autumn"), t, now);
    expect(ids(one.packing)).toContain(clean.id);
    expect(ids(one.packing)).not.toContain(washing.id);
    const two = packRules([washing, clean, item("bottom")], { notes: null }, stay(2, "autumn"), t, now);
    expect(two.packing.find((p) => p.itemId === washing.id)?.reason).toMatch(/\(in the wash now\)$/);
  });
});

describe("cleanPacking", () => {
  const wardrobe = [item("top"), item("bottom"), item("shoes", { inWashSince: new Date(2026, 9, 20) })];

  it("drops ids the wardrobe doesn't have and repeats", () => {
    const { packing } = cleanPacking(
      {
        packing: [
          { itemId: wardrobe[0].id, reason: "light for the days" },
          { itemId: "made-up", reason: "invented" },
          { itemId: wardrobe[0].id, reason: "again" },
          { itemId: wardrobe[1].id, reason: "  " },
        ],
        advice: [],
      },
      wardrobe,
      t,
      now,
    );
    expect(packing).toEqual([
      { itemId: wardrobe[0].id, reason: "light for the days" },
      { itemId: wardrobe[1].id, reason: t("trips.why.default") },
    ]);
  });

  it("flags a piece in the wash once, whoever wrote the reason", () => {
    const { packing } = cleanPacking(
      { packing: [{ itemId: wardrobe[2].id, reason: "for walking" }], advice: [] },
      wardrobe,
      t,
      now,
    );
    expect(packing[0].reason).toBe("for walking (in the wash now)");
    const again = cleanPacking({ packing: [{ itemId: wardrobe[2].id, reason: "for walking, in the wash now" }], advice: [] }, wardrobe, t, now);
    expect(again.packing[0].reason).toBe("for walking, in the wash now");
  });

  it("keeps at most three tips and drops empty shopping searches", () => {
    const tip = (text: string, shopFor: string | null) => ({ text, shopFor });
    const { advice } = cleanPacking(
      { packing: [], advice: [tip("A rain jacket", " packable rain jacket "), tip("Sandals", ""), tip("Hat", null), tip("Fourth", null)] },
      wardrobe,
      t,
      now,
    );
    expect(advice).toEqual([tip("A rain jacket", "packable rain jacket"), tip("Sandals", null), tip("Hat", null)]);
  });
});
