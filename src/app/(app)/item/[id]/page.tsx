import { ArrowLeft, ChevronRight, Clock, Ellipsis, Loader2, Pencil, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemQuickActions } from "@/components/item-quick-actions";
import { ItemSheet, SheetButton } from "@/components/item-sheet";
import { StudioWatch } from "@/components/studio-watch";
import { cx, pill, toneFor } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/gemini";
import { isCategory, parseList } from "@/lib/garment";
import { categoryLabel, formalityLabel, translator, type MessageKey } from "@/lib/i18n";
import { imageProvider } from "@/lib/image-gen";
import { profileLocale } from "@/lib/locale";
import { isQualityIssue } from "@/lib/photo-quality";
import { imageUrl } from "@/lib/storage-url";
import { studioPending } from "@/lib/studio";
import { SOURCE_LABEL } from "@/lib/try-on";
import { dayKey, dayLabel, inWash, wornLabel } from "@/lib/wardrobe";

/** The latest logged days in the wear history; the rest are counted, the calendar has them all. */
const WORN_DAYS_SHOWN = 20;

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

/** A slim amber line under the title that opens the sheet where it is dealt with. */
function Banner({ view, text, action }: { view: "menu" | "edit"; text: string; action: string }) {
  return (
    <SheetButton
      view={view}
      className="mt-3 flex w-full items-center gap-2.5 rounded-2xl bg-[#f6e6c6] px-3 py-2.5 text-left text-sm font-bold text-[#7d4b00]"
    >
      <TriangleAlert size={16} strokeWidth={2.4} className="shrink-0" />
      <span className="flex-1">{text}</span>
      <span className="flex items-center gap-0.5">
        {action} <ChevronRight size={14} strokeWidth={2.6} />
      </span>
    </SheetButton>
  );
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
  const today = dayKey(now);
  const wears = await db.wear.findMany({ where: { itemId: item.id }, orderBy: { wornOn: "desc" }, select: { wornOn: true } });
  const shownDays = wears.slice(0, WORN_DAYS_SHOWN).map((w) => ({ key: w.wornOn, label: dayLabel(w.wornOn, now, t) }));
  const worn = wornLabel(item, now, t);
  const pending = studioPending(item, now);
  const provider = imageProvider(profile.imageProvider);
  const issue = isQualityIssue(item.qualityIssue) && item.qualityNote ? item.qualityIssue : null;

  const facts: [string, string | null | undefined][] = [
    [t("item.fact.type"), item.subcategory || (isCategory(item.category) ? categoryLabel(t, item.category) : null)],
    [t("item.fact.colour"), colors.join(", ")],
    [t("item.fact.material"), item.material],
    [t("item.fact.pattern"), item.pattern],
    [t("item.fact.dressCode"), formalityLabel(t, item.formality)],
    [t("item.fact.brand"), item.brand],
    [t("edit.seasons"), seasons.map((s) => t(`season.${s}` as MessageKey)).join(", ")],
  ];
  const shown = facts.filter(([, value]) => value);

  return (
    <ItemSheet
      item={item}
      issue={issue}
      recheck={aiEnabled()}
      studio={{ apiLabel: provider ? SOURCE_LABEL[provider] : null, pending }}
      wear={{ days: shownDays, earlier: wears.length - shownDays.length, logged: wears.length, today }}
    >
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
        <SheetButton
          view="menu"
          label={t("item.more")}
          className="absolute top-3.5 right-3.5 grid size-10 place-items-center rounded-full bg-ground/90 text-ink backdrop-blur-md"
        >
          <Ellipsis size={20} strokeWidth={2.6} />
        </SheetButton>
        <span className={cx("absolute bottom-3.5 left-3.5", pill(worn.never ? "solid" : "frost", "md"))}>
          <Clock size={12} strokeWidth={2.6} /> {worn.text}
        </span>
        {item.wearCount > 0 && (
          <span className={cx("absolute right-3.5 bottom-3.5", pill("frost", "md"))}>{t.count("worn.count", item.wearCount)}</span>
        )}
      </div>

      <h1 className="mt-[18px] text-[26px] leading-tight font-extrabold tracking-tight">{item.name}</h1>

      {pending && (
        <p className="mt-3 flex items-center gap-2.5 rounded-2xl bg-[#e9e2f3] px-3 py-2.5 text-sm font-bold text-[#4e3597]">
          <Loader2 size={16} strokeWidth={2.4} className="animate-spin" /> {t("studio.pending")}
        </p>
      )}
      {issue && <Banner view="menu" text={`${t(`quality.issue.${issue}` as MessageKey)}. ${t("quality.title")}`} action={t("item.fix")} />}
      {!item.aiTagged && <Banner view="edit" text={t("item.untagged")} action={t("item.fillIn")} />}

      <ItemQuickActions
        id={item.id}
        favourite={item.favourite}
        washing={inWash(item, now)}
        woreToday={wears[0]?.wornOn === today}
        today={today}
      />

      {item.description && <p className="mt-6 text-[15px] leading-relaxed">{item.description}</p>}

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

      {(shown.length > 0 || styles.length > 0) && (
        <section className="mt-7">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">{t("item.details")}</h2>
            <SheetButton view="edit" className="flex items-center gap-1.5 py-1.5 text-sm font-bold text-muted hover:text-ink">
              <Pencil size={14} /> {t("item.editShort")}
            </SheetButton>
          </div>
          {/* Hairlines between the cells are the line colour showing through a 1px gap. */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] border border-line bg-line">
            {shown.map(([term, value], n) => (
              <div key={term} className={cx("bg-ground px-3.5 py-3", n === shown.length - 1 && n % 2 === 0 && "col-span-2")}>
                <dt className="text-[12.5px] font-semibold text-muted">{term}</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-[14.5px] font-bold capitalize">
                  {term === t("item.fact.colour") && item.colorHex && (
                    <span className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/20" style={{ background: item.colorHex }} />
                  )}
                  {value}
                </dd>
              </div>
            ))}
            {styles.length > 0 && (
              <div className="col-span-2 bg-ground px-3.5 py-3">
                <dt className="text-[12.5px] font-semibold text-muted">{t("item.fact.style")}</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {styles.map((s) => (
                    <span key={s} className={cx(pill(toneFor(s)), "capitalize")}>
                      {s}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {pending && <StudioWatch />}
    </ItemSheet>
  );
}
