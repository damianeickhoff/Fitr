import { Bookmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FlatLay, toPiece } from "@/components/flat-lay";
import { OutfitGenerator } from "@/components/outfit-generator";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiEnabled } from "@/lib/gemini";

export const metadata: Metadata = { title: "Outfits" };

export default async function OutfitsPage({ searchParams }: PageProps<"/outfits">) {
  const user = await requireUser();
  const { anchor } = await searchParams;
  const [outfits, anchorItem, itemCount] = await Promise.all([
    db.outfit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { item: true }, orderBy: { position: "asc" } } },
    }),
    typeof anchor === "string"
      ? db.item.findFirst({ where: { id: anchor, userId: user.id }, select: { id: true, name: true, imagePath: true } })
      : null,
    db.item.count({ where: { userId: user.id } }),
  ]);
  const fresh = outfits.filter((o) => !o.saved);
  const saved = outfits.filter((o) => o.saved);

  const grid = (list: typeof outfits) => (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-5">
      {list.map((outfit) => (
        <Link key={outfit.id} href={`/outfits/${outfit.id}`} className="group block">
          <FlatLay pieces={outfit.items.map(({ item }) => toPiece(item))} />
          <p className="mt-2 flex items-center gap-1.5 text-[15px] font-semibold group-hover:text-cobalt">
            {outfit.saved && <Bookmark size={14} className="fill-current" />}
            {outfit.name}
          </p>
          <p className="truncate text-[13px] text-muted">{outfit.items.map(({ item }) => item.name).join(", ")}</p>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <p className="text-[13px] font-medium text-muted">The fitting room</p>
      <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">What are you dressing for?</h1>

      <OutfitGenerator anchor={anchorItem} ai={aiEnabled()} disabled={itemCount < 2} />

      {fresh.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Fresh suggestions</h2>
          <p className="mt-0.5 mb-3.5 text-[13px] text-muted">Save the ones you like. The rest make way for the next round.</p>
          {grid(fresh)}
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3.5 text-lg font-semibold">Saved looks</h2>
        {saved.length > 0 ? grid(saved) : <p className="text-sm text-muted">Looks you save or wear end up here.</p>}
      </section>
    </>
  );
}
