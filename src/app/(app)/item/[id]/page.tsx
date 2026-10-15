import { ArrowLeft, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemActions } from "@/components/item-actions";
import { ItemEditor } from "@/components/item-editor";
import { CATEGORY_TONE, button, cx, pill, toneFor } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORIES, FORMALITY, isCategory, parseList } from "@/lib/garment";
import { imageAiEnabled } from "@/lib/image-gen";
import { imageUrl } from "@/lib/storage-url";
import { wardrobeNotes } from "@/lib/wardrobe";

async function load(id: string) {
  const user = await requireUser();
  const item = await db.item.findFirst({
    where: { id, userId: user.id },
    include: {
      outfitItems: {
        include: { outfit: { include: { items: { include: { item: true } } } } },
      },
    },
  });
  if (!item) notFound();
  return { item, userId: user.id };
}

export async function generateMetadata({ params }: PageProps<"/item/[id]">): Promise<Metadata> {
  const { item } = await load((await params).id);
  return { title: item.name };
}

export default async function ItemPage({ params }: PageProps<"/item/[id]">) {
  const { item, userId } = await load((await params).id);
  const colors = parseList(item.colors);
  const styles = parseList(item.styles);
  const seasons = parseList(item.seasons);
  const category = isCategory(item.category) ? CATEGORIES[item.category].one : item.category;

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

  const all = await db.item.findMany({ where: { userId }, select: { id: true, wearCount: true, lastWornAt: true, createdAt: true } });
  const note = wardrobeNotes(all).get(item.id);

  const facts = [
    ["Type", item.subcategory],
    ["Colour", colors.join(", ")],
    ["Material", item.material],
    ["Pattern", item.pattern],
    ["Dress code", FORMALITY[item.formality]],
    ["Brand", item.brand],
  ].filter(([, value]) => value);

  return (
    <>
      <div className="relative -mx-4 -mt-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
        <img src={imageUrl(item.imagePath)} alt={item.name} className="block aspect-[4/5] w-full bg-ground object-cover" />
        <Link
          href="/"
          aria-label="Back to wardrobe"
          className="absolute top-3.5 left-3.5 grid size-10 place-items-center rounded-full bg-white/90 text-ink backdrop-blur-md"
        >
          <ArrowLeft size={20} />
        </Link>
        <span className={cx("absolute bottom-3.5 left-3.5", pill(item.wearCount === 0 ? "solid" : "frost", "md"))}>
          {item.wearCount === 0 ? "New" : `${item.wearCount}× worn`}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {isCategory(item.category) && <span className={pill(CATEGORY_TONE[item.category], "md")}>{category}</span>}
        {item.favourite && <span className={pill("pink", "md")}>♥ Favourite</span>}
        {note && <span className={pill(note.tone, "md")}>{note.text}</span>}
      </div>
      <h1 className="mt-2.5 text-[26px] leading-tight font-semibold tracking-tight">{item.name}</h1>

      {!item.aiTagged && (
        <p className="mt-3 rounded-xl bg-[#fdeccb] p-3 text-sm text-[#8a5300]">
          This piece hasn&rsquo;t been tagged. Fill in the details below so outfits can use it properly.
        </p>
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
              {s}
            </span>
          ))}
        </div>
      )}

      <Link href={`/outfits?anchor=${item.id}`} className={cx(button.primary, "mt-5 w-full")}>
        <Sparkles size={17} /> Style this piece
      </Link>

      {facts.length > 0 && (
        <dl className="mt-5 rounded-2xl bg-ground px-4 py-1.5 text-sm">
          {facts.map(([term, value]) => (
            <div key={term} className="flex justify-between gap-4 border-b border-line py-2.5 last:border-0">
              <dt className="text-muted">{term}</dt>
              <dd className="flex items-center gap-2 text-right capitalize">
                {term === "Colour" && item.colorHex && (
                  <span className="inline-block size-2.5 rounded-full ring-1 ring-black/20" style={{ background: item.colorHex }} />
                )}
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {goesWith.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-2.5 text-lg font-semibold">Goes well with</h2>
          <div className="grid grid-cols-4 gap-2">
            {goesWith.map((p) => (
              <Link key={p.id} href={`/item/${p.id}`} title={p.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
                <img src={imageUrl(p.imagePath)} alt={p.name} className="aspect-[4/5] w-full rounded-lg bg-ground object-cover" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <ItemActions id={item.id} favourite={item.favourite} studio={imageAiEnabled()} />

      <details className="group mt-5 rounded-2xl bg-ground" open={!item.aiTagged}>
        <summary className="cursor-pointer list-none px-4 py-3.5 font-semibold">
          Edit details <span className="font-normal text-muted group-open:hidden">· fix anything the AI got wrong</span>
        </summary>
        <div className="border-t border-line px-4 py-4">
          <ItemEditor item={item} />
        </div>
      </details>
    </>
  );
}
