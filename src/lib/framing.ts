import sharp from "sharp";

/**
 * Framing a cut-out as a shop listing. Kept apart from images.ts, which pulls
 * in the background remover, so the one-off script that re-frames stored
 * cut-outs (scripts/reframe-listings.mts) can import just this.
 */

/** Listing images are portrait, like a shop's product grid. */
export const LISTING_WIDTH = 900;
export const LISTING_HEIGHT = 1125;

/**
 * The ground every cut-out sits on: a sand tone a shade deeper than the cream
 * page, so a listing reads as a tile on its card and white pieces never
 * vanish. Changing it only affects new listings; the script above redoes the
 * old ones.
 */
export const GROUND = { r: 239, g: 232, b: 219, alpha: 1 };
export const GROUND_HEX = "#efe8db";

/**
 * A transparent cut-out framed as a product shot: centred on the ground with
 * a soft contact shadow made from its own silhouette.
 */
export async function framedCutout(png: Buffer) {
  const subject = await sharp(png)
    .resize(Math.round(LISTING_WIDTH * 0.8), Math.round(LISTING_HEIGHT * 0.8), { fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(subject).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;

  const alpha = await sharp(subject).extractChannel("alpha").linear(0.22, 0).toBuffer();
  const pad = 40;
  const shadow = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 40, g: 44, b: 60 } } })
    .joinChannel(alpha)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(14)
    .png()
    .toBuffer();

  const left = Math.round((LISTING_WIDTH - w) / 2);
  const top = Math.round((LISTING_HEIGHT - h) / 2);
  return sharp({ create: { width: LISTING_WIDTH, height: LISTING_HEIGHT, channels: 4, background: GROUND } })
    .composite([
      { input: shadow, left: left - pad + 6, top: top - pad + 14 },
      { input: subject, left, top },
    ])
    .flatten({ background: GROUND })
    .jpeg({ quality: 86 })
    .toBuffer();
}
