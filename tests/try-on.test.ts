import { describe, expect, it } from "vitest";
import { tryOnPrompt } from "@/lib/try-on";

describe("tryOnPrompt", () => {
  it("numbers the pieces in outfit order", () => {
    const prompt = tryOnPrompt(["White cotton tee", "Straight-leg jeans"]);
    expect(prompt).toContain("1. White cotton tee\n2. Straight-leg jeans");
  });

  it("works whether the photos arrive separately or as one collage", () => {
    // The ChatGPT-app route may send a collage, so the prompt must not count images.
    expect(tryOnPrompt(["Tee"])).not.toMatch(/image \d/i);
  });
});
