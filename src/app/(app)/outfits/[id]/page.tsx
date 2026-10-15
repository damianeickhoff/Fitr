import { ArrowLeft, ArrowUpRight, Plus, Repeat, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToLook } from "@/components/add-to-look";
import { FlatLay, toPiece } from "@/components/flat-lay";
import { OutfitActions } from "@/components/outfit-actions";
import { TryOnPanel } from "@/components/try-on-panel";
import { button, cx, pill, type Tone } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseAdvice, shopUrl, type AdviceKind } from "@/lib/garment";
import { imageAiEnabled } from "@/lib/image-gen";
import { imageUrl } from "@/lib/storage-url";

async function load(id: string) {
  const user = await requireUser();
  const outfit = await db.outfit.findFirst({
    where: { id, userId: user.id },
    include: {
      items: { include: { item: true }, orderBy: { position: "asc" } },
      tryOns: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!outfit) notFound();
  const selfPhotos = await db.selfPhoto.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return { outfit, selfPhotos, userId: user.id };
}

export async function generateMetadata({ params }: PageProps<"/outfits/[id]">): Promise<Metadata> {
  const { outfit } = await load((await params).id);
  return { title: outfit.name };
}

const ADVICE: Record<AdviceKind, { label: string; tone: Tone; icon: typeof Plus }> = {
  add: { label: "Add from your wardrobe", tone: "green", icon: Plus },
  swap: { label: "Swap", tone: "violet", icon: Repeat },
  buy: { label: "Worth buying", tone: "pink", icon: ShoppingBag },
};

export default async function OutfitPage({ params }: PageProps<"/outfits/[id]">) {
  const { outfit, selfPhotos, userId } = await load((await params).id);
  const advice = parseAdvice(outfit.advice);
  const inLook = new Set(outfit.items.map((i) => i.itemId));
  const adviceIds = advice.map((a) => a.itemId).filter((id): id is string => Boolean(id));
  const adviceItems = adviceIds.length ? await db.item.findMany({ where: { id: { in: adviceIds }, userId } }) : [];

  // "Add" suggestions not yet taken up lie faded on the table beside the look.
  const suggested = advice
    .filter((a) => a.kind === "add" && a.itemId && !inLook.has(a.itemId))
    .map((a) => adviceItems.find((i) => i.id === a.itemId))
    .filter((i) => i !== undefined);

  return (
    <>
      <Link href="/outfits" className={cx(button.quiet, "-mt-2 -ml-3 mb-2")}>
        <ArrowLeft size={16} /> Outfits
      </Link>

      <FlatLay
        showLabels
        pieces={[...outfit.items.map(({ item }) => toPiece(item)), ...suggested.map((item) => toPiece(item, true))]}
      />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {outfit.occasion && <span className={pill("amber", "md")}>{outfit.occasion}</span>}
        <span className={pill("grey", "md")}>{outfit.items.length} pieces</span>
        {outfit.saved && <span className={pill("blue", "md")}>Saved</span>}
      </div>
      <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-tight">{outfit.name}</h1>
      {outfit.reasoning && <p className="mt-2 text-[15px] leading-relaxed text-[#3d4252]">{outfit.reasoning}</p>}

      <div className="mt-4">
        <OutfitActions id={outfit.id} saved={outfit.saved} />
      </div>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-2.5 overflow-x-auto px-4">
        {outfit.items.map(({ item }) => (
          <Link key={item.id} href={`/item/${item.id}`} className="w-[92px] shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
            <img src={imageUrl(item.imagePath)} alt="" className="aspect-[4/5] w-full rounded-lg bg-ground object-cover" />
            <span className="mt-1.5 line-clamp-2 block text-xs leading-snug font-medium">{item.name}</span>
          </Link>
        ))}
      </div>

      {advice.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Finish the look</h2>
          <ul className="space-y-2.5">
            {advice.map((tip, n) => {
              const meta = ADVICE[tip.kind] ?? ADVICE.add;
              const piece = adviceItems.find((i) => i.id === tip.itemId);
              return (
                <li key={n} className="flex gap-3 rounded-[18px] bg-ground p-3">
                  {piece ? (
                    <Link href={`/item/${piece.id}`} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
                      <img src={imageUrl(piece.imagePath)} alt={piece.name} className="h-20 w-16 rounded-xl bg-paper object-cover" />
                    </Link>
                  ) : (
                    <span className="grid h-20 w-16 shrink-0 place-items-center rounded-xl bg-[#fde2ea] text-[#a8244f]">
                      <meta.icon size={20} />
                    </span>
                  )}
                  <div className="min-w-0 text-sm">
                    <span className={pill(meta.tone)}>{meta.label}</span>
                    <p className="mt-1.5 leading-relaxed">{tip.text}</p>
                    {tip.kind === "buy" && tip.shopFor && (
                      <a
                        href={shopUrl(tip.shopFor)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 font-semibold text-cobalt hover:underline"
                      >
                        Shop {tip.shopFor} <ArrowUpRight size={14} />
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
        enabled={imageAiEnabled()}
        selfPhotos={selfPhotos.map((p) => ({ id: p.id, path: p.path }))}
        results={outfit.tryOns.map((t) => ({ id: t.id, path: t.resultPath }))}
        pieces={outfit.items.map(({ item }) => ({ id: item.id, name: item.name, imagePath: item.imagePath }))}
      />
    </>
  );
}
