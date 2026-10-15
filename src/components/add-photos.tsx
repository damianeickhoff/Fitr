"use client";

import { Camera, ImagePlus, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { shrinkImage } from "@/lib/client-image";
import { CATEGORIES, isCategory } from "@/lib/garment";
import { addPhoto, type AddPhotoResult } from "@/lib/item-actions";
import { imageUrl } from "@/lib/storage-url";
import { CATEGORY_TONE, button, cx, pill, toneFor } from "./ui";

type Upload = {
  key: string;
  preview: string;
  status: "waiting" | "working" | "done" | "failed";
  result?: AddPhotoResult;
};

/**
 * Photos go up one at a time: Gemini's free tier counts requests per minute,
 * and a queue that finishes slowly beats one that fails all at once.
 */
export function AddPhotos() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  function enqueue(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setUploads((list) => [{ key, preview: URL.createObjectURL(file), status: "waiting" }, ...list]);
      queue.current = queue.current.then(async () => {
        update(key, { status: "working" });
        try {
          const form = new FormData();
          form.set("photo", await shrinkImage(file), "photo.jpg");
          const result = await addPhoto(form);
          update(key, { status: result.ok ? "done" : "failed", result });
        } catch {
          update(key, {
            status: "failed",
            result: { ok: false, error: "The upload didn't go through. Check your connection and try again." },
          });
        }
      });
    }
  }

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => cameraInput.current?.click()} className={cx(button.primary, "py-3.5")}>
          <Camera size={18} /> Take photo
        </button>
        <button type="button" onClick={() => libraryInput.current?.click()} className={cx(button.secondary, "py-3.5 text-[15px]")}>
          <ImagePlus size={18} /> From library
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

      {uploads.length > 0 && (
        <ul className="mt-7 space-y-4" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.key}>
              {u.status !== "done" && (
                <div className="flex items-center gap-3 rounded-2xl bg-ground p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview blob */}
                  <img src={u.preview} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1 text-sm">
                    {u.status === "waiting" && <p className="text-muted">Waiting…</p>}
                    {u.status === "working" && (
                      <p className="flex items-center gap-2 text-muted">
                        <Loader2 size={16} className="animate-spin" /> Finding and cutting out the pieces…
                      </p>
                    )}
                    {u.result && !u.result.ok && (
                      <p className="flex items-start gap-1.5 text-danger">
                        <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {u.result.error}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {u.result?.ok && (
                <>
                  <p className="mb-2 text-[13px] font-medium text-muted">
                    {u.result.items.length === 1 ? "Your new listing" : `${u.result.items.length} new listings from one photo`}
                  </p>
                  <div className="space-y-2.5">
                    {u.result.items.map((item) => (
                      <Link key={item.id} href={`/item/${item.id}`} className="flex gap-3.5 rounded-[20px] bg-ground p-3">
                        <span className="relative w-[104px] shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
                          <img src={imageUrl(item.imagePath)} alt="" className="aspect-[4/5] w-full rounded-xl bg-paper object-cover" />
                          <span className={cx("absolute bottom-1.5 left-1.5", pill("solid"))}>New</span>
                        </span>
                        <span className="min-w-0 flex-1 py-1">
                          <span className="block text-[16px] leading-snug font-semibold">{item.name}</span>
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {isCategory(item.category) && (
                              <span className={pill(CATEGORY_TONE[item.category])}>{CATEGORIES[item.category].one}</span>
                            )}
                            {item.colors.map((c) => (
                              <span key={c} className={pill(toneFor(c))}>
                                {c}
                              </span>
                            ))}
                          </span>
                          <span className="mt-2 block text-[13px] font-semibold text-cobalt">Check the details</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                  {u.result.warning && <p className="mt-2 text-xs text-muted">{u.result.warning}</p>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
