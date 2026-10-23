import { ArrowLeft, ArrowUpRight, Plus, Repeat, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToLook } from "@/components/add-to-look";
import { FlatLay, toPiece } from "@/components/flat-lay";
import { OutfitActions } from "@/components/outfit-actions";
import { TryOnPanel } from "@/components/try-on-panel";
import { button, cx, panel, pill, type Tone } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseAdvice, shopUrl, type AdviceKind } from "@/lib/garment";
import { isMessageKey, translator, type MessageKey } from "@/lib/i18n";
import { imageProvider } from "@/lib/image-gen";
import { profileLocale } from "@/lib/locale";
import { SOURCE_LABEL } from "@/lib/try-on";
import { imageUrl } from "@/lib/storage-url";

async function load(id: string) {
  const { profile } = await requireProfile();
  const outfit = await db.outfit.findFirst({
    where: { id, profileId: profile.id },
    include: {
      items: { include: { item: true }, orderBy: { position: "asc" } },
      tryOns: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!outfit) notFound();
  const selfPhotos = await db.selfPhoto.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: "desc" } });
  return { outfit, selfPhotos, profile };
}

export async function generateMetadata({ params }: PageProps<"/outfits/[id]">): Promise<Metadata> {
  const { outfit } = await load((await params).id);
  return { title: outfit.name };
}

const ADVICE: Record<AdviceKind, { label: MessageKey; tone: Tone; icon: typeof Plus }> = {
  add: { label: "advice.add", tone: "green", icon: Plus },
  swap: { label: "advice.swap", tone: "violet", icon: Repeat },
  buy: { label: "advice.buy", tone: "pink", icon: ShoppingBag },
};

export default async function OutfitPage({ params }: PageProps<"/outfits/[id]">) {
  const { outfit, selfPhotos, profile } = await load((await params).id);
  const t = translator(profileLocale(profile));
  const provider = imageProvider(profile.imageProvider);
  const apiLabel = provider ? SOURCE_LABEL[provider] : null;
  const advice = parseAdvice(outfit.advice);
  const inLook = new Set(outfit.items.map((i) => i.itemId));
  const adviceIds = advice.map((a) => a.itemId).filter((id): id is string => Boolean(id));
  const adviceItems = adviceIds.length ? await db.item.findMany({ where: { id: { in: adviceIds }, profileId: profile.id } }) : [];

  // "Add" suggestions not yet taken up lie faded on the table beside the look.
  const suggested = advice
    .filter((a) => a.kind === "add" && a.itemId && !inLook.has(a.itemId))
    .map((a) => adviceItems.find((i) => i.id === a.itemId))
    .filter((i) => i !== undefined);

  return (
    <>
      <Link href="/outfits" className={cx(button.quiet, "-ml-3 mb-2")}>
        <ArrowLeft size={16} strokeWidth={2.6} /> {t("outfit.back")}
      </Link>

      <FlatLay
        showLabels
        suggestedLabel={t("common.suggested")}
        className="rounded-[26px]"
        pieces={[...outfit.items.map(({ item }) => toPiece(item)), ...suggested.map((item) => toPiece(item, true))]}
      />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {outfit.occasion && (
          <span className={pill("amber", "md")}>
            {isMessageKey(`occasion.${outfit.occasion}`) ? t(`occasion.${outfit.occasion}` as MessageKey) : outfit.occasion}
          </span>
        )}
        <span className={pill("grey", "md")}>{t.count("outfit.pieces", outfit.items.length)}</span>
        {outfit.saved && <span className={pill("blue", "md")}>{t("outfit.saved")}</span>}
      </div>
      <h1 className="mt-2 text-[28px] leading-tight font-extrabold tracking-tight">{outfit.name}</h1>
      {outfit.reasoning && <p className="mt-2 text-[15px] leading-relaxed text-[#3f3931]">{outfit.reasoning}</p>}

      <div className="mt-4">
        <OutfitActions id={outfit.id} saved={outfit.saved} />
      </div>

      <div className="no-scrollbar -mx-5 mt-5 flex gap-2.5 overflow-x-auto px-5">
        {outfit.items.map(({ item }) => (
          <Link key={item.id} href={`/item/${item.id}`} className="w-[92px] shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
            <img src={imageUrl(item.imagePath)} alt="" className="aspect-[4/5] w-full rounded-xl bg-[#efe8db] object-cover" />
            <span className="mt-1.5 line-clamp-2 block text-xs leading-snug font-bold">{item.name}</span>
          </Link>
        ))}
      </div>

      {advice.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold">{t("outfit.finish")}</h2>
          <ul className="space-y-2.5">
            {advice.map((tip, n) => {
              const meta = ADVICE[tip.kind] ?? ADVICE.add;
              const piece = adviceItems.find((i) => i.id === tip.itemId);
              return (
                <li key={n} className={cx(panel, "flex gap-3 p-3")}>
                  {piece ? (
                    <Link href={`/item/${piece.id}`} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
                      <img src={imageUrl(piece.imagePath)} alt={piece.name} className="h-20 w-16 rounded-xl bg-[#efe8db] object-cover" />
                    </Link>
                  ) : (
                    <span className="grid h-20 w-16 shrink-0 place-items-center rounded-xl bg-[#f3dcd6] text-[#7a2e2e]">
                      <meta.icon size={20} />
                    </span>
                  )}
                  <div className="min-w-0 text-sm">
                    <span className={pill(meta.tone)}>{t(meta.label)}</span>
                    <p className="mt-1.5 leading-relaxed">{tip.text}</p>
                    {tip.kind === "buy" && tip.shopFor && (
                      <a
                        href={shopUrl(tip.shopFor)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 font-bold text-accent hover:underline"
                      >
                        {t("outfit.shop", { query: tip.shopFor })} <ArrowUpRight size={14} />
                      </a>
                    )}
                    {tip.kind === "add" && piece && <AddToLook outfitId={outfit.id} itemId={piece.id} added={inLook.has(piece.id)} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <TryOnPanel
        outfitId={outfit.id}
        apiLabel={apiLabel}
        selfPhotos={selfPhotos.map((p) => ({ id: p.id, path: p.path }))}
        results={outfit.tryOns.map((r) => ({ id: r.id, path: r.resultPath, source: r.source }))}
        pieces={outfit.items.map(({ item }) => ({ id: item.id, name: item.name, imagePath: item.imagePath }))}
      />
    </>
  );
}
