import { afterEach, describe, expect, it, vi } from "vitest";
import { STUDIO_PENDING_FOR, studioPending, studioPrompt } from "@/lib/studio";
import { studioOnUpload } from "@/lib/studio-queue";

afterEach(() => vi.unstubAllEnvs());

describe("studioPrompt", () => {
  it("names the piece, or stays generic for an untagged one", () => {
    expect(studioPrompt("chelsea boots")).toContain("of only the chelsea boots.");
    expect(studioPrompt(null)).toContain("of only the clothing piece.");
  });
});

describe("studioPending", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  it("trusts a recent marker only", () => {
    expect(studioPending({ studioRequestedAt: null }, now)).toBe(false);
    expect(studioPending({ studioRequestedAt: new Date(now.getTime() - 60_000) }, now)).toBe(true);
    // A marker left behind by a restart stops showing the pill.
    expect(studioPending({ studioRequestedAt: new Date(now.getTime() - STUDIO_PENDING_FOR - 1) }, now)).toBe(false);
  });
});

describe("studioOnUpload", () => {
  function env(values: Record<string, string>) {
    for (const key of ["OPENAI_API_KEY", "GEMINI_API_KEY", "GEMINI_IMAGE_MODEL", "IMAGE_PROVIDER", "STUDIO_ON_UPLOAD"]) {
      vi.stubEnv(key, values[key] ?? "");
    }
  }

  it("is on by default once an image key is set", () => {
    env({});
    expect(studioOnUpload()).toBe(false);
    env({ OPENAI_API_KEY: "o" });
    expect(studioOnUpload()).toBe(true);
  });

  it("can be turned off for the instance", () => {
    for (const off of ["off", "false", "0", "No"]) {
      env({ OPENAI_API_KEY: "o", STUDIO_ON_UPLOAD: off });
      expect(studioOnUpload()).toBe(false);
    }
  });
});
