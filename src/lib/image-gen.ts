import "server-only";
import OpenAI, { APIError, toFile } from "openai";
import { AiError, describeAiError, geminiImage, geminiImagesEnabled, type ImageInput } from "./gemini";

/**
 * Studio photos and try-on need an image model, and neither provider offers
 * one for free. FITR can use either: OpenAI's GPT Image (what ChatGPT draws
 * with) or Gemini's. IMAGE_PROVIDER picks one when both are configured;
 * otherwise whichever has a key wins, OpenAI first.
 */
export type ImageProvider = "openai" | "gemini";

const OPENAI_DEFAULT_MODEL = "gpt-image-2.5-sunburst";

function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function imageProvider(): ImageProvider | null {
  const wanted = process.env.IMAGE_PROVIDER?.toLowerCase();
  if (wanted === "openai") return openaiConfigured() ? "openai" : null;
  if (wanted === "gemini") return geminiImagesEnabled() ? "gemini" : null;
  if (openaiConfigured()) return "openai";
  if (geminiImagesEnabled()) return "gemini";
  return null;
}

export function imageAiEnabled() {
  return imageProvider() !== null;
}

/** Shown on the Me page, so the user can see what is drawing their images. */
export function imageModelLabel() {
  const provider = imageProvider();
  if (provider === "openai") return `ChatGPT · ${process.env.OPENAI_IMAGE_MODEL || OPENAI_DEFAULT_MODEL}`;
  if (provider === "gemini") return `Gemini · ${process.env.GEMINI_IMAGE_MODEL}`;
  return null;
}

let openai: OpenAI | null = null;

async function openaiImage(prompt: string, images: ImageInput[]): Promise<Buffer> {
  openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const files = await Promise.all(
    images.map((img, n) => toFile(img.data, `reference-${n + 1}.jpg`, { type: img.mimeType ?? "image/jpeg" })),
  );
  const response = await openai.images.edit({
    model: process.env.OPENAI_IMAGE_MODEL || OPENAI_DEFAULT_MODEL,
    image: files,
    prompt,
    // Portrait, like the listings and a full-length photo of a person.
    size: "1024x1536",
    // Cost scales with quality; medium is plenty for a phone screen.
    quality: (process.env.OPENAI_IMAGE_QUALITY as "low" | "medium" | "high" | undefined) ?? "medium",
    output_format: "jpeg",
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new AiError("ChatGPT didn't return an image. Try again.");
  return Buffer.from(b64, "base64");
}

/** One image out, from a prompt and reference images, by whichever provider is set up. */
export async function generateImage(prompt: string, images: ImageInput[]): Promise<Buffer> {
  const provider = imageProvider();
  if (provider === "openai") return openaiImage(prompt, images);
  if (provider === "gemini") return geminiImage(prompt, images);
  throw new AiError("Add an OPENAI_API_KEY (or GEMINI_IMAGE_MODEL) to generate images.");
}

/** A message fit to show the user, for any error either provider can throw. */
export function describeImageError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.status === 401) return "OpenAI rejected the API key. Check OPENAI_API_KEY.";
    if (error.code === "insufficient_quota" || error.code === "billing_hard_limit_reached") {
      return "Your OpenAI account has no credit left. Add some at platform.openai.com → Billing.";
    }
    if (error.status === 429) return "OpenAI is rate-limiting requests. Wait a minute and try again.";
    if (error.status === 403) {
      return "OpenAI needs your organisation verified before it allows image models. Do that at platform.openai.com → Settings → Organization.";
    }
    if (error.code === "moderation_blocked" || /safety|moderation/i.test(error.message)) {
      return "OpenAI's safety filter declined this image. Try a different photo.";
    }
    if (error.status === 404) return "That OpenAI image model isn't available to this key. Check OPENAI_IMAGE_MODEL.";
    if (error.status >= 500) return "OpenAI is having trouble right now. Try again shortly.";
    return `OpenAI refused the request: ${error.message}`;
  }
  return describeAiError(error);
}
