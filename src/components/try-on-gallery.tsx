"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { deleteTryOn } from "@/lib/outfit-actions";
import { imageUrl } from "@/lib/storage-url";
import { SOURCE_LABEL, type TryOnSource } from "@/lib/try-on";
import { useT } from "./locale";
import { button, cx, pill } from "./ui";

export type TryOnResult = { id: string; path: string; source: string };

/**
 * Try-on pictures: a grid of thumbnails, or one picture as the outfit's hero.
 * Either way a tap opens the picture full-screen, which is where a try-on is
 * judged; the delete button is a thumb-sized target rather than a corner dot.
 */
export function TryOnGallery({ results, hero = false }: { results: TryOnResult[]; hero?: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<TryOnResult | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const remove = (r: TryOnResult) => {
    if (!confirm(t("tryon.deleteConfirm"))) return;
    setOpen(null);
    start(() => deleteTryOn(r.id));
  };

  const label = (r: TryOnResult) => SOURCE_LABEL[r.source as TryOnSource] ?? t("tryon.label");

  return (
    <>
      <div className={cx(hero ? "" : "mt-4 grid grid-cols-2 gap-2.5")}>
        {results.map((r) => (
          <figure key={r.id} className="relative">
            <button type="button" onClick={() => setOpen(r)} aria-label={t("tryon.enlarge")} className="block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- private try-on render */}
              <img
                src={imageUrl(r.path)}
                alt={t("tryon.result")}
                className={cx("w-full object-cover", hero ? "aspect-[4/5] rounded-[26px] bg-[#efe8db]" : "rounded-2xl")}
              />
            </button>
            <span className={cx("absolute bottom-2.5 left-2.5", pill(r.source === "chatgpt-app" ? "green" : "violet"))}>{label(r)}</span>
            {!hero && (
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(r)}
                className={cx(button.secondary, "absolute top-2 right-2 size-11 p-0")}
                aria-label={t("tryon.delete")}
              >
                <Trash2 size={18} />
              </button>
            )}
          </figure>
        ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("tryon.result")}
          className="fixed inset-0 z-50 grid place-items-center bg-[#16130f]/95 p-4"
          onClick={() => setOpen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private try-on render */}
          <img src={imageUrl(open.path)} alt={t("tryon.result")} className="max-h-full max-w-full rounded-2xl object-contain" />
          <button
            type="button"
            autoFocus
            onClick={() => setOpen(null)}
            aria-label={t("common.close")}
            className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-ground/90 text-ink backdrop-blur-md"
          >
            <X size={20} strokeWidth={2.4} />
          </button>
          <div
            className="absolute inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] flex items-center justify-between gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <span className={pill(open.source === "chatgpt-app" ? "green" : "violet", "md")}>{label(open)}</span>
            <button type="button" disabled={pending} onClick={() => remove(open)} className={cx(button.secondary, "py-3")}>
              <Trash2 size={18} /> {t("tryon.deleteShort")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
