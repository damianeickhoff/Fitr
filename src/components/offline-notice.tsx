"use client";

import { RotateCw, WifiOff } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { localeFromAcceptLanguage, translator, type Locale } from "@/lib/i18n";
import { button, cx } from "./ui";
import { Wordmark } from "./wordmark";

const noSubscription = () => () => {};
const browserLocale = () => localeFromAcceptLanguage(navigator.languages.join(","));

export function OfflineNotice({ serverLocale }: { serverLocale: Locale }) {
  const locale = useSyncExternalStore(noSubscription, browserLocale, () => serverLocale);
  const t = useMemo(() => translator(locale), [locale]);

  return (
    <main lang={locale} className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <Wordmark className="text-3xl" />
      <span className="mt-10 grid size-14 place-items-center rounded-full bg-accent text-white">
        <WifiOff size={26} strokeWidth={2.2} />
      </span>
      <h1 className="mt-5 text-[32px] leading-tight font-extrabold tracking-tight">{t("offline.title")}</h1>
      <p className="mt-3 mb-8 font-semibold text-muted">{t("offline.body")}</p>
      {/* A reload asks for the page that failed, which the worker shows this in place of. */}
      <button type="button" onClick={() => location.reload()} className={cx(button.primary, "self-start")}>
        <RotateCw size={17} strokeWidth={2.4} />
        {t("offline.retry")}
      </button>
    </main>
  );
}
