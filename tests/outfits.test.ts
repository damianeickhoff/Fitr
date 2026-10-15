import { describe, expect, it } from "vitest";
import type { Item } from "@/generated/prisma/client";
import { cleanOutfits, ruleOutfits } from "@/lib/outfits";

let n = 0;
function item(category: string, colors: string[], extra: Partial<Item> = {}): Item {
  n += 1;
  return {
    id: `i${n}`,
    userId: "u",
    name: `${colors[0]} ${category}`,
    category,
    subcategory: null,
    colors: JSON.stringify(colors),
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
    aiTagged: true,
    favourite: false,
    wearCount: 0,
    createdAt: new Date(),
    ...extra,
  };
}

const request = { occasion: "", weather: "Mild", notes: "", anchorItemId: null };

describe("cleanOutfits", () => {
  const wardrobe = [item("top", ["white"]), item("bottom", ["navy"]), item("shoes", ["black"])];

  it("drops ids the wardrobe doesn't have", () => {
    const [outfit] = cleanOutfits(
      [{ name: "A", itemIds: [wardrobe[0].id, "made-up", wardrobe[1].id], reasoning: "", advice: [] }],
      wardrobe,
    );
    expect(outfit.itemIds).toEqual([wardrobe[0].id, wardrobe[1].id]);
  });

  it("drops outfits left with fewer than two pieces", () => {
    const result = cleanOutfits([{ name: "A", itemIds: [wardrobe[0].id, "x"], reasoning: "", advice: [] }], wardrobe);
    expect(result).toEqual([]);
  });

  it("keeps buy advice but drops add advice pointing at unknown pieces", () => {
    const [outfit] = cleanOutfits(
      [
        {
          name: "A",
          itemIds: [wardrobe[0].id, wardrobe[1].id],
          reasoning: "",
          advice: [
            { kind: "buy", text: "Get loafers", shopFor: "tan loafers", itemId: null },
            { kind: "add", text: "Add the belt", itemId: "ghost" },
          ],
        },
      ],
      wardrobe,
    );
    expect(outfit.advice.map((a) => a.kind)).toEqual(["buy"]);
  });
});

describe("ruleOutfits", () => {
  it("builds complete outfits with shoes", () => {
    const wardrobe = [
      item("top", ["white"]),
      item("top", ["black"]),
      item("bottom", ["blue denim"]),
      item("shoes", ["white"]),
    ];
    const outfits = ruleOutfits(wardrobe, request);
    expect(outfits.length).toBeGreaterThan(0);
    for (const o of outfits) {
      const cats = o.itemIds.map((id) => wardrobe.find((i) => i.id === id)!.category);
      expect(cats).toContain("top");
      expect(cats).toContain("bottom");
      expect(cats).toContain("shoes");
    }
  });

  it("never repeats the same combination", () => {
    const wardrobe = [item("top", ["white"]), item("bottom", ["black"]), item("shoes", ["black"])];
    expect(ruleOutfits(wardrobe, request)).toHaveLength(1);
  });

  it("includes the anchor piece", () => {
    const anchor = item("dress", ["red"]);
    const wardrobe = [item("top", ["white"]), item("bottom", ["black"]), anchor, item("shoes", ["black"])];
    const outfits = ruleOutfits(wardrobe, { ...request, anchorItemId: anchor.id });
    expect(outfits.length).toBeGreaterThan(0);
    expect(outfits.every((o) => o.itemIds.includes(anchor.id))).toBe(true);
  });

  it("adds a coat when it's cold", () => {
    const coat = item("outerwear", ["camel"]);
    const wardrobe = [item("top", ["white"]), item("bottom", ["black"]), coat];
    const [outfit] = ruleOutfits(wardrobe, { ...request, weather: "Cold" });
    expect(outfit.itemIds[0]).toBe(coat.id);
  });
});
