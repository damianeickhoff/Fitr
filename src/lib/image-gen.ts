import "server-only";
import OpenAI, { APIError, toFile } from "openai";
import { AiError, describeAiError, geminiImage, geminiImagesEnabled, type ImageInput } from "./gemini";

/**
 * Studio photos and try-on need an image model, and neither provider offers
 * one for free. FITR can use either: OpenAI's GPT Image (what ChatGPT draws
 * with) or Gemini's. When both are configured a profile can pick its own on
 * the Me page; failing that IMAGE_PROVIDER decides, and failing that
 * whichever has a key wins, OpenAI first.
 */
export type ImageProvider = "openai" | "gemini";

export const PROVIDER_NAME: Record<ImageProvider, string> = { openai: "ChatGPT", gemini: "Gemini" };

export function isImageProvider(value: unknown): value is ImageProvider {
  return value === "openai" || value === "gemini";
}

const OPENAI_DEFAULT_MODEL = "gpt-image-2.5-sunburst";

function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** The providers the server has keys for, in the order the Me page offers them. */
export function configuredImageProviders(): ImageProvider[] {
  const list: ImageProvider[] = [];
  if (openaiConfigured()) list.push("openai");
  if (geminiImagesEnabled()) list.push("gemini");
  return list;
}

/** `preferred` is the profile's choice; it only counts when that provider is set up. */
export function imageProvider(preferred?: string | null): ImageProvider | null {
  if (isImageProvider(preferred) && configuredImageProviders().includes(preferred)) return preferred;
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
export function imageModelLabel(preferred?: string | null) {
  const provider = imageProvider(preferred);
  return provider ? `${PROVIDER_NAME[provider]} · ${imageModelName(provider)}` : null;
}

export function imageModelName(provider: ImageProvider) {
  return provider === "openai" ? process.env.OPENAI_IMAGE_MODEL || OPENAI_DEFAULT_MODEL : (process.env.GEMINI_IMAGE_MODEL ?? "");
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
    quality: (process.env.OPENAI_IMAGE_QUALITY as "low" | "medium" | "high" | undefined) || "medium",
    output_format: "jpeg",
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new AiError("ChatGPT didn't return an image. Try again.");
  return Buffer.from(b64, "base64");
}

/** One image out, from a prompt and reference images, by the profile's provider or whichever is set up. */
export async function generateImage(prompt: string, images: ImageInput[], preferred?: string | null): Promise<Buffer> {
  const provider = imageProvider(preferred);
  if (provider === "openai") return openaiImage(prompt, images);
  if (provider === "gemini") return geminiImage(prompt, images);
  throw new AiError("Add an OPENAI_API_KEY (or GEMINI_IMAGE_MODEL) to generate images.");
}

/** A message fit to show the user, for any error either provider can throw. */
export function describeImageError(error: unknown): string {
  // The sentence below is a guess from the status; the provider's own words
  // are what tell a real rate limit from a billing or tier problem.
  if (error instanceof APIError) {
    console.error("[image]", { status: error.status, code: error.code, type: error.type, message: error.message, requestId: error.requestID });
  } else {
    console.error("[image]", error);
  }
  if (error instanceof APIError) {
    if (error.status === 401) return "OpenAI rejected the API key. Check OPENAI_API_KEY.";
    // An empty balance arrives as a 429 too, told apart only by code or type.
    if (
      error.type === "insufficient_quota" ||
      ["insufficient_quota", "billing_hard_limit_reached", "credit_balance_exhausted"].includes(error.code ?? "")
    ) {
      return "Your OpenAI account has no credit left. Add some at platform.openai.com → Billing.";
    }
    if (error.status === 429) {
      return "OpenAI is rate-limiting requests. If waiting a minute doesn't help, the account may have no prepaid credit yet or be below the usage tier this image model needs: OpenAI answers those with the same error. Check platform.openai.com → Billing and → Limits.";
    }
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
