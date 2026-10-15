/**
 * The try-on prompt, shared by the one-tap API route and the "send to the
 * ChatGPT app" route so both ask for the same picture. The app route may get
 * the photos as separate images or as one collage, so the prompt describes the
 * person and the clothes rather than counting images.
 */

export type TryOnSource = "openai" | "gemini" | "chatgpt-app";

export const SOURCE_LABEL: Record<TryOnSource, string> = {
  openai: "ChatGPT API",
  gemini: "Gemini",
  "chatgpt-app": "ChatGPT app",
};

export function tryOnPrompt(pieceNames: string[]) {
  const list = pieceNames.map((name, n) => `${n + 1}. ${name}`).join("\n");
  return [
    "Make a realistic photo of me wearing this outfit.",
    "The photo of a person is me. The other pictures show the clothes, numbered:",
    list,
    "",
    "Keep my face, hair, skin tone, body shape and pose, and the background and lighting of my photo.",
    "Copy each piece's colour, fabric, pattern and details exactly, fitted naturally to my body, and replace what I'm wearing now.",
    "Full length, portrait format, photographic. No text, no collage: one photo of me.",
  ].join("\n");
}
