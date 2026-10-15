"use client";

import { Check, Plus } from "lucide-react";
import { useTransition } from "react";
import { addToOutfit } from "@/lib/outfit-actions";
import { cx, pill } from "./ui";

export function AddToLook({ outfitId, itemId, added }: { outfitId: string; itemId: string; added: boolean }) {
  const [pending, start] = useTransition();
  if (added) {
    return (
      <span className={cx("mt-2", pill("green", "md"))}>
        <Check size={13} /> In this look
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => addToOutfit(outfitId, itemId))}
      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-cobalt disabled:opacity-60"
    >
      <Plus size={15} /> {pending ? "Adding…" : "Add to this look"}
    </button>
  );
}
