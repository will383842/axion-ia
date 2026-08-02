// Refonte admin mai 2026 — PR 11 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Users V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badges → <AdminBadge>. Le formulaire de filtres garde les classes
// utilitaires admin.css (legit — pas de composant filtre dédié).

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
  AdminButton,
  AdminEtatBooleen,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { formatDateFrShort } from "@/lib/format-date-fr";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Éditeur",
  reader: "Lecteur",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
};
// Track 2 : tonalité des badges dérivée des enums (avant : `.admin-badge-${role}`
// / `.admin-badge-${status}` non définis → badge neutre non coloré).
const ROLE_TONE: Record<string, "info" | "neutral"> = {
  super_admin: "info",
  admin: "info",
  editor: "neutral",
  reader: "neutral",
};
const STATUS_TONE: Record<string, "success" | "neutral"> = {
  active: "success",
  suspended: "neutral",
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<UserRow>;
  total: number;
  page: number;
  totalPages: number;
  isSuperAdmin: boolean;
}

export function UsersV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
  isSuperAdmin,
}: Props): React.ReactElement {
  const columns: ReadonlyArray<AdminTableColumn<UserRow>> = [
    { key: "name", header: "Nom", cell: (u) => u.name },
    { key: "email", header: "Email", cell: (u) => u.email },
    {
      key: "role",
      header: "Rôle",
      cell: (u) => (
        <AdminBadge tone={ROLE_TONE[u.role] ?? "neutral"}>
          {ROLE_LABELS[u.role] ?? u.role}
        </AdminBadge>
      ),
    },
    {
      key: "status",
      header: "Statut",
      cell: (u) => (
        <AdminBadge tone={STATUS_TONE[u.status] ?? "neutral"}>
          {STATUS_LABELS[u.status] ?? u.status}
        </AdminBadge>
      ),
    },
    {
      key: "twoFactor",
      header: "2FA",
      cell: (u) => (
        <AdminEtatBooleen
          actif={u.twoFactorEnabled}
          libelles={{ vrai: "2FA activée", faux: "2FA désactivée" }}
        />
      ),
    },
    {
      key: "lastLogin",
      header: "Dernier login",
      cell: (u) => formatDateFrShort(u.lastLoginAt),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Utilisateurs admin"
        description={`${total} utilisateur${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          isSuperAdmin ? (
            <Link href={`/fr/${adminPrefix}/users/new`} className="admin-button">
              + Nouvel utilisateur
            </Link>
          ) : undefined
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <p className="admin-meta">
          4 rôles : <strong>super_admin</strong> (gère tout, seul à pouvoir créer/changer rôle/
          reset 2FA cross-user) · <strong>admin</strong> (gère contenus + suspend) ·{" "}
          <strong>editor</strong> (édite contenus) · <strong>reader</strong> (lecture seule). 2FA
          TOTP obligatoire pour super_admin et admin (CLAUDE.md §15).
        </p>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="role" className="admin-label">
                Rôle
              </label>
              <select
                id="role"
                name="role"
                defaultValue={sp["role"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Tous</option>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="status" className="admin-label">
                Statut
              </label>
              <select
                id="status"
                name="status"
                defaultValue={sp["status"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Tous</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Recherche (nom/email)
              </label>
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
                placeholder="Min 2 caractères"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button-secondary">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/users`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucun utilisateur trouvé." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(u) => u.id}
          caption="Liste des utilisateurs admin"
          rowAction={(u) => (
            <AdminButton
              href={`/fr/${adminPrefix}/users/${u.id}`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Détail
            </AdminButton>
          )}
        />
      )}
    </AdminPageShell>
  );
}
