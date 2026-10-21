"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { refreshInsight } from "@/lib/profile-actions";
import { useT } from "./locale";
import { button } from "./ui";

export function RefreshInsight({ label }: { label: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await refreshInsight();
            setError(result.error ?? null);
          })
        }
        className={button.primary}
      >
        <Sparkles size={16} /> {pending ? t("tips.looking") : label}
      </button>
      {error && <p className="text-sm font-semibold text-danger" role="alert">{error}</p>}
    </div>
  );
}
