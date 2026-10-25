import { describe, expect, it } from "vitest";
import { translator } from "@/lib/i18n";
import { seasonFor } from "@/lib/outfits";
import { conditionFor, forecastSentence, forecastShort, type Forecast } from "@/lib/weather";

const base: Forecast = { day: "tomorrow", max: 14, min: 9, rainChance: 80, wind: 35, condition: "rain" };

describe("forecastSentence", () => {
  it("reads like a line from the forecast, in both languages", () => {
    expect(forecastSentence(base, translator("en"))).toBe("Tomorrow: 9 to 14 °C, rain likely, windy");
    expect(forecastSentence(base, translator("nl"))).toBe("Morgen: 9 tot 14 °C, waarschijnlijk regen, winderig");
  });

  it("names the sky on a dry day and only mentions rain when it might come", () => {
    const dry = { ...base, day: "today" as const, max: 24, min: 15, rainChance: 5, wind: 10, condition: "clear" as const };
    expect(forecastSentence(dry, translator("en"))).toBe("Today: 15 to 24 °C, sunny");
    expect(forecastSentence({ ...dry, condition: "cloudy", rainChance: 40 }, translator("en"))).toBe(
      "Today: 15 to 24 °C, cloudy, a chance of rain",
    );
  });

  it("keeps snow and storms in the sentence", () => {
    const snow = { ...base, max: 1, min: -4, condition: "snow" as const, wind: 60 };
    expect(forecastSentence(snow, translator("en"))).toBe("Tomorrow: -4 to 1 °C, snow, stormy");
  });

  it("shortens to the warmest figure for the wardrobe nudge", () => {
    expect(forecastShort({ ...base, max: 7 }, translator("en"))).toBe("Tomorrow: 7 °C and rain");
    expect(forecastShort({ ...base, rainChance: 0, condition: "cloudy" }, translator("nl"))).toBe("Morgen: 14 °C en bewolkt");
  });
});

describe("conditionFor", () => {
  it("folds WMO codes into what matters for clothes", () => {
    expect(conditionFor(0)).toBe("clear");
    expect(conditionFor(3)).toBe("cloudy");
    expect(conditionFor(53)).toBe("drizzle");
    expect(conditionFor(81)).toBe("rain");
    expect(conditionFor(75)).toBe("snow");
    expect(conditionFor(95)).toBe("thunder");
  });
});

describe("seasonFor", () => {
  it("goes by the warmest temperature in a forecast sentence", () => {
    expect(seasonFor("Tomorrow: 2 to 8 °C, rain likely")).toBe("winter");
    expect(seasonFor("Today: 16 to 25 °C, sunny")).toBe("summer");
    expect(seasonFor("Morgen: 9 tot 14 °C, waarschijnlijk regen")).toBeNull();
    expect(seasonFor("Today: -6 to -1 °C, snow")).toBe("winter");
  });

  it("still understands the weather chips", () => {
    expect(seasonFor("Cold")).toBe("winter");
    expect(seasonFor("Hot")).toBe("summer");
    expect(seasonFor("Mild")).toBeNull();
  });
});
