"use client";

import { Camera, Scissors, TriangleAlert } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { shrinkImage } from "@/lib/client-image";
import type { MessageKey } from "@/lib/i18n";
import { dismissQuality, recutItem, replacePhoto } from "@/lib/item-actions";
import type { QualityIssue } from "@/lib/photo-quality";
import { useT } from "./locale";
import { button, cx, pill } from "./ui";

/**
 * The item page's notice for a listing the checks flagged: the reason, the
 * sentence behind it and three ways out. A retake replaces the piece's
 * pictures and keeps everything else; keeping it just clears the flag.
 */
export function QualityNotice({ id, issue, note }: { id: string; issue: QualityIssue; note: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  function retake(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setMessage({ text: t("quality.replacing") });
    start(async () => {
      const form = new FormData();
      form.set("photo", await shrinkImage(file), "photo.jpg");
      const result = await replacePhoto(id, form);
      setMessage(result.ok ? { text: t("quality.replaced") } : { text: result.error, error: true });
    });
  }

  return (
    <div className="mt-3 rounded-2xl bg-[#f6e6c6] p-3 text-sm font-semibold text-[#7d4b00]">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx(pill("amber"), "bg-[#fff4de]")}>
          <TriangleAlert size={11} strokeWidth={2.6} /> {t(`quality.issue.${issue}` as MessageKey)}
        </span>
        <span className="font-extrabold">{t("quality.title")}</span>
      </div>
      <p className="mt-1.5 leading-relaxed">{note}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={pending} onClick={() => cameraInput.current?.click()} className={cx(button.secondary, "px-3 py-2 text-[13px]")}>
          <Camera size={15} /> {t("quality.retakePhoto")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMessage({ text: t("actions.recutWorking") });
              const result = await recutItem(id);
              setMessage(result.error ? { text: result.error, error: true } : { text: t("actions.recutReady") });
            })
          }
          className={cx(button.secondary, "px-3 py-2 text-[13px]")}
        >
          <Scissors size={15} /> {t("actions.recut")}
        </button>
        <button type="button" disabled={pending} onClick={() => start(() => dismissQuality(id))} className={cx(button.quiet, "px-2.5 text-[13px]")}>
          {t("quality.keep")}
        </button>
      </div>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          retake(e.target.files);
          e.target.value = "";
        }}
      />
      {message && (
        <p className={cx("mt-2 text-[13px]", message.error && "text-danger")} role={message.error ? "alert" : "status"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
