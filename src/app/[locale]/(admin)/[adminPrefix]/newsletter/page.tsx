// Listing newsletter subscribers admin (M9 Tier 3 section 1).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listSubscribersAction,
  getNewsletterStatsAction,
} from "@/features/admin-newsletter/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  unsubscribed: "Désabonné",
  bounced: "Bounce",
};

export default async function NewsletterListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [result, stats] = await Promise.all([
    listSubscribersAction({
      status: sp.status as never,
      locale: sp.locale as never,
      source: sp.source,
      search: sp.search,
      dateFrom: sp.dateFrom,
      dateTo: sp.dateTo,
      page: sp.page ? parseInt(sp.page, 10) : 1,
    }),
    getNewsletterStatsAction(),
  ]);

  const csvUrl = `/api/admin/newsletter/export?${new URLSearchParams({
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.locale ? { locale: sp.locale } : {}),
    ...(sp.source ? { source: sp.source } : {}),
  }).toString()}`;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Newsletter</h1>
          <p className="admin-meta">
            {result.total} abonné{result.total > 1 ? "s" : ""} • page {result.page}/
            {result.totalPages}
          </p>
        </div>
        <a href={csvUrl} className="admin-button-ghost" download>
          Exporter CSV (confirmés)
        </a>
      </div>

      {/* Stats grille */}
      <div className="admin-kpi-grid">
        <div className="admin-card">
          <p className="admin-card-label">Confirmés FR</p>
          <p className="admin-kpi-value">{stats.confirmed?.fr ?? 0}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">Confirmés EN</p>
          <p className="admin-kpi-value">{stats.confirmed?.en ?? 0}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">En attente (double opt-in)</p>
          <p className="admin-kpi-value">{(stats.pending?.fr ?? 0) + (stats.pending?.en ?? 0)}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">Désabonnés</p>
          <p className="admin-kpi-value">
            {(stats.unsubscribed?.fr ?? 0) + (stats.unsubscribed?.en ?? 0)}
          </p>
        </div>
      </div>

      <div className="admin-card admin-filters">
        <form className="admin-filters-grid">
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
            <label htmlFor="locale" className="admin-label">
              Locale
            </label>
            <select
              id="locale"
              name="locale"
              defaultValue={sp.locale ?? "all"}
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
              defaultValue={sp.search ?? ""}
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
              defaultValue={sp.source ?? ""}
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
              defaultValue={sp.dateFrom ?? ""}
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
              defaultValue={sp.dateTo ?? ""}
              className="admin-input"
            />
          </div>
        </form>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Appliquer
          </button>
          <a href={`/fr/${adminPrefix}/newsletter`} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
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
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-table-empty">
                  Aucun abonné trouvé.
                </td>
              </tr>
            ) : (
              result.items.map((s) => (
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
    </section>
  );
}
