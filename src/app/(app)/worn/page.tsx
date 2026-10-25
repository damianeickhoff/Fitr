import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_TONE, button, cx, panel, pill } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { INTL_TAG, capitalise, categoryLabel, translator } from "@/lib/i18n";
import { profileLocale } from "@/lib/locale";
import { imageUrl } from "@/lib/storage-url";
import { dayKey, dayLabel, dayStart, monthGrid, monthKey, shiftMonth } from "@/lib/wardrobe";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await requireProfile();
  return { title: translator(profileLocale(profile))("calendar.title") };
}

/**
 * What was worn, a month at a time. Days are links rather than client state:
 * the chosen day lives in the address, so back and a reload keep it.
 */
export default async function WornPage({ searchParams }: PageProps<"/worn">) {
  const { profile } = await requireProfile();
  const locale = profileLocale(profile);
  const t = translator(locale);
  const now = new Date();
  const today = dayKey(now);
  const thisMonth = monthKey(now);

  const params = await searchParams;
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : thisMonth;
  const chosen =
    typeof params.day === "string" && params.day.startsWith(`${month}-`) ? params.day : month === thisMonth ? today : null;

  const wears = await db.wear.findMany({
    where: { profileId: profile.id, wornOn: { gte: `${month}-01`, lte: `${month}-31` } },
    orderBy: { createdAt: "asc" },
    include: {
      item: { select: { id: true, name: true, imagePath: true, category: true } },
      outfit: { select: { id: true, name: true } },
    },
  });
  const weeks = monthGrid(month, wears);
  const loggedDays = new Set(wears.map((w) => w.wornOn)).size;
  const dayWears = chosen ? wears.filter((w) => w.wornOn === chosen) : [];

  const first = dayStart(`${month}-01`);
  const title = capitalise(first.toLocaleDateString(INTL_TAG[locale], { month: "long", year: "numeric" }));
  // Monday first, as the grid is laid out; 5 January 2026 was a Monday.
  const weekdays = Array.from({ length: 7 }, (_, n) =>
    new Date(2026, 0, 5 + n).toLocaleDateString(INTL_TAG[locale], { weekday: "narrow" }),
  );
  const href = (m: string, day?: string) => `/worn?month=${m}${day ? `&day=${day}` : ""}`;
  const arrow = "grid size-10 place-items-center rounded-full bg-ground ring-1 ring-line ring-inset transition hover:ring-ink/30";

  return (
    <>
      <Link href="/" className={cx(button.quiet, "-ml-3")}>
        <ArrowLeft size={16} strokeWidth={2.6} /> {t("never.back")}
      </Link>

      <span className={cx(pill("green", "md"), "mt-3")}>{t("calendar.pill")}</span>
      <h1 className="mt-2 text-[28px] leading-tight font-extrabold tracking-tight">{t("calendar.title")}</h1>

      <div className="mt-4 flex items-center gap-3">
        <Link href={href(shiftMonth(month, -1))} aria-label={t("calendar.prev")} className={arrow}>
          <ChevronLeft size={18} strokeWidth={2.6} />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[17px] font-extrabold">{title}</p>
          <p className="text-[12.5px] font-semibold text-muted">
            {loggedDays > 0 ? t.count("calendar.days", loggedDays) : t("calendar.empty")}
          </p>
        </div>
        {month < thisMonth ? (
          <Link href={href(shiftMonth(month, 1))} aria-label={t("calendar.next")} className={arrow}>
            <ChevronRight size={18} strokeWidth={2.6} />
          </Link>
        ) : (
          <span aria-hidden className={cx(arrow, "opacity-40")}>
            <ChevronRight size={18} strokeWidth={2.6} />
          </span>
        )}
      </div>

      <div className={cx(panel, "mt-4 p-2")}>
        <div className="grid grid-cols-7 gap-1 pb-1">
          {weekdays.map((d, n) => (
            <span key={n} className="text-center text-[11.5px] font-bold text-muted">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={w} className="grid grid-cols-7 gap-1">
            {week.map((cell, n) => {
              if (!cell) return <span key={n} />;
              const pieces = cell.wears.slice(0, 4);
              const future = cell.key > today;
              return (
                <Link
                  key={cell.key}
                  href={href(month, cell.key)}
                  scroll={false}
                  aria-label={dayLabel(cell.key, now, t)}
                  aria-current={cell.key === chosen ? "date" : undefined}
                  className={cx(
                    "flex h-[62px] flex-col items-center gap-1 rounded-xl pt-1 transition",
                    cell.key === chosen ? "bg-ink text-paper" : "hover:bg-[#efe8db]",
                    future && "pointer-events-none opacity-35",
                  )}
                >
                  <span className={cx("text-[12.5px] font-bold", cell.key === today && cell.key !== chosen && "text-accent")}>{cell.day}</span>
                  {pieces.length > 0 && (
                    <span className="flex">
                      {pieces.map((wear, i) => (
                        // eslint-disable-next-line @next/next/no-img-element -- private listing image
                        <img
                          key={wear.id}
                          src={imageUrl(wear.item.imagePath)}
                          alt=""
                          className={cx("h-[28px] w-[21px] rounded-[5px] border-2 border-ground bg-[#efe8db] object-cover", i > 0 && "-ml-3.5")}
                        />
                      ))}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {chosen && (
        <section className="mt-6">
          <h2 className="text-lg font-extrabold">{dayLabel(chosen, now, t)}</h2>
          {dayWears.length > 0 ? (
            <>
              <p className="text-[13px] font-semibold text-muted">{t.count("calendar.pieces", dayWears.length)}</p>
              <ul className="mt-1 divide-y divide-line">
                {dayWears.map((wear) => (
                  <li key={wear.id}>
                    <Link href={`/item/${wear.item.id}`} className="flex items-center gap-3 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
                      <img src={imageUrl(wear.item.imagePath)} alt={wear.item.name} className="h-16 w-[52px] shrink-0 rounded-xl bg-[#efe8db] object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-bold">{wear.item.name}</span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className={pill(CATEGORY_TONE[wear.item.category] ?? "grey")}>{categoryLabel(t, wear.item.category)}</span>
                          {wear.outfit && <span className={pill("amber")}>{t("calendar.fromOutfit", { name: wear.outfit.name })}</span>}
                        </span>
                      </span>
                      <ChevronRight size={18} strokeWidth={2.4} className="shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-muted">{t("calendar.dayEmpty")}</p>
          )}
        </section>
      )}
    </>
  );
}
