import sharp from "sharp";

/**
 * The background remover is trained on people and objects, and a garment's
 * inside confuses it: the lining of an open vest or a coat, a different colour
 * from the shell, often comes back transparent as if it were wall. This puts
 * such areas back.
 *
 * A transparent area is restored when its photo pixels look nothing like the
 * photo's background and it is bordered mostly by the garment: a lining sits
 * inside the garment's outline, while a hanger, a floor or a gap between two
 * fronts is bordered mostly by background and stays out. Pure pixel work, no
 * model, so it costs nothing and runs the same everywhere.
 */

/**
 * How different from the background a pixel must be, in RGB distance (0–441).
 * High enough that the garment's own shadow on a wall or floor does not count.
 */
const FOREIGN = 110;
/** A blob counts as inside the garment when at least this share of its edge touches opaque pixels. */
const ENCLOSED = 0.6;
/** Blobs smaller than this share of the garment are noise (fur edges, shadows). */
const MIN_AREA = 0.004;
/** The outer ring of the picture is background by construction: the garment was cropped with padding. */
const RING = 0.03;

type Rgb = [number, number, number];

function distance(a: Rgb, r: number, g: number, b: number) {
  return Math.sqrt((a[0] - r) ** 2 + (a[1] - g) ** 2 + (a[2] - b) ** 2);
}

/** The median colour of the picture's outer ring. */
function backgroundColour(rgb: Buffer, width: number, height: number): Rgb {
  const ring = Math.max(2, Math.round(Math.min(width, height) * RING));
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let y = 0; y < height; y++) {
    const edge = y < ring || y >= height - ring;
    for (let x = 0; x < width; x++) {
      if (!edge && x >= ring && x < width - ring) continue;
      const i = (y * width + x) * 3;
      r.push(rgb[i]);
      g.push(rgb[i + 1]);
      b.push(rgb[i + 2]);
    }
  }
  const median = (list: number[]) => list.sort((p, q) => p - q)[Math.floor(list.length / 2)] ?? 0;
  return [median(r), median(g), median(b)];
}

/**
 * Takes the remover's RGBA output and the photo it was cut from (same size),
 * and returns the output with the garment's interior restored from the photo.
 */
export async function restoreInterior(cutout: Buffer, photo: Buffer): Promise<Buffer> {
  const { data: rgba, info } = await sharp(cutout).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const rgb = await sharp(photo).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const n = width * height;

  const opaque = new Uint8Array(n);
  let garment = 0;
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] >= 64) {
      opaque[i] = 1;
      garment++;
    }
  }
  if (garment === 0) return cutout;

  const bg = backgroundColour(rgb, width, height);
  const candidate = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!opaque[i] && distance(bg, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) > FOREIGN) candidate[i] = 1;
  }

  // Flood each candidate blob; keep the ones that sit inside the garment.
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const fill = new Uint8Array(n);
  const blob: number[] = [];
  // (seen is reset before the hole pass below, since a rejected candidate blob may still be part of a hole)
  for (let start = 0; start < n; start++) {
    if (!candidate[start] || seen[start]) continue;
    blob.length = 0;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let edgeOpaque = 0;
    let edgeOther = 0;
    while (top > 0) {
      const i = stack[--top];
      blob.push(i);
      const x = i % width;
      const y = (i - x) / width;
      const around = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
      for (const j of around) {
        if (j < 0) {
          edgeOther++;
          continue;
        }
        if (candidate[j]) {
          if (!seen[j]) {
            seen[j] = 1;
            stack[top++] = j;
          }
        } else if (opaque[j]) edgeOpaque++;
        else edgeOther++;
      }
    }
    if (blob.length < garment * MIN_AREA) continue;
    if (edgeOpaque / (edgeOpaque + edgeOther) < ENCLOSED) continue;
    for (const i of blob) fill[i] = 1;
  }

  // A transparent pocket with garment on every side is a hole the remover
  // punched (a label, a button, a pale patch), whatever its colour. Holes
  // larger than this are more likely a real opening and are left alone.
  const MAX_HOLE = 0.05;
  const TINY_HOLE = 0.003;
  seen.fill(0);
  for (let start = 0; start < n; start++) {
    if (opaque[start] || fill[start] || seen[start]) continue;
    blob.length = 0;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let open = false;
    while (top > 0) {
      const i = stack[--top];
      blob.push(i);
      const x = i % width;
      const y = (i - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) open = true;
      for (const j of [i - 1, i + 1, i - width, i + width]) {
        if (j < 0 || j >= n || opaque[j] || fill[j] || seen[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === width - 1)) continue;
        seen[j] = 1;
        stack[top++] = j;
      }
    }
    if (open || blob.length > garment * MAX_HOLE) continue;
    // A pocket the size of a label is filled whatever it shows; anything
    // bigger must mostly look foreign to the background, or it is a notch
    // in the outline that a few stray pixels happened to close off.
    if (blob.length > garment * TINY_HOLE) {
      let foreign = 0;
      for (const i of blob) if (distance(bg, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) > FOREIGN) foreign++;
      if (foreign < blob.length * 0.5) continue;
    }
    for (const i of blob) fill[i] = 1;
  }

  // The remover also leaves a lining half-there: foreign-coloured pixels that
  // are only partly opaque yet surrounded by opaque ones are interior, not
  // edge, and become solid. Fur and hair edges keep their soft alpha.
  for (let i = 0; i < n; i++) {
    const a = rgba[i * 4 + 3];
    if (a < 64 || a === 255) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) continue;
    if (opaque[i - 1] && opaque[i + 1] && opaque[i - width] && opaque[i + width] && distance(bg, rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) > FOREIGN) {
      fill[i] = 1;
    }
  }

  let restored = 0;
  for (let i = 0; i < n; i++) {
    if (!fill[i]) continue;
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = 255;
    restored++;
  }
  if (restored === 0) return cutout;
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
