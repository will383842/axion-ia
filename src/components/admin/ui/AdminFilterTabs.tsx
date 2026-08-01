// Refonte admin mai 2026 — PR 6 helper (composant additionnel).
//
// Tabs filtres unifiés (replace .admin-button-ghost + .admin-button-active
// patterns sur 6+ pages liste). Server Component, navigation via href.

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface AdminFilterTabOption {
  value: string;
  label: string;
  href: string;
  count?: number;
}

interface AdminFilterTabsProps {
  options: ReadonlyArray<AdminFilterTabOption>;
  current: string;
  label?: string;
  className?: string;
}

export function AdminFilterTabs({
  options,
  current,
  label,
  className,
}: AdminFilterTabsProps): React.ReactElement {
  return (
    <div className={cn("admin-filter-tabs", className)}>
      {label ? (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
          {label}
        </p>
      ) : null}
      {/* Refonte UI 2026-08-01 (couche 2) — passage de pastilles bordées
          indépendantes à un sélecteur segmenté : un seul conteneur creusé, et
          l'onglet actif est une tuile blanche posée dessus. Les pastilles
          isolées lisaient comme une rangée de boutons, sans montrer qu'il
          s'agit d'un choix unique et exclusif. La forme segmentée le dit
          d'elle-même — et c'est la convention des consoles depuis 2024.
          Le conteneur défile horizontalement plutôt que de passer à la ligne :
          une liste de canaux qui se réorganise à chaque filtre est
          désorientante. */}
      <div
        className={cn(
          "inline-flex max-w-full items-center gap-[var(--space-admin-1)] overflow-x-auto",
          "rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)]",
          "bg-[color:var(--color-admin-surface-sunken)] p-[var(--space-admin-2)]",
        )}
      >
        {options.map((opt) => {
          const active = opt.value === current;
          return (
            <Link
              key={opt.value}
              href={opt.href}
              {...(active ? { "aria-current": "page" } : {})}
              className={cn(
                "inline-flex shrink-0 items-center gap-[var(--space-admin-3)]",
                "rounded-[var(--radius-admin-md)]",
                "px-[var(--space-admin-5)] py-[var(--space-admin-3)]",
                "text-[length:var(--text-admin-sm)] font-medium whitespace-nowrap",
                "min-h-[var(--target-admin-min-desktop)]",
                "transition-[background-color,color,box-shadow] duration-[var(--duration-admin-fast)]",
                "focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] focus-visible:outline-none",
                active
                  ? "bg-[color:var(--color-admin-paper)] text-[color:var(--color-admin-fg)] shadow-[var(--shadow-admin-1)]"
                  : "text-[color:var(--color-admin-fg-soft)] hover:bg-[color:var(--color-admin-paper-alt)] hover:text-[color:var(--color-admin-fg)]",
              )}
            >
              {opt.label}
              {typeof opt.count === "number" ? (
                <span
                  className={cn(
                    "inline-flex min-w-[18px] items-center justify-center rounded-[var(--radius-admin-pill)]",
                    "px-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] font-semibold tabular-nums",
                    active
                      ? "bg-[color:var(--color-admin-accent)] text-[color:var(--color-admin-accent-fg)]"
                      : "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-neutral)]",
                  )}
                >
                  {opt.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
