import "server-only";
import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";

/**
 * Everything that talks to Gemini goes through here: one client, one place
 * that turns API failures into sentences, and JSON output checked against the
 * same zod schema that described it to the model.
 */

const DEFAULT_MODEL = "gemini-3.8-flash";

export function aiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Image generation is not on Gemini's free tier, so it is opt-in by model name.
 * Which provider actually draws images is decided in image-gen.ts.
 */
export function geminiImagesEnabled() {
  return aiEnabled() && Boolean(process.env.GEMINI_IMAGE_MODEL);
}

export class AiError extends Error {}

let client: GoogleGenAI | null = null;
function ai() {
  if (!process.env.GEMINI_API_KEY) throw new AiError("Add a GEMINI_API_KEY to use AI features.");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** A message fit to show the user, for any error a Gemini call can throw. */
export function describeAiError(error: unknown): string {
  if (error instanceof AiError) return error.message;
  if (error instanceof ApiError) {
    if (error.status === 402) return "Gemini's prepaid credit is used up. Top it up in AI Studio to use AI features again.";
    if (error.status === 429) return "Gemini's free quota is used up for the moment. Wait a minute and try again.";
    if (error.status === 401 || error.status === 403 || (error.status === 400 && /api key/i.test(error.message))) {
      return "Gemini rejected the API key. Check GEMINI_API_KEY.";
    }
    if (error.status === 404) return "That Gemini model isn't available to this key. Check GEMINI_MODEL.";
    if (error.status >= 500) return "Gemini is having trouble right now. Try again shortly.";
    return `Gemini refused the request: ${error.message}`;
  }
  console.error("[gemini]", error);
  return "The AI request failed. Try again.";
}

export type ImageInput = { data: Buffer; mimeType?: string };

function imageParts(images: ImageInput[]): Part[] {
  return images.map((img) => ({
    inlineData: { data: img.data.toString("base64"), mimeType: img.mimeType ?? "image/jpeg" },
  }));
}

/**
 * Gemini accepts a subset of JSON Schema; the meta keys zod adds are not part
 * of it, so they are stripped before sending.
 */
function toGeminiSchema(schema: z.ZodType): unknown {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node)
          .filter(([key]) => key !== "$schema" && key !== "additionalProperties")
          .map(([key, value]) => [key, strip(value)]),
      );
    }
    return node;
  };
  return strip(z.toJSONSchema(schema));
}

export async function generateJson<T extends z.ZodType>(options: {
  prompt: string;
  schema: T;
  images?: ImageInput[];
  system?: string;
}): Promise<z.infer<T>> {
  const response = await ai().models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    contents: [{ role: "user", parts: [...imageParts(options.images ?? []), { text: options.prompt }] }],
    config: {
      systemInstruction: options.system,
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiSchema(options.schema),
    },
  });

  const text = response.text;
  if (!text) throw new AiError("Gemini returned an empty answer. Try again.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiError("Gemini's answer wasn't readable. Try again.");
  }
  const parsed = options.schema.safeParse(raw);
  if (!parsed.success) {
    console.error("[gemini] schema mismatch", parsed.error.issues.slice(0, 3), text.slice(0, 500));
    throw new AiError("Gemini's answer was missing details. Try again.");
  }
  return parsed.data;
}

/** One image out, from a prompt and reference images. Use image-gen.ts, which picks the provider. */
export async function geminiImage(prompt: string, images: ImageInput[]): Promise<Buffer> {
  const model = process.env.GEMINI_IMAGE_MODEL;
  if (!model) throw new AiError("Set GEMINI_IMAGE_MODEL to generate images.");
  const response = await ai().models.generateContent({
    model,
    contents: [{ role: "user", parts: [...imageParts(images), { text: prompt }] }],
    config: { responseModalities: ["IMAGE"] },
  });
  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new AiError("Gemini didn't return an image. Try again.");
  return Buffer.from(part.inlineData.data, "base64");
}
