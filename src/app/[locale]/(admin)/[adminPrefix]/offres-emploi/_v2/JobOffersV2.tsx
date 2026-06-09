// Liste admin des offres d'emploi — AdminPageShell + AdminCard + table CSS
// (miroir de FaqV2). Colonne « Candidatures » = compteur + lien filtré.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
} from "@/components/admin/ui";
import type { JobOfferListItem } from "@/features/admin-job-offers/actions";
import {
  CAREER_CATEGORIES,
  careerCategoryLabel,
} from "@/content/careers/categories";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};
const WORKMODE_LABELS: Record<string, string> = {
  on_site: "Sur site",
  hybrid: "Hybride",
  remote: "Remote",
};

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<JobOfferListItem>;
  total: number;
  page: number;
  totalPages: number;
}

export function JobOffersV2({
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
        title="Offres d'emploi"
        description={`${total} offre${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <Link
            href={`/fr/${adminPrefix}/offres-emploi/new`}
            className="admin-button"
          >
            + Nouvelle offre
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="category" className="admin-label">
                Catégorie
              </label>
              <select
                id="category"
                name="category"
                defaultValue={sp["category"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Toutes</option>
                {CAREER_CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.fr}
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
                Recherche
              </label>
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
                placeholder="Titre, slug…"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Appliquer
            </button>
            <Link
              href={`/fr/${adminPrefix}/offres-emploi`}
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
                <th>Ordre</th>
                <th>Catégorie</th>
                <th>Titre (FR)</th>
                <th>Lieu</th>
                <th>Statut</th>
                <th>Candidatures</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Aucune offre trouvée.
                  </td>
                </tr>
              ) : (
                items.map((o) => (
                  <tr key={o.id}>
                    <td>{o.displayOrder}</td>
                    <td>{careerCategoryLabel(o.category, true)}</td>
                    <td>
                      {o.titleFr}
                      {o.filledAt ? (
                        <span className="admin-meta-small"> · pourvu</span>
                      ) : null}
                    </td>
                    <td>{o.city ?? WORKMODE_LABELS[o.workMode] ?? "—"}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${o.status}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td>
                      {o.applicationsCount > 0 ? (
                        <Link
                          href={`/fr/${adminPrefix}/candidatures?offerId=${o.id}`}
                          className="admin-link"
                        >
                          {o.applicationsCount}
                        </Link>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/fr/${adminPrefix}/offres-emploi/${o.id}`}
                        className="admin-link"
                      >
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
