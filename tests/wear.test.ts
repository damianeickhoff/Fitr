import { describe, expect, it } from "vitest";
import { translator } from "@/lib/i18n";
import { dayKey, dayLabel, dayStart, isWearDay, monthGrid, recentlyWorn, shiftMonth } from "@/lib/wardrobe";

// Local time, as the days are kept in the server's calendar.
const now = new Date(2026, 9, 25, 10, 30); // Sunday 25 October 2026
const wear = (itemId: string, wornOn: string) => ({ itemId, wornOn });

describe("day keys", () => {
  it("round-trips a day through midnight", () => {
    expect(dayKey(now)).toBe("2026-10-25");
    expect(dayStart("2026-10-25")).toEqual(new Date(2026, 9, 25));
    expect(dayKey(dayStart("2026-03-01"))).toBe("2026-03-01");
  });

  it("accepts past days only, and only real ones", () => {
    expect(isWearDay("2026-10-25", now)).toBe(true);
    expect(isWearDay("2025-02-28", now)).toBe(true);
    expect(isWearDay("2026-10-26", now)).toBe(false);
    expect(isWearDay("2026-02-30", now)).toBe(false);
    expect(isWearDay("25-10-2026", now)).toBe(false);
  });

  it("steps months across the year", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("recentlyWorn", () => {
  it("keeps the last seven days including today, once per piece", () => {
    const wears = [wear("a", "2026-10-25"), wear("a", "2026-10-22"), wear("b", "2026-10-19"), wear("c", "2026-10-18"), wear("d", "2026-11-01")];
    expect(recentlyWorn(wears, now)).toEqual(["a", "b"]);
  });

  it("takes another window", () => {
    expect(recentlyWorn([wear("a", "2026-10-24"), wear("b", "2026-10-23")], now, 2)).toEqual(["a"]);
  });
});

describe("monthGrid", () => {
  it("lays October 2026 out in Monday-first weeks", () => {
    const weeks = monthGrid("2026-10", []);
    // 1 October 2026 is a Thursday: three blanks, then 31 days, then blanks to fill the week.
    expect(weeks).toHaveLength(5);
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0][3]).toMatchObject({ key: "2026-10-01", day: 1 });
    expect(weeks[4][5]).toMatchObject({ key: "2026-10-31", day: 31 });
    expect(weeks[4][6]).toBeNull();
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("puts each wear on its day, in order, and ignores other months", () => {
    const wears = [wear("a", "2026-10-14"), wear("b", "2026-10-14"), wear("c", "2026-10-02"), wear("x", "2026-09-30")];
    const days = monthGrid("2026-10", wears).flat();
    expect(days.find((d) => d?.key === "2026-10-14")?.wears.map((w) => w.itemId)).toEqual(["a", "b"]);
    expect(days.find((d) => d?.key === "2026-10-02")?.wears).toHaveLength(1);
    expect(days.reduce((n, d) => n + (d?.wears.length ?? 0), 0)).toBe(3);
  });

  it("handles a month starting on Monday and a leap February", () => {
    const weeks = monthGrid("2027-02", []); // 1 February 2027 is a Monday
    expect(weeks[0][0]).toMatchObject({ day: 1 });
    expect(weeks).toHaveLength(4);
    expect(monthGrid("2028-02", []).flat().filter(Boolean)).toHaveLength(29);
  });
});

describe("dayLabel", () => {
  it("says today and yesterday, then the short date", () => {
    expect(dayLabel("2026-10-25", now)).toBe("Today");
    expect(dayLabel("2026-10-24", now)).toBe("Yesterday");
    expect(dayLabel("2026-10-14", now)).toBe("Wed 14 Oct");
    expect(dayLabel("2025-10-14", now)).toBe("Tue 14 Oct 2025");
  });

  it("speaks Dutch", () => {
    const nl = translator("nl");
    expect(dayLabel("2026-10-24", now, nl)).toBe("Gisteren");
    expect(dayLabel("2026-10-14", now, nl)).toBe("Wo 14 okt");
  });
});
