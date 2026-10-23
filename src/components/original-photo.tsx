"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { imageUrl } from "@/lib/storage-url";
import { useT } from "./locale";
import { cx, pill } from "./ui";

/** The photo as taken, always one tap away, however the listing was re-shot. */
export function OriginalPhoto({ path, className }: { path: string; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cx(pill("frost", "md"), "py-1 pl-1", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- private original photo */}
        <img src={imageUrl(path)} alt="" className="size-6 rounded-full object-cover" />
        {t("item.original")}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("item.originalAlt")}
          className="fixed inset-0 z-50 grid place-items-center bg-[#16130f]/95 p-4"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private original photo */}
          <img src={imageUrl(path)} alt={t("item.originalAlt")} className="max-h-full max-w-full rounded-2xl object-contain" />
          <button
            type="button"
            autoFocus
            onClick={() => setOpen(false)}
            aria-label={t("common.close")}
            className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-ground/90 text-ink backdrop-blur-md"
          >
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>
      )}
    </>
  );
}
