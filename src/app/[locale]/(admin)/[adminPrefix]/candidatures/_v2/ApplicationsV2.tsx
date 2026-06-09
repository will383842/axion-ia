// Liste admin des candidatures emploi — AdminPageShell + AdminCard + table CSS.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
} from "@/components/admin/ui";
import type { JobApplicationListItem } from "@/features/admin-job-applications/actions";

const STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle",
  reviewing: "En revue",
  shortlisted: "Présélection",
  rejected: "Refusée",
  hired: "Recrutée",
  archived: "Archivée",
};

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<JobApplicationListItem>;
  total: number;
  page: number;
  totalPages: number;
}

export function ApplicationsV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
}: Props): React.ReactElement {
  const offerId = sp["offerId"];
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Candidatures emploi"
        description={`${total} candidature${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          {offerId ? (
            <input type="hidden" name="offerId" value={offerId} />
          ) : null}
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
              <label htmlFor="attention" className="admin-label">
                À traiter
              </label>
              <select
                id="attention"
                name="attention"
                defaultValue={sp["attention"] ?? ""}
                className="admin-input"
              >
                <option value="">Toutes</option>
                <option value="1">À traiter seulement</option>
              </select>
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Appliquer
            </button>
            <Link
              href={`/fr/${adminPrefix}/candidatures`}
              className="admin-button-ghost"
            >
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
                <th>Date</th>
                <th>Candidat</th>
                <th>Email</th>
                <th>Offre</th>
                <th>CV</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Aucune candidature.
                  </td>
                </tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.submittedAt.toISOString().slice(0, 10)}</td>
                    <td>
                      {a.contactName}
                      {a.needsAttention ? (
                        <span className="admin-meta-small"> · à traiter</span>
                      ) : null}
                    </td>
                    <td>{a.contactEmail}</td>
                    <td>{a.offerTitleSnap}</td>
                    <td>{a.hasCv ? "📎" : "—"}</td>
                    <td>
                      <span className="admin-badge">
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/fr/${adminPrefix}/candidatures/${a.id}`}
                        className="admin-link"
                      >
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
