import { ArrowLeft, ArrowUpRight, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, MapPin, ShoppingBag, Snowflake, Sun } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackingList, type PackingGroup } from "@/components/packing-list";
import { TripActions } from "@/components/trip-actions";
import { button, cx, panel, pill } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_KEYS, shopUrl } from "@/lib/garment";
import { aiEnabled } from "@/lib/gemini";
import { INTL_TAG, capitalise, categoryLabel, translator, type MessageKey } from "@/lib/i18n";
import { profileLocale } from "@/lib/locale";
import { parsePacking, parseTips, stayWeather, tripDates, tripTiming, type StayDay } from "@/lib/trips";
import { dayStart } from "@/lib/wardrobe";
import { rainLikely, type Condition } from "@/lib/weather";

async function load(id: string) {
  const { profile } = await requireProfile();
  const trip = await db.trip.findFirst({ where: { id, profileId: profile.id } });
  if (!trip) notFound();
  return { trip, profile };
}

export async function generateMetadata({ params }: PageProps<"/trips/[id]">): Promise<Metadata> {
  const { trip } = await load((await params).id);
  return { title: trip.name };
}

const SKY: Record<Condition, typeof Sun> = {
  clear: Sun,
  partlyCloudy: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: Snowflake,
  thunder: CloudLightning,
};

export default async function TripPage({ params, searchParams }: PageProps<"/trips/[id]">) {
  const { trip, profile } = await load((await params).id);
  const { rules } = await searchParams;
  const locale = profileLocale(profile);
  const t = translator(locale);
  const now = new Date();
  const packing = parsePacking(trip.packing);
  const tips = parseTips(trip.advice);
  const [items, days] = await Promise.all([db.item.findMany({ where: { profileId: profile.id } }), stayWeather(trip, locale, now)]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const timing = tripTiming(trip, now);

  // Pieces deleted from the wardrobe since packing just drop off the list.
  const rows = packing.flatMap((p) => {
    const item = byId.get(p.itemId);
    return item ? [{ itemId: item.id, name: item.name, imagePath: item.imagePath, reason: p.reason, packed: Boolean(p.packed), category: item.category }] : [];
  });
  const groups: PackingGroup[] = CATEGORY_KEYS.map((category) => ({
    category,
    label: categoryLabel(t, category, "other"),
    rows: rows.filter((r) => r.category === category),
  })).filter((g) => g.rows.length > 0);
  const onList = new Set(rows.map((r) => r.itemId));
  const addable = items.filter((i) => !onList.has(i.id)).map((i) => ({ id: i.id, name: i.name, imagePath: i.imagePath }));

  const forecastDays = days.filter((d) => d.state === "forecast");
  const far = days.filter((d) => d.state === "far");
  const unknown = days.filter((d) => d.state === "unknown");
  const seasonOf = (list: StayDay[]) => t(`season.${list[0].season}` as MessageKey);

  return (
    <>
      <Link href="/trips" className={cx(button.quiet, "-ml-3 mb-2")}>
        <ArrowLeft size={16} strokeWidth={2.6} /> {t("trips.back")}
      </Link>

      <p className="flex items-center gap-1 text-[13px] font-bold text-muted">
        <MapPin size={14} strokeWidth={2.4} /> {trip.placeName}
      </p>
      <h1 className="mt-1 text-[28px] leading-tight font-extrabold tracking-tight">{trip.name}</h1>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={pill("grey", "md")}>{tripDates(trip, t, now)}</span>
        <span className={pill("violet", "md")}>{t.count("trips.days", days.length)}</span>
        {timing.kind === "now" && <span className={pill("green", "md")}>{t("trips.now")}</span>}
        {timing.kind === "soon" && <span className={pill("blue", "md")}>{t.count("trips.inDays", timing.days)}</span>}
      </div>
      {trip.notes && <p className="mt-2.5 text-[15px] leading-relaxed text-[#3f3931]">{trip.notes}</p>}

      <TripActions
        trip={{
          id: trip.id,
          name: trip.name,
          placeName: trip.placeName,
          latitude: trip.latitude,
          longitude: trip.longitude,
          startDate: trip.startDate,
          endDate: trip.endDate,
          notes: trip.notes,
        }}
        hasList={rows.length > 0}
        notice={rules ? (aiEnabled() ? t("trips.rulesUsed") : t("trips.rulesOnly")) : undefined}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-extrabold">{t("trips.forecast")}</h2>
        {forecastDays.length > 0 && (
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {forecastDays.map((day) => (
              <DayChip key={day.date} day={day} locale={locale} rain={t("trips.rainChip", { n: day.reading!.rainChance })} />
            ))}
          </div>
        )}
        {timing.kind === "past" ? (
          <p className="text-sm font-semibold text-muted">{t("trips.over")}</p>
        ) : (
          <>
            {far.length > 0 && (
              <p className={cx("text-sm font-semibold text-muted", forecastDays.length > 0 && "mt-2.5")}>
                {forecastDays.length > 0 ? t.count("trips.tooFarSome", far.length, { season: seasonOf(far) }) : t("trips.tooFar", { season: seasonOf(far) })}
              </p>
            )}
            {unknown.length > 0 && (
              <p className="mt-2.5 text-sm font-semibold text-muted">{t("trips.forecastFailed", { season: seasonOf(unknown) })}</p>
            )}
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold">{t("trips.packing")}</h2>
        <PackingList tripId={trip.id} groups={groups} addable={addable} />
      </section>

      {tips.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold">{t("trips.worthBuying")}</h2>
          <ul className="space-y-2.5">
            {tips.map((tip, n) => (
              <li key={n} className={cx(panel, "flex gap-3 p-3")}>
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#f3dcd6] text-[#7a2e2e]">
                  <ShoppingBag size={20} />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="leading-relaxed">{tip.text}</p>
                  {tip.shopFor && (
                    <a
                      href={shopUrl(tip.shopFor)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 font-bold text-accent hover:underline"
                    >
                      {t("outfit.shop", { query: tip.shopFor })} <ArrowUpRight size={14} />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** One day of the stay: the weekday, the sky, the high over the low, and rain when it's likely. */
function DayChip({ day, locale, rain }: { day: StayDay; locale: "en" | "nl"; rain: string }) {
  const r = day.reading!;
  const Icon = SKY[r.condition];
  const date = dayStart(day.date);
  const wet = rainLikely(r) || r.rainChance >= 30;
  return (
    <div className={cx(panel, "flex w-[78px] shrink-0 flex-col items-center px-2 py-2.5 text-center")}>
      <span className="text-[12px] font-bold text-muted">
        {capitalise(date.toLocaleDateString(INTL_TAG[locale], { weekday: "short" }).replace(".", ""))} {date.getDate()}
      </span>
      <Icon size={22} strokeWidth={2} className="my-1.5 text-ink" />
      <span className="text-[15px] font-extrabold">{r.max}°</span>
      <span className="text-[12.5px] font-semibold text-muted">{r.min}°</span>
      {wet && <span className="mt-1 text-[11px] font-bold text-[#24389c]">{rain}</span>}
    </div>
  );
}
