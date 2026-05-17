// Listing soumissions admin (M9 Tier 1 section 1).
//
// Filtres URL params : ?type=&status=&locale=&search=&dateFrom=&dateTo=&page=
// SubmissionFilters (client) navigate via useRouter.push pour preserver l'URL.

import { listSubmissionsAction } from "@/features/admin-submissions/actions";
import { SubmissionFilters } from "./SubmissionFilters";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { SubmissionsV2 } from "./_v2/SubmissionsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const TYPE_LABELS: Record<string, string> = {
  audit: "Audit",
  implementation: "Implémentation",
  intervention: "Intervention",
  contact: "Contact",
};
const STATUS_LABELS: Record<string, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  processed: "Traité",
  archived: "Archivé",
};

export default async function SubmissionsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  if (await isAdminV2Enabled()) {
    return <SubmissionsV2 adminPrefix={adminPrefix} searchParams={sp} />;
  }

  const result = await listSubmissionsAction({
    type: sp.type as never,
    status: sp.status as never,
    locale: sp.locale as never,
    search: sp.search,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    page: sp.page ? parseInt(sp.page, 10) : 1,
    pageSize: 25,
  });

  const csvUrl = `/api/admin/submissions/export?${new URLSearchParams({
    ...(sp.type ? { type: sp.type } : {}),
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.locale ? { locale: sp.locale } : {}),
  }).toString()}`;

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Soumissions</h1>
          <p className="admin-meta">
            {result.total} soumission{result.total > 1 ? "s" : ""} • page {result.page}/
            {result.totalPages}
          </p>
        </div>
        <a href={csvUrl} className="admin-button-ghost" download>
          Exporter CSV
        </a>
      </div>

      <SubmissionFilters initial={sp} />

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Société</th>
              <th>Contact</th>
              <th>Locale</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-table-empty">
                  Aucune soumission trouvée.
                </td>
              </tr>
            ) : (
              result.items.map((s) => (
                <tr key={s.id}>
                  <td>{s.submittedAt.toISOString().slice(0, 10)}</td>
                  <td>{TYPE_LABELS[s.type] ?? s.type}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${s.status}`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                  <td>{s.companyName}</td>
                  <td>
                    <div>{s.contactName}</div>
                    <div className="admin-meta-small">{s.contactEmail}</div>
                  </td>
                  <td>{s.locale.toUpperCase()}</td>
                  <td>
                    <a href={`/fr/${adminPrefix}/submissions/${s.id}`} className="admin-link">
                      Détail →
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {result.totalPages > 1 && (
        <nav className="admin-pagination" aria-label="Pagination">
          {result.page > 1 && (
            <a href={buildPageUrl(adminPrefix, sp, result.page - 1)} className="admin-button-ghost">
              ← Précédent
            </a>
          )}
          <span className="admin-pagination-info">
            Page {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <a href={buildPageUrl(adminPrefix, sp, result.page + 1)} className="admin-button-ghost">
              Suivant →
            </a>
          )}
        </nav>
      )}
    </section>
  );
}

function buildPageUrl(
  adminPrefix: string,
  sp: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "page") params.set(k, v);
  }
  params.set("page", String(page));
  return `/fr/${adminPrefix}/submissions?${params.toString()}`;
}
