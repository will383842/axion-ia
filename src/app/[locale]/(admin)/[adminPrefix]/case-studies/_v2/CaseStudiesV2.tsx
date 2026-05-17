// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Case studies V2 (liste) — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

interface CaseStudyRow {
  id: string;
  status: string;
  publishedAt: Date | null;
  sector: string;
  region: string | null;
  companySizeRange: string;
  roiWeeks: number | null;
  translations: ReadonlyArray<{ title: string; slug: string }>;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<CaseStudyRow>;
  total: number;
  page: number;
  totalPages: number;
}

export function CaseStudiesV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Cas concrets"
        description={`${total} cas concret${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <Link href={`/fr/${adminPrefix}/case-studies/new`} className="admin-button">
            + Nouveau cas concret
          </Link>
        }
      />

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
              <label htmlFor="sector" className="admin-label">
                Secteur
              </label>
              <input
                id="sector"
                name="sector"
                type="text"
                defaultValue={sp["sector"] ?? ""}
                className="admin-input"
                placeholder="ex: Industrie"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Recherche (titre)
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
            <Link href={`/fr/${adminPrefix}/case-studies`} className="admin-button-ghost">
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
                <th>Date publi</th>
                <th>Titre (FR)</th>
                <th>Secteur</th>
                <th>Région</th>
                <th>Taille</th>
                <th>ROI</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-table-empty">
                    Aucun cas concret trouvé.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.publishedAt ? c.publishedAt.toISOString().slice(0, 10) : "—"}</td>
                    <td>
                      <div>{c.translations[0]?.title ?? "(sans titre)"}</div>
                      <code className="admin-meta-small">{c.translations[0]?.slug ?? ""}</code>
                    </td>
                    <td>{c.sector}</td>
                    <td>{c.region ?? "—"}</td>
                    <td>{c.companySizeRange}</td>
                    <td>{c.roiWeeks ? `${c.roiWeeks} sem.` : "—"}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${c.status}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/fr/${adminPrefix}/case-studies/${c.id}`} className="admin-link">
                        Éditer →
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
