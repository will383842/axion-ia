// Refonte admin mai 2026 — PR 3 (ADR 0028, audit A3 finding #4).
//
// Pattern unifié pour les états vides (table sans data, recherche sans
// résultat, ressource inexistante). Server Component pur.
//
// 12 pages audit A3 réinventent ce pattern → primitive obligatoire.

import { cn } from "@/lib/utils";

interface AdminEmptyStateProps {
  /** Icone (lucide ou SVG inline). Optionnel mais recommandé. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** CTA primaire (Button asChild link + label clair). */
  primaryAction?: React.ReactNode;
  /** CTA secondaire (lien dérouté / docs). */
  secondaryAction?: React.ReactNode;
  /**
   * Variante visuelle :
   * - "card" (default) : encadré bordé pour zones tableau / formulaire.
   * - "inline" : sans bord, padding réduit, pour empty inline d'une section.
   * - "not-found" : variante page 404 (icon plus grosse, padding plus large).
   */
  variant?: "card" | "inline" | "not-found";
  className?: string;
}

const VARIANT_CLASS: Record<NonNullable<AdminEmptyStateProps["variant"]>, string> = {
  card: "border border-[color:var(--color-admin-border)] rounded-[var(--radius-admin-md)] p-[var(--space-admin-8)]",
  inline: "p-[var(--space-admin-6)]",
  "not-found":
    "border border-[color:var(--color-admin-border)] rounded-[var(--radius-admin-md)] p-[var(--space-admin-9)] my-[var(--space-admin-8)]",
};

export function AdminEmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = "card",
  className,
}: AdminEmptyStateProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "admin-empty-state",
        "flex flex-col items-center gap-[var(--space-admin-5)] text-center",
        "bg-[color:var(--color-admin-paper)]",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {icon ? (
        <div className="text-[color:var(--color-admin-fg-muted)]" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h2
        className={cn(
          "text-[length:var(--text-admin-lg)] font-semibold",
          "text-[color:var(--color-admin-fg)]",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-prose text-[length:var(--text-admin-base)]",
            "text-[color:var(--color-admin-fg-soft)]",
          )}
        >
          {description}
        </p>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-[var(--space-admin-3)] flex flex-wrap items-center justify-center gap-[var(--space-admin-3)]">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
