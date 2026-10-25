import { ArrowLeft, CloudSun, MapPin, Plus, Luggage } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TripForm } from "@/components/trip-form";
import { button, cx, panel, pill } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { translator, type Translate } from "@/lib/i18n";
import { profileLocale } from "@/lib/locale";
import { parsePacking, stayWeather, tripDates, tripDays, tripTiming, weatherSummary } from "@/lib/trips";
import { dayKey } from "@/lib/wardrobe";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await requireProfile();
  return { title: translator(profileLocale(profile))("trips.title") };
}

type TripRow = Awaited<ReturnType<typeof db.trip.findMany>>[number];

export default async function TripsPage() {
  const { profile } = await requireProfile();
  const locale = profileLocale(profile);
  const t = translator(locale);
  const now = new Date();
  const today = dayKey(now);
  const trips = await db.trip.findMany({ where: { profileId: profile.id }, orderBy: { startDate: "asc" } });
  const upcoming = trips.filter((trip) => trip.endDate >= today);
  const past = trips.filter((trip) => trip.endDate < today).reverse();
  // One forecast request per place at most, shared through weather.ts's cache.
  const summaries = new Map(
    await Promise.all(
      upcoming.map(async (trip) => {
        const days = await stayWeather(trip, locale, now);
        const summary = weatherSummary(days, t) ?? (days.every((d) => d.state === "far") ? t("trips.farShort") : null);
        return [trip.id, summary] as const;
      }),
    ),
  );

  return (
    <>
      <Link href="/outfits" className={cx(button.quiet, "-ml-3 mb-2")}>
        <ArrowLeft size={16} strokeWidth={2.6} /> {t("nav.outfits")}
      </Link>
      <p className="text-[13px] font-bold text-muted">{t("trips.kicker")}</p>
      <h1 className="mt-1 text-[28px] leading-tight font-extrabold tracking-tight">{t("trips.title")}</h1>

      <details open={trips.length === 0} className={cx(panel, "group mt-4 p-4")}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-extrabold [&::-webkit-details-marker]:hidden">
          <span className="grid size-8 place-items-center rounded-full bg-accent text-white">
            <Plus size={17} strokeWidth={2.8} />
          </span>
          {t("trips.new")}
        </summary>
        <div className="mt-4">
          <TripForm />
        </div>
      </details>

      {trips.length === 0 && <p className="mt-4 text-sm font-semibold text-muted">{t("trips.empty")}</p>}

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold">{t("trips.upcoming")}</h2>
          <div className="flex flex-col gap-3">
            {upcoming.map((trip) => (
              <TripCard key={trip.id} trip={trip} summary={summaries.get(trip.id) ?? null} t={t} now={now} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold">{t("trips.past")}</h2>
          <div className="flex flex-col gap-3">
            {past.map((trip) => (
              <TripCard key={trip.id} trip={trip} summary={null} t={t} now={now} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function TripCard({ trip, summary, t, now }: { trip: TripRow; summary: string | null; t: Translate; now: Date }) {
  const packing = parsePacking(trip.packing);
  const timing = tripTiming(trip, now);
  return (
    <Link href={`/trips/${trip.id}`} className={cx(panel, "group block p-4", timing.kind === "past" && "opacity-80")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-extrabold group-hover:text-accent">{trip.name}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] font-semibold text-muted">
            <MapPin size={13} strokeWidth={2.4} className="shrink-0" /> {trip.placeName}
          </p>
        </div>
        {timing.kind === "now" && <span className={pill("green")}>{t("trips.now")}</span>}
        {timing.kind === "soon" && <span className={pill("blue")}>{t.count("trips.inDays", timing.days)}</span>}
      </div>
      <p className="mt-2 text-[13.5px] font-bold">
        {tripDates(trip, t, now)} · {t.count("trips.days", tripDays(trip.startDate, trip.endDate).length)}
      </p>
      {summary && (
        <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
          <CloudSun size={15} strokeWidth={2.2} className="shrink-0" /> {summary}
        </p>
      )}
      <p className="mt-2.5 flex items-center gap-1.5">
        <span className={pill("amber")}>
          <Luggage size={12} strokeWidth={2.6} /> {t.count("trips.pieces", packing.length)}
        </span>
        {packing.some((p) => p.packed) && (
          <span className={pill("grey")}>{t("trips.packedCount", { done: packing.filter((p) => p.packed).length, n: packing.length })}</span>
        )}
      </p>
    </Link>
  );
}
