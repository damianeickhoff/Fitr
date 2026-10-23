import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { restoreInterior } from "@/lib/interior";

const W = 300;
const H = 300;

/** A photo: light wall, a dark square "garment" with a brown inner panel, a black "hanger" stub touching its top. */
async function photo() {
  const brown = await sharp({ create: { width: 100, height: 120, channels: 3, background: "#5a4634" } }).png().toBuffer();
  const shell = await sharp({ create: { width: 180, height: 180, channels: 3, background: "#202024" } }).png().toBuffer();
  const hanger = await sharp({ create: { width: 10, height: 50, channels: 3, background: "#101010" } }).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background: "#f0eee8" } })
    .composite([
      { input: shell, left: 60, top: 70 },
      { input: brown, left: 100, top: 100 },
      { input: hanger, left: 145, top: 20 },
    ])
    .png()
    .toBuffer();
}

/** What the remover tends to return: the shell kept, the brown panel and the hanger cut away. */
async function cutout() {
  const inner = await sharp({ create: { width: 100, height: 120, channels: 4, background: "#ffffff" } }).png().toBuffer();
  const shell = await sharp({ create: { width: 180, height: 180, channels: 4, background: "#202024" } })
    .composite([{ input: inner, left: 40, top: 30, blend: "dest-out" }])
    .png()
    .toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: shell, left: 60, top: 70 }])
    .png()
    .toBuffer();
}

async function alphaAt(png: Buffer, x: number, y: number) {
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[(y * W + x) * 4 + 3];
}

describe("restoreInterior", () => {
  it("puts back a lining the remover cut out, from the photo's pixels", async () => {
    const restored = await restoreInterior(await cutout(), await photo());
    expect(await alphaAt(restored, 150, 160)).toBe(255);
    const { data } = await sharp(restored).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const i = (160 * W + 150) * 4;
    expect([data[i], data[i + 1], data[i + 2]]).toEqual([0x5a, 0x46, 0x34]);
  });

  it("leaves the hanger and the wall alone", async () => {
    const restored = await restoreInterior(await cutout(), await photo());
    expect(await alphaAt(restored, 150, 40)).toBe(0);
    expect(await alphaAt(restored, 20, 20)).toBe(0);
  });

  it("returns the cut-out untouched when there is nothing to restore", async () => {
    const plain = await sharp({ create: { width: W, height: H, channels: 4, background: "#202024" } }).png().toBuffer();
    expect(await restoreInterior(plain, await photo())).toBe(plain);
  });
});
