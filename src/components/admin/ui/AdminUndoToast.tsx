"use client";
// use-client: setTimeout + dismiss interaction + ARIA live region.
//
// Refonte admin mai 2026 — PR 12 polish UX (ADR 0028, audit A8 #5).
//
// Toast non-bloquant avec action Undo (5 sec timer). Sans dépendance externe
// (pas sonner/react-hot-toast). Affichage bottom-right, role=status
// aria-live=polite. Additive : pas de Toaster racine requis.
//
// Usage typique : <AdminUndoToast label="Article archivé" onUndo={...}
//                   onExpired={...} timeoutMs={5000} />
// → s'auto-démonte après timeoutMs si onUndo pas cliqué.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Label affiché (ex: "Article archivé"). */
  label: string;
  /** Callback si l'utilisateur clique "Annuler". */
  onUndo: () => void;
  /** Callback si timeout dépassé (commit définitif). */
  onExpired?: () => void;
  /** Durée d'affichage en ms (default 5000). */
  timeoutMs?: number;
  className?: string;
}

export function AdminUndoToast({
  label,
  onUndo,
  onExpired,
  timeoutMs = 5000,
  className,
}: Props): React.ReactElement | null {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => {
      setVisible(false);
      onExpired?.();
    }, timeoutMs);
    return () => window.clearTimeout(id);
  }, [visible, timeoutMs, onExpired]);
  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "admin-undo-toast fixed right-[var(--space-admin-6)] bottom-[var(--space-admin-6)]",
        "z-[var(--z-admin-toast,80)]",
        "flex items-center gap-[var(--space-admin-5)]",
        "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)]",
        "bg-[color:var(--color-admin-paper)] shadow-[var(--shadow-admin-3)]",
        "px-[var(--space-admin-6)] py-[var(--space-admin-4)]",
        "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]",
        className,
      )}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          onUndo();
        }}
        className="admin-button-ghost"
      >
        Annuler
      </button>
    </div>
  );
}
