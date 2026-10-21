import type { Metadata } from "next";
import { AddPhotos } from "@/components/add-photos";
import { requireProfile } from "@/lib/auth";
import { aiEnabled } from "@/lib/gemini";
import { translator } from "@/lib/i18n";
import { profileLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await requireProfile();
  return { title: translator(profileLocale(profile))("nav.add") };
}

export default async function AddPage() {
  const { profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const [before, after] = t("add.aiOff").split("{key}");
  return (
    <>
      <p className="text-[13px] font-bold text-muted">{t("add.kicker")}</p>
      <h1 className="mt-1 text-[28px] leading-tight font-extrabold tracking-tight">{t("add.title")}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{t("add.body")}</p>
      {!aiEnabled() && (
        <p className="mt-4 rounded-2xl bg-[#f6e6c6] p-3 text-sm font-semibold text-[#7d4b00]">
          {before}
          <code>GEMINI_API_KEY</code>
          {after}
        </p>
      )}
      <AddPhotos />
    </>
  );
}
