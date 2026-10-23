import { ArrowRight, Camera, ChevronRight, Clock } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { StudioWatch } from "@/components/studio-watch";
import { WardrobeGrid, type View } from "@/components/wardrobe-grid";
import { button, cx, pill } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { categoryLabel, translator } from "@/lib/i18n";
import { profileLocale } from "@/lib/locale";
import { imageUrl } from "@/lib/storage-url";
import { studioPending } from "@/lib/studio";
import { FADE_COOKIE, VIEW_COOKIE, addedLabel, byLastWorn, isIdle, wardrobeNotes, wornLabel } from "@/lib/wardrobe";

export default async function WardrobePage() {
  const { profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const [items, latest, jar] = await Promise.all([
    db.item.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" } }),
    db.outfit.findFirst({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { item: true }, orderBy: { position: "asc" } } },
    }),
    cookies(),
  ]);

  if (items.length === 0) {
    return (
      <section className="py-16 text-center">
        <span className={pill("blue", "md")}>{t("wardrobe.empty.pill")}</span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">{t("wardrobe.empty.title")}</h1>
        <p className="mt-2 text-muted">{t("wardrobe.empty.body")}</p>
        <Link href="/add" className={cx(button.primary, "mt-6")}>
          <Camera size={18} /> {t("wardrobe.empty.cta")}
        </Link>
      </section>
    );
  }

  const now = new Date();
  const notes = wardrobeNotes(items, now, t);
  const rank = new Map(byLastWorn(items).map((i, n) => [i.id, n]));
  const cards = items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    categoryLabel: categoryLabel(t, i.category),
    imagePath: i.imagePath,
    favourite: i.favourite,
    aiTagged: i.aiTagged,
    idle: isIdle(i, now),
    note: notes.get(i.id) ?? null,
    worn: wornLabel(i, now, t),
    count: i.wearCount === 0 ? addedLabel(i, now, t) : t.count("worn.count", i.wearCount),
    wornRank: rank.get(i.id) ?? 0,
    studioPending: studioPending(i, now) ? t("studio.pending") : null,
  }));
  const unworn = items.filter((i) => i.wearCount === 0).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const view: View = jar.get(VIEW_COOKIE)?.value === "list" ? "list" : "grid";

  // One nudge card: the pieces still waiting, or failing that, today's look.
  const banner =
    unworn.length > 0 ? (
      <Link href="/never-worn" className="mt-4 flex items-center gap-3 rounded-[22px] bg-accent p-3.5 text-white">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/20">
          <Clock size={22} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold">{t.count("wardrobe.unwornCard", unworn.length)}</span>
          <span className="block truncate text-[12.5px] font-semibold opacity-90">{t("wardrobe.unwornHint", { name: unworn[0].name.toLowerCase() })}</span>
        </span>
        <ChevronRight size={20} strokeWidth={2.6} className="shrink-0" />
      </Link>
    ) : latest && latest.items.length > 0 ? (
      <Link href={`/outfits/${latest.id}`} className="mt-4 flex items-center gap-3 rounded-[22px] bg-ink p-2.5 text-paper">
        <span className="grid h-[70px] w-14 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-[12px] bg-[#efe8db]">
          {latest.items.slice(0, 4).map(({ item }) => (
            // eslint-disable-next-line @next/next/no-img-element -- private listing image
            <img key={item.id} src={imageUrl(item.imagePath)} alt="" className="h-full w-full object-cover" />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className={pill("amber")}>{latest.saved ? t("wardrobe.savedLook") : t("wardrobe.todaysPick")}</span>
          <span className="mt-1.5 block truncate font-bold">{latest.name}</span>
          <span className="block truncate text-[13px] text-[#cfc6b8]">{latest.items.map(({ item }) => item.name).join(", ")}</span>
        </span>
        <ArrowRight size={20} className="shrink-0" />
      </Link>
    ) : null;

  return (
    <>
      <WardrobeGrid
        name={profile.name}
        items={cards}
        unworn={unworn.length}
        initialFade={jar.get(FADE_COOKIE)?.value !== "off"}
        initialView={view}
        banner={banner}
      />
      {cards.some((c) => c.studioPending) && <StudioWatch />}
    </>
  );
}
