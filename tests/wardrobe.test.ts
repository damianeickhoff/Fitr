import { describe, expect, it } from "vitest";
import { translator } from "@/lib/i18n";
import { addedLabel, byLastWorn, inWash, isIdle, neverWorn, wardrobeNotes, wornLabel } from "@/lib/wardrobe";

const now = new Date("2026-10-15T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
const piece = (id: string, wearCount: number, lastWorn: number | null, created = 200) => ({
  id,
  wearCount,
  lastWornAt: lastWorn === null ? null : daysAgo(lastWorn),
  createdAt: daysAgo(created),
});
const nl = translator("nl");

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

  it("speaks Dutch when the profile does", () => {
    expect(wardrobeNotes([piece("a", 2, 110)], now, nl).get("a")?.text).toBe("Niet gedragen sinds juni");
    expect(wardrobeNotes([piece("a", 0, null, 10)], now, nl).get("a")?.text).toBe("Nog te dragen");
  });
});

describe("isIdle", () => {
  it("fades pieces not worn for two months", () => {
    expect(isIdle(piece("a", 3, 59), now)).toBe(false);
    expect(isIdle(piece("a", 3, 61), now)).toBe(true);
  });
});

describe("wornLabel", () => {
  it("says when a piece was last worn the way people do", () => {
    expect(wornLabel(piece("a", 1, 0), now)).toEqual({ text: "Worn today", never: false });
    expect(wornLabel(piece("a", 1, 1), now).text).toBe("Worn yesterday");
    expect(wornLabel(piece("a", 1, 3), now).text).toBe("3 days ago");
    expect(wornLabel(piece("a", 1, 7), now).text).toBe("1 week ago");
    expect(wornLabel(piece("a", 1, 20), now).text).toBe("2 weeks ago");
  });

  it("falls back to the month once it is further back than a month", () => {
    expect(wornLabel(piece("a", 1, 60), now).text).toBe("August");
    expect(wornLabel(piece("a", 1, 400), now).text).toBe("September 2025");
  });

  it("flags a piece never worn, whatever its dates say", () => {
    expect(wornLabel(piece("a", 0, null), now)).toEqual({ text: "Never worn", never: true });
    expect(wornLabel(piece("a", 0, null), now, nl).text).toBe("Nooit gedragen");
    expect(wornLabel(piece("a", 1, 2), now, nl).text).toBe("2 dagen geleden");
    expect(wornLabel(piece("a", 1, 60), now, nl).text).toBe("Augustus");
  });
});

describe("addedLabel", () => {
  it("dates a piece in the profile's language", () => {
    expect(addedLabel(piece("a", 0, null, 10), now)).toBe("Added 5 October");
    expect(addedLabel(piece("a", 0, null, 10), now, nl)).toBe("Toegevoegd 5 oktober");
    expect(addedLabel(piece("a", 0, null, 400), now)).toBe("Added 10 September 2025");
  });
});

describe("neverWorn", () => {
  it("splits the never-worn pieces by how long they have waited, oldest first", () => {
    const { old, recent } = neverWorn([piece("new", 0, null, 10), piece("worn", 4, 2), piece("older", 0, null, 120), piece("oldest", 0, null, 300)], now);
    expect(old.map((i) => i.id)).toEqual(["oldest", "older"]);
    expect(recent.map((i) => i.id)).toEqual(["new"]);
  });
});

describe("byLastWorn", () => {
  it("puts the most recently worn first and the never worn last", () => {
    const order = byLastWorn([piece("never-old", 0, null, 100), piece("week", 2, 7), piece("never-new", 0, null, 3), piece("today", 1, 0)]);
    expect(order.map((i) => i.id)).toEqual(["today", "week", "never-new", "never-old"]);
  });
});

describe("inWash", () => {
  it("is out when never put in the wash", () => {
    expect(inWash({ inWashSince: null }, now)).toBe(false);
  });

  it("is in for a fortnight", () => {
    expect(inWash({ inWashSince: daysAgo(0) }, now)).toBe(true);
    expect(inWash({ inWashSince: daysAgo(14) }, now)).toBe(true);
  });

  it("quietly counts as back once forgotten for longer", () => {
    expect(inWash({ inWashSince: daysAgo(15) }, now)).toBe(false);
  });
});
