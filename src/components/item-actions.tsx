"use client";

import { Heart, Shirt, Trash2, Wand2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteItem, makeStudioPhoto, markWorn, toggleFavourite } from "@/lib/item-actions";
import { useT } from "./locale";
import { button, cx } from "./ui";

export function ItemActions({ id, favourite, studio }: { id: string; favourite: boolean; studio: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => start(() => toggleFavourite(id))} className={button.secondary}>
          <Heart size={16} className={cx(favourite && "fill-[#c9365f] text-[#c9365f]")} />
          {favourite ? t("common.favourite") : t("actions.addFavourite")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await markWorn(id);
              setMessage(t("actions.loggedWorn"));
            })
          }
          className={button.secondary}
        >
          <Shirt size={16} /> {t("actions.woreToday")}
        </button>
        {studio && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMessage(t("actions.studioWorking"));
                const result = await makeStudioPhoto(id);
                setMessage(result.error ?? t("actions.studioReady"));
              })
            }
            className={button.secondary}
          >
            <Wand2 size={16} /> {t("actions.studio")}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(t("actions.removeConfirm"))) start(() => deleteItem(id));
          }}
          className={button.danger}
        >
          <Trash2 size={16} /> {t("actions.remove")}
        </button>
      </div>
      {message && (
        <p className="mt-2 text-sm font-semibold text-muted" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
