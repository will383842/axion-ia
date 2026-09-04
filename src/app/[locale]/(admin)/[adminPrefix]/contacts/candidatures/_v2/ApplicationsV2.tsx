// Liste admin des candidatures — AdminPageShell + AdminCard + table CSS.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badge statut → <AdminBadge>.
// Sous-onglets 2026-08-13 : Toutes / Monteur vidéo / Apporteurs d’affaires. Les lignes
// sont des CandidatureUnifieeItem : les candidatures commerciales (Mémo
// Isère) viennent de la table Submission et pointent vers leur propre détail.

import Link from "next/link";
import { ArrowRight, Download, Gauge } from "lucide-react";
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
import type { SourceCandidatures } from "@/features/admin-job-applications/annonces-stats";
// Date affichée en FR (audit UX : ISO brut "2026-07-31" illisible pour Will).
import { formatDateFrShort } from "@/lib/format-date-fr";
import {
  LIBELLE_MOTIF_REFUS,
  LIBELLE_STATUT,
  MOTIFS_REFUS_SAISISSABLES,
  STATUTS_CANDIDATURE,
  TON_STATUT,
} from "@/content/recrutement/statuts";
import { PLAFOND_EN_MASSE } from "@/features/admin-job-applications/en-masse";
import { FormulaireEnMasse } from "./FormulaireEnMasse";

/**
 * Les menus du geste groupé, DÉRIVÉS du vocabulaire — jamais recopiés.
 *
 * 🔑 Calculés ICI, dans un composant serveur, plutôt que dans l'île cliente :
 * un seul import de `@/content/recrutement/statuts` depuis un fichier
 * `"use client"` tire le module entier dans le paquet du navigateur, alors que
 * l'île n'a besoin que de deux listes de `{ value, label }`. Le cliquet
 * anti-croissance de `bundle:check` l'a attrapé à 700,35 Ko contre 700.
 *
 * ⚠️ `STATUTS_CANDIDATURE` et `MOTIFS_REFUS_SAISISSABLES` restent la SOURCE :
 * un statut ajouté au vocabulaire apparaît ici sans qu'on y touche. Écrire les
 * libellés à la main aurait produit la quatrième copie de la liste que le lot 3
 * venait justement de solder.
 */
const OPTIONS_STATUT = STATUTS_CANDIDATURE.map((s) => ({ value: s, label: LIBELLE_STATUT[s] }));
const OPTIONS_MOTIF = MOTIFS_REFUS_SAISISSABLES.map((m) => ({
  value: m,
  label: LIBELLE_MOTIF_REFUS[m],
}));

export type CandidaturesView = "all" | "monteur" | "memo" | "standard";

/**
 * Ce qu'on affiche à la place d'une identité que le rôle courant n'a pas le
 * droit d'ouvrir. Un tiret cadratin, pas une chaîne vide : une cellule vide se
 * lit comme « ce candidat n'a pas donné son nom », ce qui est faux.
 */
const MASQUE = "—";

// 🔴 Ces deux tables étaient tenues À LA MAIN ici, et une troisième copie vivait
// dans le formulaire de la fiche. Elles ne connaissaient que six statuts ; la
// base en porte neuf depuis le lot 3. Un dossier « en entretien » se serait
// affiché « interview » en pastille grise — le libellé brut de l'enum, et le
// ton du défaut. Elles dérivent désormais de `@/content/recrutement/statuts`,
// où le type refuse une table incomplète.
const STATUS_LABELS: Record<string, string> = LIBELLE_STATUT;
const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "info" | "destructive"> =
  TON_STATUT;

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
  /**
   * Canaux d'annonce réellement présents dans les données, avec leur volume —
   * les sous-onglets de la vue apporteurs. Vide sur les autres vues.
   *
   * Dérivés des données et non d'une liste figée : un canal ajouté à
   * `SOURCE_OPTIONS` apparaît tout seul dès sa première candidature, et aucun
   * onglet ne propose un filtre qui ne renverrait rien.
   */
  sources?: ReadonlyArray<SourceCandidatures>;
  /** Canal actif, ou `undefined` pour « toutes provenances ». */
  activeSource?: string | undefined;
  items: ReadonlyArray<CandidatureUnifieeItem>;
  total: number;
  page: number;
  totalPages: number;
  /**
   * `true` quand la recherche a mordu son plafond de balayage. L'écran DOIT le
   * dire : une recherche qui ment par omission — « aucun résultat » alors que
   * la personne existe, plus loin dans le stock — est pire qu'une recherche
   * absente, parce qu'on en tire une conclusion.
   */
  balayageTronque?: boolean;
}

