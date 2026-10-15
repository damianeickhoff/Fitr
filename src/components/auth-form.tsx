"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/lib/auth-actions";
import { SubmitButton } from "./submit-button";
import { field, label } from "./ui";

export function AuthForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, signInAction] = useActionState(signIn, undefined);
  const [upState, signUpAction] = useActionState(signUp, undefined);
  const error = mode === "in" ? inState?.error : upState?.error;

  return (
    <form action={mode === "in" ? signInAction : signUpAction} className="space-y-4">
      {mode === "up" && (
        <div>
          <label htmlFor="name" className={label}>Name</label>
          <input id="name" name="name" required autoComplete="name" className={field} />
        </div>
      )}
      <div>
        <label htmlFor="email" className={label}>Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={field} />
      </div>
      <div>
        <label htmlFor="password" className={label}>Password</label>
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
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <SubmitButton className="w-full" pending={mode === "in" ? "Signing in…" : "Creating account…"}>
        {mode === "in" ? "Sign in" : "Create account"}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {mode === "in" ? "New to FITR?" : "Already have an account?"}{" "}
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="font-semibold text-cobalt">
          {mode === "in" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
