// Refonte admin mai 2026 — PR 3 (ADR 0028, audit A3 finding #7).
//
// État erreur unifié pour error.tsx (RSC) et boundaries client.
// Wrapping consistent : titre + description + actions (Retry, Back).
//
// Server Component (le bouton Retry peut être un Server Action ou un
// callback client passé depuis error.tsx qui est lui 'use client').

import { cn } from "@/lib/utils";

interface AdminErrorStateProps {
  title?: string;
  description?: string;
  /** Détails techniques (mode dev / debug only). Pas affiché par défaut. */
  detail?: string;
  /** Bouton « Réessayer » (callback côté consumer). */
  retryAction?: React.ReactNode;
  /** Bouton « Retour ». */
  backAction?: React.ReactNode;
  /**
   * Variante visuelle :
   * - "page" (default) : centré, large padding pour erreur fatale.
   * - "inline" : compact, pour erreur dans une section.
   */
  variant?: "page" | "inline";
  className?: string;
}

const VARIANT_CLASS: Record<NonNullable<AdminErrorStateProps["variant"]>, string> = {
  page: "p-[var(--space-admin-9)] my-[var(--space-admin-8)]",
  inline: "p-[var(--space-admin-6)]",
};

export function AdminErrorState({
  title = "Une erreur est survenue",
  description = "Le serveur n'a pas pu traiter cette page. Vous pouvez réessayer ou revenir en arrière.",
  detail,
  retryAction,
  backAction,
  variant = "page",
  className,
}: AdminErrorStateProps): React.ReactElement {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "admin-error-state",
        "rounded-[var(--radius-admin-md)] border",
        "border-[color:var(--color-admin-destructive)]",
        "bg-[color:var(--color-admin-destructive-soft)]",
        "flex flex-col items-center gap-[var(--space-admin-5)] text-center",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      <h2
        className={cn(
          "text-[length:var(--text-admin-lg)] font-semibold",
          "text-[color:var(--color-admin-destructive-fg)]",
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "max-w-prose text-[length:var(--text-admin-base)]",
          "text-[color:var(--color-admin-fg-soft)]",
        )}
      >
        {description}
      </p>
      {detail && process.env.NODE_ENV !== "production" ? (
        <details className="mt-[var(--space-admin-3)] max-w-prose text-left text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          <summary className="cursor-pointer">Détails techniques (dev)</summary>
          <pre className="mt-[var(--space-admin-3)] overflow-x-auto rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-paper-alt)] p-[var(--space-admin-4)]">
            {detail}
          </pre>
        </details>
      ) : null}
      {retryAction || backAction ? (
        <div className="mt-[var(--space-admin-3)] flex flex-wrap items-center justify-center gap-[var(--space-admin-3)]">
          {retryAction}
          {backAction}
        </div>
      ) : null}
    </div>
  );
}
