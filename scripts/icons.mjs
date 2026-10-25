// Renders the home-screen icons and the favicon from public/icon.svg. Run
// with `npm run icons` after changing the SVG and commit what it writes.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ACCENT = "#7a2e2e";
const svg = await readFile(new URL("../public/icon.svg", import.meta.url));
const out = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

const render = (size) => sharp(svg, { density: Math.ceil((72 * size) / 512) }).resize(size, size);

await mkdir(out("public/icons"), { recursive: true });

// "any" icons keep the rounded square with transparent corners.
await render(192).png().toFile(out("public/icons/icon-192.png"));
await render(512).png().toFile(out("public/icons/icon-512.png"));

// Maskable: launchers crop to anything inside the central 80% circle, so the
// whole square is filled and the artwork shrunk to 80% to keep the F well
// inside that safe zone. The rounded corners vanish against the same colour.
const inner = await render(410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: ACCENT } })
  .composite([{ input: inner, gravity: "centre" }])
  .png()
  .toFile(out("public/icons/maskable-512.png"));

// iOS rounds the corners itself and paints transparency black, so the touch
// icon is a full, opaque square.
await render(180).flatten({ background: ACCENT }).png().toFile(out("public/apple-touch-icon.png"));

// favicon.ico: an ICO container holding PNGs, which every current browser reads.
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => render(s).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const entry = 6 + 16 * i;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(pngs[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += pngs[i].length;
});
await writeFile(out("src/app/favicon.ico"), Buffer.concat([header, ...pngs]));

console.log("Icons written to public/icons, public/apple-touch-icon.png and src/app/favicon.ico");
