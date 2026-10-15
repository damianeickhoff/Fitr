import { describe, expect, it } from "vitest";
import { isIdle, wardrobeNotes } from "@/lib/wardrobe";

const now = new Date("2026-10-15T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
const piece = (id: string, wearCount: number, lastWorn: number | null, created = 200) => ({
  id,
  wearCount,
  lastWornAt: lastWorn === null ? null : daysAgo(lastWorn),
  createdAt: daysAgo(created),
});

describe("wardrobeNotes", () => {
  it("says nothing about ordinary pieces", () => {
    // Worn, recently, but not often enough for "most worn" to mean anything.
    expect(wardrobeNotes([piece("a", 2, 5), piece("b", 1, 10)], now).size).toBe(0);
  });

  it("marks the most worn piece once it has been worn a few times", () => {
    const notes = wardrobeNotes([piece("a", 12, 1), piece("b", 2, 3)], now);
    expect(notes.get("a")).toEqual({ text: "Most worn", tone: "green" });
    expect(notes.has("b")).toBe(false);
  });

  it("names the month a forgotten piece was last worn", () => {
    expect(wardrobeNotes([piece("a", 2, 110)], now).get("a")?.text).toBe("Not worn since June");
  });

  it("adds the year when it was last worn in an earlier year", () => {
    expect(wardrobeNotes([piece("a", 2, 400)], now).get("a")?.text).toBe("Not worn since September 2025");
  });

  it("treats a new piece as still to wear, then as forgotten", () => {
    expect(wardrobeNotes([piece("a", 0, null, 10)], now).get("a")?.text).toBe("Still to wear");
    expect(wardrobeNotes([piece("a", 0, null, 45)], now).get("a")?.text).toBe("Never worn yet");
  });
});

describe("isIdle", () => {
  it("fades pieces not worn for two months", () => {
    expect(isIdle(piece("a", 3, 59), now)).toBe(false);
    expect(isIdle(piece("a", 3, 61), now)).toBe(true);
  });
});
