"use client";

import { useActionState } from "react";
import { saveStyleNotes } from "@/lib/profile-actions";
import { SubmitButton } from "./submit-button";
import { field } from "./ui";

export function StyleNotes({ initial }: { initial: string }) {
  const [state, action] = useActionState(saveStyleNotes, undefined);
  return (
    <form action={action} className="mt-3">
      <textarea
        name="styleNotes"
        rows={3}
        defaultValue={initial}
        maxLength={600}
        placeholder="e.g. Mostly neutrals with one colour. Love oversized knits, never skinny jeans. Dress code at work is smart casual."
        className={field}
      />
      <div className="mt-2 flex items-center gap-3">
        <SubmitButton variant="secondary" pending="Saving…">Save</SubmitButton>
        {state?.saved && <p className="text-sm text-muted" role="status">Saved.</p>}
      </div>
    </form>
  );
}
