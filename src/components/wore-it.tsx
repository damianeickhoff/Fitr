"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { markWorn } from "@/lib/item-actions";
import { useT } from "./locale";
import { button, cx } from "./ui";

/** One tap on the never-worn overview: the piece is logged as worn today and leaves the list. */
export function WoreIt({ id }: { id: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={pending || done}
      onClick={() =>
        start(async () => {
          await markWorn(id);
          setDone(true);
        })
      }
      className={cx(button.secondary, "shrink-0 px-3 py-2 text-[12.5px]", done && "bg-[#dcefe0] text-[#1d6b3a] ring-transparent")}
    >
      {done && <Check size={14} strokeWidth={3} />}
      {done ? t("never.logged") : t("never.woreIt")}
    </button>
  );
}
