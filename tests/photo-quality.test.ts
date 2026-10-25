import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  BLUR_FLAT,
  BLUR_SOFT,
  checkListing,
  cutoutStats,
  judgeCutoutStats,
  judgePhotoStats,
  judgeSharpness,
  photoStats,
  sharpness,
  worstFinding,
} from "@/lib/photo-quality";

const demo = (name: string) => readFile(path.join(import.meta.dirname, `../scripts/demo-wardrobe/${name}.jpg`));

/** A light wall with a dark checked "garment" on it: plenty of edges. */
async function crispPhoto() {
  const tile = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#202024" } }).png().toBuffer();
  const composites = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) composites.push({ input: tile, left: 80 + x * 20, top: 60 + y * 20 });
  return sharp({ create: { width: 320, height: 320, channels: 3, background: "#f0eee8" } }).composite(composites).jpeg().toBuffer();
}

/** A transparent canvas with an opaque block at the given place. */
async function cutout(width: number, height: number, block: { left: number; top: number; width: number; height: number }) {
  const piece = await sharp({ create: { width: block.width, height: block.height, channels: 4, background: { r: 30, g: 30, b: 40, alpha: 1 } } })
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: block.left, top: block.top }])
    .png()
    .toBuffer();
}

describe("exposure", () => {
  it("passes a normal photo and flags it once darkened", async () => {
    const photo = await crispPhoto();
    expect(judgePhotoStats(await photoStats(photo))).toBeNull();
    const dark = await sharp(photo).linear(0.15, 0).jpeg().toBuffer();
    expect(judgePhotoStats(await photoStats(dark))).toMatchObject({ key: "dark", severity: "major" });
  });

  it("calls a photo that is mostly black dark whatever its mean", () => {
    expect(judgePhotoStats({ mean: 100, black: 0.7 })).toMatchObject({ key: "dark", severity: "major" });
    expect(judgePhotoStats({ mean: 75, black: 0.1 })).toMatchObject({ key: "dark", severity: "minor" });
    expect(judgePhotoStats({ mean: 180, black: 0.1 })).toBeNull();
  });

  it("flags the demo photos only when darkened", async () => {
    for (const name of ["knit", "trainers", "satchel"]) {
      const photo = await demo(name);
      expect(judgePhotoStats(await photoStats(photo)), name).toBeNull();
      const dark = await sharp(photo).linear(0.18, 0).jpeg().toBuffer();
      expect(judgePhotoStats(await photoStats(dark)), name).toMatchObject({ key: "dark", severity: "major" });
    }
  });
});

describe("sharpness", () => {
  it("drops from crisp to flat as a photo is blurred", async () => {
    const photo = await crispPhoto();
    const crisp = await sharpness(photo);
    const soft = await sharpness(await sharp(photo).blur(3).jpeg().toBuffer());
    const flat = await sharpness(await sharp(photo).blur(8).jpeg().toBuffer());
    expect(crisp).toBeGreaterThan(BLUR_SOFT);
    expect(soft).toBeLessThan(crisp);
    expect(flat).toBeLessThan(BLUR_FLAT);
    expect(judgeSharpness(crisp)).toBeNull();
    expect(judgeSharpness(flat)).toMatchObject({ key: "blurry", severity: "major" });
  });

  it("keeps a smooth, plain piece out of the major band", async () => {
    // The white tee is the flattest demo photo while perfectly sharp.
    expect(judgeSharpness(await sharpness(await demo("tee")))).toBeNull();
    expect(judgeSharpness(await sharpness(await sharp(await demo("tee")).blur(6).jpeg().toBuffer()))).toMatchObject({ key: "blurry" });
  });
});

describe("cut-out", () => {
  it("passes a piece well inside the crop", async () => {
    const stats = await cutoutStats(await cutout(200, 200, { left: 40, top: 40, width: 120, height: 120 }));
    expect(stats.coverage).toBeCloseTo(0.36, 1);
    expect(stats.edges).toEqual([0, 0, 0, 0]);
    expect(judgeCutoutStats(stats)).toEqual([]);
  });

  it("sees a piece that runs off the bottom as cut off there", async () => {
    const stats = await cutoutStats(await cutout(200, 200, { left: 50, top: 60, width: 100, height: 140 }));
    expect(stats.edges[2]).toBeCloseTo(0.5, 1);
    expect(stats.edges[0]).toBe(0);
    expect(judgeCutoutStats(stats)).toMatchObject([{ key: "cut_off", severity: "major" }]);
  });

  it("notices when the remover kept almost nothing", async () => {
    const stats = await cutoutStats(await cutout(300, 300, { left: 140, top: 140, width: 10, height: 10 }));
    expect(judgeCutoutStats(stats)).toMatchObject([{ key: "missing_parts", severity: "major" }]);
  });

  it("treats a failed removal as its own finding", () => {
    expect(judgeCutoutStats(null)).toEqual([{ key: "no_cutout", severity: "major", measure: 0 }]);
  });
});

describe("checkListing", () => {
  it("finds nothing wrong with a good crop and cut-out", async () => {
    const photo = await crispPhoto();
    const good = await cutout(320, 320, { left: 80, top: 60, width: 160, height: 160 });
    expect(await checkListing(photo, good)).toEqual([]);
  });

  it("reports dark before anything else and skips the blur check in the dark", async () => {
    const dark = await sharp(await crispPhoto()).linear(0.15, 0).jpeg().toBuffer();
    const findings = await checkListing(dark, null);
    expect(findings.map((f) => f.key)).toEqual(["dark", "no_cutout"]);
    expect(worstFinding(findings)?.key).toBe("dark");
  });

  it("puts a major finding ahead of an earlier minor one", () => {
    expect(
      worstFinding([
        { key: "blurry", severity: "minor", measure: 8 },
        { key: "cut_off", severity: "major", measure: 0.4 },
      ])?.key,
    ).toBe("cut_off");
    expect(worstFinding([])).toBeNull();
  });
});
