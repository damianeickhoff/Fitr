"use client";

import { Heart, Shirt, Trash2, Wand2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteItem, makeStudioPhoto, markWorn, toggleFavourite } from "@/lib/item-actions";
import { button, cx } from "./ui";

export function ItemActions({ id, favourite, studio }: { id: string; favourite: boolean; studio: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => start(() => toggleFavourite(id))} className={button.secondary}>
          <Heart size={16} className={cx(favourite && "fill-[#e0457b] text-[#e0457b]")} />
          {favourite ? "Favourite" : "Add to favourites"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await markWorn(id);
              setMessage("Logged as worn today.");
            })
          }
          className={button.secondary}
        >
          <Shirt size={16} /> Wore it today
        </button>
        {studio && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMessage("Re-shooting as a studio photo…");
                const result = await makeStudioPhoto(id);
                setMessage(result.error ?? "Studio photo ready.");
              })
            }
            className={button.secondary}
          >
            <Wand2 size={16} /> Studio photo
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("Remove this piece from your wardrobe? Outfits that use it lose it too.")) start(() => deleteItem(id));
          }}
          className={button.danger}
        >
          <Trash2 size={16} /> Remove
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-muted" role="status">{message}</p>}
    </div>
  );
}
