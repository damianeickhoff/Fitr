"use client";

import { Pencil, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteTrip, repackTrip } from "@/lib/trip-actions";
import { useT } from "./locale";
import { TripForm, type TripFields } from "./trip-form";
import { button, cx, panel } from "./ui";

/** Pack again with the stylist, edit the trip in place, or delete it. */
export function TripActions({ trip, hasList, notice }: { trip: TripFields; hasList: boolean; notice?: string }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<{ error?: string; notice?: string } | null>(null);
  const [packing, startPacking] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const repack = () => {
    if (hasList && !confirm(t("trips.repackConfirm"))) return;
    startPacking(async () => setResult(await repackTrip(trip.id)));
  };
  const remove = () => {
    if (confirm(t("trips.deleteConfirm"))) startDeleting(() => deleteTrip(trip.id));
  };
  const message = result ? (result.error ?? result.notice) : notice;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={repack} disabled={packing} className={button.primary}>
          <Sparkles size={16} /> {packing ? t("trips.repacking") : t("trips.repack")}
        </button>
        <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing} className={button.secondary}>
          <Pencil size={15} strokeWidth={2.4} /> {t("trips.edit")}
        </button>
        <button type="button" onClick={remove} disabled={deleting} className={button.danger}>
          <Trash2 size={15} strokeWidth={2.4} /> {t("trips.delete")}
        </button>
      </div>
      {message && (
        <p className={cx("mt-2.5 text-sm font-semibold", result?.error ? "text-danger" : "text-muted")} role="status">
          {message}
        </p>
      )}
      {editing && (
        <div className={cx(panel, "mt-3 p-4")}>
          <TripForm trip={trip} onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}
