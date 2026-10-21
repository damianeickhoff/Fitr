// Creates a demo account with a real, cut-out wardrobe and one saved outfit,
// for trying the app without photographing anything. Safe to re-run: it
// replaces the demo account.
//
//   npm run db:seed-demo
//
// Sign in with the email and password below.
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

export const DEMO_EMAIL = "demo@fitr.test";
export const DEMO_PASSWORD = "fitr-demo-wardrobe";

const assets = path.join(import.meta.dirname, "demo-wardrobe");
const dbFile = (process.env.DATABASE_URL ?? "file:./data/fitr.db").replace(/^file:/, "");
const uploads = path.resolve(process.env.UPLOADS_DIR ?? "./data/uploads");
const db = new Database(dbFile);

const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

// key, name, category, subcategory, colours, hex, styles, seasons, formality, worn, last worn (days ago), favourite, description
const WARDROBE = [
  ["tee", "White cotton tee", "top", "t-shirt", ["white"], "#f2f2f0", ["minimal", "casual"], ["spring", "summer"], 2, 9, 3, false,
    "A crisp crew-neck tee in soft cotton. Tuck it into jeans or wear it under a jacket."],
  ["knit", "Oatmeal chunky knit", "top", "jumper", ["oatmeal"], "#b9ac95", ["cosy", "minimal"], ["autumn", "winter"], 2, 4, 9, true,
    "Relaxed, boxy jumper in a soft wool blend with dropped shoulders. Tuck the front into high-waisted jeans."],
  ["biker", "Black leather biker", "outerwear", "biker jacket", ["black"], "#222226", ["edgy", "classic"], ["spring", "autumn"], 3, 6, 1, true,
    "A classic biker in supple black leather with silver zips. Throw it over anything that needs an edge."],
  ["jeans", "Straight-leg jeans", "bottom", "jeans", ["blue denim"], "#4d6c94", ["casual", "classic"], ["spring", "autumn", "winter"], 2, 12, 0, false,
    "Mid-blue straight-leg jeans with turned-up hems. Your everyday base."],
  ["dress", "White lace midi dress", "dress", "midi dress", ["white", "cream"], "#f1ede6", ["romantic", "elegant"], ["summer"], 3, 0, null, false,
    "A sleeveless lace bodice over a soft tulle skirt. Dress it down with a biker and boots."],
  ["top", "Black sleeveless top", "top", "shell top", ["black"], "#1d1d22", ["minimal", "smart"], ["spring", "summer"], 3, 2, 110, false,
    "A clean, high-neck sleeveless top. Works tucked into tailoring or jeans."],
  ["boots", "Black zip ankle boots", "shoes", "ankle boots", ["black"], "#1b1b1b", ["classic", "edgy"], ["autumn", "winter"], 3, 7, 6, false,
    "Smooth leather ankle boots with side zips and a low block heel."],
  ["trainers", "White leather trainers", "shoes", "trainers", ["white"], "#f4f4f4", ["casual", "minimal"], ["spring", "summer", "autumn"], 2, 10, 3, false,
    "Clean white leather trainers with perforated detailing."],
  ["tote", "Tan leather tote", "bag", "tote", ["tan"], "#a8683a", ["classic"], ["spring", "summer", "autumn", "winter"], 3, 5, 12, false,
    "A roomy tote in burnished tan leather. Big enough for a laptop."],
  ["satchel", "Grey buckle satchel", "bag", "satchel", ["grey"], "#8c8d90", ["preppy"], ["spring", "autumn"], 3, 1, 200, false,
    "A structured grey satchel with gold buckles and a top handle."],
  ["sunglasses", "Tortoiseshell sunglasses", "accessory", "sunglasses", ["tortoiseshell", "amber"], "#b5763f", ["retro"], ["spring", "summer"], 2, 3, 75, false,
    "Round sunglasses in a clear tortoiseshell frame with warm brown lenses."],
];

const old = db.prepare("SELECT id FROM User WHERE email = ?").get(DEMO_EMAIL);
if (old) {
  db.prepare("DELETE FROM User WHERE id = ?").run(old.id);
  await rm(path.join(uploads, old.id), { recursive: true, force: true });
}

