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
      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        {options.map((opt) => {
          const active = opt.value === current;
          return (
            <Link
              key={opt.value}
              href={opt.href}
              {...(active ? { "aria-current": "page" } : {})}
              className={cn(
                "inline-flex items-center gap-[var(--space-admin-2)]",
                "rounded-[var(--radius-admin-md)] border",
                "px-[var(--space-admin-5)] py-[var(--space-admin-3)]",
                "text-[length:var(--text-admin-sm)] font-medium",
                "min-h-[var(--target-admin-min-desktop)]",
                "transition-colors",
                active
                  ? "border-[color:var(--color-admin-info)] bg-[color:var(--color-admin-info-soft)] text-[color:var(--color-admin-info)]"
                  : "border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] text-[color:var(--color-admin-fg-soft)] hover:bg-[color:var(--color-admin-surface-hover)] hover:text-[color:var(--color-admin-fg)]",
              )}
            >
              {opt.label}
              {typeof opt.count === "number" ? (
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded-[var(--radius-admin-sm)]",
                    "px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold",
                    active
                      ? "bg-[color:var(--color-admin-info)] text-white"
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
