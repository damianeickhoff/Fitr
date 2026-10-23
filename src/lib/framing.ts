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

/** Shadows are a warm dark, not black, so they sit in the sand rather than on it. */
const SHADE = { r: 60, g: 52, b: 40 };

/**
 * A transparent cut-out framed as a product shot: one soft pool of shadow
 * under the base of the piece, the way a flat lay is lit in a studio, and
 * nothing around the sides. A shadow from the piece's own silhouette looked
 * wrong at every strength: it piled up in concave spots such as between
 * sleeves, and read as a cut-and-paste.
 */
export async function framedCutout(png: Buffer) {
  const subject = await sharp(png)
    .resize(Math.round(LISTING_WIDTH * 0.8), Math.round(LISTING_HEIGHT * 0.8), { fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(subject).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const pad = 110;

  const poolW = Math.round(w * 0.86);
  const poolH = Math.round(Math.max(40, h * 0.16));
  const ellipse =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${poolW + pad * 2}" height="${poolH + pad * 2}">` +
    `<ellipse cx="${poolW / 2 + pad}" cy="${poolH / 2 + pad}" rx="${poolW / 2}" ry="${poolH / 2}" ` +
    `fill="rgb(${SHADE.r},${SHADE.g},${SHADE.b})" fill-opacity="0.24"/></svg>`;
  const pool = await sharp(Buffer.from(ellipse)).blur(40).png().toBuffer();

  const left = Math.round((LISTING_WIDTH - w) / 2);
  const top = Math.round((LISTING_HEIGHT - h) / 2);

  // A blurred layer reaches past the canvas for a tall or wide piece, and
  // sharp only composites what fits, so each is clipped to the frame.
  const place = async (layer: Buffer, x: number, y: number, width: number, height: number) => {
    const x0 = Math.max(0, -x);
    const y0 = Math.max(0, -y);
    const x1 = Math.min(width, LISTING_WIDTH - x);
    const y1 = Math.min(height, LISTING_HEIGHT - y);
    const input = await sharp(layer).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
    return { input, left: x + x0, top: y + y0 };
  };

  return sharp({ create: { width: LISTING_WIDTH, height: LISTING_HEIGHT, channels: 4, background: GROUND } })
    .composite([
      await place(pool, Math.round(left + (w - poolW) / 2) - pad, Math.round(top + h - poolH * 0.7) - pad, poolW + pad * 2, poolH + pad * 2),
      { input: subject, left, top },
    ])
    .flatten({ background: GROUND })
    .jpeg({ quality: 86 })
    .toBuffer();
}
