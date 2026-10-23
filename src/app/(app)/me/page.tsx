import { ChevronRight, Globe, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteProfile, ProfileSwitcher } from "@/components/profile-switcher";
import { ReshootAll } from "@/components/reshoot-all";
import { SelfPhotos } from "@/components/self-photos";
import { StudioWatch } from "@/components/studio-watch";
import { StyleNotes } from "@/components/style-notes";
import { button, cx, panel, pill } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/gemini";
import { LANGUAGE_NAMES, translator } from "@/lib/i18n";
import { ImageProviderChoice } from "@/components/image-provider-choice";
import { PROVIDER_NAME, configuredImageProviders, imageModelLabel, imageModelName, imageProvider } from "@/lib/image-gen";
import { profileLocale } from "@/lib/locale";
import { studioPending } from "@/lib/studio";
import { studioProgress } from "@/lib/studio-queue";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await requireProfile();
  return { title: translator(profileLocale(profile))("nav.me") };
}

export default async function MePage() {
  const { user, profile } = await requireProfile();
  const locale = profileLocale(profile);
  const t = translator(locale);
  const [photos, profiles, pieces, outfits, plain] = await Promise.all([
    db.selfPhoto.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" } }),
    db.profile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { items: true } } },
    }),
    db.item.count({ where: { profileId: profile.id } }),
    db.outfit.count({ where: { profileId: profile.id, saved: true } }),
    db.item.findMany({ where: { profileId: profile.id, studioAt: null }, select: { studioRequestedAt: true } }),
  ]);

  const imageLabel = imageModelLabel(profile.imageProvider);
  const providers = configuredImageProviders();
  const activeProvider = imageProvider(profile.imageProvider);
  const now = new Date();
  const waiting = plain.filter((i) => studioPending(i, now)).length;
  const batch = studioProgress(profile.id);
  const progress = batch && { done: batch.done, total: batch.total, error: batch.error, running: waiting > 0 };

  const status = [
    {
      name: t("me.aiTagging"),
      on: aiEnabled(),
      detail: aiEnabled() ? process.env.GEMINI_MODEL || "gemini-3.8-flash" : t("me.addKey", { key: "GEMINI_API_KEY" }),
    },
    {
      name: t("me.aiStudio"),
      on: imageLabel !== null,
      detail: imageLabel ?? t("me.addKey", { key: "OPENAI_API_KEY" }),
    },
    { name: t("me.aiCutout"), on: true, detail: t("me.aiCutoutDetail") },
  ];

  const row = "flex items-center gap-3 border-b border-line py-3 last:border-0";

  return (
    <>
      <p className="text-[13px] font-bold text-muted">{t("me.kicker")}</p>
      <h1 className="mt-1 text-[28px] font-extrabold tracking-tight">{profile.name}</h1>
      <p className="mt-1 text-[13px] font-semibold text-muted">
        {t("me.summary", { pieces: t.count("wardrobe.pieces", pieces), outfits: t.count("me.outfits", outfits) })}
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-extrabold">{t("me.switch")}</h2>
        <p className="mt-1 text-sm leading-relaxed font-semibold text-muted">{t("me.switchBody")}</p>
        <ProfileSwitcher
          profiles={profiles.map((p) => ({ id: p.id, name: p.name, accent: p.accent, pieces: p._count.items, current: p.id === profile.id }))}
        />
      </section>

      <section className="mt-7">
        <h2 className="text-lg font-extrabold">{t("me.appearance")}</h2>
        <div className={cx(panel, "mt-3 px-4")}>
          <Link href="/me/appearance" className={row}>
            <span className="size-10 shrink-0 rounded-xl" style={{ background: profile.accent }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{t("me.accent")}</span>
              <span className="block text-[12.5px] font-semibold text-muted">{t("me.accentHint")}</span>
            </span>
            <ChevronRight size={18} strokeWidth={2.4} className="text-muted" />
          </Link>
          <Link href="/me/appearance#language" className={row}>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper text-ink ring-1 ring-line ring-inset">
              <Globe size={20} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{t("me.language")}</span>
              <span className="block text-[12.5px] font-semibold text-muted">{LANGUAGE_NAMES[locale]}</span>
            </span>
            <ChevronRight size={18} strokeWidth={2.4} className="text-muted" />
          </Link>
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-lg font-extrabold">{t("me.photos")}</h2>
        <p className="mt-1 text-sm leading-relaxed font-semibold text-muted">{t("me.photosBody")}</p>
        <SelfPhotos photos={photos.map((p) => ({ id: p.id, path: p.path }))} />
      </section>

      <section className="mt-7">
        <h2 className="text-lg font-extrabold">{t("me.style")}</h2>
        <p className="mt-1 text-sm leading-relaxed font-semibold text-muted">{t("me.styleBody")}</p>
        <StyleNotes initial={profile.styleNotes ?? ""} />
      </section>

      <section className="mt-7">
        <h2 className="text-lg font-extrabold">{t("me.ai")}</h2>
        <ul className={cx(panel, "mt-2.5 px-4 py-1")}>
          {status.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
              <span className="min-w-0">
                <span className="block text-sm font-bold">{s.name}</span>
                <span className="block truncate text-xs font-semibold text-muted">{s.detail}</span>
              </span>
              <span className={pill(s.on ? "green" : "amber")}>{s.on ? t("me.on") : t("me.off")}</span>
            </li>
          ))}
        </ul>
        {providers.length > 1 && activeProvider && (
          <ImageProviderChoice
            options={providers.map((p) => ({ id: p, name: PROVIDER_NAME[p], model: imageModelName(p) }))}
            current={activeProvider}
          />
        )}
        {imageLabel && <ReshootAll missing={plain.length - waiting} label={imageLabel} progress={progress} />}
        {waiting > 0 && <StudioWatch />}
      </section>

      <div className="mt-7 flex flex-wrap items-start gap-3">
        <form action={signOut}>
          <button type="submit" className={button.secondary}>
            <LogOut size={16} /> {t("me.signOut")}
          </button>
        </form>
        {profiles.length > 1 && <DeleteProfile />}
      </div>
      <p className="mt-3 text-xs font-semibold text-muted">{user.email}</p>
    </>
  );
}
