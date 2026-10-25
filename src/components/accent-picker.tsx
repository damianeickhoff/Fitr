"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ACCENT_PRESETS, ACCENT_SATURATION, MIN_CONTRAST, contrastWithWhite, hexToHsl, hslToHex, isHex } from "@/lib/colour";
import { LANGUAGE_NAMES, LOCALES, type Locale, type MessageKey } from "@/lib/i18n";
import { saveAppearance } from "@/lib/profile-actions";
import { useT } from "./locale";
import { cx, panel, pill } from "./ui";

/**
 * The accent colour, chosen three ways: a preset, hue and lightness sliders,
 * or the phone's own colour picker for anything else. The page recolours as
 * the sliders move and the choice is saved a moment after they stop, so there
 * is no save button to forget. Lightness is capped so white text stays readable.
 */
export function AccentPicker({ accent, locale, name }: { accent: string; locale: Locale; name: string }) {
  const t = useT();
  const router = useRouter();
  // The hex is the one truth; the sliders read their positions from it, so the
  // saved colour comes back exactly rather than snapped to the sliders' saturation.
  const [hex, setHex] = useState(isHex(accent) ? accent.toLowerCase() : "#7a2e2e");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hsl = hexToHsl(hex);
  const ratio = contrastWithWhite(hex);
  const readable = ratio >= MIN_CONTRAST;

  // The page follows the picker at once; the server catches up when the hand stops.
  useEffect(() => {
    if (readable) document.documentElement.style.setProperty("--accent", hex);
    if (timer.current) clearTimeout(timer.current);
    if (hex.toLowerCase() === accent.toLowerCase() || !readable) return;
    timer.current = setTimeout(() => {
      start(async () => {
        const form = new FormData();
        form.set("accent", hex);
        const result = await saveAppearance(undefined, form);
        setError(result?.error ?? null);
        router.refresh();
      });
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hex, readable, accent, router]);

  function pickLanguage(next: Locale) {
    if (next === locale) return;
    start(async () => {
      const form = new FormData();
      form.set("locale", next);
      const result = await saveAppearance(undefined, form);
      setError(result?.error ?? null);
      router.refresh();
    });
  }

  const slider = (id: string, label: string, min: number, max: number, value: number, track: string, onChange: (v: number) => void) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-slider w-full"
        style={{ "--track": track } as React.CSSProperties}
      />
    </div>
  );

  return (
    <>
      <section>
        <h2 className="text-lg font-extrabold">{t("appearance.accent")}</h2>
        <p className="mt-1 text-sm leading-relaxed font-semibold text-muted">{t("appearance.accentBody")}</p>

        {/* A preview of what takes the colour, so the choice can be judged in place. */}
        <div aria-hidden="true" className={cx(panel, "mt-3 flex flex-col gap-3 p-3.5")}>
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-extrabold tracking-[0.12em]">FITR</span>
            <span className="flex items-center gap-1.5 rounded-full bg-paper py-0.5 pr-2.5 pl-0.5 text-xs font-bold">
              <span className="grid size-6 place-items-center rounded-full text-[11px] font-extrabold text-white" style={{ background: hex }}>
                {name.slice(0, 1).toUpperCase()}
              </span>
              {name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="relative h-[68px] w-[54px] shrink-0 overflow-hidden rounded-lg bg-paper">
              <span className="absolute bottom-1 left-1 max-w-[46px] truncate rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white" style={{ background: hex }}>
                {t("worn.never")}
              </span>
            </span>
            <span className="flex flex-1 flex-col items-start gap-2">
              <span className="rounded-full px-4 py-2 text-[13px] font-bold text-white" style={{ background: hex }}>
                {t("appearance.previewButton")}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[12.5px] font-bold" style={{ color: hex }}>
                  {t("appearance.previewLink")}
                </span>
                <span className={pill("green")}>{t("note.mostWorn")}</span>
              </span>
            </span>
            <span className="grid size-11 place-items-center rounded-full text-white" style={{ background: hex }}>
              <span className="text-2xl leading-none font-bold">+</span>
            </span>
          </div>
        </div>

        <div role="group" aria-label={t("appearance.presets")} className="no-scrollbar -mx-5 mt-4 flex gap-3 overflow-x-auto px-5 py-1">
          {ACCENT_PRESETS.map((p) => {
            const value = hslToHex(p.hue, ACCENT_SATURATION, p.light);
            const on = value === hex;
            return (
              <button
                key={p.key}
                type="button"
                aria-label={t(`preset.${p.key}` as MessageKey)}
                aria-pressed={on}
                onClick={() => setHex(value)}
                className={cx("grid size-11 shrink-0 place-items-center rounded-full text-white", on && "outline-3 outline-offset-3 outline-ink")}
                style={{ background: value }}
              >
                {on && <Check size={18} strokeWidth={3} />}
              </button>
            );
          })}
          <label
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-[10px] font-extrabold text-ink ring-2 ring-line ring-inset"
            style={{ background: "conic-gradient(#c03a3a, #c9a23a, #3a9a5a, #3a7ac9, #8a3ac9, #c03a3a)" }}
          >
            <span className="rounded-full bg-ground px-1.5 py-0.5">{t("appearance.any")}</span>
            <input
              type="color"
              value={hex}
              aria-label={t("appearance.any")}
              onChange={(e) => setHex(e.target.value.toLowerCase())}
              className="sr-only"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {slider(
            "hue",
            t("appearance.hue"),
            0,
            360,
            hsl.h,
            "linear-gradient(90deg, hsl(0 62% 45%), hsl(60 62% 40%), hsl(120 62% 36%), hsl(180 62% 36%), hsl(240 62% 50%), hsl(300 62% 42%), hsl(360 62% 45%))",
            (h) => setHex(hslToHex(h, ACCENT_SATURATION, Math.min(56, Math.max(14, hsl.l)))),
          )}
          {slider(
            "lightness",
            t("appearance.lightness"),
            14,
            56,
            hsl.l,
            `linear-gradient(90deg, ${hslToHex(hsl.h, ACCENT_SATURATION, 14)}, ${hslToHex(hsl.h, ACCENT_SATURATION, 56)})`,
            (l) => setHex(hslToHex(hsl.h, ACCENT_SATURATION, l)),
          )}
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[13px] font-semibold text-muted">{t("appearance.hex")}</span>
            <span className="size-7 rounded-lg" style={{ background: hex }} />
            <span className="rounded-xl bg-ground px-3 py-2 text-sm font-bold uppercase ring-1 ring-line ring-inset">{hex}</span>
          </div>
          <p className={cx("text-[13px] font-semibold", readable ? "text-muted" : "text-danger")} role="status">
            {readable ? t("appearance.contrastOk", { ratio: ratio.toFixed(1) }) : t("appearance.contrastBad", { ratio: ratio.toFixed(1) })}
          </p>
          {error && (
            <p className="text-sm font-semibold text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      <section id="language" className="mt-8 scroll-mt-20">
        <h2 className="text-lg font-extrabold">{t("appearance.language")}</h2>
        <p className="mt-1 text-sm leading-relaxed font-semibold text-muted">{t("appearance.languageBody")}</p>
        <div role="group" aria-label={t("appearance.language")} className="mt-3 flex rounded-full bg-ground p-1 ring-1 ring-line ring-inset">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={l === locale}
              onClick={() => pickLanguage(l)}
              className={cx("flex-1 rounded-full py-2.5 text-sm font-bold transition", l === locale ? "bg-ink text-paper" : "text-muted hover:text-ink")}
            >
              {LANGUAGE_NAMES[l]}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
