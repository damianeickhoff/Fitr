"use client";

import { Bookmark, Droplets, Shirt, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteOutfit, toggleSaved, woreOutfit } from "@/lib/outfit-actions";
import { washOutfit } from "@/lib/wash-actions";
import { useT } from "./locale";
import { button, cx } from "./ui";

export function OutfitActions({ id, saved }: { id: string; saved: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [worn, setWorn] = useState(false);
  const [washed, setWashed] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => toggleSaved(id))}
        className={saved ? button.secondary : cx(button.primary, "py-2.5 text-sm")}
      >
        <Bookmark size={16} className={cx(saved && "fill-current")} />
        {saved ? t("outfit.saved") : t("outfit.save")}
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
        <Shirt size={16} /> {worn ? t("outfit.logged") : t("outfit.wearing")}
      </button>
      {worn && (
        <button
          type="button"
          disabled={pending || washed}
          onClick={() =>
            start(async () => {
              await washOutfit(id);
              setWashed(true);
            })
          }
          className={button.secondary}
        >
          <Droplets size={16} /> {washed ? t("wash.in") : t("wash.outfit")}
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(t("outfit.deleteConfirm"))) start(() => deleteOutfit(id));
        }}
        className={button.danger}
        aria-label={t("outfit.delete")}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
