// Refonte admin mai 2026 — PR 5 (ADR 0028, audit A1 finding #9).
//
// Dropdown notifications/alertes ops (V1 stub) :
// - Compteur badge sur l'icône bell.
// - Liste max 5 notifications dans le dropdown.
// - Lien « Voir toutes » → /alerts.
//
// V1 = stub server-rendered avec count + items passés en props (le data
// fetch se fait côté layout/page consumer via /api/admin/alerts ou Prisma).
// Pas d'auto-refresh côté V1 (laissé pour V1.5+).

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminBadge } from "./AdminBadge";

export interface AdminNotificationItem {
  id: string;
  title: string;
  description?: string;
  href: string;
  /** Mappe vers AdminBadge tone. */
  severity: "info" | "warning" | "destructive" | "success";
  /** ISO date. */
  createdAt: string;
}

interface AdminNotificationsDropdownProps {
  items: ReadonlyArray<AdminNotificationItem>;
  unreadCount?: number;
  /** URL vers la page Alerts complète. */
  allHref: string;
  className?: string;
}

export function AdminNotificationsDropdown({
  items,
  unreadCount,
  allHref,
  className,
}: AdminNotificationsDropdownProps): React.ReactElement {
  const count = unreadCount ?? items.length;
  const displayed = items.slice(0, 5);
  return (
    <details className={cn("admin-notifications-dropdown group relative", className)}>
      <summary
        className={cn(
          "relative flex cursor-pointer list-none items-center justify-center",
          "rounded-[var(--radius-admin-sm)]",
          "px-[var(--space-admin-3)] py-[var(--space-admin-2)]",
          "text-[color:var(--color-admin-fg-soft)] hover:bg-[color:var(--color-admin-surface-hover)]",
          "min-h-[var(--target-admin-min-desktop)] min-w-[var(--target-admin-min-desktop)]",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-info)] focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
        aria-label={count > 0 ? `Notifications (${count} non lues)` : "Notifications"}
      >
        <Bell size={16} aria-hidden="true" />
        {count > 0 ? (
          <span
            className={cn(
              "absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center",
              "rounded-full bg-[color:var(--color-admin-destructive)]",
              "px-[3px] text-[10px] font-semibold text-white",
            )}
            aria-hidden="true"
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </summary>
      <div
        className={cn(
          "absolute right-0 z-[var(--z-admin-dropdown)] mt-[var(--space-admin-2)] w-[320px]",
          "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]",
          "bg-[color:var(--color-admin-paper)] shadow-[var(--shadow-admin-3)]",
        )}
      >
        <header
          className={cn(
            "flex items-center justify-between border-b border-[color:var(--color-admin-border)]",
            "px-[var(--space-admin-5)] py-[var(--space-admin-4)]",
          )}
        >
          <strong className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            Notifications
          </strong>
          {count > 0 ? (
            <AdminBadge tone="destructive" compact>
              {count}
            </AdminBadge>
          ) : null}
        </header>
        {displayed.length === 0 ? (
          <div
            className={cn(
              "px-[var(--space-admin-5)] py-[var(--space-admin-6)] text-center",
              "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]",
            )}
          >
            Aucune notification.
          </div>
        ) : (
          <ul className="max-h-[300px] overflow-y-auto">
            {displayed.map((it) => (
              <li key={it.id}>
                <Link
                  href={it.href}
                  className={cn(
                    "flex flex-col gap-[var(--space-admin-1)]",
                    "border-b border-[color:var(--color-admin-border)] last:border-b-0",
                    "px-[var(--space-admin-5)] py-[var(--space-admin-4)]",
                    "hover:bg-[color:var(--color-admin-surface-hover)]",
                  )}
                >
                  <div className="flex items-center gap-[var(--space-admin-3)]">
                    <AdminBadge tone={it.severity} compact>
                      {it.severity}
                    </AdminBadge>
                    <span
                      className={cn(
                        "text-[length:var(--text-admin-sm)] font-medium",
                        "text-[color:var(--color-admin-fg)]",
                      )}
                    >
                      {it.title}
                    </span>
                  </div>
                  {it.description ? (
                    <p
                      className={cn(
                        "text-[length:var(--text-admin-xs)]",
                        "text-[color:var(--color-admin-fg-soft)]",
                      )}
                    >
                      {it.description}
                    </p>
                  ) : null}
                  <time
                    className={cn(
                      "text-[length:var(--text-admin-xs)]",
                      "text-[color:var(--color-admin-fg-muted)]",
                    )}
                    dateTime={it.createdAt}
                  >
                    {new Date(it.createdAt).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <footer
          className={cn(
            "border-t border-[color:var(--color-admin-border)]",
            "px-[var(--space-admin-5)] py-[var(--space-admin-4)]",
          )}
        >
          <Link
            href={allHref}
            className={cn(
              "text-[length:var(--text-admin-sm)] font-medium",
              "text-[color:var(--color-admin-info)] hover:underline",
            )}
          >
            Voir toutes →
          </Link>
        </footer>
      </div>
    </details>
  );
}
