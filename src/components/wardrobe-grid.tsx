"use client";

import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CATEGORY_KEYS } from "@/lib/garment";
import { categoryLabel } from "@/lib/i18n";
import { FADE_COOKIE, VIEW_COOKIE } from "@/lib/wardrobe";
import { ItemCard, ItemRow, type CardItem } from "./item-card";
import { useT } from "./locale";
import { chip, cx } from "./ui";

export type View = "grid" | "list";

function remember(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * The wardrobe itself: title, view switch, category chips and the pieces as
 * cards or rows. Filters and switches work on the client, since they only
 * rearrange what is already on the page; each choice is remembered per device.
 * `banner` is whatever the server wants shown between the title and the
 * filters: the never-worn nudge, or today's look.
 */
export function WardrobeGrid({
  name,
  items,
  unworn,
  initialFade,
  initialView,
  banner,
}: {
  name: string;
  items: CardItem[];
  unworn: number;
  initialFade: boolean;
  initialView: View;
  banner?: React.ReactNode;
}) {
  const t = useT();
  const [tab, setTab] = useState<string>("all");
  const [fade, setFade] = useState(initialFade);
  const [view, setView] = useState<View>(initialView);

  function toggleFade() {
    const next = !fade;
    setFade(next);
    remember(FADE_COOKIE, next ? "on" : "off");
  }
  function pick(next: View) {
    setView(next);
    remember(VIEW_COOKIE, next);
  }

  const tabs = [
    { key: "all", label: t("wardrobe.all") },
    ...(items.some((i) => i.favourite) ? [{ key: "fav", label: t("wardrobe.favourites") }] : []),
    ...(items.some((i) => i.wash) ? [{ key: "wash", label: t("wash.in") }] : []),
    ...CATEGORY_KEYS.filter((k) => items.some((i) => i.category === k)).map((k) => ({ key: k, label: categoryLabel(t, k, "other") })),
  ];
  const shown = items.filter((i) => tab === "all" || (tab === "fav" ? i.favourite : tab === "wash" ? i.wash : i.category === tab));
  const rows = view === "list" ? [...shown].sort((a, b) => a.wornRank - b.wornRank) : shown;
  const needsDetails = t("note.needsDetails");

  const viewButton = (which: View, Icon: typeof LayoutGrid, label: string) => (
    <button
      type="button"
      onClick={() => pick(which)}
      aria-label={label}
      aria-pressed={view === which}
      className={cx("grid h-[30px] w-10 place-items-center rounded-full transition", view === which ? "bg-accent text-white" : "text-muted hover:text-ink")}
    >
      <Icon size={17} strokeWidth={2.6} />
    </button>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-[30px] font-extrabold tracking-tight">{t("wardrobe.hi", { name })}</h1>
        <div role="group" aria-label={t("wardrobe.view")} className="flex shrink-0 gap-0.5 rounded-full bg-ground p-1 ring-1 ring-line ring-inset">
          {viewButton("grid", LayoutGrid, t("wardrobe.grid"))}
          {viewButton("list", List, t("wardrobe.list"))}
        </div>
      </div>
      <p className="mt-1 text-[13px] font-semibold text-muted">
        {t.count("wardrobe.pieces", items.length)}
        {unworn > 0 && (
          <>
            {" · "}
            <Link href="/never-worn" className="text-[#7d4b00] hover:underline">
              {t.count("wardrobe.neverWorn", unworn)}
            </Link>
          </>
        )}
      </p>

      {banner}

      <nav aria-label={t("wardrobe.filter")} className="no-scrollbar -mx-5 mt-4 flex gap-1.5 overflow-x-auto px-5">
        {tabs.map((tb) => (
          <button key={tb.key} type="button" onClick={() => setTab(tb.key)} aria-pressed={tab === tb.key} className={chip(tab === tb.key)}>
            {tb.label}
          </button>
        ))}
      </nav>

      <div className="mt-3 mb-3 flex items-center justify-between">
        <span id="fade-label" className="text-[13px] font-semibold text-muted">
          {view === "list" ? t("wardrobe.sorted") : t("wardrobe.fade")}
        </span>
        {view === "grid" && (
          <button
            type="button"
            role="switch"
            aria-checked={fade}
            aria-labelledby="fade-label"
            onClick={toggleFade}
            className={cx("relative h-6 w-[42px] shrink-0 rounded-full transition-colors", fade ? "bg-ink" : "bg-line")}
          >
            <span className={cx("absolute top-[3px] size-[18px] rounded-full bg-ground transition-all", fade ? "left-[21px]" : "left-[3px]")} />
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{t("wardrobe.emptyFilter")}</p>
      ) : view === "list" ? (
        <div className="divide-y divide-line">
          {rows.map((item) => (
            <ItemRow key={item.id} item={item} faded={fade && item.idle} needsDetails={needsDetails} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rows.map((item, n) => (
            <ItemCard key={item.id} item={item} faded={fade && item.idle} priority={n < 4} needsDetails={needsDetails} />
          ))}
        </div>
      )}
    </>
  );
}
