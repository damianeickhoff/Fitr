import { ArrowLeft, Clock, Droplets, Loader2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemActions } from "@/components/item-actions";
import { ItemDetails, RecheckControls } from "@/components/item-recheck";
import { OriginalPhoto } from "@/components/original-photo";
import { StudioPanel } from "@/components/studio-panel";
import { StudioWatch } from "@/components/studio-watch";
import { CATEGORY_TONE, button, cx, panel, pill, toneFor } from "@/components/ui";
import { WornDays } from "@/components/worn-days";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/gemini";
import { isCategory, parseList } from "@/lib/garment";
import { categoryLabel, formalityLabel, translator, type MessageKey } from "@/lib/i18n";
import { imageAiEnabled } from "@/lib/image-gen";
import { profileLocale } from "@/lib/locale";
import { imageUrl } from "@/lib/storage-url";
import { studioPending } from "@/lib/studio";
import { dayKey, dayLabel, inWash, wardrobeNotes, wornLabel } from "@/lib/wardrobe";

/** The latest logged days on the item page; the rest are counted, the calendar has them all. */
const WORN_DAYS_SHOWN = 6;

async function load(id: string) {
  const { profile } = await requireProfile();
  const item = await db.item.findFirst({
    where: { id, profileId: profile.id },
    include: {
      outfitItems: {
        include: { outfit: { include: { items: { include: { item: true } } } } },
      },
    },
  });
  if (!item) notFound();
  return { item, profile };
}

export async function generateMetadata({ params }: PageProps<"/item/[id]">): Promise<Metadata> {
  const { item } = await load((await params).id);
  return { title: item.name };
}

