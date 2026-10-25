"use client";

import { ChevronDown, MapPin, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { saveLocation, searchPlaces } from "@/lib/profile-actions";
import type { Place } from "@/lib/weather";
import { useT } from "./locale";
import { SubmitButton } from "./submit-button";
import { button, cx, field } from "./ui";

/** The Me page's location row: opens in place to look a town up and pick one of the matches. */
export function LocationSetting({ placeName }: { placeName: string | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, search] = useActionState(searchPlaces, undefined);
  const [saving, startSaving] = useTransition();

  const choose = (place: Place | null) =>
    startSaving(async () => {
      await saveLocation(place);
      setOpen(false);
    });

  return (
    <div className="border-b border-line last:border-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 py-3 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper text-ink ring-1 ring-line ring-inset">
          <MapPin size={20} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{t("me.location")}</span>
          <span className="block truncate text-[12.5px] font-semibold text-muted">{placeName ?? t("me.locationHint")}</span>
        </span>
        <ChevronDown size={18} strokeWidth={2.4} className={cx("text-muted transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="pb-4">
          <form action={search} className="flex gap-2">
            <input
              name="place"
              required
              minLength={2}
              maxLength={80}
              autoFocus
              autoComplete="address-level2"
              placeholder={t("me.locationSearch")}
              aria-label={t("me.locationSearch")}
              className={cx(field, "bg-paper")}
            />
            <SubmitButton variant="secondary" pending={t("me.locationFinding")}>
              {t("me.locationFind")}
            </SubmitButton>
          </form>
          {state?.error && (
            <p className="mt-2 text-sm font-semibold text-danger" role="alert">
              {state.error}
            </p>
          )}
          {state?.places && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {state.places.map((p) => (
                <li key={`${p.latitude},${p.longitude}`}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => choose(p)}
                    className="w-full rounded-2xl bg-paper px-3.5 py-2.5 text-left ring-1 ring-line ring-inset transition hover:ring-ink/30 disabled:opacity-60"
                  >
                    <span className="block text-sm font-bold">{p.name}</span>
                    <span className="block truncate text-xs font-semibold text-muted">{[p.admin1, p.country].filter(Boolean).join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {placeName && (
            <button type="button" disabled={saving} onClick={() => choose(null)} className={cx(button.danger, "mt-2 -ml-3")}>
              <X size={16} /> {t("me.locationRemove")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
