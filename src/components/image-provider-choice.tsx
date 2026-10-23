"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveImageProvider } from "@/lib/profile-actions";
import { useT } from "./locale";
import { cx } from "./ui";

export type ProviderOption = { id: string; name: string; model: string };

/**
 * Shown only when the server has both image providers set up: which one
 * draws this profile's studio photos and try-ons. Saved as soon as it is
 * tapped, so the next picture already uses it.
 */
export function ImageProviderChoice({ options, current }: { options: ProviderOption[]; current: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const chosen = options.find((o) => o.id === current);

  return (
    <div className="mt-3">
      <p className="text-sm font-bold">{t("me.imageProvider")}</p>
      <p className="mt-0.5 text-[12.5px] font-semibold text-muted">{t("me.imageProviderBody")}</p>
      <div role="group" aria-label={t("me.imageProvider")} className="mt-2 flex rounded-full bg-ground p-1 ring-1 ring-line ring-inset">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={pending}
            aria-pressed={o.id === current}
            onClick={() =>
              start(async () => {
                const result = await saveImageProvider(o.id);
                setError(result?.error ?? null);
                router.refresh();
              })
            }
            className={cx("flex-1 rounded-full py-2 text-sm font-bold transition", o.id === current ? "bg-ink text-paper" : "text-muted hover:text-ink")}
          >
            {o.name}
          </button>
        ))}
      </div>
      {chosen && <p className="mt-1.5 truncate text-xs font-semibold text-muted">{chosen.model}</p>}
      {error && (
        <p className="mt-1.5 text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
