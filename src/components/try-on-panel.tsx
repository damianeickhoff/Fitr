"use client";

import { ImagePlus, Send } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { prepareKit, sendToChatGpt, type HandoffKit } from "@/lib/chatgpt-handoff";
import { shrinkImage } from "@/lib/client-image";
import { addTryOnFromApp, tryOn } from "@/lib/outfit-actions";
import { imageUrl } from "@/lib/storage-url";
import { tryOnPrompt } from "@/lib/try-on";
import { useT } from "./locale";
import { SubmitButton } from "./submit-button";
import { TryOnGallery } from "./try-on-gallery";
import { button, cx, panel, pill } from "./ui";

type Photo = { id: string; path: string };
type Result = Photo & { source: string };
type Piece = { id: string; name: string; imagePath: string };

export function TryOnPanel({
  outfitId,
  apiLabel,
  selfPhotos,
  results,
  pieces,
}: {
  outfitId: string;
  /** "ChatGPT API" or "Gemini" when an image key is set up; null otherwise. */
  apiLabel: string | null;
  selfPhotos: Photo[];
  results: Result[];
  pieces: Piece[];
}) {
  const t = useT();
  const [state, action] = useActionState(tryOn.bind(null, outfitId), undefined);
  const [chosen, setChosen] = useState(selfPhotos[0]?.id ?? "");
  const chosenPhoto = selfPhotos.find((p) => p.id === chosen);
  const [keyBefore, keyAfter] = t("tryon.needKey").split("{key}");

  return (
    <section className={cx(panel, "mt-8 p-4")}>
      <h2 className="text-lg font-extrabold">{t("tryon.title")}</h2>

      {selfPhotos.length === 0 ? (
        <p className="mt-1.5 text-sm font-semibold text-muted">
          <Link href="/me" className="font-bold text-accent">
            {t("tryon.addPhoto")}
          </Link>{" "}
          {t("tryon.addPhotoRest")}
        </p>
      ) : (
        <>
          <fieldset className="mt-3">
            <legend className="mb-2 text-[13px] font-semibold text-muted">{t("tryon.which")}</legend>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {selfPhotos.map((p) => (
                <label key={p.id} className="shrink-0 cursor-pointer">
                  <input
                    type="radio"
                    name="selfPhotoChoice"
                    value={p.id}
                    checked={chosen === p.id}
                    onChange={() => setChosen(p.id)}
                    className="peer sr-only"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element -- private self photo */}
                  <img
                    src={imageUrl(p.path)}
                    alt={t("tryon.you")}
                    className="h-24 w-[72px] rounded-xl object-cover object-top opacity-60 ring-2 ring-transparent transition peer-checked:opacity-100 peer-checked:ring-accent peer-focus-visible:ring-accent"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {chosenPhoto && (
            <div className="mt-3 flex gap-2.5">
              <div className="relative h-72 flex-1 overflow-hidden rounded-2xl bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element -- private self photo */}
                <img src={imageUrl(chosenPhoto.path)} alt={t("tryon.before")} className="h-full w-full object-cover object-top" />
                <span className={cx("absolute bottom-2.5 left-2.5", pill("frost", "md"))}>{t("tryon.before")}</span>
              </div>
              <div className="flex w-[68px] flex-col gap-1.5">
                {pieces.slice(0, 4).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element -- private listing image
                  <img key={p.id} src={imageUrl(p.imagePath)} alt={p.name} className="min-h-0 w-full flex-1 rounded-lg bg-paper object-cover" />
                ))}
              </div>
            </div>
          )}

          {/* Route 1: one tap, paid per image through an API key. */}
          <div className="mt-4 rounded-2xl bg-paper p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{t("tryon.oneTap")}</p>
              <span className={pill(apiLabel ? "violet" : "grey")}>{apiLabel ? t("tryon.paid", { label: apiLabel }) : t("tryon.notSetUp")}</span>
            </div>
            {apiLabel ? (
              <form action={action}>
                <input type="hidden" name="selfPhoto" value={chosen} />
                <SubmitButton className="mt-3 w-full" pending={t("tryon.dressing")}>
                  {t("tryon.tryIt")}
                </SubmitButton>
                {state?.error && <p className="mt-2 text-sm font-semibold text-danger" role="alert">{state.error}</p>}
              </form>
            ) : (
              <p className="mt-1.5 text-[13px] leading-relaxed font-semibold text-muted">
                {keyBefore}
                <code>OPENAI_API_KEY</code>
                {keyAfter}
              </p>
            )}
          </div>

          {/* Route 2: free on the user's own ChatGPT subscription, via the app. */}
          {chosenPhoto && <ChatGptAppRoute outfitId={outfitId} photo={chosenPhoto} pieces={pieces} />}
        </>
      )}

      {results.length > 0 && <TryOnGallery results={results} />}
    </section>
  );
}

