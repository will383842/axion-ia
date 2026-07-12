// Liste admin des candidatures emploi — AdminPageShell + AdminCard + table CSS.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badge statut → <AdminBadge>.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import type { JobApplicationListItem } from "@/features/admin-job-applications/actions";

const STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle",
  reviewing: "En revue",
  shortlisted: "Présélection",
  rejected: "Refusée",
  hired: "Recrutée",
  archived: "Archivée",
};
// Track 2 : tonalité du badge dérivée du statut (avant : `.admin-badge` neutre).
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  hired: "success",
  new: "warning",
  reviewing: "warning",
  shortlisted: "warning",
  rejected: "neutral",
  archived: "neutral",
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
  const columns: ReadonlyArray<AdminTableColumn<JobApplicationListItem>> = [
    { key: "date", header: "Date", cell: (a) => a.submittedAt.toISOString().slice(0, 10) },
    {
      key: "candidate",
      header: "Candidat",
      cell: (a) => (
        <>
          {a.contactName}
          {a.needsAttention ? <span className="admin-meta-small"> · à traiter</span> : null}
        </>
      ),
    },
    { key: "email", header: "Email", cell: (a) => a.contactEmail },
    { key: "offer", header: "Offre", cell: (a) => a.offerTitleSnap },
    { key: "cv", header: "CV", cell: (a) => (a.hasCv ? "📎" : "—") },
    {
      key: "status",
      header: "Statut",
      cell: (a) => (
        <AdminBadge tone={STATUS_TONE[a.status] ?? "neutral"}>
          {STATUS_LABELS[a.status] ?? a.status}
        </AdminBadge>
      ),
    },
  ];
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Candidatures emploi"
        description={`${total} candidature${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          {offerId ? <input type="hidden" name="offerId" value={offerId} /> : null}
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
            <Link href={`/fr/${adminPrefix}/contacts/candidatures`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucune candidature." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(a) => a.id}
          caption="Liste des candidatures emploi"
          rowAction={(a) => (
            <Link href={`/fr/${adminPrefix}/contacts/candidatures/${a.id}`} className="admin-link">
              Détail →
            </Link>
          )}
        />
      )}
    </AdminPageShell>
  );
}
