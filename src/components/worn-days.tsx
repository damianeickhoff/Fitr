"use client";

import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { markWorn, unmarkWorn } from "@/lib/item-actions";
import { useT } from "./locale";
import { button, cx, field, panel, pill } from "./ui";

type Day = { key: string; label: string };

/**
 * The item page's wear history: the latest days as pills, a tap taking one
 * off, and a date to log a day that was forgotten. `today` comes from the
 * server, whose calendar the days are kept in.
 */
export function WornDays({ id, days, earlier, today }: { id: string; days: Day[]; earlier: number; today: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [day, setDay] = useState(today);

  return (
    <section className="mt-7">
      <h2 className="mb-2.5 text-lg font-extrabold">{t("worn.section")}</h2>
      <div className={cx(panel, "p-3.5")}>
        {days.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {days.map((d) => (
              <button
                key={d.key}
                type="button"
                disabled={pending}
                aria-label={t("worn.remove", { date: d.label })}
                onClick={() => start(() => unmarkWorn(id, d.key))}
                className={cx(pill("green", "md"), "transition hover:brightness-95 disabled:opacity-60")}
              >
                {d.label} <X size={12} strokeWidth={3} />
              </button>
            ))}
            {earlier > 0 && <span className="text-[12.5px] font-semibold text-muted">{t.count("worn.earlier", earlier)}</span>}
          </div>
        ) : (
          <p className="text-sm font-semibold text-muted">{t("worn.none")}</p>
        )}

        <form
          className="mt-3 flex items-end gap-2 border-t border-line pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (day) start(() => markWorn(id, day));
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">{t("worn.logDay")}</span>
            <input type="date" value={day} max={today} required onChange={(e) => setDay(e.target.value)} className={cx(field, "py-2.5")} />
          </label>
          <button type="submit" disabled={pending || !day} className={cx(button.secondary, "py-3")}>
            <Plus size={15} strokeWidth={2.6} /> {t("worn.log")}
          </button>
        </form>
      </div>
    </section>
  );
}
