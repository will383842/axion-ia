// Refonte admin mai 2026 — PR 2 (ADR 0028, PATTERNS.md §1).
//
// Toolbar standard pages liste : filtres + recherche + sort + view toggle.
// Server Component (les enfants peuvent être client si interactifs).
//
// Layout responsive : flex wrap, stack mobile sous 768px.
// Tokens --space-admin-* pour densité dense.

import { cn } from "@/lib/utils";

interface AdminToolbarProps {
  /** Zone filtres (boutons, tabs, chips). Aligné à gauche. */
  filters?: React.ReactNode;
  /** Input search (controlled ou non). */
  search?: React.ReactNode;
  /** Select sort / view toggle (compact). */
  sort?: React.ReactNode;
  /** Boutons actions rapides (Refresh, Export, etc.) — alignés à droite. */
  actions?: React.ReactNode;
  className?: string;
}

export function AdminToolbar({
  filters,
  search,
  sort,
  actions,
  className,
}: AdminToolbarProps): React.ReactElement {
  return (
    <div
      role="toolbar"
      aria-label="Filtres et actions de la liste"
      className={cn(
        "admin-toolbar",
        "flex flex-wrap items-center gap-[var(--space-admin-5,12px)]",
        "mb-[var(--space-admin-6,16px)]",
        className,
      )}
    >
      {filters ? (
        <div className="flex flex-wrap items-center gap-[var(--space-admin-3,6px)]">{filters}</div>
      ) : null}
      {search ? <div className="min-w-[200px] flex-1">{search}</div> : null}
      {sort ? <div className="flex shrink-0 items-center">{sort}</div> : null}
      {actions ? (
        <div className="flex shrink-0 items-center gap-[var(--space-admin-3,6px)]">{actions}</div>
      ) : null}
    </div>
  );
}
