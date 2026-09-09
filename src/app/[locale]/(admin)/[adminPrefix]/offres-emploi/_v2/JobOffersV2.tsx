// Liste admin des offres d'emploi — AdminPageShell + AdminCard + <AdminTable>
// (miroir de FaqV2). Colonne « Candidatures » = compteur + lien filtré.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badges → <AdminBadge>. Le formulaire de filtres garde les classes
// utilitaires admin.css (legit — pas de composant filtre dédié).

import Link from "next/link";
import { WORKMODE_LABELS as WORKMODE_LABELS_SSOT } from "@/lib/careers/format";
import { ArrowRight, TriangleAlert } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
  AdminButton,
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import type { JobOfferListItem } from "@/features/admin-job-offers/actions";
import type { StaleJobPosting } from "@/server/careers/freshness";
import { CAREER_CATEGORIES, careerCategoryLabel } from "@/content/careers/categories";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

// Date de publication effective (celle du JSON-LD Google) + âge en jours.
// Rendu serveur uniquement → Intl est stable (pas d'hydration mismatch).
const DATE_FR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
function postedCell(postedAt: Date): React.ReactElement {
  const days = Math.max(0, Math.floor((Date.now() - postedAt.getTime()) / 86_400_000));
  return (
    <>
      {DATE_FR.format(postedAt)}
      <span className="admin-meta-small"> · {days} j</span>
    </>
  );
}
// Dérivé de la SSOT (`format.ts`) : la console disait « À distance » là où le
// site public disait « Remote ». Un seul mot, un seul endroit.
const WORKMODE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(WORKMODE_LABELS_SSOT).map(([k, v]) => [k, v.fr]),
);
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
  /** Offres à republier (fraîcheur Google for Jobs) — bandeau d'alerte. */
  staleOffers?: ReadonlyArray<StaleJobPosting>;
}

export function JobOffersV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
  staleOffers = [],
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
      key: "posted",
      header: "Publiée le",
      cell: (o) => postedCell(o.postedAt),
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
            href={`/fr/${adminPrefix}/contacts/candidatures?offerId=${o.id}`}
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

      {/* Bandeau fraîcheur Google for Jobs : offres dont la date de publication
          effective dépasse 45 j. Republier = clic HUMAIN (fiche offre) après
          avoir vérifié que l'offre est toujours ouverte — jamais automatique
          (fausse fraîcheur = pénalité Google). Les offres statiques (pages hors
          DB) se republient par une modif de code. */}
      {staleOffers.length > 0 ? (
        <AdminCard className="mb-[var(--space-admin-5)]">
          <p className="admin-label flex items-center gap-2" role="alert">
            <TriangleAlert size={16} aria-hidden="true" className="shrink-0" />
            {staleOffers.length} offre{staleOffers.length > 1 ? "s" : ""} à republier — la date vue
            par Google dépasse 45 jours, l&apos;offre devient invisible dans les filtres « récent »
            de Google for Jobs.
          </p>
          <ul className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-2)]">
            {staleOffers.map((o) => (
              <li key={`${o.kind}-${o.slug}`} className="admin-meta-small">
                {o.kind === "db" && o.id ? (
                  <Link href={`/fr/${adminPrefix}/offres-emploi/${o.id}`} className="admin-link">
                    {o.title}
                  </Link>
                ) : (
                  <>
                    {o.title} <span className="admin-meta-small">(page statique — modif code)</span>
                  </>
                )}{" "}
                · {o.daysOld} jours — si toujours ouverte : relire puis « Republier » sur la fiche.
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}

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
            <button type="submit" className="admin-button-ghost">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/offres-emploi`} className="admin-button-secondary">
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
            <AdminButton
              href={`/fr/${adminPrefix}/offres-emploi/${o.id}`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Éditer
            </AdminButton>
          )}
        />
      )}

      {/* 🔴 Même défaut que la newsletter : `page` et `totalPages` reçus,
          affichés dans le sous-titre (« page 1/3 »), et aucun contrôle rendu.
          Les offres au-delà de la cinquantième étaient inatteignables sans
          éditer l'URL. Les filtres sont préservés dans les liens. */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={`/fr/${adminPrefix}/offres-emploi`}
        preservedParams={{
          category: sp["category"],
          status: sp["status"],
          search: sp["search"],
        }}
      />
    </AdminPageShell>
  );
}
