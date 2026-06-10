// Refonte admin mai 2026 — PR 5 (ADR 0028, audit A1 finding #5 / #7 / #9).
// Harmonisation rail mocha juin 2026 :
//   - Hauteur verrouillée à `--admin-topbar-h` → alignement pixel-perfect
//     avec l'épinglage de la sidebar (`top: var(--admin-topbar-h)`).
//   - Pleine largeur (plus de max-w centré) pour un shell cohérent flush
//     avec le rail à gauche et les contrôles calés à droite.
//   - Le brand n'est rendu qu'en mobile (le rail porte l'identité sur
//     desktop) — fin du doublon « Axion-IA ».
//
// Topbar contextuelle : brand (mobile) + breadcrumbs + cmdk trigger +
// notifications + user menu. Sticky en haut. Server Component wrapper
// (les enfants peuvent être client).

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
        "h-[var(--admin-topbar-h)]",
        "border-b border-[color:var(--color-admin-border)]",
        "bg-[color:var(--color-admin-paper)]/95 backdrop-blur",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-full items-center justify-between gap-[var(--space-admin-5)]",
          "px-[var(--space-admin-5)]",
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
