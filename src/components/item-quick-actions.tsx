"use client";

import { Droplets, Heart, Shirt, Sparkles } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { markWorn, toggleFavourite, unmarkWorn } from "@/lib/item-actions";
import { toggleWash } from "@/lib/wash-actions";
import { useT } from "./locale";
import { TONES, cx } from "./ui";

const disc = "grid size-14 place-items-center rounded-full bg-ground ring-1 ring-line ring-inset transition";
const label = "flex flex-col items-center gap-1.5 text-center text-[12.5px] leading-tight font-bold disabled:opacity-60";

/**
 * The everyday taps on a piece, as four round buttons under its title. The
 * three toggles show their new state at once; the server's answer follows.
 */
export function ItemQuickActions({
  id,
  favourite,
  washing,
  woreToday,
  today,
}: {
  id: string;
  favourite: boolean;
  washing: boolean;
  woreToday: boolean;
  today: string;
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const [fav, setFav] = useOptimistic(favourite);
  const [wash, setWash] = useOptimistic(washing);
  const [wore, setWore] = useOptimistic(woreToday);

  return (
    <div className="mt-[18px] grid grid-cols-4 gap-1">
      <Link href={`/outfits?anchor=${id}`} className={label}>
        <span className={cx(disc, "bg-accent text-white ring-0")}>
          <Sparkles size={22} />
        </span>
        {t("item.styleIt")}
      </Link>
      <button
        type="button"
        aria-pressed={wore}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setWore(!wore);
            // A second tap takes back today's wear, for a tap made by mistake.
            await (wore ? unmarkWorn(id, today) : markWorn(id));
          })
        }
        className={label}
      >
        <span className={cx(disc, wore && [TONES.green, "ring-transparent"])}>
          <Shirt size={22} />
        </span>
        {wore ? t("item.woreDone") : t("item.wore")}
      </button>
      <button
        type="button"
        aria-pressed={wash}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setWash(!wash);
            await toggleWash(id);
          })
        }
        className={label}
      >
        <span className={cx(disc, wash && [TONES.teal, "ring-transparent"])}>
          <Droplets size={22} />
        </span>
        {t("wash.in")}
      </button>
      <button
        type="button"
        aria-pressed={fav}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setFav(!fav);
            await toggleFavourite(id);
          })
        }
        className={label}
      >
        <span className={cx(disc, fav && "bg-[#f3dcd6] ring-transparent")}>
          <Heart size={22} className={cx(fav && "fill-[#c9365f] text-[#c9365f]")} />
        </span>
        {t("common.favourite")}
      </button>
    </div>
  );
}
