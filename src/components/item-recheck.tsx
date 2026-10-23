"use client";

import { Sparkles } from "lucide-react";
import { createContext, useContext, useRef, useState, useTransition } from "react";
import type { Item } from "@/generated/prisma/browser";
import { SEASONS } from "@/lib/garment";
import { suggestDetails } from "@/lib/item-actions";
import { detailValues, mergeSuggestion, type DetailKey, type DetailValues, type MergeMode } from "@/lib/suggest";
import { ItemEditor } from "./item-editor";
import { useT } from "./locale";
import { button, cx, panel } from "./ui";

type Spot = "notice" | "actions";

type Recheck = {
  run: (mode: MergeMode, spot: Spot) => void;
  pending: boolean;
  status: { spot: Spot; text: string; error?: boolean } | null;
};

const RecheckContext = createContext<Recheck | null>(null);

function formValues(form: HTMLFormElement): DetailValues {
  const data = new FormData(form);
  const text = (key: string) => String(data.get(key) ?? "").trim();
  return {
    name: text("name"),
    category: text("category"),
    subcategory: text("subcategory"),
    colors: text("colors"),
    colorHex: text("colorHex"),
    brand: text("brand"),
    material: text("material"),
    pattern: text("pattern"),
    styles: text("styles"),
    formality: Number(text("formality")) || 0,
    seasons: SEASONS.filter((s) => data.getAll("seasons").includes(s)),
    description: text("description"),
  };
}

/**
 * Holds a pending re-check for one piece: the buttons (in the untagged notice
 * and beside the actions) ask the model, and the edit panel opens with its
 * answer filled in. Nothing is saved until the form is.
 */
export function ItemDetails({ item, children }: { item: Item; children: React.ReactNode }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Recheck["status"]>(null);
  const [draft, setDraft] = useState<{ values: DetailValues; changed: DetailKey[]; version: number } | null>(null);
  const [open, setOpen] = useState(!item.aiTagged);
  const panelRef = useRef<HTMLDetailsElement>(null);

  const run = (mode: MergeMode, spot: Spot) => {
    // Outside the transition, or it would only show once the answer is in.
    setStatus({ spot, text: t("recheck.working") });
    start(async () => {
      const result = await suggestDetails(item.id);
      if (!result.ok) {
        setStatus({ spot, text: result.error, error: true });
        return;
      }
      // Merged into what the form shows now, so unsaved hand edits count as filled in.
      const form = panelRef.current?.querySelector("form");
      const current = form ? formValues(form) : detailValues(item);
      const { values, changed } = mergeSuggestion(current, result.suggestion, mode, { untagged: !item.aiTagged });
      if (changed.length === 0) {
        setStatus({ spot, text: t("recheck.nothing") });
        return;
      }
      setDraft({ values, changed, version: (draft?.version ?? 0) + 1 });
      setStatus({ spot, text: t("recheck.filled") });
      setOpen(true);
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  };

  return (
    <RecheckContext.Provider value={{ run, pending, status }}>
      {children}
      <details
        ref={panelRef}
        className={cx("group mt-5 scroll-mt-4", panel)}
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary className="cursor-pointer list-none px-4 py-3.5 font-bold">
          {t("item.edit")} <span className="font-semibold text-muted group-open:hidden">{t("item.editHint")}</span>
        </summary>
        <div className="border-t border-line px-4 py-4">
          {/* A new suggestion remounts the form so its values land in the inputs. */}
          <ItemEditor
            key={draft?.version ?? 0}
            id={item.id}
            values={draft?.values ?? detailValues(item)}
            changed={draft?.changed ?? []}
            onSaved={() => setDraft((d) => d && { ...d, changed: [] })}
          />
        </div>
      </details>
    </RecheckContext.Provider>
  );
}

/** The Re-check button with its quieter fill-empty choice and a status line. */
export function RecheckControls({ spot, className }: { spot: Spot; className?: string }) {
  const t = useT();
  const recheck = useContext(RecheckContext);
  if (!recheck) return null;
  const { run, pending, status } = recheck;
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" disabled={pending} onClick={() => run("replace", spot)} className={button.secondary}>
          <Sparkles size={16} /> {t("recheck.button")}
        </button>
        <button type="button" disabled={pending} onClick={() => run("empty", spot)} className={button.quiet}>
          {t("recheck.fillEmpty")}
        </button>
      </div>
      {status?.spot === spot && (
        <p
          className={cx("mt-2 text-sm font-semibold", status.error ? "text-danger" : "text-muted")}
          role={status.error ? "alert" : "status"}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
