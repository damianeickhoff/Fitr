"use client";

import { Bookmark, Shirt, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteOutfit, toggleSaved, woreOutfit } from "@/lib/outfit-actions";
import { button, cx } from "./ui";

export function OutfitActions({ id, saved }: { id: string; saved: boolean }) {
  const [pending, start] = useTransition();
  const [worn, setWorn] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => start(() => toggleSaved(id))} className={saved ? button.secondary : cx(button.primary, "py-2.5 text-sm")}>
        <Bookmark size={16} className={cx(saved && "fill-current")} />
        {saved ? "Saved" : "Save look"}
      </button>
      <button
        type="button"
        disabled={pending || worn}
        onClick={() =>
          start(async () => {
            await woreOutfit(id);
            setWorn(true);
          })
        }
        className={button.secondary}
      >
        <Shirt size={16} /> {worn ? "Logged for today" : "Wearing it today"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this outfit? The pieces stay in your wardrobe.")) start(() => deleteOutfit(id));
        }}
        className={button.danger}
        aria-label="Delete outfit"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
