import { Clock, Heart } from "lucide-react";
import Link from "next/link";
import type { WardrobeNote } from "@/lib/wardrobe";
import { imageUrl } from "@/lib/storage-url";
import { card, cx, pill, type Tone } from "./ui";

export type CardItem = {
  id: string;
  name: string;
  category: string;
  /** Translated, singular: "Top", "Broek". */
  categoryLabel: string;
  imagePath: string;
  favourite: boolean;
  aiTagged: boolean;
  idle: boolean;
  note: WardrobeNote | null;
  /** "Worn yesterday", "3 days ago", "Never worn". */
  worn: { text: string; never: boolean };
  /** "7× worn", or "Added 14 March" for a piece never worn. */
  count: string;
  /** Position in most-recently-worn order, for the list view. */
  wornRank: number;
};

/**
 * A piece as a shop listing: the cut-out photo in a rounded card with when it
 * was last worn on it, the name, and a coloured note only when there is
 * something worth saying.
 */
export function ItemCard({
  item,
  faded,
  priority,
  needsDetails,
}: {
  item: CardItem;
  faded?: boolean;
  priority?: boolean;
  needsDetails: string;
}) {
  const note = item.aiTagged ? item.note : { text: needsDetails, tone: "amber" as Tone };
  return (
    <Link href={`/item/${item.id}`} className={cx("group block", card)}>
      <span className="relative block overflow-hidden rounded-[20px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, already-sized listing images */}
        <img
          src={imageUrl(item.imagePath)}
          alt={item.name}
          loading={priority ? "eager" : "lazy"}
          className={cx("block aspect-[4/5] w-full bg-[#efe8db] object-cover transition duration-300", faded && "opacity-55 grayscale-[0.85]")}
        />
        <span className={cx("absolute bottom-2 left-2", pill(item.worn.never ? "solid" : "frost"), faded && "opacity-70")}>
          <Clock size={11} strokeWidth={2.6} /> {item.worn.text}
        </span>
        {item.favourite && (
          <Heart size={16} className="absolute top-2.5 right-2.5 fill-[#c9365f] text-[#c9365f]" aria-label="♥" />
        )}
      </span>
      <span className={cx("mt-2.5 block px-1.5 text-[14px] leading-snug font-bold group-hover:text-accent", faded ? "text-muted" : "text-ink")}>
        {item.name}
      </span>
      {note && <span className={cx("mt-1.5 ml-1.5", pill(note.tone))}>{note.text}</span>}
    </Link>
  );
}

/** The same piece as a row: for scanning dates down a list. */
export function ItemRow({ item, faded, needsDetails }: { item: CardItem; faded?: boolean; needsDetails: string }) {
  const note = item.aiTagged ? item.note : { text: needsDetails, tone: "amber" as Tone };
  const quiet = item.worn.never || item.idle;
  return (
    <Link href={`/item/${item.id}`} className="flex items-center gap-3 py-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
      <img
        src={imageUrl(item.imagePath)}
        alt=""
        loading="lazy"
        className={cx("h-[70px] w-14 shrink-0 rounded-xl bg-[#efe8db] object-cover", faded && "opacity-55 grayscale-[0.85]")}
      />
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate text-[14.5px] font-bold", faded ? "text-muted" : "text-ink")}>{item.name}</span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={pill("grey")}>{item.categoryLabel}</span>
          {note && <span className={pill(note.tone)}>{note.text}</span>}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cx("block text-[13.5px] font-bold", quiet ? "text-[#7d4b00]" : "text-ink")}>{item.worn.text}</span>
        <span className="mt-0.5 block text-xs font-semibold text-muted">{item.count}</span>
      </span>
    </Link>
  );
}
