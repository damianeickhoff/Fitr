"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { generateOutfits } from "@/lib/outfit-actions";
import { imageUrl } from "@/lib/storage-url";
import { SubmitButton } from "./submit-button";
import { cx, field } from "./ui";

const OCCASIONS = ["Everyday", "Work", "Date night", "Weekend", "Party", "Wedding guest", "Travel", "Gym"];
const WEATHER = ["Hot", "Warm", "Mild", "Cool", "Cold", "Rainy"];

type Anchor = { id: string; name: string; imagePath: string } | null;

export function OutfitGenerator({ anchor, ai, disabled }: { anchor: Anchor; ai: boolean; disabled: boolean }) {
  const [state, action] = useActionState(generateOutfits, undefined);
  const [occasion, setOccasion] = useState("Everyday");
  const [weather, setWeather] = useState("Mild");

  const chip = (active: boolean) =>
    cx(
      "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition",
      active ? "bg-ink text-white" : "bg-paper text-muted ring-1 ring-line ring-inset hover:text-ink",
    );

  return (
    <form action={action} className="mt-4 rounded-[22px] bg-ground p-4">
      <input type="hidden" name="occasion" value={occasion} />
      <input type="hidden" name="weather" value={weather} />
      {anchor && <input type="hidden" name="anchor" value={anchor.id} />}

      {anchor && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-paper p-2 pr-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
          <img src={imageUrl(anchor.imagePath)} alt="" className="size-12 rounded-xl object-cover" />
          <p className="min-w-0 flex-1 text-sm">
            Building around <span className="font-semibold">{anchor.name}</span>
          </p>
          <Link href="/outfits" aria-label="Stop building around this piece" className="text-muted hover:text-ink">
            <X size={18} />
          </Link>
        </div>
      )}

      <p className="mb-2 text-[13px] font-semibold">Occasion</p>
      <div className="flex flex-wrap gap-1.5">
        {OCCASIONS.map((o) => (
          <button key={o} type="button" onClick={() => setOccasion(o)} className={chip(occasion === o)} aria-pressed={occasion === o}>
            {o}
          </button>
        ))}
      </div>

      <p className="mt-4 mb-2 text-[13px] font-semibold">Weather</p>
      <div className="flex flex-wrap gap-1.5">
        {WEATHER.map((w) => (
          <button key={w} type="button" onClick={() => setWeather(w)} className={chip(weather === w)} aria-pressed={weather === w}>
            {w}
          </button>
        ))}
      </div>

      {ai && (
        <div className="mt-4">
          <label htmlFor="notes" className="mb-2 block text-[13px] font-semibold">
            Anything else?
          </label>
          <input id="notes" name="notes" placeholder="Something with colour, nothing too tight" className={cx(field, "bg-paper")} />
        </div>
      )}

      <SubmitButton className="mt-5 w-full" pending={ai ? "Styling your outfits…" : "Matching…"}>
        <Sparkles size={16} /> Put outfits together
      </SubmitButton>
      {disabled && <p className="mt-2 text-center text-[13px] text-muted">Add a few more pieces first.</p>}
      {state?.error && <p className="mt-3 text-sm text-danger" role="alert">{state.error}</p>}
      {state?.notice && <p className="mt-3 text-sm text-muted" role="status">{state.notice}</p>}
    </form>
  );
}
