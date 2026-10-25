import "server-only";
import sharp from "sharp";

/**
 * Free, local checks on a new listing: is the photo too dark or too soft,
 * and did the background remover find the whole piece? Pure pixel work, so
 * it runs on every upload before any model is asked (vision.ts gives the
 * second opinion when a key is there). A finding never blocks a listing:
 * the Add page suggests a retake and the user may keep the piece anyway.
 */

/**
 * Every reason a listing can be flagged, local or from the model. The key is
 * what Item.qualityIssue stores and what `quality.issue.*` in i18n.ts names.
 */
export const QUALITY_ISSUES = [
  "dark",
  "blurry",
  "cut_off",
  "cluttered",
  "missing_parts",
  "artefacts",
  "hanger",
  "no_cutout",
] as const;
export type QualityIssue = (typeof QUALITY_ISSUES)[number];

export function isQualityIssue(value: unknown): value is QualityIssue {
  return (QUALITY_ISSUES as readonly unknown[]).includes(value);
}

/**
 * A major finding is stored straight away and the model is not consulted:
 * the numbers leave no doubt. A minor one is a hunch; the model's view of the
 * finished listing wins when a key is there, otherwise it is stored too and
 * the user decides.
 */
export type Severity = "minor" | "major";
export type QualityFinding = { key: QualityIssue; severity: Severity; measure: number };

/*
 * Thresholds, measured on scripts/demo-wardrobe (see the test file for the
 * synthetic cases). Luminance is 0–255 on a greyscale copy.
 *
 * A photo whose mean sits below DARK_MEAN, or that is mostly near-black, is
 * underexposed: the demo photos darkened to a fifth of their light land at
 * 30–42, a normal one at 170–240. Between DARK_MEAN and DIM_MEAN colours
 * still read but the model is asked to confirm.
 */
export const DARK_MEAN = 60;
export const DIM_MEAN = 85;
/** Pixels this dark count as black; a photo more than half black is dark whatever its mean. */
export const BLACK_LEVEL = 30;
export const BLACK_SHARE = 0.5;

/*
 * Sharpness is the variance of a Laplacian over a 512px greyscale copy of the
 * crop: edges push it up, blur flattens it. The demo photos score 150–670;
 * blurred by 2.5px they drop to 2–12, by 6px to 1–3. A plain, smooth piece on
 * a plain wall scores low while sharp (the white tee: 23), which is why only
 * the clearly flat end is major and the soft band is left to the model.
 */
export const BLUR_SOFT = 12;
export const BLUR_FLAT = 5;

/*
 * The cut-out, read over the crop it was taken from. A piece that reaches the
 * crop's edge on one side was cut off there (the crop already pads the
 * detected box by 6%), and a cut-out covering almost none of the crop means
 * the remover kept little of the piece. Shares of a side's length and of the
 * crop's area.
 */
export const EDGE_TOUCH = 0.08;
export const EDGE_CUT = 0.25;
export const COVER_THIN = 0.06;
export const COVER_NONE = 0.02;
/** Alpha above this is the piece; the remover's edges are soft. */
const OPAQUE = 128;
/** How many pixels in from each side count as the border. */
const BORDER = 2;

export type PhotoStats = { mean: number; black: number };
export type CutoutStats = { coverage: number; edges: [number, number, number, number] };

/** Mean luminance and the share of near-black pixels. */
export async function photoStats(image: Buffer): Promise<PhotoStats> {
  const { data, info } = await sharp(image)
    .greyscale()
    .resize({ width: 256, height: 256, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let sum = 0;
  let black = 0;
  for (let i = 0; i < n; i++) {
    sum += data[i];
    if (data[i] < BLACK_LEVEL) black++;
  }
  return { mean: sum / n, black: black / n };
}

/** Variance of the Laplacian: high for crisp edges, near zero for a soft picture. */
export async function sharpness(image: Buffer): Promise<number> {
  // The offset keeps negative responses, which a 0–255 channel would clip away.
  const { data, info } = await sharp(image)
    .greyscale()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], scale: 1, offset: 128 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let sum = 0;
  let squares = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i] - 128;
    sum += v;
    squares += v * v;
  }
  const mean = sum / n;
  return squares / n - mean * mean;
}

