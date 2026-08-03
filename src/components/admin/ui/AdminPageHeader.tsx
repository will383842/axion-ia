// Refonte admin mai 2026 — PR 2 (ADR 0028, PATTERNS.md §spec).
//
// Header de page standard : titre + description + breadcrumbs + actions.
// Server Component pur (pas d'état).
//
// Pattern canonique master prompt §8.2 — typography admin compacte,
// border-b mocha-soft, tokens --color-admin-* + --space-admin-*.

import { cn } from "@/lib/utils";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  /** Composant <AdminBreadcrumbs> ou élément équivalent. */
  breadcrumbs?: React.ReactNode;
  /** Boutons / actions (Button, link, etc.) — alignés à droite. */
  actions?: React.ReactNode;
  /** Badges / statuts (AdminStatusBadge, AdminBadge) — sous le titre. */
  meta?: React.ReactNode;
  className?: string;
}

export function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
}: AdminPageHeaderProps): React.ReactElement {
  return (
    <header
      className={cn(
        "admin-page-header",
        "border-b border-[color:var(--color-admin-border)]",
        "mb-[var(--space-admin-7,24px)] pb-[var(--space-admin-6,16px)]",
        className,
      )}
    >
      {breadcrumbs ? <div className="mb-[var(--space-admin-4,8px)]">{breadcrumbs}</div> : null}
      <div className="flex items-start justify-between gap-[var(--space-admin-6,16px)]">
        <div className="min-w-0">
          {/* 🔴 `truncate` coupe le titre aux points de suspension sans aucun
              recours : sur un écran étroit — et le viewport réel de Will est
              sous 1024 px — le nom de la fiche ouverte devenait illisible ET
              irrécupérable. C'est la primitive la plus réutilisée de la console
              (145 imports). `title` rend le texte complet accessible au survol
              et aux technologies d'assistance ; le titre reste sur une ligne. */}
          <h1
            title={title}
            className={cn(
              "text-[length:var(--text-admin-xl,22px)] font-bold tracking-tight",
              "leading-[var(--lh-admin-tight,1.4)]",
              "text-[color:var(--color-admin-fg)]",
              "truncate",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-[var(--space-admin-2,4px)]",
                "text-[length:var(--text-admin-base,14px)]",
                "text-[color:var(--color-admin-fg-soft)]",
                "max-w-prose",
              )}
            >
              {description}
            </p>
          ) : null}
          {meta ? (
            <div className="mt-[var(--space-admin-3,6px)] flex flex-wrap gap-[var(--space-admin-3,6px)]">
              {meta}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-[var(--space-admin-3,6px)]">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