function ChatGptAppRoute({ outfitId, photo, pieces }: { outfitId: string; photo: Photo; pieces: Piece[] }) {
  const t = useT();
  // Prepared ahead of the tap: a share sheet only opens straight from one.
  const [kit, setKit] = useState<{ forPhoto: string; kit: HandoffKit } | null>(null);
  const [sent, setSent] = useState<"shared" | "fallback" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const prompt = tryOnPrompt(pieces.map((p) => p.name));
  const ready = kit?.forPhoto === photo.id ? kit.kit : null;
  const [fallbackBefore, fallbackAfter] = t("tryon.fallback").split("{file}");

  useEffect(() => {
    let current = true;
    prepareKit(
      imageUrl(photo.path),
      pieces.map((p) => ({ name: p.name, url: imageUrl(p.imagePath) })),
    )
      .then((k) => current && setKit({ forPhoto: photo.id, kit: k }))
      .catch(() => current && setError(t("tryon.loadFailed")));
    return () => {
      current = false;
    };
  }, [photo.id, photo.path, pieces, t]);

  function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    startUpload(async () => {
      const form = new FormData();
      form.set("selfPhoto", photo.id);
      form.set("photo", await shrinkImage(file, 2000), "try-on.jpg");
      const result = await addTryOnFromApp(outfitId, form);
      setError(result.error ?? null);
      if (!result.error) setSent(null);
    });
  }

  return (
    <div className="mt-2.5 rounded-2xl bg-paper p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{t("tryon.withApp")}</p>
        <span className={pill("green")}>{t("tryon.free")}</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed font-semibold text-muted">{t("tryon.appBody")}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => ready && setSent(sendToChatGpt(ready, prompt))}
          className={cx(button.dark, "px-3 py-2.5 text-sm")}
        >
          <Send size={15} /> {ready ? t("tryon.send") : t("tryon.preparing")}
        </button>
        <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className={cx(button.secondary, "px-3 text-sm")}>
          <ImagePlus size={15} /> {uploading ? t("tryon.adding") : t("tryon.addPicture")}
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
      />

      {sent === "shared" && (
        <p className="mt-2.5 text-[13px] leading-relaxed font-semibold text-[#1d6b3a]" role="status">
          {t("tryon.shared")}
        </p>
      )}
      {sent === "fallback" && (
        <p className="mt-2.5 text-[13px] leading-relaxed font-semibold text-[#1d6b3a]" role="status">
          {fallbackBefore}
          <strong>fitr-try-on.jpg</strong>
          {fallbackAfter}
        </p>
      )}
      {error && <p className="mt-2.5 text-sm font-semibold text-danger" role="alert">{error}</p>}

      <details className="mt-2.5 text-[13px]">
        <summary className="cursor-pointer font-bold text-muted">{t("tryon.seePrompt")}</summary>
        <p className="mt-1.5 rounded-xl bg-ground p-3 leading-relaxed whitespace-pre-line text-[#3f3931] ring-1 ring-line ring-inset">{prompt}</p>
      </details>
    </div>
  );
}