const userId = randomUUID();
db.prepare("INSERT INTO User (id, email, name, passwordHash, tokenVersion, createdAt) VALUES (?, ?, ?, ?, 0, ?)").run(
  userId, DEMO_EMAIL, "Demo", bcrypt.hashSync(DEMO_PASSWORD, 10), daysAgo(300),
);
// The wardrobe belongs to a profile under the account; a second, empty profile shows the switcher.
const profileId = randomUUID();
db.prepare("INSERT INTO Profile (id, userId, name, accent, locale, styleNotes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
  profileId, userId, "Demo", "#7a2e2e", "en", "Clean lines, mostly neutrals with one strong colour.", daysAgo(300),
);
db.prepare("INSERT INTO Profile (id, userId, name, accent, locale, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(
  randomUUID(), userId, "Lotte", "#a8244f", "nl", daysAgo(100),
);

await mkdir(path.join(uploads, userId), { recursive: true });
async function store(file, kind) {
  const ext = path.extname(file);
  const relative = `${userId}/${kind}-demo-${randomBytes(4).toString("hex")}${ext}`;
  await copyFile(path.join(assets, file), path.join(uploads, relative));
  return relative;
}

const insert = db.prepare(`INSERT INTO Item
  (id, userId, profileId, name, category, subcategory, colors, colorHex, pattern, material, styles, seasons, formality, description,
   photoPath, imagePath, cutoutPath, aiTagged, favourite, wearCount, lastWornAt, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'solid', NULL, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`);

const ids = {};
for (const [n, [key, name, category, sub, colors, hex, styles, seasons, formality, worn, lastWorn, fave, description]] of WARDROBE.entries()) {
  const imagePath = await store(`${key}.jpg`, "item");
  const cutoutPath = await store(`${key}.png`, "cutout");
  ids[key] = randomUUID();
  insert.run(
    ids[key], userId, profileId, name, category, sub, JSON.stringify(colors), hex, JSON.stringify(styles), JSON.stringify(seasons), formality,
    description, imagePath, imagePath, cutoutPath, fave ? 1 : 0, worn, lastWorn === null ? null : daysAgo(lastWorn),
    // The dress was bought recently; everything else has been around for a while.
    key === "dress" ? daysAgo(10) : daysAgo(250 - n),
  );
}

// One saved look with styling advice, so the outfit screen has something to show.
const outfitId = randomUUID();
db.prepare(
  "INSERT INTO Outfit (id, userId, profileId, name, occasion, reasoning, advice, saved, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
).run(
  outfitId, userId, profileId, "Off-duty edge", "Weekend",
  "A crisp white tee keeps the biker from feeling heavy, and mid-blue denim sits between the two. White trainers repeat the tee, so the look reads clean rather than tough.",
  JSON.stringify([
    { kind: "add", text: "Your tortoiseshell sunglasses warm up all that black leather. Push them up into your hair on cloudy days.", itemId: ids.sunglasses, shopFor: null },
    { kind: "buy", text: "Tan suede loafers would take this from weekend to office-casual, and they'd work with your lace dress too.", itemId: null, shopFor: "tan suede loafers" },
    { kind: "swap", text: "Once it turns colder, trade the trainers for your black ankle boots and roll the jeans once.", itemId: ids.boots, shopFor: null },
  ]),
  daysAgo(1),
);
const link = db.prepare("INSERT INTO OutfitItem (outfitId, itemId, position) VALUES (?, ?, ?)");
["tee", "biker", "jeans", "trainers"].forEach((key, position) => link.run(outfitId, ids[key], position));

// A full-length photo to try outfits on with.
db.prepare("INSERT INTO SelfPhoto (id, userId, profileId, path, createdAt) VALUES (?, ?, ?, ?, ?)").run(
  randomUUID(), userId, profileId, await store("me.jpg", "self"), daysAgo(30),
);

console.log(`Demo wardrobe ready: ${WARDROBE.length} pieces, 1 saved look and a photo to try it on. Sign in as ${DEMO_EMAIL}.`);
