"use client";

import { MapPin, Search } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { searchPlaces, type PlaceState } from "@/lib/profile-actions";
import { createTrip, updateTrip, type TripFormState } from "@/lib/trip-actions";
import { useT } from "./locale";
import { SubmitButton } from "./submit-button";
import { button, cx, field, label } from "./ui";

export type TripFields = {
  id: string;
  name: string;
  placeName: string;
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  notes: string | null;
};

type Picked = { name: string; latitude: number; longitude: number };

/** New trip, or the same fields to edit one. The town is looked up and picked like the Me page's location. */
export function TripForm({ trip, onDone }: { trip?: TripFields; onDone?: () => void }) {
  const t = useT();
  const [state, action] = useActionState<TripFormState, FormData>(trip ? updateTrip.bind(null, trip.id) : createTrip, undefined);
  const [place, setPlace] = useState<Picked | null>(trip ? { name: trip.placeName, latitude: trip.latitude, longitude: trip.longitude } : null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PlaceState>(undefined);
  const [searching, startSearch] = useTransition();
  const [start, setStart] = useState(trip?.startDate ?? "");

  // An edit closes itself once saved; a new trip moves on to its own page.
  const submitted = useRef(false);
  useEffect(() => {
    if (submitted.current && state && !state.error) onDone?.();
  }, [state, onDone]);

  // Not a nested form: the look-up runs inside the trip form, so it calls the action itself.
  const search = () =>
    startSearch(async () => {
      const form = new FormData();
      form.set("place", query);
      setFound(await searchPlaces(undefined, form));
    });

  return (
    <form action={action} onSubmit={() => (submitted.current = true)} className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="trip-name" className={label}>
          {t("trips.name")}
        </label>
        <input id="trip-name" name="name" required maxLength={80} defaultValue={trip?.name} placeholder={t("trips.namePlaceholder")} className={cx(field, "bg-paper")} />
      </div>

      <div>
        <p className={label}>{t("trips.place")}</p>
        {place ? (
          <div className="flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-2.5 ring-1 ring-line ring-inset">
            <MapPin size={18} strokeWidth={2.2} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{place.name}</span>
            <button type="button" onClick={() => setPlace(null)} className="text-sm font-bold text-muted hover:text-ink">
              {t("trips.placeChange")}
            </button>
            <input type="hidden" name="placeName" value={place.name} />
            <input type="hidden" name="latitude" value={place.latitude} />
            <input type="hidden" name="longitude" value={place.longitude} />
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (query.trim().length >= 2) search();
                  }
                }}
                maxLength={80}
                autoComplete="off"
                placeholder={t("trips.placeSearch")}
                aria-label={t("trips.placeSearch")}
                className={cx(field, "bg-paper")}
              />
              <button type="button" onClick={search} disabled={searching || query.trim().length < 2} className={button.secondary}>
                <Search size={15} strokeWidth={2.4} /> {searching ? t("trips.placeFinding") : t("trips.placeFind")}
              </button>
            </div>
            {found?.error && (
              <p className="mt-2 text-sm font-semibold text-danger" role="alert">
                {found.error}
              </p>
            )}
            {found?.places && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {found.places.map((p) => (
                  <li key={`${p.latitude},${p.longitude}`}>
                    <button
                      type="button"
                      onClick={() => setPlace({ name: [p.name, p.country].filter(Boolean).join(", "), latitude: p.latitude, longitude: p.longitude })}
                      className="w-full rounded-2xl bg-paper px-3.5 py-2.5 text-left ring-1 ring-line ring-inset transition hover:ring-ink/30"
                    >
                      <span className="block text-sm font-bold">{p.name}</span>
                      <span className="block truncate text-xs font-semibold text-muted">{[p.admin1, p.country].filter(Boolean).join(", ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="trip-start" className={label}>
            {t("trips.start")}
          </label>
          <input
            id="trip-start"
            name="startDate"
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={cx(field, "bg-paper")}
          />
        </div>
        <div>
          <label htmlFor="trip-end" className={label}>
            {t("trips.end")}
          </label>
          <input id="trip-end" name="endDate" type="date" required min={start || undefined} defaultValue={trip?.endDate} className={cx(field, "bg-paper")} />
        </div>
      </div>

      <div>
        <label htmlFor="trip-notes" className={label}>
          {t("trips.notes")}
        </label>
        <input id="trip-notes" name="notes" maxLength={300} defaultValue={trip?.notes ?? ""} placeholder={t("trips.notesPlaceholder")} className={cx(field, "bg-paper")} />
      </div>

      {state?.error && (
        <p className="text-sm font-semibold text-danger" role="alert">
          {state.error}
        </p>
      )}
      {trip ? (
        <div className="flex gap-2">
          <SubmitButton className="flex-1" pending={t("common.saving")}>
            {t("common.save")}
          </SubmitButton>
          <button type="button" onClick={onDone} className={button.quiet}>
            {t("common.close")}
          </button>
        </div>
      ) : (
        <SubmitButton pending={t("trips.creating")}>{t("trips.create")}</SubmitButton>
      )}
    </form>
  );
}