/** How much of the crop the cut-out keeps, and how much of each border (top, right, bottom, left) is opaque. */
export async function cutoutStats(cutout: Buffer): Promise<CutoutStats> {
  const { data, info } = await sharp(cutout).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const opaqueAt = (x: number, y: number) => data[(y * width + x) * 4 + 3] >= OPAQUE;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] >= OPAQUE) opaque++;

  const border = Math.min(BORDER, Math.floor(Math.min(width, height) / 2));
  const side = (count: () => number, length: number) => (length === 0 ? 0 : count() / (length * border));
  const edges: [number, number, number, number] = [
    side(() => countRows(0, border), width),
    side(() => countCols(width - border, width), height),
    side(() => countRows(height - border, height), width),
    side(() => countCols(0, border), height),
  ];
  return { coverage: opaque / (width * height), edges };

  function countRows(from: number, to: number) {
    let n = 0;
    for (let y = from; y < to; y++) for (let x = 0; x < width; x++) if (opaqueAt(x, y)) n++;
    return n;
  }
  function countCols(from: number, to: number) {
    let n = 0;
    for (let x = from; x < to; x++) for (let y = 0; y < height; y++) if (opaqueAt(x, y)) n++;
    return n;
  }
}

/** Findings from the numbers alone, so the thresholds can be tested without images. */
export function judgePhotoStats(stats: PhotoStats): QualityFinding | null {
  if (stats.mean < DARK_MEAN || stats.black > BLACK_SHARE) return { key: "dark", severity: "major", measure: stats.mean };
  if (stats.mean < DIM_MEAN) return { key: "dark", severity: "minor", measure: stats.mean };
  return null;
}

export function judgeSharpness(variance: number): QualityFinding | null {
  if (variance < BLUR_FLAT) return { key: "blurry", severity: "major", measure: variance };
  if (variance < BLUR_SOFT) return { key: "blurry", severity: "minor", measure: variance };
  return null;
}

export function judgeCutoutStats(stats: CutoutStats | null): QualityFinding[] {
  if (!stats) return [{ key: "no_cutout", severity: "major", measure: 0 }];
  const findings: QualityFinding[] = [];
  const touch = Math.max(...stats.edges);
  if (touch > EDGE_CUT) findings.push({ key: "cut_off", severity: "major", measure: touch });
  else if (touch > EDGE_TOUCH) findings.push({ key: "cut_off", severity: "minor", measure: touch });
  if (stats.coverage < COVER_NONE) findings.push({ key: "missing_parts", severity: "major", measure: stats.coverage });
  else if (stats.coverage < COVER_THIN) findings.push({ key: "missing_parts", severity: "minor", measure: stats.coverage });
  return findings;
}

/**
 * Every finding for one piece: `crop` is the part of the photo the piece was
 * cut from and `cutout` the remover's output at the same size (null when it
 * failed). Blur is not judged on a dark photo: its Laplacian is flat anyway.
 */
export async function checkListing(crop: Buffer, cutout: Buffer | null): Promise<QualityFinding[]> {
  const findings: QualityFinding[] = [];
  const exposure = judgePhotoStats(await photoStats(crop));
  if (exposure) findings.push(exposure);
  if (exposure?.severity !== "major") {
    const blur = judgeSharpness(await sharpness(crop));
    if (blur) findings.push(blur);
  }
  findings.push(...judgeCutoutStats(cutout ? await cutoutStats(cutout) : null));
  return findings;
}

/** The finding worth telling the user about: a major one before a minor one, in the order found. */
export function worstFinding(findings: QualityFinding[]): QualityFinding | null {
  return findings.find((f) => f.severity === "major") ?? findings[0] ?? null;
}
