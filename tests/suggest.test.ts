import { describe, expect, it } from "vitest";
import { detailValues, mergeSuggestion, suggestionValues } from "@/lib/suggest";

const item = {
  name: "Blue jumper",
  category: "top",
  subcategory: null,
  colors: JSON.stringify(["blue"]),
  colorHex: null,
  brand: "Uniqlo",
  material: "",
  pattern: "solid",
  styles: "[]",
  formality: 2,
  seasons: JSON.stringify(["autumn"]),
  description: null,
};

const answer = {
  name: "Navy wool crewneck jumper",
  category: "top",
  subcategory: "crewneck jumper",
  colors: ["navy"],
  colorHex: "#1F2A44",
  pattern: "solid",
  material: "wool",
  styles: ["minimal", "preppy"],
  seasons: ["autumn", "winter"],
  formality: 3,
  brand: null,
  description: "A soft crewneck in fine merino.",
};

describe("re-check suggestions", () => {
  it("replaces every field the model filled in and marks only what moved", () => {
    const { values, changed } = mergeSuggestion(detailValues(item), suggestionValues(answer), "replace");
    expect(values.name).toBe("Navy wool crewneck jumper");
    expect(values.colors).toBe("navy");
    expect(values.colorHex).toBe("#1f2a44");
    expect(values.seasons).toEqual(["autumn", "winter"]);
    // No readable label: the brand the owner typed survives.
    expect(values.brand).toBe("Uniqlo");
    expect(changed).not.toContain("brand");
    // Same as before, so not marked.
    expect(changed).not.toContain("pattern");
    expect(changed).not.toContain("category");
    expect(changed).toEqual(
      expect.arrayContaining(["name", "subcategory", "colors", "colorHex", "material", "styles", "formality", "seasons", "description"]),
    );
  });

  it("only fills blank fields when asked to", () => {
    const { values, changed } = mergeSuggestion(detailValues(item), suggestionValues(answer), "empty");
    expect(values.name).toBe("Blue jumper");
    expect(values.colors).toBe("blue");
    expect(values.seasons).toEqual(["autumn"]);
    expect(values.formality).toBe(2);
    expect(values.material).toBe("wool");
    expect(values.subcategory).toBe("crewneck jumper");
    expect(changed.sort()).toEqual(["colorHex", "description", "material", "styles", "subcategory"]);
  });

  it("treats an untagged piece's placeholders as blank", () => {
    const untagged = { ...item, name: "New", formality: 2 };
    const { values, changed } = mergeSuggestion(detailValues(untagged), suggestionValues(answer), "empty", { untagged: true });
    expect(values.name).toBe("Navy wool crewneck jumper");
    expect(values.formality).toBe(3);
    expect(changed).toContain("name");
  });

  it("finds nothing new when the answer matches", () => {
    const first = mergeSuggestion(detailValues(item), suggestionValues(answer), "replace").values;
    expect(mergeSuggestion(first, suggestionValues(answer), "replace").changed).toEqual([]);
  });
});
