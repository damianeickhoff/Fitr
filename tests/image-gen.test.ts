import { afterEach, describe, expect, it, vi } from "vitest";
import { APIError } from "openai";
import { describeImageError, imageModelLabel, imageProvider } from "@/lib/image-gen";

afterEach(() => vi.unstubAllEnvs());

function env(values: Record<string, string>) {
  for (const key of ["OPENAI_API_KEY", "GEMINI_API_KEY", "GEMINI_IMAGE_MODEL", "IMAGE_PROVIDER", "OPENAI_IMAGE_MODEL"]) {
    vi.stubEnv(key, values[key] ?? "");
  }
}

describe("imageProvider", () => {
  it("is off without any image key", () => {
    env({ GEMINI_API_KEY: "g" });
    expect(imageProvider()).toBeNull();
  });

  it("uses ChatGPT when an OpenAI key is set", () => {
    env({ OPENAI_API_KEY: "o" });
    expect(imageProvider()).toBe("openai");
    expect(imageModelLabel()).toBe("ChatGPT · gpt-image-2.5-sunburst");
  });

  it("uses Gemini when only its image model is set", () => {
    env({ GEMINI_API_KEY: "g", GEMINI_IMAGE_MODEL: "gemini-3.1-flash-image" });
    expect(imageProvider()).toBe("gemini");
  });

  it("prefers OpenAI when both are set, unless told otherwise", () => {
    env({ OPENAI_API_KEY: "o", GEMINI_API_KEY: "g", GEMINI_IMAGE_MODEL: "m" });
    expect(imageProvider()).toBe("openai");
    env({ OPENAI_API_KEY: "o", GEMINI_API_KEY: "g", GEMINI_IMAGE_MODEL: "m", IMAGE_PROVIDER: "gemini" });
    expect(imageProvider()).toBe("gemini");
  });

  it("stays off when the chosen provider has no key", () => {
    env({ GEMINI_API_KEY: "g", GEMINI_IMAGE_MODEL: "m", IMAGE_PROVIDER: "openai" });
    expect(imageProvider()).toBeNull();
  });
});

describe("describeImageError", () => {
  const openai429 = (code: string, type: string) =>
    APIError.generate(429, { error: { code, type, message: "429 from OpenAI" } }, undefined, new Headers());

  it("tells an empty balance from a real rate limit", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(describeImageError(openai429("credit_balance_exhausted", "insufficient_quota"))).toMatch(/no credit left/);
    expect(describeImageError(openai429("rate_limit_exceeded", "requests"))).toMatch(/rate-limiting/);
  });
});