export function ApplicationsV2({
  adminPrefix,
  searchParams: sp,
  view,
  sources = [],
  activeSource,
  items,
  total,
  page,
  totalPages,
  balayageTronque = false,
}: Props): React.ReactElement {
  const offerId = sp["offerId"];
  const baseHref = `/fr/${adminPrefix}/contacts/candidatures`;
  const viewQuery = view === "all" ? "" : `?view=${view}`;
  // Le filtre statut n'a de sens que sur une vue mono-table : les vues
  // fusionnée (Toutes) et commerciale (Apporteurs d’affaires) mélangent deux enums de
  // statut différents — on n'y garde que « À traiter ».
  const showStatusFilter = view === "monteur" || view === "standard" || Boolean(offerId);

  // Dérivée des paramètres RÉELLEMENT en vigueur, pas recopiée à la main : une
  // seconde liste de clés divergerait au premier filtre ajouté, et l'export
  // sortirait un périmètre différent de l'écran sans qu'on le voie.
  const exportQuery = new URLSearchParams(
    Object.entries({
      view: view === "all" ? "" : view,
      offerId: offerId ?? "",
      status: showStatusFilter ? (sp["status"] ?? "") : "",
      attention: sp["attention"] ?? "",
      q: sp["q"] ?? "",
    }).filter(([, v]) => v !== "" && v !== "all"),
  ).toString();

  // 🔴 La case n'apparaît QUE sur les lignes « emploi ». Les candidatures
  //    commerciales viennent de `Submission` : leur enum de statut est un AUTRE
  //    enum, et leur appliquer `JobApplicationStatus` écrirait une valeur que
  //    leur écran ne sait pas afficher. Une case grisée dirait « pas ici » ;
  //    une case absente dit la même chose sans inviter à essayer.
  const columns: ReadonlyArray<AdminTableColumn<CandidatureUnifieeItem>> = [
    {
      key: "select",
      header: "",
      cell: (a) =>
        a.source === "emploi" ? (
          <input
            type="checkbox"
            name="ids"
            value={a.id}
            className="admin-checkbox"
            aria-label={`Sélectionner la candidature de ${a.contactName ?? "candidat"}`}
          />
        ) : null,
    },
    { key: "date", header: "Date", cell: (a) => formatDateFrShort(a.submittedAt) },
    {
      key: "candidate",
      header: "Candidat",
      cell: (a) => (
        <>
          {a.contactName ?? MASQUE}
          {a.needsAttention ? <span className="admin-meta-small"> · à traiter</span> : null}
        </>
      ),
    },
    { key: "email", header: "Email", cell: (a) => a.contactEmail ?? MASQUE },
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
        actions={
          <div className="flex items-center gap-[var(--space-admin-3)]">
            <Link href={`${baseHref}/pilotage`} className="admin-button-ghost">
              <Gauge size={15} aria-hidden="true" /> Pilotage
            </Link>
            {/* 🔑 L'export porte EXACTEMENT les filtres de l'écran. Un bouton
                qui exporterait « tout » depuis une liste filtrée rendrait un
                fichier qui ne ressemble pas à ce qu'on regarde — et c'est le
                fichier qu'on croirait, pas l'écran. */}
            <a
              href={`/api/admin/candidatures/export?${exportQuery}`}
              className="admin-button-ghost"
            >
              <Download size={15} aria-hidden="true" /> Export CSV
            </a>
          </div>
        }
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

      {/* Sous-onglets par canal d'annonce — uniquement sous « Apporteurs
          d'affaires », et uniquement s'il y a plus d'un canal. Avec une seule
          provenance, un sous-onglet « Toutes » face à un unique canal ne
          propose aucun choix : il n'ajoute qu'une ligne à lire.

          Le compteur est porté par le libellé : sans lui, on clique un onglet
          pour découvrir qu'il est vide, ce qui est exactement l'information
          qu'un onglet devrait donner avant le clic. */}
      {view === "memo" && sources.length > 1 ? (
        <AdminFilterTabs
          className="mb-[var(--space-admin-5)]"
          current={activeSource ?? "__toutes__"}
          options={[
            {
              value: "__toutes__",
              label: `Toutes provenances (${sources.reduce((n, s) => n + s.count, 0)})`,
              href: `${baseHref}?view=memo`,
            },
            ...sources.map((s) => ({
              value: s.id,
              label: `${s.label} (${s.count})`,
              href: `${baseHref}?view=memo&source=${encodeURIComponent(s.id)}`,
            })),
          ]}
        />
      ) : null}

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
              <label htmlFor="q" className="admin-label">
                Nom ou adresse
              </label>
              {/* 🔴 `type="search"` et non `text` : le navigateur y offre la
                  croix d'effacement, et un champ de recherche qu'on ne sait pas
                  vider se contourne en éditant l'URL. */}
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={sp["q"] ?? ""}
                placeholder="dupont, @exemple.fr…"
                className="admin-input"
              />
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
            <button type="submit" className="admin-button-secondary">
              Appliquer
            </button>
            <Link href={`${baseHref}${viewQuery}`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {balayageTronque ? (
        <p className="admin-alert admin-alert-warning mb-[var(--space-admin-4)]" role="status">
          La recherche n’a examiné que les candidatures les plus récentes : des dossiers plus
          anciens n’ont PAS été parcourus. Restreindre par offre ou par statut pour remonter plus
          loin.
        </p>
      ) : null}

      {items.length === 0 ? (
        <AdminEmptyState title="Aucune candidature." />
      ) : (
        <FormulaireEnMasse
          statuts={OPTIONS_STATUT}
          motifs={OPTIONS_MOTIF}
          plafond={PLAFOND_EN_MASSE}
        >
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
        </FormulaireEnMasse>
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
          // Sans lui, passer à la page 2 d'une recherche repartait de la liste
          // complète — la page 2 ne parlait plus du même ensemble que la page 1.
          q: sp["q"],
        }}
      />
    </AdminPageShell>
  );
}
