// Liste admin des candidatures — AdminPageShell + AdminCard + table CSS.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badge statut → <AdminBadge>.
// Sous-onglets 2026-08-13 : Toutes / Monteur vidéo / Apporteurs d’affaires. Les lignes
// sont des CandidatureUnifieeItem : les candidatures commerciales (Mémo
// Isère) viennent de la table Submission et pointent vers leur propre détail.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
  AdminButton,
  AdminEtatBooleen,
  AdminFilterTabs,
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import type { CandidatureUnifieeItem } from "@/features/admin-job-applications/actions";
// Date affichée en FR (audit UX : ISO brut "2026-07-31" illisible pour Will).
import { formatDateFrShort } from "@/lib/format-date-fr";

export type CandidaturesView = "all" | "monteur" | "memo" | "standard";

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

// Statuts des candidatures commerciales (enum SubmissionStatus — la table
// Submission porte aussi les états pipeline de /planning/pipeline).
const COMMERCIALE_STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle",
  in_progress: "En cours",
  processed: "Traitée",
  archived: "Archivée",
  qualifying: "Qualification",
  negotiating: "Négociation",
  converted: "Convertie",
  lost: "Perdue",
};
const COMMERCIALE_STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  new: "warning",
  in_progress: "warning",
  qualifying: "warning",
  negotiating: "warning",
  processed: "success",
  converted: "success",
  archived: "neutral",
  lost: "neutral",
};

const TITLES: Record<CandidaturesView, string> = {
  all: "Candidatures",
  monteur: "Candidatures — Monteur vidéo",
  // Libellé SOURCE-NEUTRE (2026-08-23). Il disait « Mémo Isère » alors que le
  // filtre porte sur `subType = candidature-commerciale` — donc AUSSI sur les
  // candidatures Le Bon Coin, et sur celles de toute future annonce. Un onglet
  // qui nomme un canal en en agrégeant plusieurs fait chercher ailleurs des
  // candidatures qui sont sous les yeux. La ventilation par provenance vit
  // dans l'écran Ops → Annonces recrutement.
  // La CLÉ `memo` reste inchangée : les liens `?view=memo` existants marchent.
  memo: "Candidatures — Apporteurs d'affaires",
  standard: "Candidatures emploi",
};

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  view: CandidaturesView;
  items: ReadonlyArray<CandidatureUnifieeItem>;
  total: number;
  page: number;
  totalPages: number;
}

export function ApplicationsV2({
  adminPrefix,
  searchParams: sp,
  view,
  items,
  total,
  page,
  totalPages,
}: Props): React.ReactElement {
  const offerId = sp["offerId"];
  const baseHref = `/fr/${adminPrefix}/contacts/candidatures`;
  const viewQuery = view === "all" ? "" : `?view=${view}`;
  // Le filtre statut n'a de sens que sur une vue mono-table : les vues
  // fusionnée (Toutes) et commerciale (Apporteurs d’affaires) mélangent deux enums de
  // statut différents — on n'y garde que « À traiter ».
  const showStatusFilter = view === "monteur" || view === "standard" || Boolean(offerId);

  const columns: ReadonlyArray<AdminTableColumn<CandidatureUnifieeItem>> = [
    { key: "date", header: "Date", cell: (a) => formatDateFrShort(a.submittedAt) },
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
    { key: "offer", header: "Offre", cell: (a) => a.offerLabel },
    {
      key: "cv",
      header: "CV",
      cell: (a) =>
        a.hasCv === null ? (
          "—"
        ) : (
          <AdminEtatBooleen actif={a.hasCv} libelles={{ vrai: "CV joint", faux: "Sans CV" }} />
        ),
    },
    {
      key: "status",
      header: "Statut",
      cell: (a) => {
        const labels = a.source === "commerciale" ? COMMERCIALE_STATUS_LABELS : STATUS_LABELS;
        const tones = a.source === "commerciale" ? COMMERCIALE_STATUS_TONE : STATUS_TONE;
        return (
          <AdminBadge tone={tones[a.status] ?? "neutral"}>
            {labels[a.status] ?? a.status}
          </AdminBadge>
        );
      },
    },
  ];
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={TITLES[view]}
        description={`${total} candidature${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
      />

      <AdminFilterTabs
        className="mb-[var(--space-admin-5)]"
        current={view}
        options={[
          { value: "all", label: "Toutes", href: baseHref },
          { value: "monteur", label: "Monteur vidéo", href: `${baseHref}?view=monteur` },
          { value: "memo", label: "Apporteurs d'affaires", href: `${baseHref}?view=memo` },
        ]}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          {offerId ? <input type="hidden" name="offerId" value={offerId} /> : null}
          {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
          <div className="admin-filters-grid">
            {showStatusFilter ? (
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
            ) : null}
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
            <button type="submit" className="admin-button-secondary">
              Appliquer
            </button>
            <Link href={`${baseHref}${viewQuery}`} className="admin-button-ghost">
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
          caption="Liste des candidatures"
          rowAction={(a) => (
            <AdminButton
              href={
                a.source === "commerciale"
                  ? `/fr/${adminPrefix}/contacts/commercial/${a.id}`
                  : `/fr/${adminPrefix}/contacts/candidatures/${a.id}`
              }
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Détail
            </AdminButton>
          )}
        />
      )}

      {/* 🔴 Le sous-titre annonçait « page 1/N » et la page N n'existait
          nulle part à l'écran : au-delà de la première, les lignes
          n'étaient atteignables qu'en éditant l'URL. Les filtres en cours
          sont reportés dans les liens — sinon changer de page les
          effacerait, et on repartirait d'une autre liste. */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={baseHref}
        preservedParams={{
          status: showStatusFilter ? sp["status"] : undefined,
          offerId: sp["offerId"],
          attention: sp["attention"],
          view: view === "all" ? undefined : view,
        }}
      />
    </AdminPageShell>
  );
}
