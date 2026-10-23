import { describe, expect, it } from "vitest";
import { ACCENT_PRESETS, ACCENT_SATURATION, accentIsReadable, contrastWithWhite, hexToHsl, hslToHex } from "@/lib/colour";
import { categoryLabel, localeFromAcceptLanguage, translator } from "@/lib/i18n";

describe("translator", () => {
  it("fills placeholders and picks plural forms", () => {
    const t = translator("en");
    expect(t("wardrobe.hi", { name: "Damian" })).toBe("Hi Damian");
    expect(t.count("wardrobe.pieces", 1)).toBe("1 piece");
    expect(t.count("wardrobe.pieces", 24)).toBe("24 pieces");
    expect(translator("nl").count("wardrobe.pieces", 24)).toBe("24 stuks");
  });

  it("labels categories in both languages", () => {
    expect(categoryLabel(translator("en"), "bottom", "other")).toBe("Bottoms");
    expect(categoryLabel(translator("nl"), "bottom", "other")).toBe("Broeken");
    expect(categoryLabel(translator("nl"), "unknown")).toBe("unknown");
  });

  it("keeps the same placeholders in every Dutch sentence as the English one", () => {
    // Every key exists in both (the type checks that); this checks the {vars} match.
    const en = translator("en");
    const nl = translator("nl");
    const keys = ["wardrobe.hi", "worn.added", "tryon.paid", "appearance.contrastOk", "me.summary", "outfit.shop", "add.aiOff", "me.reshootBody.other", "me.reshootStopped"] as const;
    for (const key of keys) {
      const vars = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
      expect(vars(nl(key))).toEqual(vars(en(key)));
    }
  });

  it("reads the browser's language before a profile has one", () => {
    expect(localeFromAcceptLanguage("nl-NL,nl;q=0.9,en;q=0.8")).toBe("nl");
    expect(localeFromAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("en");
  });
});

describe("accent colours", () => {
  it("round-trips hex and hsl closely enough for the sliders", () => {
    const hex = hslToHex(232, ACCENT_SATURATION, 54);
    const back = hexToHsl(hex);
    expect(Math.abs(back.h - 232)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.l - 54)).toBeLessThanOrEqual(1);
  });

  it("only accepts colours white text can be read on", () => {
    expect(accentIsReadable("#7a2e2e")).toBe(true);
    expect(accentIsReadable("#ffee88")).toBe(false);
    expect(accentIsReadable("not a colour")).toBe(false);
    expect(contrastWithWhite("#000000")).toBeCloseTo(21, 0);
  });

  it("ships presets that all pass that check", () => {
    for (const p of ACCENT_PRESETS) expect(accentIsReadable(hslToHex(p.hue, ACCENT_SATURATION, p.light))).toBe(true);
  });
});
