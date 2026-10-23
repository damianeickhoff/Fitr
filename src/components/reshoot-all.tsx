"use client";

import { Wand2 } from "lucide-react";
import { useState, useTransition } from "react";
import { reshootAll } from "@/lib/item-actions";
import { useT } from "./locale";
import { button, cx, panel } from "./ui";

export type ReshootProgress = { done: number; total: number; error?: string; running: boolean };

/**
 * Re-shoots every plain cut-out of this profile as a studio photo, in the
 * background on the server. Asks first: each picture is a paid image.
 */
export function ReshootAll({ missing, label, progress }: { missing: number; label: string; progress: ReshootProgress | null }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={cx(panel, "mt-2.5 p-4")}>
      <p className="text-sm font-bold">{t("me.reshoot")}</p>
      <p className="mt-1 text-[13px] leading-relaxed font-semibold text-muted">
        {missing > 0 ? t.count("me.reshootBody", missing, { label }) : !progress?.running && t("me.reshootNone")}
      </p>
      {progress && (
        <p
          className={cx("mt-2 text-[13px] font-bold", progress.error ? "text-[#7d4b00]" : "text-[#1d6b3a]")}
          role="status"
        >
          {progress.error
            ? t("me.reshootStopped", { done: progress.done, total: progress.total, error: progress.error })
            : t("me.reshootProgress", { done: progress.done, total: progress.total })}
        </p>
      )}
      {missing > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(t.count("me.reshootConfirm", missing))) return;
            start(async () => {
              const result = await reshootAll();
              setError(result.error ?? null);
            });
          }}
          className={cx(button.secondary, "mt-3")}
        >
          <Wand2 size={16} /> {pending ? t("me.reshootQueuing") : t("me.reshoot")}
        </button>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-danger" role="alert">{error}</p>}
    </div>
  );
}
