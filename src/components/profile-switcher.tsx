"use client";

import { Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { createProfile, deleteProfile, switchProfile } from "@/lib/profile-actions";
import { useT } from "./locale";
import { SubmitButton } from "./submit-button";
import { button, cx, field, panel } from "./ui";

export type ProfileSummary = { id: string; name: string; accent: string; pieces: number; current: boolean };

/**
 * The household's profiles: tap one to take over this device, no password
 * asked. Adding one is a name and nothing else.
 */
export function ProfileSwitcher({ profiles }: { profiles: ProfileSummary[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [state, create] = useActionState(createProfile, undefined);
  const [adding, setAdding] = useState(false);

  return (
    <div className={cx(panel, "mt-3 px-4")}>
      {profiles.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={pending || p.current}
          onClick={() => start(() => switchProfile(p.id))}
          aria-current={p.current ? "true" : undefined}
          className="flex w-full items-center gap-3 border-b border-line py-3 text-left disabled:opacity-100"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-extrabold text-white" style={{ background: p.accent }}>
            {p.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{p.name}</span>
            <span className="block text-[12.5px] font-semibold text-muted">{t.count("wardrobe.pieces", p.pieces)}</span>
          </span>
          {p.current ? (
            <Check size={20} strokeWidth={2.8} className="text-accent" aria-label={t("me.current")} />
          ) : (
            <ChevronRight size={18} strokeWidth={2.4} className="text-muted" />
          )}
        </button>
      ))}

      {adding ? (
        <form action={create} className="flex items-center gap-2 py-3">
          <input name="name" required maxLength={60} autoFocus placeholder={t("me.newName")} className={cx(field, "py-2.5")} />
          <SubmitButton variant="secondary" className="shrink-0" pending={t("common.saving")}>
            {t("me.create")}
          </SubmitButton>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-3 py-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-full text-muted ring-[1.5px] ring-line ring-inset">
            <Plus size={18} strokeWidth={2.6} />
          </span>
          <span className="text-[15px] font-bold">{t("me.newProfile")}</span>
        </button>
      )}
      {state?.error && (
        <p className="pb-3 text-sm font-semibold text-danger" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

/** Removes the open profile and all it owns; refused for the last one. */
export function DeleteProfile() {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(t("me.deleteConfirm"))) {
            start(async () => {
              const result = await deleteProfile();
              setError(result?.error ?? null);
            });
          }
        }}
        className={button.danger}
      >
        <Trash2 size={16} /> {t("me.deleteProfile")}
      </button>
      {error && (
        <p className="mt-2 text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
