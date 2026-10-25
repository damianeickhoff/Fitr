# FITR — agent notes

A self-hosted wardrobe app: photos of clothes become shop-style listings,
Gemini puts outfits together and suggests what to add or buy. Next.js 16 (App
Router, React 19, Server Actions), Tailwind v4, SQLite via Prisma 7
(better-sqlite3), Gemini through `@google/genai`.

## Commands

- `npm run dev` — dev server (`prisma generate` runs first)
- `npm run build` / `npm start` — production (standalone output)
- `npm test` — vitest; `npm run typecheck`; `npm run lint`
- `npm run db:migrate` — create/apply a migration after editing the schema
- `npm run db:seed-demo` — demo account with an illustrated wardrobe

## Layout

- `src/app/(app)` — signed-in pages; `src/app/login` — sign-in.
- `src/app/api/images/[...path]` — serves stored photos to their owner only.
- `src/lib` — server logic. `*-actions.ts` are `"use server"` modules; the rest
  are server-only helpers. `garment.ts` and `storage-url.ts` are shared with
  the client.
- `src/generated/prisma` — generated, gitignored.

## Profiles, language, colour

- One account (sign-in) holds several profiles; a profile owns the wardrobe.
  Pages and actions call `requireProfile()` and filter by `profileId`; files on
  disk still live under the user's id. The chosen profile is a plain cookie.
- Every sentence lives in `src/lib/i18n.ts` (English and Dutch, typed against
  each other). Server code: `translator(profileLocale(profile))`; client
  components: `useT()`. AI prompts get the locale and answer in it.
- The accent colour is per profile, set on `<html>` as `--accent` by the root
  layout; use `bg-accent`/`text-accent`, never a hex. It must carry white
  text (`accentIsReadable` in `src/lib/colour.ts`).

## Conventions

- British English in code and copy: colour, favourite, normalise.
- Comments explain constraints and reasoning, not mechanics.
- Every Gemini call goes through `src/lib/gemini.ts`: `generateJson` checks the
  answer against the zod schema that described it, and `describeAiError` turns
  failures into user-facing sentences. AI features must degrade, never break:
  uploads save untagged and outfits fall back to `ruleOutfits` without a key.
- Model output referencing wardrobe ids is untrusted — filter ids against the
  user's real items before storing (see `cleanOutfits`).
- Image generation (studio photos, try-on) is not on Gemini's free tier and is
  gated on `GEMINI_IMAGE_MODEL` via `imageAiEnabled()`. With both providers set up a
  profile picks its own (`Profile.imageProvider`); pass `profile.imageProvider` to
  `generateImage`/`imageProvider` so the choice holds everywhere.
- Studio photos are the standard listing. With an image key, `addPhoto`
  answers with the cut-out first, then `after()` hands the new pieces to the
  in-memory queue in `src/lib/studio-queue.ts`, one picture at a time for the
  whole server; `STUDIO_ON_UPLOAD=off` turns that off. `studioRequestedAt`
  marks a piece as waiting (trusted for 90 minutes, as a restart drops the
  queue) and `studioAt` records that it has one. A failure keeps the
  cut-out, clears the marker and stops the rest of the batch. With or without
  a key the item page offers the free hand-off to the ChatGPT app; every route
  shares `studioPrompt` (`src/lib/studio.ts`) and `swapInStudio`.
- "In the wash" (`Item.inWashSince`, `src/lib/wash-actions.ts`) keeps a piece
  out of outfit suggestions unless it is the anchor. Read it only through
  `inWash(item, now)` in `src/lib/wardrobe.ts`: after 14 days a forgotten
  toggle lapses and the piece counts as back.
- Weather comes from Open-Meteo (free, no key) through `src/lib/weather.ts`:
  a profile's `latitude`/`longitude` (set on Me) give `forecast()` and
  `profileForecasts()`, cached in memory per place for an hour. They never
  throw; null means "show the plain weather chips". The forecast sentence is
  posted as the outfit request's weather, so keep its temperature first:
  `seasonFor` reads it for the rule-based fallback.
- Wearing is a history: one `Wear` row per piece per day, `wornOn` a
  "YYYY-MM-DD" day in the server's time zone (`dayKey` in `src/lib/wardrobe.ts`).
  Log and remove wears only through `logWears`/`removeWear` (`src/lib/wear.ts`):
  they keep `Item.wearCount` and `lastWornAt` (that day's midnight) in step,
  which the cards still read. The count can exceed the rows, as wears from
  before the history only left a number.
- Every new listing is judged, and a poor one gets an amber "retake" notice the
  user can act on or dismiss (`Item.qualityIssue`/`qualityNote`). Free local
  checks in `src/lib/photo-quality.ts` run first (exposure, blur, and whether
  the cut-out reaches the crop's edge or covers almost nothing; thresholds
  with their reasons at the top of that file). A certain finding is stored as
  it is; otherwise the detection's own `quality` answer counts, then one small
  `judgeListing` call looks at the finished listing. Without a key a local
  hunch is stored and the user decides. `replacePhoto` is `addPhoto` for one
  existing piece; a re-cut, a studio photo or "Keep it" clears the flag.
- Stored files are never rewritten in place; a change writes a new file, which
  is why the image route can cache forever.
- Phone only, by design: every screen is laid out for the 440px column that
  `PhoneStage` centres on wide screens. Don't add desktop breakpoints.
- Home-screen app: `src/app/manifest.ts` (Android) and the root layout's
  `appleWebApp`/`icons` metadata (iOS) are kept in step. Icons are rendered
  from `public/icon.svg` by `npm run icons`; commit the outputs. `public/sw.js`
  is registered in production builds only and caches just the `/offline`
  page with its static files and `/api/images/*` (immutable, newest 300);
  never other HTML or server actions. Bump its `VERSION` when changing it.
  `/offline`, `/sw.js` and the icons stay outside the sign-in gate in
  `src/proxy.ts`. `InstallHint` shows on the wardrobe page only.
- Testing a production build on `localhost` while other worktrees' servers
  run: they share the session cookie across ports, so use `127.0.0.1`.
- Warm paper look: cream page, near-white `panel`/`card` surfaces edged with a
  hairline (`src/components/ui.ts`), Nunito, a floating pill nav. No tags or
  monospace caps labels: status and categories are colourful pills (`pill()`),
  notes appear only when they say something (`src/lib/wardrobe.ts`).
- Exactly one copy of sharp may load: two libvips builds in one process crash
  it natively. `overrides` in package.json points the background remover at
  ours; `tests/images.test.ts` runs both together to catch a regression.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
