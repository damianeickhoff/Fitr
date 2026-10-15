import { ArrowRight, Camera, ChevronRight } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { WardrobeGrid } from "@/components/wardrobe-grid";
import { button, cx, pill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/storage-url";
import { FADE_COOKIE, isIdle, wardrobeNotes } from "@/lib/wardrobe";

export default async function WardrobePage() {
  const user = await requireUser();
  const [items, latest] = await Promise.all([
    db.item.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.outfit.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { item: true }, orderBy: { position: "asc" } } },
    }),
  ]);

  if (items.length === 0) {
    return (
      <section className="py-16 text-center">
        <span className={pill("blue", "md")}>Your wardrobe is empty</span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Start with what you wore today</h1>
        <p className="mt-2 text-muted">
          Photograph a piece on a hanger, laid flat, or a whole outfit on you. FITR cuts out each piece and lists it.
        </p>
        <Link href="/add" className={cx(button.primary, "mt-6")}>
          <Camera size={18} /> Photograph a piece
        </Link>
      </section>
    );
  }

  const now = new Date();
  const notes = wardrobeNotes(items, now);
  const cards = items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    imagePath: i.imagePath,
    wearCount: i.wearCount,
    favourite: i.favourite,
    aiTagged: i.aiTagged,
    idle: isIdle(i, now),
    note: notes.get(i.id) ?? null,
  }));
  const idle = items.filter((i) => isIdle(i, now));

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="text-[26px] font-semibold tracking-tight">Wardrobe</h1>
        <span className="text-[13px] text-muted">
          {items.length} {items.length === 1 ? "piece" : "pieces"}
        </span>
      </div>

      {latest && latest.items.length > 0 && (
        <Link href={`/outfits/${latest.id}`} className="mt-3.5 flex items-center gap-3 rounded-[18px] bg-ink p-2.5 text-white">
          <span className="grid h-[70px] w-14 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-[10px] bg-ground">
            {latest.items.slice(0, 4).map(({ item }) => (
              // eslint-disable-next-line @next/next/no-img-element -- private listing image
              <img key={item.id} src={imageUrl(item.imagePath)} alt="" className="h-full w-full object-cover" />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className={pill("amber")}>{latest.saved ? "Saved look" : "Today's pick"}</span>
            <span className="mt-1.5 block truncate font-semibold">{latest.name}</span>
            <span className="block truncate text-[13px] text-[#b9bdc9]">
              {latest.items.map(({ item }) => item.name).join(", ")}
            </span>
          </span>
          <ArrowRight size={20} className="shrink-0" />
        </Link>
      )}

      {idle.length > 0 && (
        <Link href="/tips#rediscover" className="mt-2.5 flex items-center gap-3 rounded-[14px] bg-ground px-3.5 py-3">
          <span className="flex shrink-0">
            {idle.slice(0, 3).map((item, n) => (
              // eslint-disable-next-line @next/next/no-img-element -- private listing image
              <img
                key={item.id}
                src={imageUrl(item.imagePath)}
                alt=""
                className={cx("h-[38px] w-[30px] rounded-md object-cover opacity-70 grayscale-[0.85]", n > 0 && "-ml-2 shadow-[-2px_0_0_var(--ground)]")}
              />
            ))}
          </span>
          <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
            <strong className="font-semibold">
              {idle.length} {idle.length === 1 ? "piece misses" : "pieces miss"} you.
            </strong>{" "}
            <span className="text-muted">See how to wear {idle.length === 1 ? "it" : "them"} this week.</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted" />
        </Link>
      )}

      <WardrobeGrid items={cards} initialFade={(await cookies()).get(FADE_COOKIE)?.value !== "off"} />
    </>
  );
}
