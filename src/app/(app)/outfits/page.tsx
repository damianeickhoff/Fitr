import { Bookmark, CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FlatLay, toPiece } from "@/components/flat-lay";
import { OutfitGenerator } from "@/components/outfit-generator";
import { button, card, cx } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/gemini";
import { translator } from "@/lib/i18n";
import { profileLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await requireProfile();
  return { title: translator(profileLocale(profile))("nav.outfits") };
}

export default async function OutfitsPage({ searchParams }: PageProps<"/outfits">) {
  const { profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const { anchor, focus } = await searchParams;
  const [outfits, anchorItem, itemCount] = await Promise.all([
    db.outfit.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { item: true }, orderBy: { position: "asc" } } },
    }),
    typeof anchor === "string"
      ? db.item.findFirst({ where: { id: anchor, profileId: profile.id }, select: { id: true, name: true, imagePath: true } })
      : null,
    db.item.count({ where: { profileId: profile.id } }),
  ]);
  const fresh = outfits.filter((o) => !o.saved);
  const saved = outfits.filter((o) => o.saved);

  const grid = (list: typeof outfits) => (
    <div className="grid grid-cols-2 gap-3">
      {list.map((outfit) => (
        <Link key={outfit.id} href={`/outfits/${outfit.id}`} className={cx("group block", card)}>
          <FlatLay pieces={outfit.items.map(({ item }) => toPiece(item))} className="rounded-[20px]" />
          <p className="mt-2.5 flex items-center gap-1.5 px-1.5 text-[15px] font-bold group-hover:text-accent">
            {outfit.saved && <Bookmark size={14} className="fill-current" />}
            {outfit.name}
          </p>
          <p className="truncate px-1.5 text-[13px] font-semibold text-muted">{outfit.items.map(({ item }) => item.name).join(", ")}</p>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <p className="text-[13px] font-bold text-muted">{t("outfits.kicker")}</p>
      <h1 className="mt-1 text-[28px] leading-tight font-extrabold tracking-tight">{t("outfits.title")}</h1>

      <OutfitGenerator anchor={anchorItem} unworn={focus === "unworn"} ai={aiEnabled()} disabled={itemCount < 2} />

      {fresh.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold">{t("outfits.fresh")}</h2>
          <p className="mt-0.5 mb-3.5 text-[13px] font-semibold text-muted">{t("outfits.freshHint")}</p>
          {grid(fresh)}
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3.5 text-lg font-extrabold">{t("outfits.saved")}</h2>
        {saved.length > 0 ? grid(saved) : <p className="text-sm font-semibold text-muted">{t("outfits.savedEmpty")}</p>}
        <Link href="/worn" className={cx(button.secondary, "mt-4 w-full")}>
          <CalendarDays size={16} strokeWidth={2.4} /> {t("calendar.whatYouWore")}
        </Link>
      </section>
    </>
  );
}
