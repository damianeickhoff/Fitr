import { ArrowLeft, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_TONE, button, cx, pill } from "@/components/ui";
import { WoreIt } from "@/components/wore-it";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { categoryLabel, translator } from "@/lib/i18n";
import { profileLocale } from "@/lib/locale";
import { imageUrl } from "@/lib/storage-url";
import { addedLabel, neverWorn } from "@/lib/wardrobe";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await requireProfile();
  return { title: translator(profileLocale(profile))("never.pill") };
}

/**
 * Everything still waiting for its first outing, oldest first. A tap logs a
 * wear and the piece leaves the list; the button at the top sends the whole
 * set to the stylist.
 */
export default async function NeverWornPage() {
  const { profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const items = await db.item.findMany({ where: { profileId: profile.id, wearCount: 0 } });
  const now = new Date();
  const { old, recent } = neverWorn(items, now);
  const total = old.length + recent.length;

  const list = (group: typeof old, long: boolean) => (
    <ul className="divide-y divide-line">
      {group.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-3">
          <Link href={`/item/${item.id}`} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
            <img src={imageUrl(item.imagePath)} alt={item.name} className="h-20 w-16 rounded-xl bg-[#efe8db] object-cover" />
          </Link>
          <Link href={`/item/${item.id}`} className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-bold">{item.name}</span>
            <span className={cx("mt-0.5 block text-[12.5px] font-semibold", long ? "text-[#7d4b00]" : "text-muted")}>
              {addedLabel(item, now, t)}
            </span>
            <span className="mt-1.5 block">
              <span className={pill(CATEGORY_TONE[item.category] ?? "grey")}>{categoryLabel(t, item.category)}</span>
            </span>
          </Link>
          <WoreIt id={item.id} />
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <Link href="/" className={cx(button.quiet, "-ml-3")}>
        <ArrowLeft size={16} strokeWidth={2.6} /> {t("never.back")}
      </Link>

      <span className={cx(pill("amber", "md"), "mt-3")}>{t("never.pill")}</span>
      {total === 0 ? (
        <>
          <h1 className="mt-3 text-[26px] leading-tight font-extrabold tracking-tight">{t("never.empty")}</h1>
          <Link href="/" className={cx(button.secondary, "mt-5")}>
            {t("never.emptyCta")}
          </Link>
        </>
      ) : (
        <>
          <h1 className="mt-3 text-[26px] leading-tight font-extrabold tracking-tight">{t.count("never.title", total)}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t("never.body")}</p>
          <Link href="/outfits?focus=unworn" className={cx(button.primary, "mt-4 px-4 py-2.5 text-sm")}>
            <Layers size={16} strokeWidth={2.4} /> {t("never.outfits")}
          </Link>

          {old.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-1 text-[12.5px] font-bold text-muted">{t("never.old")}</h2>
              {list(old, true)}
            </section>
          )}
          {recent.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-1 text-[12.5px] font-bold text-muted">{t("never.recent")}</h2>
              {list(recent, false)}
            </section>
          )}
        </>
      )}
    </>
  );
}
