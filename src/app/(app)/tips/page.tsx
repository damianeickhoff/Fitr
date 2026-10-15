import { ArrowUpRight, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RefreshInsight } from "@/components/refresh-insight";
import { CATEGORY_TONE, cx, pill, toneFor } from "@/components/ui";
import { parseInsight } from "@/lib/advice";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORIES, isCategory, shopUrl } from "@/lib/garment";
import { aiEnabled } from "@/lib/gemini";
import { imageUrl } from "@/lib/storage-url";
import { isIdle, wardrobeNotes } from "@/lib/wardrobe";

export const metadata: Metadata = { title: "Shop tips" };

export default async function TipsPage() {
  const user = await requireUser();
  const [row, items] = await Promise.all([
    db.insight.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.item.findMany({ where: { userId: user.id } }),
  ]);
  const insight = row ? parseInsight(row.content) : null;
  const byId = new Map(items.map((i) => [i.id, i]));
  const stale = row && items.length - row.itemCount >= 3;
  const notes = wardrobeNotes(items);

  // Forgotten pieces always show, with the AI's idea when it has one.
  const ideas = new Map(insight?.rediscover.map((r) => [r.itemId, r.idea]) ?? []);
  const forgotten = items.filter((i) => isIdle(i) || ideas.has(i.id)).slice(0, 6);

  const thumbs = (ids: string[]) => {
    const found = ids.map((id) => byId.get(id)).filter((i) => i !== undefined).slice(0, 4);
    if (found.length === 0) return <span />;
    return (
      <span className="flex items-center gap-2 text-xs text-muted">
        <span className="flex">
          {found.map((item, n) => (
            <Link key={item.id} href={`/item/${item.id}`} title={item.name} className={cx(n > 0 && "-ml-2.5")}>
              {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
              <img src={imageUrl(item.imagePath)} alt={item.name} className="h-[38px] w-[30px] rounded-md border-2 border-ground object-cover" />
            </Link>
          ))}
        </span>
        Pairs with {found.length} of your pieces
      </span>
    );
  };

  return (
    <>
      <p className="text-[13px] font-medium text-muted">Personal shopper</p>
      <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight">What would make your wardrobe work harder</h1>

      {aiEnabled() ? (
        <div className="mt-4">
          <RefreshInsight label={insight ? "Refresh advice" : "Analyse my wardrobe"} />
          {!insight && (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              FITR looks across everything you own and suggests the few purchases that would unlock the most new outfits, plus
              accessories to lift what you have.
            </p>
          )}
          {stale && <p className="mt-2 text-[13px] text-muted">You&rsquo;ve added pieces since this was written. Refresh to include them.</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Shopping advice comes from Gemini looking across your whole wardrobe. Add a <code>GEMINI_API_KEY</code> to switch it on.
        </p>
      )}

      {insight && (
        <>
          <section className="mt-5 rounded-[22px] bg-ink p-4 text-white">
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
                <p className="mt-4 mb-1.5 text-xs font-medium text-[#b9bdc9]">Your palette</p>
                <div className="flex h-9 overflow-hidden rounded-[10px]">
                  {insight.palette.map((hex) => (
                    <span key={hex} className="flex-1" style={{ background: hex }} title={hex} />
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="mt-7">
            <h2 className="mb-3 text-lg font-semibold">Worth buying</h2>
            <ol className="space-y-3">
              {insight.buy.map((b) => (
                <li key={b.title} className="rounded-[20px] bg-ground p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fde2ea] text-[#a8244f]">
                        <ShoppingBag size={20} />
                      </span>
                      <span>
                        <span className="block text-[16px] font-semibold">{b.title}</span>
                        <span className="mt-1 block text-[13px] leading-relaxed text-muted">{b.why}</span>
                      </span>
                    </span>
                    {isCategory(b.category) && <span className={pill(CATEGORY_TONE[b.category])}>{CATEGORIES[b.category].one}</span>}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {thumbs(b.pairsWith)}
                    <a
                      href={shopUrl(b.shopFor)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-cobalt hover:underline"
                    >
                      Find one <ArrowUpRight size={14} />
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {insight.accessorise.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-3 text-lg font-semibold">Accessorise</h2>
              <ul className="space-y-2.5">
                {insight.accessorise.map((a) => (
                  <li key={a.text} className="rounded-[18px] bg-ground p-3.5">
                    <span className={pill("green")}>Add</span>
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
          <h2 className="mb-3 text-lg font-semibold">Rediscover</h2>
          <ul className="space-y-2.5">
            {forgotten.map((item) => {
              const note = notes.get(item.id);
              return (
                <li key={item.id}>
                  <Link href={`/outfits?anchor=${item.id}`} className="flex gap-3 rounded-[18px] bg-ground p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
                    <img src={imageUrl(item.imagePath)} alt="" className="h-20 w-16 shrink-0 rounded-xl bg-paper object-cover" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{item.name}</span>
                      {note && <span className={cx("mt-1", pill(note.tone))}>{note.text}</span>}
                      <span className="mt-1.5 block text-[13px] leading-relaxed text-[#3d4252]">
                        {ideas.get(item.id) ?? "Tap to build an outfit around it."}
                      </span>
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
