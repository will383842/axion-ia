// Listing activity logs admin (M9 Tier 3 section 4 — DERNIERE, read-only).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listActivityLogsAction,
  listAdminUsersOptionsAction,
  getActivityLogStatsAction,
} from "@/features/admin-activity-logs/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ActivityLogsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [result, users, stats] = await Promise.all([
    listActivityLogsAction({
      adminUserId: sp.adminUserId,
      action: sp.action,
      targetType: sp.targetType,
      search: sp.search,
      dateFrom: sp.dateFrom,
      dateTo: sp.dateTo,
      page: sp.page ? parseInt(sp.page, 10) : 1,
    }),
    listAdminUsersOptionsAction(),
    getActivityLogStatsAction(),
  ]);

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Activity logs</h1>
          <p className="admin-meta">
            {result.total} entrée{result.total > 1 ? "s" : ""} • page {result.page}/
            {result.totalPages} • Read-only audit trail
          </p>
        </div>
      </div>

      <div className="admin-card admin-meta-block">
        <h2 className="admin-h2">Top 20 actions enregistrées</h2>
        <div className="admin-tags-grid">
          {stats.length === 0 ? (
            <p className="admin-meta-small">Aucune action enregistrée.</p>
          ) : (
            stats.map((s) => (
              <span key={s.action} className="admin-tag-checkbox">
                <code>{s.action}</code>
                <strong>{s.count}</strong>
              </span>
            ))
          )}
        </div>
      </div>

      <div className="admin-card admin-filters">
        <form className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="adminUserId" className="admin-label">
              Utilisateur
            </label>
            <select
              id="adminUserId"
              name="adminUserId"
              defaultValue={sp.adminUserId ?? ""}
              className="admin-input"
            >
              <option value="">Tous</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="action" className="admin-label">
              Action (contient)
            </label>
            <input
              id="action"
              name="action"
              type="text"
              defaultValue={sp.action ?? ""}
              className="admin-input"
              placeholder="ex: option.validated"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="targetType" className="admin-label">
              Type cible
            </label>
            <select
              id="targetType"
              name="targetType"
              defaultValue={sp.targetType ?? ""}
              className="admin-input"
            >
              <option value="">Tous</option>
              <option value="article">article</option>
              <option value="case_study">case_study</option>
              <option value="help_article">help_article</option>
              <option value="testimonial">testimonial</option>
              <option value="faq">faq</option>
              <option value="category">category</option>
              <option value="booking_option">booking_option</option>
              <option value="calendar_slot">calendar_slot</option>
              <option value="submission">submission</option>
              <option value="newsletter_subscriber">newsletter_subscriber</option>
              <option value="setting">setting</option>
              <option value="admin_user">admin_user</option>
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="search" className="admin-label">
              Recherche (action / target / IP)
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
          <div className="admin-field">
            <label htmlFor="dateFrom" className="admin-label">
              Du
            </label>
            <input
              id="dateFrom"
              name="dateFrom"
              type="date"
              defaultValue={sp.dateFrom ?? ""}
              className="admin-input"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="dateTo" className="admin-label">
              Au
            </label>
            <input
              id="dateTo"
              name="dateTo"
              type="date"
              defaultValue={sp.dateTo ?? ""}
              className="admin-input"
            />
          </div>
        </form>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Appliquer
          </button>
          <a href={`/fr/${adminPrefix}/activity-logs`} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Type cible</th>
              <th>Target ID</th>
              <th>IP</th>
              <th>Changements</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-table-empty">
                  Aucune entrée trouvée.
                </td>
              </tr>
            ) : (
              result.items.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div>{l.createdAt.toISOString().slice(0, 10)}</div>
                    <div className="admin-meta-small">
                      {l.createdAt.toISOString().slice(11, 19)}
                    </div>
                  </td>
                  <td>
                    {l.adminUser ? (
                      <>
                        <div>{l.adminUser.name}</div>
                        <div className="admin-meta-small">{l.adminUser.email}</div>
                      </>
                    ) : (
                      <span className="admin-meta-small">—</span>
                    )}
                  </td>
                  <td>
                    <code className="admin-meta-small">{l.action}</code>
                  </td>
                  <td>{l.targetType ?? "—"}</td>
                  <td>
                    {l.targetId ? (
                      <code className="admin-meta-small">{l.targetId.slice(0, 8)}…</code>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="admin-meta-small">{l.ipAddress ?? "—"}</td>
                  <td>
                    {l.changes ? (
                      <pre className="admin-json admin-json-cell">
                        {JSON.stringify(l.changes, null, 2)}
                      </pre>
                    ) : (
                      "—"
                    )}
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
