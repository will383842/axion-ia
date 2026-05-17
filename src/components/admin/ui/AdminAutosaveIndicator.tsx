// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A8 #2).
//
// Indicateur visuel autosave (Tiptap, settings) : idle / saving / saved /
// error. Server Component si rendu statique, mais typiquement consommé via
// state côté wrapper client (Tiptap).

import { cn } from "@/lib/utils";

export type AdminAutosaveStatus = "idle" | "saving" | "saved" | "error";

interface AdminAutosaveIndicatorProps {
  status: AdminAutosaveStatus;
  /** Override labels (i18n future). */
  labels?: Partial<Record<AdminAutosaveStatus, string>>;
  className?: string;
}

const DEFAULT_LABELS: Record<AdminAutosaveStatus, string> = {
  idle: "",
  saving: "Sauvegarde en cours…",
  saved: "Sauvegardé",
  error: "Échec de sauvegarde",
};

const STATUS_COLOR: Record<AdminAutosaveStatus, string> = {
  idle: "text-[color:var(--color-admin-fg-muted)]",
  saving: "text-[color:var(--color-admin-info)]",
  saved: "text-[color:var(--color-admin-success)]",
  error: "text-[color:var(--color-admin-destructive)]",
};

export function AdminAutosaveIndicator({
  status,
  labels,
  className,
}: AdminAutosaveIndicatorProps): React.ReactElement | null {
  const label = labels?.[status] ?? DEFAULT_LABELS[status];
  if (status === "idle" || !label) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "admin-autosave-indicator inline-flex items-center gap-[var(--space-admin-2)]",
        "text-[length:var(--text-admin-xs)]",
        STATUS_COLOR[status],
        className,
      )}
    >
      {label}
    </span>
  );
}
