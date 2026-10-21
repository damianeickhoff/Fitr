"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { shrinkImage } from "@/lib/client-image";
import { addSelfPhoto, deleteSelfPhoto } from "@/lib/profile-actions";
import { imageUrl } from "@/lib/storage-url";
import { useT } from "./locale";
import { button, cx } from "./ui";

export function SelfPhotos({ photos }: { photos: { id: string; path: string }[] }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    start(async () => {
      const form = new FormData();
      form.set("photo", await shrinkImage(file, 2000), "self.jpg");
      const result = await addSelfPhoto(form);
      setError(result.error ?? null);
    });
  }

  return (
    <div className="mt-3">
      <div className="flex gap-3 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={pending}
          className="grid h-36 w-26 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-line text-muted transition hover:border-accent hover:text-accent"
        >
          <span className="flex flex-col items-center gap-1 text-xs font-bold">
            <ImagePlus size={20} />
            {pending ? t("photos.adding") : t("photos.add")}
          </span>
        </button>
        {photos.map((p) => (
          <figure key={p.id} className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- private self photo */}
            <img src={imageUrl(p.path)} alt={t("tryon.you")} className="h-36 w-26 rounded-2xl object-cover" />
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(t("photos.deleteConfirm"))) start(() => deleteSelfPhoto(p.id));
              }}
              className={cx(button.secondary, "absolute top-1.5 right-1.5 size-8 p-0")}
              aria-label={t("photos.delete")}
            >
              <Trash2 size={14} />
            </button>
          </figure>
        ))}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm font-semibold text-danger" role="alert">{error}</p>}
    </div>
  );
}
