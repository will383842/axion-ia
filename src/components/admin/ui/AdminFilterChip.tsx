// Refonte admin mai 2026 — PR 4 (ADR 0028).
//
// Chip filtre actif dismissible (avec ESC ou clic croix). Server Component
// si href, Client si callback.

import Link from "next/link";
import { cn } from "@/lib/utils";

interface AdminFilterChipProps {
  label: string;
  /** Si fournie, génère un lien (filtre via href). */
  removeHref?: string;
  /** Si fournie, ouvre un bouton (filtre via JS — composant client requis). */
  onRemove?: () => void;
  className?: string;
}

export function AdminFilterChip({
  label,
  removeHref,
  onRemove,
  className,
}: AdminFilterChipProps): React.ReactElement {
  const inner = (
    <>
      <span className="text-[length:var(--text-admin-sm)]">{label}</span>
      <span
        aria-label="Retirer le filtre"
        className="ml-[var(--space-admin-2)] text-[length:var(--text-admin-base)] leading-none"
      >
        ×
      </span>
    </>
  );

  const sharedClass = cn(
    "admin-filter-chip inline-flex items-center gap-[var(--space-admin-2)]",
    "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]",
    "bg-[color:var(--color-admin-paper-alt)]",
    "px-[var(--space-admin-4)] py-[var(--space-admin-2)]",
    "min-h-[var(--target-admin-min-desktop)]",
    "text-[color:var(--color-admin-fg-soft)] hover:text-[color:var(--color-admin-fg)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-info)] focus-visible:ring-offset-2",
    className,
  );

  if (onRemove) {
    return (
      <button type="button" onClick={onRemove} className={sharedClass}>
        {inner}
      </button>
    );
  }
  if (removeHref) {
    return (
      <Link href={removeHref} className={sharedClass}>
        {inner}
      </Link>
    );
  }
  return <span className={sharedClass}>{inner}</span>;
}
