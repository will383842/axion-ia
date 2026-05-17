// Refonte admin mai 2026 — PR 5 (ADR 0028, audit A1 finding #7).
//
// Dropdown menu utilisateur admin (header) : email + 2FA status +
// settings + logout. Server Component wrapper qui rend un détails/
// summary natif (a11y by default), pas de Radix pour rester serveur-safe
// et minimiser le JS.
//
// Le logout est une Server Action existante (à passer en prop href).

import Link from "next/link";
import { User as UserIcon, LogOut, Shield, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminUserMenuProps {
  email: string;
  /** Bool si l'utilisateur a 2FA actif. */
  twoFactorEnabled?: boolean;
  /** Href base admin (ex. /fr/<adminPrefix>). */
  adminBase: string;
  /** URL logout (Server Action côté consumer). */
  logoutHref?: string;
  className?: string;
}

export function AdminUserMenu({
  email,
  twoFactorEnabled = false,
  adminBase,
  logoutHref,
  className,
}: AdminUserMenuProps): React.ReactElement {
  return (
    <details className={cn("admin-user-menu group relative", className)}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-[var(--space-admin-2)]",
          "rounded-[var(--radius-admin-sm)]",
          "px-[var(--space-admin-3)] py-[var(--space-admin-2)]",
          "text-[length:var(--text-admin-sm)]",
          "text-[color:var(--color-admin-fg)] hover:bg-[color:var(--color-admin-surface-hover)]",
          "min-h-[var(--target-admin-min-desktop)]",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-info)] focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
        aria-label={`Menu utilisateur — ${email}`}
      >
        <UserIcon size={16} aria-hidden="true" />
        <span className="hidden truncate sm:inline">{email}</span>
      </summary>
      <div
        className={cn(
          "absolute right-0 z-[var(--z-admin-dropdown)] mt-[var(--space-admin-2)] w-[260px]",
          "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]",
          "bg-[color:var(--color-admin-paper)] shadow-[var(--shadow-admin-3)]",
          "p-[var(--space-admin-3)]",
        )}
      >
        <div
          className={cn(
            "px-[var(--space-admin-3)] py-[var(--space-admin-2)]",
            "text-[length:var(--text-admin-xs)]",
            "text-[color:var(--color-admin-fg-muted)]",
          )}
        >
          Connecté en tant que
          <div className="mt-[var(--space-admin-1)] truncate font-medium text-[color:var(--color-admin-fg)]">
            {email}
          </div>
        </div>
        <hr className="my-[var(--space-admin-2)] border-[color:var(--color-admin-border)]" />
        <Link
          href={`${adminBase}/2fa/setup`}
          className={cn(
            "flex items-center gap-[var(--space-admin-3)]",
            "rounded-[var(--radius-admin-sm)] px-[var(--space-admin-3)] py-[var(--space-admin-3)]",
            "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]",
            "hover:bg-[color:var(--color-admin-surface-hover)]",
            "min-h-[var(--target-admin-min-desktop)]",
          )}
        >
          <Shield size={16} aria-hidden="true" />
          <span>2FA — {twoFactorEnabled ? "activé" : "configurer"}</span>
        </Link>
        <Link
          href={`${adminBase}/settings`}
          className={cn(
            "flex items-center gap-[var(--space-admin-3)]",
            "rounded-[var(--radius-admin-sm)] px-[var(--space-admin-3)] py-[var(--space-admin-3)]",
            "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]",
            "hover:bg-[color:var(--color-admin-surface-hover)]",
            "min-h-[var(--target-admin-min-desktop)]",
          )}
        >
          <Settings size={16} aria-hidden="true" />
          <span>Paramètres</span>
        </Link>
        {logoutHref ? (
          <>
            <hr className="my-[var(--space-admin-2)] border-[color:var(--color-admin-border)]" />
            <a
              href={logoutHref}
              className={cn(
                "flex items-center gap-[var(--space-admin-3)]",
                "rounded-[var(--radius-admin-sm)] px-[var(--space-admin-3)] py-[var(--space-admin-3)]",
                "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]",
                "hover:bg-[color:var(--color-admin-destructive-soft)]",
                "min-h-[var(--target-admin-min-desktop)]",
              )}
            >
              <LogOut size={16} aria-hidden="true" />
              <span>Se déconnecter</span>
            </a>
          </>
        ) : null}
      </div>
    </details>
  );
}
