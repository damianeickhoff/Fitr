"use client";

import { Clock, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import { generateOutfits } from "@/lib/outfit-actions";
import { imageUrl } from "@/lib/storage-url";
import { useT } from "./locale";
import { SubmitButton } from "./submit-button";
import { chip, cx, field, panel } from "./ui";

/** Sent to the stylist as they are; shown in the profile's language. */
const OCCASIONS = ["Everyday", "Work", "Date night", "Weekend", "Party", "Wedding guest", "Travel", "Gym"];
const WEATHER = ["Hot", "Warm", "Mild", "Cool", "Cold", "Rainy"];

type Anchor = { id: string; name: string; imagePath: string } | null;
type Day = "today" | "tomorrow";
const DAYS: Day[] = ["today", "tomorrow"];

export function OutfitGenerator({
  anchor,
  unworn,
  ai,
  disabled,
  forecasts,
  hasPlace,
  day,
}: {
  anchor: Anchor;
  /** From the never-worn overview: build every look around a piece never worn. */
  unworn: boolean;
  ai: boolean;
  disabled: boolean;
  /** The forecast sentence for each day, when the profile has a place and the forecast came through. */
  forecasts: Record<Day, string> | null;
  hasPlace: boolean;
  /** Preselected from the wardrobe's nudge. */
  day?: Day;
}) {
  const t = useT();
  const [state, action] = useActionState(generateOutfits, undefined);
  const [occasion, setOccasion] = useState("Everyday");
  // A day chip stands for its forecast sentence, which is what the stylist gets as the weather.
  const [weather, setWeather] = useState<string>(forecasts ? (day ?? "today") : "Mild");
  const forecast = forecasts && (weather === "today" || weather === "tomorrow") ? forecasts[weather] : null;

  return (
    <form action={action} className={cx(panel, "mt-4 p-4")}>
      <input type="hidden" name="occasion" value={occasion} />
      <input type="hidden" name="weather" value={forecast ?? weather} />
      {anchor && <input type="hidden" name="anchor" value={anchor.id} />}
      {unworn && <input type="hidden" name="focus" value="unworn" />}

      {anchor && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-paper p-2 pr-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
          <img src={imageUrl(anchor.imagePath)} alt="" className="size-12 rounded-xl object-cover" />
          <p className="min-w-0 flex-1 text-sm font-semibold">
            {t("gen.around")} <span className="font-bold">{anchor.name}</span>
          </p>
          <Link href="/outfits" aria-label={t("gen.stop")} className="text-muted hover:text-ink">
            <X size={18} />
          </Link>
        </div>
      )}
      {unworn && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-paper p-2 pr-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-white">
            <Clock size={20} strokeWidth={2.4} />
          </span>
          <p className="min-w-0 flex-1 text-sm font-bold">{t("gen.unworn")}</p>
          <Link href="/outfits" aria-label={t("gen.stop")} className="text-muted hover:text-ink">
            <X size={18} />
          </Link>
        </div>
      )}

      <p className="mb-2 text-[13px] font-bold">{t("gen.occasion")}</p>
      <div className="flex flex-wrap gap-1.5">
        {OCCASIONS.map((o) => (
          <button key={o} type="button" onClick={() => setOccasion(o)} className={chip(occasion === o)} aria-pressed={occasion === o}>
            {t(`occasion.${o}` as MessageKey)}
          </button>
        ))}
      </div>

      <p className="mt-4 mb-2 text-[13px] font-bold">{t("gen.weather")}</p>
      <div className="flex flex-wrap gap-1.5">
        {forecasts &&
          DAYS.map((d) => (
            <button key={d} type="button" onClick={() => setWeather(d)} className={chip(weather === d)} aria-pressed={weather === d}>
              {t(`weather.${d}`)}
            </button>
          ))}
        {WEATHER.map((w) => (
          <button key={w} type="button" onClick={() => setWeather(w)} className={chip(weather === w)} aria-pressed={weather === w}>
            {t(`weather.${w}` as MessageKey)}
          </button>
        ))}
      </div>
      {forecast && <p className="mt-2 text-[13px] font-semibold">{forecast}</p>}
      {!hasPlace && (
        <p className="mt-2 text-[12.5px] font-semibold text-muted">
          <Link href="/me" className="underline decoration-line underline-offset-2 hover:text-ink">
            {t("weather.setPlace")}
          </Link>
        </p>
      )}

      {ai && (
        <div className="mt-4">
          <label htmlFor="notes" className="mb-2 block text-[13px] font-bold">
            {t("gen.notes")}
          </label>
          <input id="notes" name="notes" placeholder={t("gen.notesHint")} className={cx(field, "bg-paper")} />
        </div>
      )}

      <SubmitButton className="mt-5 w-full" pending={ai ? t("gen.styling") : t("gen.matching")}>
        <Sparkles size={16} /> {t("gen.submit")}
      </SubmitButton>
      {disabled && <p className="mt-2 text-center text-[13px] font-semibold text-muted">{t("gen.addMore")}</p>}
      {state?.error && <p className="mt-3 text-sm font-semibold text-danger" role="alert">{state.error}</p>}
      {state?.notice && <p className="mt-3 text-sm font-semibold text-muted" role="status">{state.notice}</p>}
    </form>
  );
}
