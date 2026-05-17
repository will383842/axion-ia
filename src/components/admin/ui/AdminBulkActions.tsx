"use client";
// use-client: state selection + sticky positioning interactive.
//
// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A8 #8).
//
// Sticky bottom bar quand sélection > 0. Affiche compteur + actions.

import { cn } from "@/lib/utils";

interface AdminBulkActionsProps {
  /** Nombre d'items sélectionnés. */
  selectedCount: number;
  /** Total visible (pour "X sur Y"). */
  totalCount?: number;
  /** Actions à proposer (boutons). */
  actions: React.ReactNode;
  /** Callback clear selection. */
  onClear: () => void;
  className?: string;
}

export function AdminBulkActions({
  selectedCount,
  totalCount,
  actions,
  onClear,
  className,
}: AdminBulkActionsProps): React.ReactElement | null {
  if (selectedCount === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Actions sur la sélection"
      className={cn(
        "admin-bulk-actions fixed right-0 bottom-0 left-0 z-[var(--z-admin-sticky)]",
        "border-t border-[color:var(--color-admin-border-strong)]",
        "bg-[color:var(--color-admin-paper)] shadow-[var(--shadow-admin-3)]",
        "px-[var(--space-admin-6)] py-[var(--space-admin-4)]",
        "flex items-center justify-between gap-[var(--space-admin-5)]",
        className,
      )}
    >
      <span
        className={cn("text-[length:var(--text-admin-sm)]", "text-[color:var(--color-admin-fg)]")}
      >
        <strong>{selectedCount}</strong>
        {totalCount ? (
          <>
            {" "}
            sur <strong>{totalCount}</strong>
          </>
        ) : null}{" "}
        sélectionné
        {selectedCount > 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-[var(--space-admin-3)]">
        {actions}
        <button
          type="button"
          onClick={onClear}
          className="admin-button-ghost"
          aria-label="Vider la sélection"
        >
          Désélectionner
        </button>
      </div>
    </div>
  );
}
