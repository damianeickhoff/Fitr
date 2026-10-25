"use client";

import { Check, ChevronDown, Plus, X } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { imageUrl } from "@/lib/storage-url";
import { addToTrip, removeFromTrip, setPacked } from "@/lib/trip-actions";
import { useT } from "./locale";
import { CATEGORY_TONE, button, cx, panel, pill } from "./ui";

export type PackingRow = { itemId: string; name: string; imagePath: string; reason: string; packed: boolean };
export type PackingGroup = { category: string; label: string; rows: PackingRow[] };
type Addable = { id: string; name: string; imagePath: string };

/** The list grouped by category, ticked off as pieces go in the case. */
export function PackingList({ tripId, groups, addable }: { tripId: string; groups: PackingGroup[]; addable: Addable[] }) {
  const t = useT();
  const rows = groups.flatMap((g) => g.rows);
  // Ticks show at once; the server catches up behind them.
  const [ticks, tick] = useOptimistic(new Map(rows.map((r) => [r.itemId, r.packed])), (state, [id, packed]: [string, boolean]) =>
    new Map(state).set(id, packed),
  );
  const [, start] = useTransition();
  const done = rows.filter((r) => ticks.get(r.itemId)).length;

  return (
    <>
      {rows.length > 0 ? (
        <>
          <p className="mt-0.5 text-[13px] font-semibold text-muted">
            {t("trips.packingHint")} <span className="font-bold text-ink">{t("trips.packedCount", { done, n: rows.length })}</span>
          </p>
          {groups.map((group) => (
            <section key={group.category} className="mt-4">
              <h3 className="mb-2">
                <span className={pill(CATEGORY_TONE[group.category] ?? "grey", "md")}>
                  {group.label} · {group.rows.length}
                </span>
              </h3>
              <ul className={cx(panel, "divide-y divide-line px-3")}>
                {group.rows.map((row) => {
                  const packed = ticks.get(row.itemId) ?? false;
                  return (
                    <li key={row.itemId} className="flex items-center gap-3 py-2.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={packed}
                        aria-label={`${t("trips.tick")}: ${row.name}`}
                        onClick={() =>
                          start(async () => {
                            tick([row.itemId, !packed]);
                            await setPacked(tripId, row.itemId, !packed);
                          })
                        }
                        className={cx(
                          "grid size-7 shrink-0 place-items-center rounded-full transition",
                          packed ? "bg-accent text-white" : "bg-paper ring-2 ring-line ring-inset hover:ring-ink/30",
                        )}
                      >
                        {packed && <Check size={16} strokeWidth={3} />}
                      </button>
                      <Link href={`/item/${row.itemId}`} className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
                        <img src={imageUrl(row.imagePath)} alt="" className={cx("h-16 w-13 rounded-xl bg-[#efe8db] object-cover transition", packed && "opacity-50")} />
                      </Link>
                      <div className={cx("min-w-0 flex-1", packed && "opacity-60")}>
                        <p className={cx("truncate text-[15px] font-bold", packed && "line-through decoration-2")}>{row.name}</p>
                        <p className="text-[13px] leading-snug font-semibold text-muted">{row.reason}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={`${t("trips.remove")}: ${row.name}`}
                        onClick={() => start(() => removeFromTrip(tripId, row.itemId))}
                        className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger"
                      >
                        <X size={17} strokeWidth={2.4} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <p className="mt-1 text-sm font-semibold text-muted">{t("trips.packingEmpty")}</p>
      )}
      <AddPiece tripId={tripId} addable={addable} />
    </>
  );
}

/** Opens the rest of the wardrobe as a grid; a tap puts the piece on the list. */
function AddPiece({ tripId, addable }: { tripId: string; addable: Addable[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [, start] = useTransition();

  return (
    <div className="mt-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={cx(button.secondary, "w-full")}>
        <Plus size={16} strokeWidth={2.6} /> {t("trips.add")}
        <ChevronDown size={16} strokeWidth={2.4} className={cx("transition", open && "rotate-180")} />
      </button>
      {open &&
        (addable.length ? (
          <ul className="mt-3 grid grid-cols-4 gap-2">
            {addable.map((piece) => (
              <li key={piece.id}>
                <button
                  type="button"
                  disabled={adding !== null}
                  onClick={() => {
                    setAdding(piece.id);
                    start(async () => {
                      await addToTrip(tripId, piece.id);
                      setAdding(null);
                    });
                  }}
                  className={cx("block w-full text-left transition disabled:opacity-60", adding === piece.id && "animate-pulse")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- private listing image */}
                  <img src={imageUrl(piece.imagePath)} alt="" className="aspect-[4/5] w-full rounded-xl bg-[#efe8db] object-cover" />
                  <span className="mt-1 line-clamp-2 block text-[11.5px] leading-snug font-bold">{piece.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm font-semibold text-muted">{t("trips.addNone")}</p>
        ))}
    </div>
  );
}
