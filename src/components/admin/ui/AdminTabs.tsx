// Refonte admin mai 2026 — PR 4 (ADR 0028, audit A2 critère 11).
//
// Tabs admin compactes (text-xs header, count badge). Server Component si
// usage avec liens, Client si state interne nécessaire.
//
// Cette version = liens (RSC), navigation via href. Pour un tab interactif
// pur (sans navigation), wrap dans un composant client custom.

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface AdminTabItem {
  value: string;
  label: string;
  href: string;
  count?: number;
  disabled?: boolean;
}

interface AdminTabsProps {
  items: ReadonlyArray<AdminTabItem>;
  /** Tab actif (key de l'item). */
  current?: string;
  className?: string;
}

export function AdminTabs({ items, current, className }: AdminTabsProps): React.ReactElement {
  return (
    <nav
      aria-label="Onglets"
      className={cn("admin-tabs border-b border-[color:var(--color-admin-border)]", className)}
    >
      <ul className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        {items.map((item) => {
          const active = current === item.value;
          return (
            <li key={item.value}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-disabled={item.disabled}
                className={cn(
                  "inline-flex items-center gap-[var(--space-admin-2)]",
                  "px-[var(--space-admin-5)] py-[var(--space-admin-4)]",
                  "text-[length:var(--text-admin-sm)] font-medium",
                  "border-b-2 transition-colors",
                  "min-h-[var(--target-admin-min-desktop)]",
                  active
                    ? "border-[color:var(--color-admin-info)] text-[color:var(--color-admin-info)]"
                    : "border-transparent text-[color:var(--color-admin-fg-soft)] hover:border-[color:var(--color-admin-border)] hover:text-[color:var(--color-admin-fg)]",
                  item.disabled && "pointer-events-none opacity-50",
                )}
              >
                {item.label}
                {typeof item.count === "number" ? (
                  <span
                    className={cn(
                      "inline-flex min-w-[20px] items-center justify-center rounded-[var(--radius-admin-sm)]",
                      "px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold",
                      active
                        ? "bg-[color:var(--color-admin-info-soft)] text-[color:var(--color-admin-info)]"
                        : "bg-[color:var(--color-admin-neutral-soft)] text-[color:var(--color-admin-neutral)]",
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
