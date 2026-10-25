import type { Metadata } from "next";
import { headers } from "next/headers";
import { OfflineNotice } from "@/components/offline-notice";
import { localeFromAcceptLanguage } from "@/lib/i18n";

export const metadata: Metadata = { title: "Offline" };

/**
 * The page the service worker keeps for when the network is gone. It is
 * cached once and shown to whoever is holding the phone, so it speaks the
 * browser's language rather than a profile's.
 */
export default async function OfflinePage() {
  const locale = localeFromAcceptLanguage((await headers()).get("accept-language"));
  return <OfflineNotice serverLocale={locale} />;
}
