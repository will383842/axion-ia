// Refonte admin mai 2026 — PR 5 (ADR 0028, audit A1 finding #5 / #7 / #9).
//
// Topbar contextuelle : brand + breadcrumbs + cmdk trigger + notifications
// + user menu. Sticky en haut. Server Component wrapper (les enfants
// peuvent être client).

import { cn } from "@/lib/utils";

interface AdminTopbarProps {
  /** Brand (logo + nom). */
  brand?: React.ReactNode;
  /** <AdminBreadcrumbs> ou équivalent. */
  breadcrumbs?: React.ReactNode;
  /** Bouton/zone command palette trigger (Cmd+K). */
  commandPalette?: React.ReactNode;
  /** <AdminNotificationsDropdown>. */
  notifications?: React.ReactNode;
  /** <AdminUserMenu>. */
  userMenu?: React.ReactNode;
  className?: string;
}

export function AdminTopbar({
  brand,
  breadcrumbs,
  commandPalette,
  notifications,
  userMenu,
  className,
}: AdminTopbarProps): React.ReactElement {
  return (
    <header
      className={cn(
        "admin-topbar sticky top-0 z-[var(--z-admin-sticky)]",
        "border-b border-[color:var(--color-admin-border)]",
        "bg-[color:var(--color-admin-paper)]/95 backdrop-blur",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-[1280px] items-center justify-between gap-[var(--space-admin-5)]",
          "px-[var(--space-admin-6)] py-[var(--space-admin-4)]",
        )}
      >
        <div className="flex min-w-0 items-center gap-[var(--space-admin-5)]">
          {brand ? <div className="shrink-0">{brand}</div> : null}
          {breadcrumbs ? <div className="min-w-0">{breadcrumbs}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-[var(--space-admin-3)]">
          {commandPalette}
          {notifications}
          {userMenu}
        </div>
      </div>
    </header>
  );
}
