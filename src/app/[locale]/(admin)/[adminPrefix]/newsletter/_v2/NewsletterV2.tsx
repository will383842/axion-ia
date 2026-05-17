// Refonte admin mai 2026 — PR 10 (ADR 0028 IMPLEMENTATION-PLAN.md).
//
// Newsletter V2 — AdminPageShell + AdminPageHeader + AdminCard + AdminStatCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  unsubscribed: "Désabonné",
  bounced: "Bounce",
};

interface SubscriberRow {
  id: string;
  email: string;
  locale: string;
  status: string;
  source: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
}

interface Stats {
  confirmed?: { fr?: number; en?: number };
  pending?: { fr?: number; en?: number };
  unsubscribed?: { fr?: number; en?: number };
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<SubscriberRow>;
  total: number;
  page: number;
  totalPages: number;
  stats: Stats;
  csvUrl: string;
}

export function NewsletterV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
  stats,
  csvUrl,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Newsletter"
        description={`${total} abonné${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <a href={csvUrl} className="admin-button-ghost" download>
            Exporter CSV (confirmés)
          </a>
        }
      />

      <section
        aria-label="KPIs newsletter"
        className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <AdminStatCard label="Confirmés FR" value={stats.confirmed?.fr ?? 0} />
        <AdminStatCard label="Confirmés EN" value={stats.confirmed?.en ?? 0} />
        <AdminStatCard
          label="En attente (double opt-in)"
          value={(stats.pending?.fr ?? 0) + (stats.pending?.en ?? 0)}
        />
        <AdminStatCard
          label="Désabonnés"
          value={(stats.unsubscribed?.fr ?? 0) + (stats.unsubscribed?.en ?? 0)}
        />
      </section>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
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
              <label htmlFor="locale" className="admin-label">
                Locale
              </label>
              <select
                id="locale"
                name="locale"
                defaultValue={sp["locale"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Toutes</option>
                <option value="fr">FR</option>
                <option value="en">EN</option>
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Email
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
              <label htmlFor="source" className="admin-label">
                Source
              </label>
              <input
                id="source"
                name="source"
                type="text"
                defaultValue={sp["source"] ?? ""}
                className="admin-input"
                placeholder="ex: footer, blog-cta…"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="dateFrom" className="admin-label">
                Inscrit du
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
                Inscrit au
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
            <Link href={`/fr/${adminPrefix}/newsletter`} className="admin-button-ghost">
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
                <th>Date inscription</th>
                <th>Email</th>
                <th>Locale</th>
                <th>Statut</th>
                <th>Source</th>
                <th>Confirmé le</th>
                <th>Désabonné le</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Aucun abonné trouvé.
                  </td>
                </tr>
              ) : (
                items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.createdAt.toISOString().slice(0, 10)}</td>
                    <td>{s.email}</td>
                    <td>{s.locale.toUpperCase()}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${s.status}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td>{s.source ?? "—"}</td>
                    <td>{s.confirmedAt ? s.confirmedAt.toISOString().slice(0, 10) : "—"}</td>
                    <td>{s.unsubscribedAt ? s.unsubscribedAt.toISOString().slice(0, 10) : "—"}</td>
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
