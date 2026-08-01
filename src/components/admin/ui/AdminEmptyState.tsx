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

// Refonte UI 2026-08-01 (couche 2) — un état vide se lisait « boîte blanche
// avec un texte gras au milieu » : rien n'indiquait s'il fallait attendre,
// changer de filtre ou créer un élément. Bordure adoucie en pointillés (le
// conteneur est une réserve, pas une carte de contenu), fond très légèrement
// creusé, respiration accrue, et l'icône reçoit enfin un traitement — pastille
// ronde teintée, comme dans les consoles de référence.
const VARIANT_CLASS: Record<NonNullable<AdminEmptyStateProps["variant"]>, string> = {
  card: "border border-dashed border-[color:var(--color-admin-border-strong)] rounded-[var(--radius-admin-xl)] bg-[color:var(--color-admin-surface-sunken)] px-[var(--space-admin-7)] py-[var(--space-admin-9)]",
  inline: "p-[var(--space-admin-7)]",
  "not-found":
    "border border-dashed border-[color:var(--color-admin-border-strong)] rounded-[var(--radius-admin-xl)] bg-[color:var(--color-admin-surface-sunken)] px-[var(--space-admin-7)] py-[var(--space-admin-9)] my-[var(--space-admin-8)]",
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
        "flex flex-col items-center gap-[var(--space-admin-4)] text-center",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className={cn(
            "mb-[var(--space-admin-2)] flex h-12 w-12 items-center justify-center rounded-full",
            "bg-[color:var(--color-admin-paper)] text-[color:var(--color-admin-fg-muted)]",
            "border border-[color:var(--color-admin-border)]",
          )}
        >
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
