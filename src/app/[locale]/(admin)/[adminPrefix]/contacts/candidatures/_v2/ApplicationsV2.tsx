// Liste admin des candidatures EMPLOI — AdminPageShell + AdminCard + table CSS.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badge statut → <AdminBadge>.
//
// 🔴 2026-09-23 — REFONTE (mesure prod, 2026-09-23) : cet écran affichait
// deux onglets qui n'auraient jamais dû exister ensemble.
//
//   · « Apporteurs d'affaires » dupliquait EXACTEMENT les 12 lignes déjà
//     visibles sous `/contacts/commercial` (mêmes `Submission`, même filtre
//     `subType = candidature-commerciale`) — deux portes vers les mêmes
//     dossiers, ET la vue « Toutes » mélangeait au passage deux enums de
//     statut différents (`JobApplicationStatus` / `SubmissionStatus`). Les
//     deux onglets sont retirés ; cet écran ne montre plus QUE des
//     `JobApplication` (164 lignes, un seul vocabulaire de statut).
//   · « Monteur vidéo » promouvait UNE offre sur 34 au rang d'onglet. Un
//     sélecteur « Offre », alimenté par les offres qui ont réellement des
//     candidatures, répond à la question qu'on se pose en réalité
//     (« qui a postulé à Rédacteur web ? ») pour les 34, pas pour une seule.
//   · Sans offre choisie, 164 lignes triées par seule date (`reads.ts`)
//     ressemblaient à un tas — la même offre revenait toutes les cinq lignes.
//     Le tri par défaut passe par l'offre en premier (33 offres + 1 bucket
//     « Candidature spontanée » contigus à l'écran), la date en second.

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
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import type {
  JobApplicationListItem,
  OffreAvecCandidatures,
} from "@/features/admin-job-applications/reads";
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
import { MODELES_REPONSE } from "@/content/recrutement/modeles-reponse";
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

// Reduits ICI, dans un composant serveur : le module de modeles ne doit pas
// traverser la frontiere client. Meme raison que `OPTIONS_STATUT`.
const OPTIONS_MODELE = MODELES_REPONSE.map((m) => ({
  value: m.id,
  label: m.libelle,
  quand: m.quand,
  objet: m.objet,
  corps: m.corps,
}));
const OPTIONS_MOTIF = MOTIFS_REFUS_SAISISSABLES.map((m) => ({
  value: m,
  label: LIBELLE_MOTIF_REFUS[m],
}));

/**
 * Ce qu'on affiche à la place d'une identité que le rôle courant n'a pas le
 * droit d'ouvrir. Un tiret cadratin, pas une chaîne vide : une cellule vide se
 * lit comme « ce candidat n'a pas donné son nom », ce qui est faux.
 */
const MASQUE = "—";

const STATUS_LABELS: Record<string, string> = LIBELLE_STATUT;
const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "info" | "destructive"> =
  TON_STATUT;

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  /**
   * Les offres ayant au moins une candidature, avec leur volume — alimente le
   * sélecteur. Indépendant de la page/du filtre courants : la liste proposée
   * ne doit pas rétrécir quand on choisit une offre.
   */
  offres: ReadonlyArray<OffreAvecCandidatures>;
  items: ReadonlyArray<JobApplicationListItem>;
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
  /**
   * Le dossier « jamais répondu » le plus ancien, `null` s'il n'y en a
   * aucun ou si l'écran n'est pas sur son atterrissage normal (voir
   * `page.tsx`, qui ne le calcule que là). Un candidat oublié depuis deux
   * mois ne doit pas dépendre d'un écran de pilotage que personne n'ouvre.
   */
  plusAncienJamaisRepondu?: { id: string; offerTitleSnap: string; jours: number } | null;
}

