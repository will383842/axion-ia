// Refonte admin mai 2026 — PR 11 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Activity logs V2 — AdminPageShell + AdminPageHeader + AdminCard. Read-only.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";

interface LogRow {
  id: string;
  createdAt: Date;
  adminUser: { name: string; email: string } | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  changes: unknown;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface StatRow {
  action: string;
  count: number;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<LogRow>;
  total: number;
  page: number;
  totalPages: number;
  users: ReadonlyArray<UserOption>;
  stats: ReadonlyArray<StatRow>;
}

export function ActivityLogsV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
  users,
  stats,
}: Props): React.ReactElement {
  const columns: ReadonlyArray<AdminTableColumn<LogRow>> = [
    {
      key: "date",
      header: "Date",
      cell: (l) => (
        <>
          <div>{l.createdAt.toISOString().slice(0, 10)}</div>
          <div className="admin-meta-small">{l.createdAt.toISOString().slice(11, 19)}</div>
        </>
      ),
    },
    {
      key: "user",
      header: "Utilisateur",
      cell: (l) =>
        l.adminUser ? (
          <>
            <div>{l.adminUser.name}</div>
            <div className="admin-meta-small">{l.adminUser.email}</div>
          </>
        ) : (
          <span className="admin-meta-small">—</span>
        ),
    },
    {
      key: "action",
      header: "Action",
      cell: (l) => <code className="admin-meta-small">{l.action}</code>,
    },
    { key: "targetType", header: "Type cible", cell: (l) => l.targetType ?? "—" },
    {
      key: "targetId",
      header: "Target ID",
      cell: (l) =>
        l.targetId ? <code className="admin-meta-small">{l.targetId.slice(0, 8)}…</code> : "—",
    },
    {
      key: "ip",
      header: "IP",
      cell: (l) => <span className="admin-meta-small">{l.ipAddress ?? "—"}</span>,
    },
    {
      key: "changes",
      header: "Changements",
      cell: (l) =>
        l.changes ? (
          <pre className="admin-json admin-json-cell">{JSON.stringify(l.changes, null, 2)}</pre>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Activity logs"
        description={`${total} entrée${total > 1 ? "s" : ""} · page ${page}/${totalPages} · Read-only audit trail`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
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
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="adminUserId" className="admin-label">
                Utilisateur
              </label>
              <select
                id="adminUserId"
                name="adminUserId"
                defaultValue={sp["adminUserId"] ?? ""}
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
                defaultValue={sp["action"] ?? ""}
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
                defaultValue={sp["targetType"] ?? ""}
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
                defaultValue={sp["search"] ?? ""}
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
                defaultValue={sp["dateFrom"] ?? ""}
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
                defaultValue={sp["dateTo"] ?? ""}
                className="admin-input"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/activity-logs`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucune entrée trouvée." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(l) => l.id}
          caption="Journal d'audit"
        />
      )}
    </AdminPageShell>
  );
}
