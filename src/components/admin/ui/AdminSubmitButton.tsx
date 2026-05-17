"use client";
// use-client: useFormStatus React 19 (browser pending state).
//
// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A7 duplication #19).
//
// Promotion de src/components/admin/content-gen/SubmitButton.tsx vers
// `admin/ui`. Désactivé pendant submission, label override.

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

interface AdminSubmitButtonProps {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "destructive";
  className?: string;
}

export function AdminSubmitButton({
  children,
  pendingLabel = "Patientez…",
  variant = "primary",
  className,
}: AdminSubmitButtonProps): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        variant === "destructive" ? "admin-button-refuse" : "admin-button",
        "min-h-[var(--target-admin-min-desktop)]",
        "disabled:opacity-60",
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
