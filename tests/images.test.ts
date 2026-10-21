import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LISTING_HEIGHT, LISTING_WIDTH, blurredListing, cropToBox, framedCutout, makeListing, normalisePhoto } from "@/lib/images";

/** A grey photo with a red "garment" in its top-left quarter. */
async function photo() {
  const red = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#d02020" } }).png().toBuffer();
  return sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#808080" } })
    .composite([{ input: red, left: 200, top: 150 }])
    .jpeg()
    .toBuffer();
}

describe("cropToBox", () => {
  it("crops to the detected box, with a little padding", async () => {
    const { data, width, height } = await normalisePhoto(await photo());
    // The red block, in Gemini's 0–1000 [ymin, xmin, ymax, xmax] coordinates.
    const crop = await cropToBox(data, width, height, [125, 125, 375, 375]);
    const meta = await sharp(crop).metadata();
    expect(meta.width).toBeGreaterThanOrEqual(400);
    expect(meta.width).toBeLessThan(460);
  });

  it("keeps the whole photo for a box too small to be a garment", async () => {
    const { data, width, height } = await normalisePhoto(await photo());
    const crop = await cropToBox(data, width, height, [500, 500, 501, 501]);
    expect((await sharp(crop).metadata()).width).toBe(width);
  });

  it("ignores boxes that run off the photo", async () => {
    const { data, width, height } = await normalisePhoto(await photo());
    await expect(cropToBox(data, width, height, [-50, 900, 1200, 1100])).resolves.toBeInstanceOf(Buffer);
  });
});

describe("makeListing", () => {
  // Runs the real background-removal model in the same process as sharp. Two
  // copies of libvips in one process crash it, which is what this guards.
  it("cuts a real photo out into a transparent PNG and a framed listing", async () => {
    const photo = await readFile(path.join(import.meta.dirname, "../scripts/demo-wardrobe/tote.jpg"));
    const { data, width, height } = await normalisePhoto(photo);
    const { listing, cutout } = await makeListing(data, width, height);
    expect(cutout).not.toBeNull();
    expect((await sharp(cutout!).metadata()).hasAlpha).toBe(true);
    expect((await sharp(listing).metadata()).width).toBe(LISTING_WIDTH);
  }, 60_000);
});

describe("listing frames", () => {
  it("frames a plain crop at listing size", async () => {
    const meta = await sharp(await blurredListing(await photo())).metadata();
    expect([meta.width, meta.height]).toEqual([LISTING_WIDTH, LISTING_HEIGHT]);
  });

  it("centres a transparent cut-out on the sand ground", async () => {
    const cutout = await sharp({ create: { width: 300, height: 400, channels: 4, background: { r: 20, g: 40, b: 200, alpha: 1 } } })
      .png()
      .toBuffer();
    const framed = await framedCutout(cutout);
    const meta = await sharp(framed).metadata();
    expect([meta.width, meta.height]).toEqual([LISTING_WIDTH, LISTING_HEIGHT]);
    const { data: corner } = await sharp(framed).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    // JPEG rounding moves a channel by one; the ground is #efe8db.
    for (const [n, v] of [239, 232, 219].entries()) expect(Math.abs(corner[n] - v)).toBeLessThanOrEqual(2);
    const { data: centre } = await sharp(framed)
      .extract({ left: Math.floor(LISTING_WIDTH / 2), top: Math.floor(LISTING_HEIGHT / 2), width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(centre[2]).toBeGreaterThan(150);
  });
});
