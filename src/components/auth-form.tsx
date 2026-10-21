"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/lib/auth-actions";
import { useT } from "./locale";
import { SubmitButton } from "./submit-button";
import { field, label } from "./ui";

export function AuthForm() {
  const t = useT();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, signInAction] = useActionState(signIn, undefined);
  const [upState, signUpAction] = useActionState(signUp, undefined);
  const error = mode === "in" ? inState?.error : upState?.error;

  return (
    <form action={mode === "in" ? signInAction : signUpAction} className="space-y-4">
      {mode === "up" && (
        <div>
          <label htmlFor="name" className={label}>{t("auth.name")}</label>
          <input id="name" name="name" required autoComplete="name" className={field} />
        </div>
      )}
      <div>
        <label htmlFor="email" className={label}>{t("auth.email")}</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={field} />
      </div>
      <div>
        <label htmlFor="password" className={label}>{t("auth.password")}</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "up" ? 8 : undefined}
          autoComplete={mode === "up" ? "new-password" : "current-password"}
          className={field}
        />
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <SubmitButton className="w-full" pending={mode === "in" ? t("auth.signingIn") : t("auth.creating")}>
        {mode === "in" ? t("auth.signIn") : t("auth.create")}
      </SubmitButton>
      <p className="text-center text-sm font-semibold text-muted">
        {mode === "in" ? t("auth.newHere") : t("auth.haveAccount")}{" "}
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="font-bold text-accent">
          {mode === "in" ? t("auth.createLink") : t("auth.signIn")}
        </button>
      </p>
    </form>
  );
}