export default async function ItemPage({ params }: PageProps<"/item/[id]">) {
  const { item, profile } = await load((await params).id);
  const t = translator(profileLocale(profile));
  const colors = parseList(item.colors);
  const styles = parseList(item.styles);
  const seasons = parseList(item.seasons);

  // "Goes well with": pieces it has been paired with in outfits, most often first.
  const partners = new Map<string, { id: string; name: string; imagePath: string; count: number }>();
  for (const { outfit } of item.outfitItems) {
    for (const { item: other } of outfit.items) {
      if (other.id === item.id) continue;
      const entry = partners.get(other.id) ?? { id: other.id, name: other.name, imagePath: other.imagePath, count: 0 };
      entry.count += outfit.saved ? 2 : 1;
      partners.set(other.id, entry);
    }
  }
  const goesWith = [...partners.values()].sort((a, b) => b.count - a.count).slice(0, 4);

  const now = new Date();
  const [all, wears] = await Promise.all([
    db.item.findMany({
      where: { profileId: profile.id },
      select: { id: true, wearCount: true, lastWornAt: true, createdAt: true },
    }),
    db.wear.findMany({ where: { itemId: item.id }, orderBy: { wornOn: "desc" }, select: { wornOn: true } }),
  ]);
  const shownDays = wears.slice(0, WORN_DAYS_SHOWN).map((w) => ({ key: w.wornOn, label: dayLabel(w.wornOn, now, t) }));
  const note = wardrobeNotes(all, now, t).get(item.id);
  const worn = wornLabel(item, now, t);
  const pending = studioPending(item, now);
  const washing = inWash(item, now);
  const recheck = aiEnabled();

  const facts: [string, string | null | undefined][] = [
    [t("item.fact.type"), item.subcategory],
    [t("item.fact.colour"), colors.join(", ")],
    [t("item.fact.material"), item.material],
    [t("item.fact.pattern"), item.pattern],
    [t("item.fact.dressCode"), formalityLabel(t, item.formality)],
    [t("item.fact.brand"), item.brand],
  ];

  return (
    <>
      <div className="relative -mx-5 -mt-2 overflow-hidden rounded-b-[30px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
        <img src={imageUrl(item.imagePath)} alt={item.name} className="block aspect-[4/5] w-full bg-[#efe8db] object-cover" />
        <Link
          href="/"
          aria-label={t("item.back")}
          className="absolute top-3.5 left-3.5 grid size-10 place-items-center rounded-full bg-ground/90 text-ink backdrop-blur-md"
        >
          <ArrowLeft size={20} strokeWidth={2.4} />
        </Link>
        <OriginalPhoto path={item.photoPath} className="absolute top-3.5 right-3.5" />
        <span className={cx("absolute bottom-3.5 left-3.5", pill(worn.never ? "solid" : "frost", "md"))}>
          <Clock size={12} strokeWidth={2.6} /> {worn.text}
        </span>
        {item.wearCount > 0 && (
          <span className={cx("absolute right-3.5 bottom-3.5", pill("frost", "md"))}>{t.count("worn.count", item.wearCount)}</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {isCategory(item.category) && <span className={pill(CATEGORY_TONE[item.category], "md")}>{categoryLabel(t, item.category)}</span>}
        {pending && (
          <span className={pill("violet", "md")}>
            <Loader2 size={12} strokeWidth={2.6} className="animate-spin" /> {t("studio.pending")}
          </span>
        )}
        {washing && (
          <span className={pill("teal", "md")}>
            <Droplets size={12} strokeWidth={2.6} /> {t("wash.in")}
          </span>
        )}
        {item.favourite && <span className={pill("pink", "md")}>{t("item.favourite")}</span>}
        {note && <span className={pill(note.tone, "md")}>{note.text}</span>}
      </div>
      <h1 className="mt-2.5 text-[26px] leading-tight font-extrabold tracking-tight">{item.name}</h1>

      <ItemDetails item={item}>
      {!item.aiTagged && (
        <div className="mt-3 rounded-2xl bg-[#f6e6c6] p-3 text-sm font-semibold text-[#7d4b00]">
          <p>{t("item.untagged")}</p>
          {recheck && <RecheckControls spot="notice" className="mt-2.5" />}
        </div>
      )}
      {item.description && <p className="mt-2.5 text-[15px] leading-relaxed">{item.description}</p>}

      {(styles.length > 0 || seasons.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {styles.map((s) => (
            <span key={s} className={cx(pill(toneFor(s), "md"), "capitalize")}>
              {s}
            </span>
          ))}
          {seasons.map((s) => (
            <span key={s} className={cx(pill("grey", "md"), "capitalize")}>
              {t(`season.${s}` as MessageKey)}
            </span>
          ))}
        </div>
      )}

      <Link href={`/outfits?anchor=${item.id}`} className={cx(button.primary, "mt-5 w-full")}>
        <Sparkles size={17} /> {t("item.styleThis")}
      </Link>

      {facts.some(([, value]) => value) && (
        <dl className={cx(panel, "mt-5 px-4 py-1.5 text-sm")}>
          {facts
            .filter(([, value]) => value)
            .map(([term, value], n) => (
              <div key={term} className="flex justify-between gap-4 border-b border-line py-2.5 last:border-0">
                <dt className="font-semibold text-muted">{term}</dt>
                <dd className="flex items-center gap-2 text-right font-semibold capitalize">
                  {n === 1 && item.colorHex && (
                    <span className="inline-block size-2.5 rounded-full ring-1 ring-black/20" style={{ background: item.colorHex }} />
                  )}
                  {value}
                </dd>
              </div>
            ))}
        </dl>
      )}

      <WornDays id={item.id} days={shownDays} earlier={wears.length - shownDays.length} today={dayKey(now)} />

      {goesWith.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-2.5 text-lg font-extrabold">{t("item.goesWith")}</h2>
          <div className="grid grid-cols-4 gap-2">
            {goesWith.map((p) => (
              <Link key={p.id} href={`/item/${p.id}`} title={p.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
                <img src={imageUrl(p.imagePath)} alt={p.name} className="aspect-[4/5] w-full rounded-xl bg-[#efe8db] object-cover" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <ItemActions id={item.id} favourite={item.favourite} washing={washing} studio={imageAiEnabled() && !pending} />
      {recheck && <RecheckControls spot="actions" className="mt-3" />}
      {!pending && <StudioPanel id={item.id} name={item.name} aiTagged={item.aiTagged} photoPath={item.photoPath} />}
      {pending && <StudioWatch />}
      </ItemDetails>
    </>
  );
}
