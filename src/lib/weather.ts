import "server-only";
import type { Locale, MessageKey, Translate } from "./i18n";
import { translator } from "./i18n";

export type Day = "today" | "tomorrow";

export const CONDITIONS = ["clear", "partlyCloudy", "cloudy", "fog", "drizzle", "rain", "snow", "thunder"] as const;
export type Condition = (typeof CONDITIONS)[number];

/** One day's weather, whichever day it is. */
export type Reading = {
  /** °C, rounded. */
  max: number;
  min: number;
  /** Highest chance of rain in the day, 0–100. */
  rainChance: number;
  /** Strongest wind of the day, km/h. */
  wind: number;
  condition: Condition;
};

export type Forecast = Reading & { day: Day };

/** WMO weather interpretation codes, as Open-Meteo reports them, folded into what matters for clothes. */
export function conditionFor(code: number): Condition {
  if (code <= 1) return "clear";
  if (code === 2) return "partlyCloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunder";
  return "rain";
}

const WINDY_KMH = 30;
const STORMY_KMH = 55;

/** Rain that's worth dressing for: the forecast says it's wet, or more likely than not. */
export function rainLikely(f: Reading) {
  return f.rainChance >= 60 || ((f.condition === "rain" || f.condition === "drizzle") && f.rainChance >= 40);
}

/**
 * "Tomorrow: 9 to 14 °C, rain likely, windy". The stylist reads it as the
 * weather and `seasonFor` finds the temperature in it, so the numbers stay first.
 * A day of a trip is named by its date instead ("Mon 3 Nov: …").
 */
export function forecastSentence(f: Reading & { day?: Day }, t: Translate, label = t(`weather.${f.day ?? "today"}`)) {
  const parts = [t("weather.range", { min: f.min, max: f.max })];
  if (f.condition === "snow" || f.condition === "thunder") parts.push(t(`weather.sky.${f.condition}` as MessageKey));
  else if (rainLikely(f)) parts.push(t("weather.rainLikely"));
  else {
    parts.push(t(`weather.sky.${f.condition}` as MessageKey));
    if (f.rainChance >= 30) parts.push(t("weather.rainChance"));
  }
  if (f.wind >= STORMY_KMH) parts.push(t("weather.stormy"));
  else if (f.wind >= WINDY_KMH) parts.push(t("weather.windy"));
  return `${label}: ${parts.join(", ")}`;
}

/** "Tomorrow: 7 °C and rain", for the nudge on the wardrobe. */
export function forecastShort(f: Forecast, t: Translate) {
  const sky = f.condition === "snow" || f.condition === "thunder" || !rainLikely(f) ? f.condition : "rain";
  return t("weather.short", { day: t(`weather.${f.day}`), max: f.max, sky: t(`weather.sky.${sky}` as MessageKey).toLowerCase() });
}

type Daily = {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_probability_max: (number | null)[];
  wind_speed_10m_max: (number | null)[];
  weather_code: (number | null)[];
};

/** How far ahead Open-Meteo forecasts. Today counts as the first day. */
export const FORECAST_DAYS = 16;

/** A day of the forecast, by the place's own calendar date. */
type Dated = Reading & { date: string };
type Cached = { at: number; days: Dated[] | null };

const HOUR = 60 * 60 * 1000;
/** A failed fetch is retried sooner than a good one is refreshed, but not on every page view. */
const RETRY = 10 * 60 * 1000;

/**
 * On globalThis, like the studio queue, so dev reloads share it. Keyed by
 * place: one request brings the whole range, which outfits (today, tomorrow)
 * and trips (any day of the stay) both read from.
 */
const cache: Map<string, Cached> = ((globalThis as { __fitrForecasts?: Map<string, Cached> }).__fitrForecasts ??= new Map());

async function fetchDays(lat: number, lon: number): Promise<Dated[] | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code",
    timezone: "auto",
    forecast_days: String(FORECAST_DAYS),
  }).toString();
  try {
    // Pages wait for this, so a slow weather service must not hold them up for long.
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!res.ok) return null;
    const { daily } = (await res.json()) as { daily?: Daily };
    if (!daily?.time) return null;
    return daily.time.flatMap((date, n): Dated[] => {
      const max = daily.temperature_2m_max?.[n];
      const min = daily.temperature_2m_min?.[n];
      const code = daily.weather_code?.[n];
      if (typeof max !== "number" || typeof min !== "number" || typeof code !== "number") return [];
      return [
        {
          date,
          max: Math.round(max),
          min: Math.round(min),
          rainChance: daily.precipitation_probability_max?.[n] ?? 0,
          wind: Math.round(daily.wind_speed_10m_max?.[n] ?? 0),
          condition: conditionFor(code),
        },
      ];
    });
  } catch {
    return null;
  }
}

async function daysAt(lat: number, lon: number) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const now = Date.now();
  let hit = cache.get(key);
  if (!hit || now - hit.at > (hit.days ? HOUR : RETRY)) {
    hit = { at: now, days: await fetchDays(lat, lon) };
    cache.set(key, hit);
  }
  return hit.days;
}

export type DayForecast = Forecast & { sentence: string; short: string };

/** Today's or tomorrow's weather at a place, or null when the forecast can't be had. Never throws. */
export async function forecast(lat: number, lon: number, day: Day, locale: Locale): Promise<DayForecast | null> {
  // The first two days are the place's today and tomorrow, which is what the outfit chips mean.
  const days = await daysAt(lat, lon);
  const reading = days?.[day === "today" ? 0 : 1];
  if (!reading) return null;
  const f: Forecast = { ...reading, day };
  const t = translator(locale);
  return { ...f, sentence: forecastSentence(f, t), short: forecastShort(f, t) };
}

/**
 * The forecast for each of these calendar days at a place, null for a day it
 * doesn't cover (past, beyond the range, or a failed fetch). Never throws.
 */
export async function forecastFor(lat: number, lon: number, dates: string[]): Promise<Map<string, Reading | null>> {
  const days = await daysAt(lat, lon);
  return new Map(
    dates.map((date) => {
      const hit = days?.find((d) => d.date === date);
      if (!hit) return [date, null];
      return [date, { max: hit.max, min: hit.min, rainChance: hit.rainChance, wind: hit.wind, condition: hit.condition }];
    }),
  );
}

export async function profileForecasts(profile: { latitude: number | null; longitude: number | null }, locale: Locale) {
  if (profile.latitude == null || profile.longitude == null) return null;
  const [today, tomorrow] = await Promise.all([
    forecast(profile.latitude, profile.longitude, "today", locale),
    forecast(profile.latitude, profile.longitude, "tomorrow", locale),
  ]);
  return today && tomorrow ? { today, tomorrow } : null;
}

export type Place = { name: string; admin1: string | null; country: string | null; latitude: number; longitude: number };

/** Up to five towns matching what was typed, named in the profile's language. Null when the lookup fails. */
export async function findPlaces(query: string, locale: Locale): Promise<Place[] | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: query, count: "5", language: locale, format: "json" }).toString();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return null;
    const { results } = (await res.json()) as {
      results?: { name?: string; admin1?: string; country?: string; latitude?: number; longitude?: number }[];
    };
    return (results ?? []).flatMap((r) =>
      r.name && typeof r.latitude === "number" && typeof r.longitude === "number"
        ? [{ name: r.name, admin1: r.admin1 ?? null, country: r.country ?? null, latitude: r.latitude, longitude: r.longitude }]
        : [],
    );
  } catch {
    return null;
  }
}
