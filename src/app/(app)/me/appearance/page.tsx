import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccentPicker } from "@/components/accent-picker";
import { button, cx } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { translator } from "@/lib/i18n";
import { profileLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await requireProfile();
  return { title: translator(profileLocale(profile))("appearance.title") };
}

/** Colour and language for the open profile. Both save as they change. */
export default async function AppearancePage() {
  const { profile } = await requireProfile();
  const locale = profileLocale(profile);
  const t = translator(locale);
  return (
    <>
      <Link href="/me" className={cx(button.quiet, "-ml-3")}>
        <ArrowLeft size={16} strokeWidth={2.6} /> {t("nav.me")}
      </Link>
      <h1 className="mt-3 mb-6 text-[28px] font-extrabold tracking-tight">{t("appearance.title")}</h1>
      <AccentPicker accent={profile.accent} locale={locale} name={profile.name} />
    </>
  );
}