export function ApplicationsV2({
  adminPrefix,
  searchParams: sp,
  offres,
  items,
  total,
  page,
  totalPages,
  balayageTronque = false,
  plusAncienJamaisRepondu = null,
}: Props): React.ReactElement {
  const offerId = sp["offerId"];
  const baseHref = `/fr/${adminPrefix}/contacts/candidatures`;
  const offreActive = offerId ? offres.find((o) => o.id === offerId) : undefined;
  const totalOffres = offres.reduce((n, o) => n + o.count, 0);

  // Dérivée des paramètres RÉELLEMENT en vigueur, pas recopiée à la main : une
  // seconde liste de clés divergerait au premier filtre ajouté, et l'export
  // sortirait un périmètre différent de l'écran sans qu'on le voie.
  //
  // 🔑 `view=all` est FIXE, et non dérivé d'une prop : cet écran n'affiche
  // plus que des candidatures emploi, toutes offres comprises — c'est
  // exactement ce que l'export doit refléter, mot pour mot.
  const exportQuery = new URLSearchParams(
    Object.entries({
      view: "all",
      offerId: offerId ?? "",
      status: sp["status"] ?? "",
      attention: sp["attention"] ?? "",
      q: sp["q"] ?? "",
    }).filter(([, v]) => v !== "" && v !== "all"),
  ).toString();

  const columns: ReadonlyArray<AdminTableColumn<JobApplicationListItem>> = [
    {
      key: "select",
      header: "",
      cell: (a) => (
        <input
          type="checkbox"
          name="ids"
          value={a.id}
          className="admin-checkbox"
          aria-label={`Sélectionner la candidature de ${a.contactName ?? "candidat"}`}
        />
      ),
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
    { key: "offer", header: "Offre", cell: (a) => a.offerTitleSnap },
    {
      key: "cv",
      header: "CV",
      cell: (a) => (
        <AdminEtatBooleen actif={a.hasCv} libelles={{ vrai: "CV joint", faux: "Sans CV" }} />
      ),
    },
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
        title={offreActive ? `Candidatures — ${offreActive.label}` : "Candidatures"}
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

      {/* 🔴 LE PLUS ANCIEN DOSSIER SANS RÉPONSE — dit ICI, pas seulement dans
          `/pilotage`. Une liste de 178 lignes triées par offre cache le candidat
          qui attend depuis deux mois aussi bien qu'une liste vide : il est
          quelque part dedans, mais rien ne le désigne. */}
      {plusAncienJamaisRepondu ? (
        <p className="admin-alert admin-alert-error mb-[var(--space-admin-4)]" role="alert">
          Le plus ancien dossier sans réponse attend depuis{" "}
          <strong>{plusAncienJamaisRepondu.jours} j</strong> —{" "}
          {plusAncienJamaisRepondu.offerTitleSnap}.{" "}
          <Link href={`${baseHref}/${plusAncienJamaisRepondu.id}`} className="admin-link">
            Ouvrir le dossier
          </Link>
        </p>
      ) : null}

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="offerId" className="admin-label">
                Offre
              </label>
              {/* 🔴 REMPLACE l'onglet « Monteur vidéo » (une offre sur 34).
                  « Qui a postulé à Rédacteur web ? » est la question que cet
                  écran doit savoir répondre pour CHACUNE des 34, pas pour une
                  seule figée au code. Alimenté par les offres qui ont
                  RÉELLEMENT des candidatures (`getOffresAvecCandidatures`) :
                  aucune option qui rendrait zéro ligne. */}
              <select
                id="offerId"
                name="offerId"
                defaultValue={offerId ?? ""}
                className="admin-input"
              >
                <option value="">Toutes les offres ({totalOffres})</option>
                {offres.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label} ({o.count})
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
            <button type="submit" className="admin-button-ghost">
              Appliquer
            </button>
            <Link href={baseHref} className="admin-button-secondary">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {!offerId && !sp["q"] ? (
        <p className="admin-meta-small mb-[var(--space-admin-4)]">
          Triée par offre — {offres.length} offre{offres.length > 1 ? "s" : ""} concernée
          {offres.length > 1 ? "s" : ""}.
        </p>
      ) : null}

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
          modeles={OPTIONS_MODELE}
        >
          <AdminTable
            columns={columns}
            rows={items}
            getRowId={(a) => a.id}
            caption="Liste des candidatures"
            rowAction={(a) => (
              <AdminButton
                href={`/fr/${adminPrefix}/contacts/candidatures/${a.id}`}
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
          status: sp["status"],
          offerId: sp["offerId"],
          attention: sp["attention"],
          // Sans lui, passer à la page 2 d'une recherche repartait de la liste
          // complète — la page 2 ne parlait plus du même ensemble que la page 1.
          q: sp["q"],
        }}
      />
    </AdminPageShell>
  );
}
