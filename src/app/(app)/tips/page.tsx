import { ArrowUpRight, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RefreshInsight } from "@/components/refresh-insight";
import { CATEGORY_TONE, cx, panel, pill, toneFor } from "@/components/ui";
import { parseInsight } from "@/lib/advice";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCategory, shopUrl } from "@/lib/garment";
import { aiEnabled } from "@/lib/gemini";
import { categoryLabel, translator } from "@/lib/i18n";
import { profileLocale } from "@/lib/locale";
import { imageUrl } from "@/lib/storage-url";
import { isIdle, wardrobeNotes } from "@/lib/wardrobe";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await requireProfile();
  return { title: translator(profileLocale(profile))("nav.tips") };
}

export default async function TipsPage() {
  const { profile } = await requireProfile();
  const t = translator(profileLocale(profile));
  const [row, items] = await Promise.all([
    db.insight.findFirst({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" } }),
    db.item.findMany({ where: { profileId: profile.id } }),
  ]);
  const insight = row ? parseInsight(row.content) : null;
  const byId = new Map(items.map((i) => [i.id, i]));
  const stale = row && items.length - row.itemCount >= 3;
  const now = new Date();
  const notes = wardrobeNotes(items, now, t);
  const [offBefore, offAfter] = t("tips.off").split("{key}");

  // Forgotten pieces always show, with the AI's idea when it has one.
  const ideas = new Map(insight?.rediscover.map((r) => [r.itemId, r.idea]) ?? []);
  const forgotten = items.filter((i) => isIdle(i, now) || ideas.has(i.id)).slice(0, 6);

  const thumbs = (ids: string[]) => {
    const found = ids.map((id) => byId.get(id)).filter((i) => i !== undefined).slice(0, 4);
    if (found.length === 0) return <span />;
    return (
      <span className="flex items-center gap-2 text-xs font-semibold text-muted">
        <span className="flex">
          {found.map((item, n) => (
            <Link key={item.id} href={`/item/${item.id}`} title={item.name} className={cx(n > 0 && "-ml-2.5")}>
              {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
              <img src={imageUrl(item.imagePath)} alt={item.name} className="h-[38px] w-[30px] rounded-md border-2 border-ground object-cover" />
            </Link>
          ))}
        </span>
        {t("tips.pairs", { n: found.length })}
      </span>
    );
  };

  return (
    <>
      <p className="text-[13px] font-bold text-muted">{t("tips.kicker")}</p>
      <h1 className="mt-1 text-[26px] leading-tight font-extrabold tracking-tight">{t("tips.title")}</h1>

      {aiEnabled() ? (
        <div className="mt-4">
          <RefreshInsight label={insight ? t("tips.refresh") : t("tips.analyse")} />
          {!insight && <p className="mt-3 text-sm leading-relaxed font-semibold text-muted">{t("tips.intro")}</p>}
          {stale && <p className="mt-2 text-[13px] font-semibold text-muted">{t("tips.stale")}</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed font-semibold text-muted">
          {offBefore}
          <code>GEMINI_API_KEY</code>
          {offAfter}
        </p>
      )}

      {insight && (
        <>
          <section className="mt-5 rounded-[22px] bg-ink p-4 text-paper">
            <p className="text-[15px] leading-relaxed">{insight.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {insight.styleWords.map((w) => (
                <span key={w} className={cx(pill(toneFor(w), "md"), "capitalize")}>
                  {w}
                </span>
              ))}
            </div>
            {insight.palette.length > 0 && (
              <>
                <p className="mt-4 mb-1.5 text-xs font-bold text-[#cfc6b8]">{t("tips.palette")}</p>
                <div className="flex h-9 overflow-hidden rounded-[10px]">
                  {insight.palette.map((hex) => (
                    <span key={hex} className="flex-1" style={{ background: hex }} title={hex} />
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="mt-7">
            <h2 className="mb-3 text-lg font-extrabold">{t("tips.buy")}</h2>
            <ol className="space-y-3">
              {insight.buy.map((b) => (
                <li key={b.title} className={cx(panel, "p-4")}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f3dcd6] text-[#7a2e2e]">
                        <ShoppingBag size={20} />
                      </span>
                      <span>
                        <span className="block text-[16px] font-bold">{b.title}</span>
                        <span className="mt-1 block text-[13px] leading-relaxed font-semibold text-muted">{b.why}</span>
                      </span>
                    </span>
                    {isCategory(b.category) && <span className={pill(CATEGORY_TONE[b.category])}>{categoryLabel(t, b.category)}</span>}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {thumbs(b.pairsWith)}
                    <a
                      href={shopUrl(b.shopFor)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-accent hover:underline"
                    >
                      {t("tips.find")} <ArrowUpRight size={14} />
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {insight.accessorise.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-3 text-lg font-extrabold">{t("tips.accessorise")}</h2>
              <ul className="space-y-2.5">
                {insight.accessorise.map((a) => (
                  <li key={a.text} className={cx(panel, "p-3.5")}>
                    <span className={pill("green")}>{t("tips.add")}</span>
                    <p className="mt-1.5 mb-2.5 text-sm leading-relaxed">{a.text}</p>
                    {thumbs(a.pairsWith)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {forgotten.length > 0 && (
        <section id="rediscover" className="mt-7 scroll-mt-20">
          <h2 className="mb-3 text-lg font-extrabold">{t("tips.rediscover")}</h2>
          <ul className="space-y-2.5">
            {forgotten.map((item) => {
              const note = notes.get(item.id);
              return (
                <li key={item.id}>
                  <Link href={`/outfits?anchor=${item.id}`} className={cx(panel, "flex gap-3 p-3")}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
                    <img src={imageUrl(item.imagePath)} alt="" className="h-20 w-16 shrink-0 rounded-xl bg-[#efe8db] object-cover" />
                    <span className="min-w-0">
                      <span className="block font-bold">{item.name}</span>
                      {note && <span className={cx("mt-1", pill(note.tone))}>{note.text}</span>}
                      <span className="mt-1.5 block text-[13px] leading-relaxed text-[#3f3931]">{ideas.get(item.id) ?? t("tips.tap")}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
