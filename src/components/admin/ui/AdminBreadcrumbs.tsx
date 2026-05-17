// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A1 finding #5 / A8 #4).
//
// Breadcrumbs admin a11y avec truncation responsive. Server Component.

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface AdminBreadcrumbItem {
  label: string;
  /** Optionnel : si absent, item rendu sans lien (typiquement dernier). */
  href?: string;
}

interface AdminBreadcrumbsProps {
  items: ReadonlyArray<AdminBreadcrumbItem>;
  /** Tronque si plus de N items (collapse middle). */
  truncate?: number;
  className?: string;
}

export function AdminBreadcrumbs({
  items,
  truncate = 5,
  className,
}: AdminBreadcrumbsProps): React.ReactElement {
  const displayed: ReadonlyArray<AdminBreadcrumbItem> =
    items.length > truncate && items.length > 0
      ? [items[0] as AdminBreadcrumbItem, { label: "…" } as AdminBreadcrumbItem, ...items.slice(-2)]
      : items;
  return (
    <nav
      aria-label="Fil d'Ariane"
      className={cn(
        "admin-breadcrumbs flex flex-wrap items-center gap-[var(--space-admin-2)]",
        "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]",
        className,
      )}
    >
      <ol className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        {displayed.map((item, i) => {
          const isLast = i === displayed.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-[var(--space-admin-2)]">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="underline-offset-2 hover:text-[color:var(--color-admin-fg)] hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "font-medium text-[color:var(--color-admin-fg)]" : ""}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="text-[color:var(--color-admin-border-strong)]">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
