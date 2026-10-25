"use client";

import { Camera, ImagePlus, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { isCategory } from "@/lib/garment";
import { categoryLabel, type MessageKey } from "@/lib/i18n";
import { dismissQuality, studioStatus, type AddedItem } from "@/lib/item-actions";
import { imageUrl } from "@/lib/storage-url";
import {
  applyStudioStatus,
  clearQuality,
  clearSettledUploads,
  enqueueReplacement,
  enqueueUploads,
  pendingStudioIds,
  retryUpload,
  useUploads,
} from "@/lib/upload-queue";
import { useT } from "./locale";
import { CATEGORY_TONE, button, cx, panel, pill, toneFor } from "./ui";

/** The queue itself lives in `upload-queue.ts`, so leaving this page doesn't stop it. */
export function AddPhotos() {
  const t = useT();
  const uploads = useUploads();
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const retakeInput = useRef<HTMLInputElement>(null);
  /** Which flagged piece the next photo from the retake input is for. */
  const retakeFor = useRef<string | null>(null);
  const [, start] = useTransition();
  const enqueue = (files: FileList | null) => enqueueUploads(files, t("add.failed"));
  const retake = (id: string) => {
    retakeFor.current = id;
    retakeInput.current?.click();
  };
  const keep = (id: string) => {
    clearQuality(id);
    start(() => dismissQuality(id));
  };
  // Studio photos land in the background after the upload; check in on them.
  const waiting = pendingStudioIds(uploads).join(",");
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      studioStatus(waiting.split(",")).then(applyStudioStatus, () => undefined);
    }, 6000);
    return () => clearInterval(timer);
  }, [waiting]);

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => cameraInput.current?.click()} className={cx(button.primary, "py-3.5")}>
          <Camera size={18} /> {t("add.takePhoto")}
        </button>
        <button type="button" onClick={() => libraryInput.current?.click()} className={cx(button.secondary, "py-3.5 text-[15px]")}>
          <ImagePlus size={18} /> {t("add.fromLibrary")}
        </button>
      </div>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          enqueue(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          enqueue(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={retakeInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          if (retakeFor.current) enqueueReplacement(retakeFor.current, e.target.files?.[0], t("add.failed"));
          retakeFor.current = null;
          e.target.value = "";
        }}
      />

      {uploads.length > 0 && (
        <ul className="mt-7 space-y-4" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.key}>
              {u.status !== "done" && (
                <div className={cx(panel, "flex items-center gap-3 p-3")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview blob */}
                  <img src={u.preview} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1 text-sm font-semibold">
                    {u.status === "waiting" && <p className="text-muted">{t("add.waiting")}</p>}
                    {u.status === "working" && (
                      <p className="flex items-center gap-2 text-muted">
                        <Loader2 size={16} className="animate-spin" /> {u.replaces ? t("quality.replacing") : t("add.working")}
                      </p>
                    )}
                    {u.result && !u.result.ok && (
                      <p className="flex items-start gap-1.5 text-danger">
                        <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {u.result.error}
                      </p>
                    )}
                    {u.status === "failed" && u.retryable && (
                      <button type="button" onClick={() => retryUpload(u.key)} className={cx(button.quiet, "-ml-3")}>
                        {t("add.tryAgain")}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {u.result?.ok && (
                <>
                  <p className="mb-2 text-[13px] font-bold text-muted">
                    {u.replaces
                      ? t("quality.replaced")
                      : u.result.items.length === 1
                        ? t("add.newListing")
                        : t("add.newListings", { n: u.result.items.length })}
                  </p>
                  <div className="space-y-2.5">
                    {u.result.items.map((item) => (
                      <NewListing key={item.id} item={item} replaced={Boolean(u.replaces)} onRetake={retake} onKeep={keep} />
                    ))}
                  </div>
                  {u.result.warning && <p className="mt-2 text-xs font-semibold text-muted">{u.result.warning}</p>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {uploads.some((u) => u.status === "done" || u.status === "failed") && (
        <button type="button" onClick={clearSettledUploads} className={cx(button.quiet, "mt-5")}>
          {t("add.clear")}
        </button>
      )}
    </div>
  );
}

/**
 * One new piece as a card. When the checks flagged its photo, an amber pill
 * names the reason under the card with a retake and a keep button; the card
 * itself is the link to the piece, so the buttons sit outside it.
 */
function NewListing({
  item,
  replaced,
  onRetake,
  onKeep,
}: {
  item: AddedItem;
  replaced: boolean;
  onRetake: (id: string) => void;
  onKeep: (id: string) => void;
}) {
  const t = useT();
  return (
    <div className={panel}>
      <Link href={`/item/${item.id}`} className="flex gap-3.5 p-3">
        <span className="relative w-[104px] shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
          <img src={imageUrl(item.imagePath)} alt="" className="aspect-[4/5] w-full rounded-xl bg-[#efe8db] object-cover" />
          {!replaced && <span className={cx("absolute bottom-1.5 left-1.5", pill("solid"))}>{t("common.new")}</span>}
        </span>
        <span className="min-w-0 flex-1 py-1">
          <span className="block text-[16px] leading-snug font-bold">{item.name}</span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            {item.studioPending && (
              <span className={pill("violet")}>
                <Loader2 size={11} strokeWidth={2.6} className="animate-spin" /> {t("studio.pending")}
              </span>
            )}
            {isCategory(item.category) && <span className={pill(CATEGORY_TONE[item.category])}>{categoryLabel(t, item.category)}</span>}
            {item.colors.map((c) => (
              <span key={c} className={pill(toneFor(c))}>
                {c}
              </span>
            ))}
          </span>
          <span className="mt-2 block text-[13px] font-bold text-accent">{t("add.check")}</span>
        </span>
      </Link>
      {item.quality && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
          <span className={pill("amber")} title={item.quality.note}>
            <TriangleAlert size={11} strokeWidth={2.6} /> {t(`quality.issue.${item.quality.issue}` as MessageKey)}
          </span>
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={() => onRetake(item.id)} className={cx(button.secondary, "px-3 py-1.5 text-[12.5px]")}>
              <Camera size={14} /> {t("quality.retake")}
            </button>
            <button type="button" onClick={() => onKeep(item.id)} className={cx(button.quiet, "px-2.5 py-1.5 text-[12.5px]")}>
              {t("quality.keep")}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
