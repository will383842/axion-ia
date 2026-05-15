/**
 * P3-30 audit E2E NAV+CTA 2026-05-15 — composant générique « Voir sur le site »
 * pour les pages edit admin. Centralise le pattern (target=_blank +
 * rel=noopener + iconographie) pour qu'une seule modif propage à toutes les
 * pages d'édition.
 *
 * Server Component — pas de state nécessaire. Externalise simplement le
 * markup avec ARIA correct.
 */

import { ExternalLink } from "lucide-react";

interface PreviewButtonProps {
  /** URL publique complète OU path absolu (`/fr/blog/mon-slug`). */
  href: string;
  /** Label visible (déjà localisé par le caller). Défaut « Voir sur le site ». */
  label?: string;
  /** Variant visuel — `outline` (défaut) ou `solid`. */
  variant?: "outline" | "solid";
  /** Classe additionnelle (peut surcharger). */
  className?: string;
}

const VARIANTS = {
  outline: "border border-border bg-paper text-fg hover:bg-sand focus-visible:ring-primary",
  solid: "bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-primary",
} as const;

export function PreviewButton({
  href,
  label = "Voir sur le site",
  variant = "outline",
  className,
}: PreviewButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-admin-preview="true"
      className={`inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${VARIANTS[variant]} ${className ?? ""}`}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </a>
  );
}
