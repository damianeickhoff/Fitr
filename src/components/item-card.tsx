import { Heart } from "lucide-react";
import Link from "next/link";
import type { WardrobeNote } from "@/lib/wardrobe";
import { imageUrl } from "@/lib/storage-url";
import { cx, pill } from "./ui";

export type CardItem = {
  id: string;
  name: string;
  category: string;
  imagePath: string;
  wearCount: number;
  favourite: boolean;
  aiTagged: boolean;
  idle: boolean;
  note: WardrobeNote | null;
};

/**
 * A piece as a shop listing: the cut-out photo with a quiet wear pill on it,
 * the name, and a coloured note only when there is something worth saying.
 */
export function ItemCard({ item, faded, priority }: { item: CardItem; faded?: boolean; priority?: boolean }) {
  const note = item.aiTagged ? item.note : { text: "Needs details", tone: "amber" as const };
  return (
    <Link href={`/item/${item.id}`} className="group block">
      <span className="relative block">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, already-sized listing images */}
        <img
          src={imageUrl(item.imagePath)}
          alt={item.name}
          loading={priority ? "eager" : "lazy"}
          className={cx(
            "block aspect-[4/5] w-full rounded-md bg-ground object-cover transition duration-300",
            faded && "opacity-55 grayscale-[0.85]",
          )}
        />
        <span className={cx("absolute bottom-2 left-2", pill(item.wearCount === 0 ? "solid" : "frost"), faded && "opacity-60")}>
          {item.wearCount === 0 ? "New" : `${item.wearCount}× worn`}
        </span>
        {item.favourite && (
          <Heart size={16} className="absolute top-2.5 right-2.5 fill-[#e0457b] text-[#e0457b]" aria-label="Favourite" />
        )}
      </span>
      <span className={cx("mt-2 block text-[13.5px] leading-snug font-medium group-hover:text-cobalt", faded ? "text-muted" : "text-ink")}>
        {item.name}
      </span>
      {note && <span className={cx("mt-1.5", pill(note.tone))}>{note.text}</span>}
    </Link>
  );
}
