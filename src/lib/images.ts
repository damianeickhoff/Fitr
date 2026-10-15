import "server-only";
import sharp from "sharp";
import { removeBackground } from "./cutout";

/** Listing images are portrait, like a shop's product grid. */
export const LISTING_WIDTH = 900;
export const LISTING_HEIGHT = 1125;

/** The light grey every cut-out sits on, so white pieces never vanish. */
const GROUND = { r: 243, g: 244, b: 246, alpha: 1 };

/**
 * Upright, capped at 2000px and re-encoded, so every stored photo is a sane
 * JPEG whatever the phone produced.
 */
export async function normalisePhoto(input: Buffer) {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Gemini's boxes: [ymin, xmin, ymax, xmax], each 0–1000. */
export type Box = [number, number, number, number];

/**
 * The part of the photo inside `box`, padded a little so the background
 * remover sees the garment's edges. The whole photo when there is no usable box.
 */
export async function cropToBox(photo: Buffer, width: number, height: number, box?: Box | null, pad = 0.06) {
  if (!box) return photo;
  const [y0, x0, y1, x1] = box.map((v) => Math.min(1000, Math.max(0, v)));
  const padX = (x1 - x0) * pad;
  const padY = (y1 - y0) * pad;
  const left = Math.floor((Math.max(0, x0 - padX) / 1000) * width);
  const top = Math.floor((Math.max(0, y0 - padY) / 1000) * height);
  const right = Math.min(width, Math.ceil((Math.min(1000, x1 + padX) / 1000) * width));
  const bottom = Math.min(height, Math.ceil((Math.min(1000, y1 + padY) / 1000) * height));
  // A box too small to be a garment is a bad detection; keep the whole photo.
  if (right - left <= 40 || bottom - top <= 40) return photo;
  return sharp(photo).extract({ left, top, width: right - left, height: bottom - top }).jpeg({ quality: 92 }).toBuffer();
}

/**
 * The fallback listing, used when background removal fails: the crop on a
 * blurred, enlarged copy of itself, so the frame never shows a hard edge.
 */
export async function blurredListing(crop: Buffer) {
  const backdrop = await sharp(crop)
    .resize(LISTING_WIDTH, LISTING_HEIGHT, { fit: "cover" })
    .blur(40)
    .modulate({ brightness: 1.08, saturation: 0.7 })
    .toBuffer();
  const subject = await sharp(crop)
    .resize(LISTING_WIDTH - 60, LISTING_HEIGHT - 60, { fit: "inside" })
    .toBuffer();
  return sharp(backdrop).composite([{ input: subject, gravity: "center" }]).jpeg({ quality: 86 }).toBuffer();
}

/**
 * A transparent cut-out framed as a product shot: centred on the light grey
 * ground with a soft contact shadow made from its own silhouette.
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

/**
 * Everything a new piece needs from its photo: the shop listing and, when the
 * background could be removed, the transparent cut-out for flat lays.
 */
export async function makeListing(photo: Buffer, width: number, height: number, box?: Box | null) {
  const crop = await cropToBox(photo, width, height, box);
  try {
    const removed = await removeBackground(crop);
    const cutout = await sharp(removed)
      .trim({ threshold: 10 })
      .resize(900, 900, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    // An empty cut-out means the model found no subject; the plain crop is better.
    const { width: cw = 0, height: ch = 0 } = await sharp(cutout).metadata();
    if (cw < 40 || ch < 40) throw new Error("Cut-out came back empty.");
    return { listing: await framedCutout(cutout), cutout };
  } catch (error) {
    console.error("[cutout] falling back to the plain crop:", error);
    return { listing: await blurredListing(crop), cutout: null };
  }
}

/** Model output arrives as PNG or WebP; store everything as JPEG. */
export async function toJpeg(input: Buffer) {
  return sharp(input).jpeg({ quality: 88 }).toBuffer();
}
