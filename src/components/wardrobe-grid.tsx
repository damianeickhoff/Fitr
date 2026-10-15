"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/garment";
import { FADE_COOKIE } from "@/lib/wardrobe";
import { ItemCard, type CardItem } from "./item-card";
import { cx } from "./ui";

/**
 * Category tabs and the fade switch work on the client: they only rearrange
 * what is already on the page. The fade choice is remembered per device.
 */
export function WardrobeGrid({ items, initialFade }: { items: CardItem[]; initialFade: boolean }) {
  const [tab, setTab] = useState<string>("all");
  const [fade, setFade] = useState(initialFade);

  function toggleFade() {
    const next = !fade;
    setFade(next);
    document.cookie = `${FADE_COOKIE}=${next ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;
  }

  const tabs = [
    { key: "all", label: "All" },
    ...(items.some((i) => i.favourite) ? [{ key: "fav", label: "Favourites" }] : []),
    ...CATEGORY_KEYS.filter((k) => items.some((i) => i.category === k)).map((k) => ({ key: k, label: CATEGORIES[k].label })),
  ];
  const shown = items.filter((i) => tab === "all" || (tab === "fav" ? i.favourite : i.category === tab));

  return (
    <>
      <nav aria-label="Filter by category" className="no-scrollbar -mx-4 mt-4 flex gap-5 overflow-x-auto border-b border-line px-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cx(
              "-mb-px shrink-0 border-b-2 pb-2.5 text-sm transition",
              tab === t.key ? "border-ink font-semibold text-ink" : "border-transparent font-medium text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-3 mb-4 flex items-center justify-between">
        <span id="fade-label" className="text-[13px] text-muted">
          Fade what I don&rsquo;t wear
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={fade}
          aria-labelledby="fade-label"
          onClick={toggleFade}
          className={cx("relative h-6 w-[42px] shrink-0 rounded-full transition-colors", fade ? "bg-ink" : "bg-[#d4d8df]")}
        >
          <span className={cx("absolute top-[3px] size-[18px] rounded-full bg-white transition-all", fade ? "left-[21px]" : "left-[3px]")} />
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Nothing here yet. Tap the heart on a piece to make it a favourite.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-6">
          {shown.map((item, n) => (
            <ItemCard key={item.id} item={item} faded={fade && item.idle} priority={n < 4} />
          ))}
        </div>
      )}
    </>
  );
}
