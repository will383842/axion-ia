// Listing utilisateurs admin (M9 Tier 3 section 3 — ordre §14).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAdminUsersAction } from "@/features/admin-users/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

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

export default async function UsersListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const callerRole = (session.user as { role?: string }).role;
  const isSuperAdmin = callerRole === "super_admin";

  const result = await listAdminUsersAction({
    role: sp.role as never,
    status: sp.status as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Utilisateurs admin</h1>
          <p className="admin-meta">
            {result.total} utilisateur{result.total > 1 ? "s" : ""} • page {result.page}/
            {result.totalPages}
          </p>
        </div>
        {isSuperAdmin && (
          <a href={`/fr/${adminPrefix}/users/new`} className="admin-button">
            + Nouvel utilisateur
          </a>
        )}
      </div>

      <div className="admin-card admin-meta-block">
        <p className="admin-meta">
          4 rôles : <strong>super_admin</strong> (gère tout, seul à pouvoir créer/changer rôle/
          reset 2FA cross-user) · <strong>admin</strong> (gère contenus + suspend) ·{" "}
          <strong>editor</strong> (édite contenus) · <strong>reader</strong> (lecture seule). 2FA
          TOTP obligatoire pour super_admin et admin (CLAUDE.md §15).
        </p>
      </div>

      <div className="admin-card admin-filters">
        <form className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="role" className="admin-label">
              Rôle
            </label>
            <select id="role" name="role" defaultValue={sp.role ?? "all"} className="admin-input">
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
              defaultValue={sp.status ?? "all"}
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
              defaultValue={sp.search ?? ""}
              className="admin-input"
              placeholder="Min 2 caractères"
            />
          </div>
        </form>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Appliquer
          </button>
          <a href={`/fr/${adminPrefix}/users`} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
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
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-table-empty">
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            ) : (
              result.items.map((u) => (
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
                    <a href={`/fr/${adminPrefix}/users/${u.id}`} className="admin-link">
                      Détail →
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
