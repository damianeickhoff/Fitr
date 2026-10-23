/**
 * The studio-photo prompt, shared by the one-tap API route, the background
 * step after an upload and the "send to the ChatGPT app" route, so all three
 * ask for the same picture. The API gets the cut-out listing, the app gets
 * the photo as taken, which may show a whole outfit: hence the piece's name.
 */

export function studioPrompt(pieceName: string | null) {
  const piece = pieceName ? `the ${pieceName}` : "the clothing piece";
  return [
    `Turn this into a clean e-commerce product photo of only ${piece}.`,
    "Show the piece alone, neatly presented as a ghost-mannequin or flat-lay shot, centred on a plain soft light-grey studio background with gentle shadow.",
    "Keep its exact colours, fabric, proportions, logos and details. Portrait 4:5 framing. No text, no people, no props.",
  ].join("\n");
}

/**
 * A server restart drops the background queue but leaves the marker behind,
 * so a marker older than this is treated as a job that will never land. Long
 * enough for a "re-shoot all" of a large wardrobe to work through its queue.
 */
export const STUDIO_PENDING_FOR = 90 * 60 * 1000;

export function studioPending(item: { studioRequestedAt: Date | null }, now = new Date()) {
  return item.studioRequestedAt !== null && now.getTime() - item.studioRequestedAt.getTime() < STUDIO_PENDING_FOR;
}
