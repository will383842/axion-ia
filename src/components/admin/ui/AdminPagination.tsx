// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A7 duplication #9).
//
// Pagination unifiée : 5 pages réinventent ce pattern. Server Component
// (liens href avec page= dans searchParams), pas de state interne.

import Link from "next/link";
import { cn } from "@/lib/utils";

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  /** URL de base (sans ?page=). */
  baseHref: string;
  /** Params additionnels à préserver dans les liens. */
  preservedParams?: Record<string, string | undefined>;
  /** Nom du param (default "page"). */
  paramName?: string;
  className?: string;
}

function buildHref(
  baseHref: string,
  paramName: string,
  page: number,
  preserved?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(preserved ?? {})) {
    if (v) params.set(k, v);
  }
  params.set(paramName, String(page));
  return `${baseHref}?${params.toString()}`;
}

const PAGE_LINK_BASE = cn(
  "inline-flex items-center gap-[var(--space-admin-2)]",
  "px-[var(--space-admin-5)] py-[var(--space-admin-4)]",
  "text-[length:var(--text-admin-sm)]",
  "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]",
  "min-h-[var(--target-admin-min-desktop)]",
);

/**
 * 🔴 EN PREMIÈRE PAGE, « Précédent » ÉTAIT UN LIEN ACTIF VERS `#` (et
 * « Suivant » en dernière page). `aria-disabled` seul ne retire ni le rôle
 * ni la cible : un lecteur d'écran annonçait un lien, un clic remontait en
 * haut de page, un moteur y voyait une URL. Sans page à atteindre, il n'y a
 * pas de lien à rendre — un élément inerte, marqué désactivé, sans `href`.
 */
function PageLink({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  if (href === null) {
    return (
      <span
        role="link"
        aria-disabled="true"
        className={cn(
          PAGE_LINK_BASE,
          "pointer-events-none cursor-default select-none",
          "text-[color:var(--color-admin-fg-disabled)]",
        )}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        PAGE_LINK_BASE,
        "text-[color:var(--color-admin-fg)] hover:bg-[color:var(--color-admin-surface-hover)]",
      )}
    >
      {children}
    </Link>
  );
}

export function AdminPagination({
  page,
  totalPages,
  baseHref,
  preservedParams,
  paramName = "page",
  className,
}: AdminPaginationProps): React.ReactElement | null {
  if (totalPages <= 1) return null;
  const prevHref =
    page > 1 ? buildHref(baseHref, paramName, Math.max(1, page - 1), preservedParams) : null;
  const nextHref =
    page < totalPages
      ? buildHref(baseHref, paramName, Math.min(totalPages, page + 1), preservedParams)
      : null;
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "admin-pagination flex items-center justify-between",
        "mt-[var(--space-admin-6)] gap-[var(--space-admin-3)]",
        className,
      )}
    >
      <PageLink href={prevHref}>← Précédent</PageLink>
      {/* Un seul nœud texte : « Page 2 sur 5 » se lit d'une traite, au lieu de
          trois fragments (« Page », « 2 », « sur », « 5 ») que les lecteurs
          d'écran et les outils d'audit découpaient. */}
      <span
        aria-live="polite"
        className={cn(
          "text-[length:var(--text-admin-sm)]",
          "text-[color:var(--color-admin-fg-soft)]",
        )}
      >
        {`Page ${page} sur ${totalPages}`}
      </span>
      <PageLink href={nextHref}>Suivant →</PageLink>
    </nav>
  );
}
