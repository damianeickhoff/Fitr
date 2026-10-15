"use client";

import { useFormStatus } from "react-dom";
import { button, cx } from "./ui";

export function SubmitButton({
  children,
  pending: pendingLabel,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  pending?: string;
  variant?: keyof typeof button;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cx(button[variant], className)}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
