// Liste admin des offres d'emploi — AdminPageShell + AdminCard + <AdminTable>
// (miroir de FaqV2). Colonne « Candidatures » = compteur + lien filtré.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badges → <AdminBadge>. Le formulaire de filtres garde les classes
// utilitaires admin.css (legit — pas de composant filtre dédié).

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
import type { JobOfferListItem } from "@/features/admin-job-offers/actions";
import { CAREER_CATEGORIES, careerCategoryLabel } from "@/content/careers/categories";

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
// Track 2 : tonalité du badge dérivée du statut (avant : `.admin-badge-${status}`
// non défini pour draft/published/archived → badge neutre non coloré).
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  published: "success",
  open: "success",
  active: "success",
  draft: "warning",
  closed: "neutral",
  archived: "neutral",
  filled: "neutral",
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
  const columns: ReadonlyArray<AdminTableColumn<JobOfferListItem>> = [
    { key: "order", header: "Ordre", cell: (o) => o.displayOrder },
    { key: "category", header: "Catégorie", cell: (o) => careerCategoryLabel(o.category, true) },
    {
      key: "title",
      header: "Titre (FR)",
      cell: (o) => (
        <>
          {o.titleFr}
          {o.filledAt ? <span className="admin-meta-small"> · pourvu</span> : null}
        </>
      ),
    },
    {
      key: "location",
      header: "Lieu",
      cell: (o) => o.city ?? WORKMODE_LABELS[o.workMode] ?? "—",
    },
    {
      key: "status",
      header: "Statut",
      cell: (o) => (
        <AdminBadge tone={STATUS_TONE[o.status] ?? "neutral"}>
          {STATUS_LABELS[o.status] ?? o.status}
        </AdminBadge>
      ),
    },
    {
      key: "applications",
      header: "Candidatures",
      cell: (o) =>
        o.applicationsCount > 0 ? (
          <Link
            href={`/fr/${adminPrefix}/candidatures?offerId=${o.id}`}
            className="admin-link"
          >
            {o.applicationsCount}
          </Link>
        ) : (
          "0"
        ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Offres d'emploi"
        description={`${total} offre${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <Link href={`/fr/${adminPrefix}/offres-emploi/new`} className="admin-button">
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
            <Link href={`/fr/${adminPrefix}/offres-emploi`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucune offre trouvée." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(o) => o.id}
          caption="Liste des offres d'emploi"
          rowAction={(o) => (
            <Link href={`/fr/${adminPrefix}/offres-emploi/${o.id}`} className="admin-link">
              Éditer →
            </Link>
          )}
        />
      )}
    </AdminPageShell>
  );
}
