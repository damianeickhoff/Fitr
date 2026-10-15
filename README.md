# FITR

Your wardrobe, shopped like a store. Photograph the clothes you own and FITR
turns each piece into a shop-style listing, puts outfits together from them,
and tells you what would finish a look — an accessory you already have, or the
kind of shoes worth buying.

## What it does

- **Add pieces** — take a photo (or pick several). Gemini finds every garment
  in it and names and describes it like a product listing; FITR cuts each one
  out of its background and frames it like a shop photo. A photo of a whole
  outfit becomes several pieces.
- **Wardrobe** — a product grid with a small "9× worn" pill on each photo, and a
  coloured note only when it matters (most worn, still to wear, not worn since
  June). Pieces you've neglected fade, and the wardrobe tells you how many miss you.
- **Outfits** — pick an occasion and the weather (or start from one piece) and
  the stylist puts three outfits together, laid out as a flat lay from the
  cut-outs. Each comes with tips: what to add from your wardrobe (one tap adds
  it), what to swap, and what to buy, with a shopping link.
- **Shop tips** — a look across your whole wardrobe: your style and palette, the
  few purchases that would unlock the most new outfits, accessory ideas, and
  forgotten pieces worth wearing again.
- **Try-on** — upload photos of yourself and see an outfit on you. Needs an
  image model (see below).

## AI

FITR runs on Gemini's free tier. Get a key at
[Google AI Studio](https://aistudio.google.com/apikey) and put it in `.env`:

```
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-3.8-flash"   # optional; any free-tier text+vision model
```

Without a key the app still works: photos are saved untagged for you to fill
in, and outfits are matched by simple colour rules.

**Try-on for free:** each outfit has a "Send to ChatGPT" button that hands your
photo, the pieces and a ready-made prompt to the ChatGPT app, so the picture is
made on your own ChatGPT subscription; "Add its picture" brings the result back.
On a phone over HTTPS this opens the share menu; elsewhere it copies the prompt,
downloads the photos as one collage and opens ChatGPT in a new tab.

**One-tap studio photos and try-on** need an image model, and no provider offers one
for free. The simplest is ChatGPT's: put an OpenAI API key in `.env` as
`OPENAI_API_KEY` (from platform.openai.com/api-keys, with some API credit — a
ChatGPT Plus subscription doesn't cover the API). `OPENAI_IMAGE_QUALITY`
(low/medium/high) trades looks for cost. Gemini's image model works too: set
`GEMINI_IMAGE_MODEL` on a billed Gemini key, and `IMAGE_PROVIDER` if both are
configured.

**Cut-outs** don't use Gemini at all: background removal runs on the server
with a local model from `@imgly/background-removal-node`, about a second per
piece, free. That package is AGPL-3.0 — fine for running FITR yourself, worth
knowing before distributing it.

## Phone first

FITR is built for phones only. On a computer the same phone layout sits in a
centred column, so testing in a desktop browser is testing the real thing
(F12 → device toolbar gives exact phone sizes). Beside the column, wide screens
show a QR code to open FITR on your phone. During development it points at
your PC's network address, so a phone on the same wifi can scan it — allow
Node through the Windows firewall if it doesn't load. Installing FITR to a
phone's home screen needs HTTPS, so do that once it runs behind your reverse
proxy.

## Running it

```bash
npm install
cp .env.example .env    # then fill in AUTH_SECRET and GEMINI_API_KEY
npx prisma migrate deploy
npm run dev
```

Open http://localhost:3000 and create an account. To look around with a
ready-made wardrobe, run `npm run db:seed-demo` and sign in with the demo
account in `scripts/seed-demo.mjs`.

Photos are stored under `data/uploads` (or `UPLOADS_DIR`), the database at
`data/fitr.db`. Back up `data/` and you've backed up everything.
