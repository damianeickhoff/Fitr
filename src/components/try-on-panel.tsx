"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { deleteTryOn, tryOn } from "@/lib/outfit-actions";
import { imageUrl } from "@/lib/storage-url";
import { SubmitButton } from "./submit-button";
import { button, cx, pill } from "./ui";

type Photo = { id: string; path: string };
type Piece = { id: string; name: string; imagePath: string };

export function TryOnPanel({
  outfitId,
  enabled,
  selfPhotos,
  results,
  pieces,
}: {
  outfitId: string;
  enabled: boolean;
  selfPhotos: Photo[];
  results: Photo[];
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
        <form action={action} className="mt-3">
          <fieldset>
            <legend className="mb-2 text-[13px] text-muted">Which photo of you?</legend>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {selfPhotos.map((p) => (
                <label key={p.id} className="shrink-0 cursor-pointer">
                  <input
                    type="radio"
                    name="selfPhoto"
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

          {enabled ? (
            <>
              <SubmitButton className="mt-3.5 w-full" pending="Dressing you… this takes a moment">
                Try it on
              </SubmitButton>
              <p className="mt-2 text-xs text-muted">Keeps your face, pose and background, and swaps in these pieces.</p>
            </>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              <span className={pill("violet")}>Needs an image model</span> Try-on is ready, but image generation isn&rsquo;t
              free with any provider. Add an <code>OPENAI_API_KEY</code> on the server to switch it on with ChatGPT&rsquo;s
              image model.
            </p>
          )}
          {state?.error && <p className="mt-3 text-sm text-danger" role="alert">{state.error}</p>}
        </form>
      )}

      {results.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {results.map((r) => (
            <figure key={r.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- private try-on render */}
              <img src={imageUrl(r.path)} alt="You wearing this outfit" className="w-full rounded-2xl object-cover" />
              <span className={cx("absolute bottom-2 left-2", pill("violet"))}>Try-on</span>
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
