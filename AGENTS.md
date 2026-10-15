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
  gated on `GEMINI_IMAGE_MODEL` via `imageAiEnabled()`.
- Stored files are never rewritten in place; a change writes a new file, which
  is why the image route can cache forever.
- Phone only, by design: every screen is laid out for the 440px column that
  `PhoneStage` centres on wide screens. Don't add desktop breakpoints.
- No tags or monospace caps labels: status and categories are colourful pills
  (`pill()` in `src/components/ui.ts`), notes appear only when they say
  something (`src/lib/wardrobe.ts`).
- Exactly one copy of sharp may load: two libvips builds in one process crash
  it natively. `overrides` in package.json points the background remover at
  ours; `tests/images.test.ts` runs both together to catch a regression.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
