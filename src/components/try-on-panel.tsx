"use client";

import { ImagePlus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { prepareKit, sendToChatGpt, type HandoffKit } from "@/lib/chatgpt-handoff";
import { shrinkImage } from "@/lib/client-image";
import { addTryOnFromApp, deleteTryOn, tryOn } from "@/lib/outfit-actions";
import { imageUrl } from "@/lib/storage-url";
import { SOURCE_LABEL, tryOnPrompt, type TryOnSource } from "@/lib/try-on";
import { SubmitButton } from "./submit-button";
import { button, cx, pill } from "./ui";

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
  const [state, action] = useActionState(tryOn.bind(null, outfitId), undefined);
  const [chosen, setChosen] = useState(selfPhotos[0]?.id ?? "");
  const [pending, start] = useTransition();
  const chosenPhoto = selfPhotos.find((p) => p.id === chosen);

  return (
    <section className="mt-8 rounded-[22px] bg-ground p-4">
      <h2 className="text-lg font-semibold">See it on you</h2>

      {selfPhotos.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted">
          <Link href="/me" className="font-semibold text-cobalt">
            Add a photo of yourself
          </Link>{" "}
          first: full length, facing the camera, in good light.
        </p>
      ) : (
        <>
          <fieldset className="mt-3">
            <legend className="mb-2 text-[13px] text-muted">Which photo of you?</legend>
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
                    alt="Photo of you"
                    className="h-24 w-[72px] rounded-xl object-cover object-top opacity-60 ring-2 ring-transparent transition peer-checked:opacity-100 peer-checked:ring-cobalt peer-focus-visible:ring-cobalt"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {chosenPhoto && (
            <div className="mt-3 flex gap-2.5">
              <div className="relative h-72 flex-1 overflow-hidden rounded-2xl bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element -- private self photo */}
                <img src={imageUrl(chosenPhoto.path)} alt="You, before" className="h-full w-full object-cover object-top" />
                <span className={cx("absolute bottom-2.5 left-2.5", pill("frost", "md"))}>Before</span>
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
              <p className="text-sm font-semibold">One tap</p>
              <span className={pill(apiLabel ? "violet" : "grey")}>{apiLabel ? `${apiLabel} · paid per image` : "Not set up"}</span>
            </div>
            {apiLabel ? (
              <form action={action}>
                <input type="hidden" name="selfPhoto" value={chosen} />
                <SubmitButton className="mt-3 w-full" pending="Dressing you… this takes a moment">
                  Try it on
                </SubmitButton>
                {state?.error && <p className="mt-2 text-sm text-danger" role="alert">{state.error}</p>}
              </form>
            ) : (
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Add an <code>OPENAI_API_KEY</code> on the server and FITR makes the picture for you in one tap.
              </p>
            )}
          </div>

          {/* Route 2: free on the user's own ChatGPT subscription, via the app. */}
          {chosenPhoto && <ChatGptAppRoute outfitId={outfitId} photo={chosenPhoto} pieces={pieces} />}
        </>
      )}

      {results.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {results.map((r) => (
            <figure key={r.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- private try-on render */}
              <img src={imageUrl(r.path)} alt="You wearing this outfit" className="w-full rounded-2xl object-cover" />
              <span className={cx("absolute bottom-2 left-2", pill(r.source === "chatgpt-app" ? "green" : "violet"))}>
                {SOURCE_LABEL[r.source as TryOnSource] ?? "Try-on"}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(() => deleteTryOn(r.id))}
                className={cx(button.secondary, "absolute top-2 right-2 size-9 p-0")}
                aria-label="Delete this try-on"
              >
                <Trash2 size={15} />
              </button>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function ChatGptAppRoute({ outfitId, photo, pieces }: { outfitId: string; photo: Photo; pieces: Piece[] }) {
  // Prepared ahead of the tap: a share sheet only opens straight from one.
  const [kit, setKit] = useState<{ forPhoto: string; kit: HandoffKit } | null>(null);
  const [sent, setSent] = useState<"shared" | "fallback" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const prompt = tryOnPrompt(pieces.map((p) => p.name));
  const ready = kit?.forPhoto === photo.id ? kit.kit : null;

  useEffect(() => {
    let current = true;
    prepareKit(
      imageUrl(photo.path),
      pieces.map((p) => ({ name: p.name, url: imageUrl(p.imagePath) })),
    )
      .then((k) => current && setKit({ forPhoto: photo.id, kit: k }))
      .catch(() => current && setError("Couldn't load the photos to send. Reload the page and try again."));
    return () => {
      current = false;
    };
  }, [photo.id, photo.path, pieces]);

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
        <p className="text-sm font-semibold">With your ChatGPT app</p>
        <span className={pill("green")}>Free with ChatGPT Plus</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        Sends your photo, the pieces and a ready-made prompt to ChatGPT. Save the picture it makes, then add it here.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => ready && setSent(sendToChatGpt(ready, prompt))}
          className={cx(button.dark, "px-3 py-2.5 text-sm")}
        >
          <Send size={15} /> {ready ? "Send to ChatGPT" : "Preparing…"}
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          className={cx(button.secondary, "px-3 text-sm")}
        >
          <ImagePlus size={15} /> {uploading ? "Adding…" : "Add its picture"}
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
        <p className="mt-2.5 text-[13px] leading-relaxed text-[#17693b]" role="status">
          Pick ChatGPT in the share menu. The prompt is also copied, in case it doesn&rsquo;t come along: paste it in.
        </p>
      )}
      {sent === "fallback" && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-[#17693b]" role="status">
          The prompt is copied and the photos are saved as <strong>fitr-try-on.jpg</strong>. In the ChatGPT tab, attach that
          picture, paste the prompt and send.
        </p>
      )}
      {error && <p className="mt-2.5 text-sm text-danger" role="alert">{error}</p>}

      <details className="mt-2.5 text-[13px]">
        <summary className="cursor-pointer font-semibold text-muted">See the prompt</summary>
        <p className="mt-1.5 rounded-xl bg-ground p-3 leading-relaxed whitespace-pre-line text-[#3d4252]">{prompt}</p>
      </details>
    </div>
  );
}
