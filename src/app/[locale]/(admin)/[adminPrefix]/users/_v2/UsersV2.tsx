// Refonte admin mai 2026 — PR 11 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Users V2 — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

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
            <button type="submit" className="admin-button">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/users`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>2FA</th>
                <th>Dernier login</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${u.role}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge-${u.status}`}>
                        {STATUS_LABELS[u.status] ?? u.status}
                      </span>
                    </td>
                    <td>{u.twoFactorEnabled ? "✓" : "✗"}</td>
                    <td>{u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : "—"}</td>
                    <td>
                      <Link href={`/fr/${adminPrefix}/users/${u.id}`} className="admin-link">
                        Détail →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
