"use client";

import { useActionState } from "react";
import { saveStyleNotes } from "@/lib/profile-actions";
import { useT } from "./locale";
import { SubmitButton } from "./submit-button";
import { field } from "./ui";

export function StyleNotes({ initial }: { initial: string }) {
  const t = useT();
  const [state, action] = useActionState(saveStyleNotes, undefined);
  return (
    <form action={action} className="mt-3">
      <textarea name="styleNotes" rows={3} defaultValue={initial} maxLength={600} placeholder={t("me.stylePlaceholder")} className={field} />
      <div className="mt-2 flex items-center gap-3">
        <SubmitButton variant="secondary" pending={t("common.saving")}>
          {t("common.save")}
        </SubmitButton>
        {state?.saved && (
          <p className="text-sm font-semibold text-muted" role="status">
            {t("common.saved")}
          </p>
        )}
      </div>
    </form>
  );
}
