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

export function OutfitGenerator({
  anchor,
  unworn,
  ai,
  disabled,
}: {
  anchor: Anchor;
  /** From the never-worn overview: build every look around a piece never worn. */
  unworn: boolean;
  ai: boolean;
  disabled: boolean;
}) {
  const t = useT();
  const [state, action] = useActionState(generateOutfits, undefined);
  const [occasion, setOccasion] = useState("Everyday");
  const [weather, setWeather] = useState("Mild");

  return (
    <form action={action} className={cx(panel, "mt-4 p-4")}>
      <input type="hidden" name="occasion" value={occasion} />
      <input type="hidden" name="weather" value={weather} />
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
        {WEATHER.map((w) => (
          <button key={w} type="button" onClick={() => setWeather(w)} className={chip(weather === w)} aria-pressed={weather === w}>
            {t(`weather.${w}` as MessageKey)}
          </button>
        ))}
      </div>

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
