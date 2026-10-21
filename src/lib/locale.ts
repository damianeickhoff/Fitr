import "server-only";
import { headers } from "next/headers";
import { getCurrentProfile } from "./auth";
import { isLocale, localeFromAcceptLanguage, translator, type Locale } from "./i18n";

/** The open profile's language; before sign-in, whatever the browser asks for. */
export async function currentLocale(): Promise<Locale> {
  const profile = await getCurrentProfile();
  if (profile && isLocale(profile.locale)) return profile.locale;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}

/** A translator for the current request. Pages with a profile in hand can call `translator(profile.locale)` directly. */
export async function getT() {
  return translator(await currentLocale());
}

export function profileLocale(profile: { locale: string }): Locale {
  return isLocale(profile.locale) ? profile.locale : "en";
}
