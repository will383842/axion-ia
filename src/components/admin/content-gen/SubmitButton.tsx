/**
 * Content Generator — SubmitButton client avec useFormStatus.pending.
 *
 * P2-B fix audit opérationnel 2026-05-15 — empêche le double-submit sur forms
 * admin et fournit un feedback "Envoi…" pendant la Server Action en vol.
 *
 * Utilisation :
 *   <form action={serverAction}>
 *     <SubmitButton variant="primary" pendingLabel="Approbation…">
 *       ✅ Approuver
 *     </SubmitButton>
 *   </form>
 */

"use client";
// use-client: useFormStatus() hook React requires client runtime for pending state tracking.

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly variant?: "primary" | "ghost" | "danger";
  readonly pendingLabel?: string;
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
}

const VARIANT_CLASS: Record<NonNullable<SubmitButtonProps["variant"]>, string> = {
  primary: "admin-button",
  ghost: "admin-button-ghost",
  danger: "admin-button admin-button-danger",
};

export function SubmitButton({
  children,
  className,
  variant = "primary",
  pendingLabel,
  disabled,
  ariaLabel,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const cls = className ?? VARIANT_CLASS[variant];
  return (
    <button
      type="submit"
      className={cls}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      aria-label={ariaLabel}
    >
      {pending ? (pendingLabel ?? "Envoi…") : children}
    </button>
  );
}
