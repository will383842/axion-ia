// LA LISTE « FUTURS APPORTEURS » (Candidatures unifiées L8d, maquette v2
// validée le 2026-10-07) — composant SERVEUR.
//
// Même disposition que la liste « Candidatures », vocabulaire du RÉSEAU :
//
//   Date · Nom · Zone · Dossier · Étape · Dernier échange · Nous a connus par
//
// 🔴 Une liste SÉPARÉE, jamais un onglet de « Candidatures » : contrainte
// juridique (`features/personne/fiche-personne.ts`). Aucun mot de recrutement :
// l'étape vient de `etapeApporteur` (L8a, sur la logique de la PR 1358), les
// colonnes de `liste-reseau.ts`.
//
// Ce qui ne change pas : les onglets En cours / Archivés / Tous / Corbeille et
// l'archivage automatique de la PR 1358 (`ongletsListe`), l'export, « Ajouter ».
// `SubmissionsV2` reste INCHANGÉ pour les autres types de messages.
//
// Les filtres « Étape » et « Nous a connus par » sont DÉRIVÉS (aucune colonne
// en base) : quand l'un d'eux est actif, la liste examine les 400 fiches les
// plus récentes de l'onglet, filtre, puis pagine — et le dit.

import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
  AdminFilterTabs,
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { PastilleEtape } from "@/components/admin/etapes/PastilleEtape";
import { ArchiverSelectionApporteurs } from "@/components/admin/contacts/ArchiverSelectionApporteurs";
import { ComposeurEnMasseApporteurs } from "@/components/admin/contacts/ComposeurEnMasseApporteurs";
import { listSubmissionsAction } from "@/features/admin-submissions/actions";
import type { SubmissionListItem } from "@/features/admin-submissions/reads";
import { ongletsListe } from "@/features/admin-submissions/onglets-liste";
import { lireSuiviInvitationListe } from "@/features/commercial-application/invitation-apporteur";
import {
  lireDossiersApporteurListe,
  lireMotifsSansLien,
} from "@/features/commercial-application/etape-apporteur-liste";
import { etapeDuSuivi } from "@/lib/commercial-application/etape-suivi-apporteur";
import type { SuiviInvitation } from "@/lib/commercial-application/relance-invitation";
import { BARRE_APPORTEUR, etapeApporteur, type Etape } from "@/features/etapes/etapes";
import {
  dernierEchange,
  dossierCourt,
  ORIGINES_FILTRABLES,
} from "@/lib/commercial-application/liste-reseau";
import { splitNomPrenom } from "@/lib/nom-prenom";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { prisma } from "@/lib/prisma";
import { FILTRE_APPORTEUR_PRISMA } from "@/lib/commercial-application/est-apporteur";
import { MODELES_REPONSE_APPORTEUR } from "@/content/apporteurs/modeles-reponse";
import { PLAFOND_EN_MASSE } from "@/features/admin-job-applications/en-masse";
import { partagesActifs } from "@/server/partages/config";
import { fichiersPourComposeur } from "@/server/partages/suivi";

const MASQUE = "—";
const PAR_PAGE = 25;
const BALAYAGE_FILTRE = 400;
/** Les étapes proposées au filtre : la barre, puis les sorties. */
const ETAPES_FILTRABLES = [...BARRE_APPORTEUR, "Absent à l'échange", "Sans suite"] as const;

/** Les modèles de l'envoi groupé : jamais le « Message libre » (L6b). */
const MODELES_GROUPE = MODELES_REPONSE_APPORTEUR.filter((m) => m.id !== "libre").map((m) => ({
  id: m.id,
  libelle: m.libelle,
  quand: m.quand,
  objet: m.objet,
  corps: m.corps,
}));

interface Ligne {
  readonly s: SubmissionListItem;
  readonly etape: Etape;
  readonly dernier: { sens: "recu" | "envoye"; libelle: string } | null;
}

/** « Notre plus ancienne réponse en attente » : la fiche qui attend depuis le plus longtemps. */
async function plusAncienneAttente(): Promise<{ id: string; jours: number } | null> {
  const f = await prisma.submission.findFirst({
    where: { ...FILTRE_APPORTEUR_PRISMA, needsAttention: true, archivedAt: null, deletedAt: null },
    orderBy: { updatedAt: "asc" },
    select: { id: true, updatedAt: true },
  });
  if (!f) return null;
  const jours = Math.max(0, Math.floor((Date.now() - f.updatedAt.getTime()) / 86_400_000));
  return { id: f.id, jours };
}

export async function ListeFutursApporteurs({
  adminPrefix,
  searchParams: sp,
}: {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}): Promise<React.ReactElement> {
  const base = `/fr/${adminPrefix}/contacts/commercial`;
  const includeArchived = sp["includeArchived"] === "true";
  const deleted = sp["deleted"] === "true";
  const filtreEtape =
    sp["etape"] && ETAPES_FILTRABLES.includes(sp["etape"] as never) ? sp["etape"] : null;
  const filtreOrigine =
    sp["origine"] && ORIGINES_FILTRABLES.includes(sp["origine"]) ? sp["origine"] : null;
  const derive = Boolean(filtreEtape || filtreOrigine);
  const page = Math.max(1, Number.parseInt(sp["page"] ?? "1", 10) || 1);

  const requete = {
    unifiedTypeIn: ["recrutement"],
    perimetre: "apporteurs" as const,
    status: sp["status"] as never,
    search: sp["search"],
    replyStatus: sp["replyStatus"] as never,
    tri: sp["tri"] as never,
    includeArchived,
    deleted,
  };
  // Sans filtre dérivé : Postgres pagine. Avec : balayage borné, puis filtre.
  const lots = derive
    ? await Promise.all(
        Array.from({ length: BALAYAGE_FILTRE / 100 }, (_, i) =>
          listSubmissionsAction({ ...requete, page: i + 1, pageSize: 100 }),
        ),
      )
    : [await listSubmissionsAction({ ...requete, page, pageSize: PAR_PAGE })];
  const tous = lots.flatMap((l) => l.items);
  const totalBase = lots[0]?.total ?? 0;

  const ids = tous.map((s) => s.id);
  const [suivis, dossiers, motifs, attente] = await Promise.all([
    lireSuiviInvitationListe(ids).catch((err) => {
      Sentry.captureException(err, { tags: { ecran: "futurs-apporteurs", etape: "suivi" } });
      return new Map<string, SuiviInvitation>();
    }),
    lireDossiersApporteurListe(ids).catch(() => new Map()),
    lireMotifsSansLien(ids).catch(() => new Map()),
    plusAncienneAttente().catch(() => null),
  ]);
  const maintenant = new Date();

  const lignes: Ligne[] = tous.map((s) => {
    const suivi = suivis.get(s.id) ?? null;
    const etape = etapeApporteur(
      etapeDuSuivi(
        {
          suivi,
          dossier: dossiers.get(s.id) ?? null,
          sansSuite: s.sansSuiteAt !== null,
          motifSansLien: motifs.get(s.id) ?? null,
        },
        maintenant,
      ),
      { pretASigner: s.pretASignerLe !== null },
    );
    const dernier = dernierEchange({
      invitation: suivi?.invitation ?? null,
      relances: suivi?.relances ?? [],
      reponse: suivi?.reponse ?? null,
      envoyeLe: s.lastRepliedAt,
    });
    return { s, etape, dernier };
  });

  const filtrees = derive
    ? lignes.filter(
        (l) =>
          (!filtreEtape || l.etape.libelle === filtreEtape) &&
          (!filtreOrigine || l.s.connuPar === filtreOrigine),
      )
    : lignes;
  const total = derive ? filtrees.length : totalBase;
  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const affichees = derive ? filtrees.slice((page - 1) * PAR_PAGE, page * PAR_PAGE) : filtrees;
  const aTraiter = lignes.filter((l) => l.s.needsAttention).length;

  const { options: tabOptions, current: currentTab } = ongletsListe({
    perimetre: "apporteurs",
    base,
    searchParams: sp,
  });

  const fichiers = partagesActifs()
    ? await fichiersPourComposeur("apporteur")
        .then((l) =>
          l.map((f) => ({ id: f.id, titre: f.titre, libelleCategorie: f.libelleCategorie })),
        )
        .catch(() => null)
    : null;

  const colonnes: ReadonlyArray<AdminTableColumn<Ligne>> = [
    {
      key: "select",
      header: "",
      cell: (l) => {
        const { prenom, nom } = splitNomPrenom(l.s.contactName, l.s.prenomSeul === true);
        return (
          // `relative z-[2]` : au-dessus du lien étiré de la ligne cliquable.
          <span className="relative z-[2]">
            <input
              type="checkbox"
              name="ids"
              value={l.s.id}
              className="admin-checkbox"
              aria-label={`Cocher ${[prenom, nom].filter(Boolean).join(" ") || "cette personne"}`}
            />
          </span>
        );
      },
    },
    { key: "date", header: "Date", cell: (l) => formatDateFrShort(l.s.submittedAt) },
    {
      key: "nom",
      header: "Nom",
      cell: (l) => {
        const { prenom, nom } = splitNomPrenom(l.s.contactName, l.s.prenomSeul === true);
        return (
          <>
            {[prenom, nom].filter(Boolean).join(" ") || MASQUE}
            {l.s.needsAttention ? <span className="admin-meta-small"> · à traiter</span> : null}
          </>
        );
      },
    },
    { key: "zone", header: "Zone", cell: (l) => l.s.zone ?? MASQUE },
    { key: "dossier", header: "Dossier", cell: (l) => dossierCourt(l.s.etape) },
    { key: "etape", header: "Étape", cell: (l) => <PastilleEtape etape={l.etape} /> },
    {
      key: "dernier",
      header: "Dernier échange",
      cell: (l) => l.dernier?.libelle ?? MASQUE,
    },
    { key: "connu", header: "Nous a connus par", cell: (l) => l.s.connuPar ?? MASQUE },
  ];

  const garder = {
    includeArchived: sp["includeArchived"],
    status: sp["status"],
    deleted: sp["deleted"],
    search: sp["search"],
    replyStatus: sp["replyStatus"],
    etape: filtreEtape ?? undefined,
    origine: filtreOrigine ?? undefined,
  };
  const exporter = `/api/admin/submissions/export?${new URLSearchParams({
    unifiedTypeIn: "recrutement",
    perimetre: "apporteurs",
    ...(includeArchived ? { includeArchived: "true" } : {}),
    ...(deleted ? { deleted: "true" } : {}),
    ...(sp["search"] ? { search: sp["search"] } : {}),
  }).toString()}`;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Futurs apporteurs"
        description={`${total} personne${total > 1 ? "s" : ""}${aTraiter > 0 ? ` · ${aTraiter} attend${aTraiter > 1 ? "ent" : ""} notre réponse` : ""}`}
        actions={
          <>
            <Link href={`${base}/nouveau`} className="admin-button">
              Ajouter
            </Link>
            <Link href={exporter} className="admin-button-ghost" download>
              Exporter
            </Link>
          </>
        }
      />

      {attente && attente.jours > 0 ? (
        <p className="admin-alert admin-alert-warning mb-[var(--space-admin-4)]" role="status">
          Notre plus ancienne réponse en attente : <strong>{attente.jours} j</strong>.{" "}
          <Link href={`${base}/${attente.id}`} className="admin-link">
            Ouvrir
          </Link>
        </p>
      ) : null}

      <AdminFilterTabs
        className="mb-[var(--space-admin-4)]"
        options={tabOptions}
        current={currentTab}
        label="Vue"
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          {includeArchived ? <input type="hidden" name="includeArchived" value="true" /> : null}
          {sp["status"] ? <input type="hidden" name="status" value={sp["status"]} /> : null}
          {deleted ? <input type="hidden" name="deleted" value="true" /> : null}
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="fa-etape" className="admin-label">
                Étape
              </label>
              <select
                id="fa-etape"
                name="etape"
                defaultValue={filtreEtape ?? ""}
                className="admin-input"
              >
                <option value="">Toutes</option>
                {ETAPES_FILTRABLES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="fa-origine" className="admin-label">
                Nous a connus par
              </label>
              <select
                id="fa-origine"
                name="origine"
                defaultValue={filtreOrigine ?? ""}
                className="admin-input"
              >
                <option value="">Toutes</option>
                {ORIGINES_FILTRABLES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="fa-q" className="admin-label">
                Nom ou adresse
              </label>
              <input
                id="fa-q"
                name="search"
                type="search"
                defaultValue={sp["search"] ?? ""}
                placeholder="dupont, @exemple.fr…"
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="fa-at" className="admin-label">
                À traiter
              </label>
              <select
                id="fa-at"
                name="replyStatus"
                defaultValue={sp["replyStatus"] ?? ""}
                className="admin-input"
              >
                <option value="">Toutes</option>
                <option value="unanswered">Sans réponse de notre part</option>
              </select>
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button-ghost">
              Appliquer
            </button>
            <Link href={base} className="admin-button-secondary">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      <p className="admin-meta-small mb-[var(--space-admin-4)]">
        {sp["tri"] === "ancien"
          ? "Triée de la plus ancienne à la plus récente."
          : "Triée par date, la plus récente d’abord."}
        {derive
          ? ` Filtre appliqué aux ${BALAYAGE_FILTRE} fiches les plus récentes de cette vue.`
          : ""}
      </p>

      {affichees.length === 0 ? (
        <AdminEmptyState
          title={
            derive || sp["search"]
              ? "Personne avec ces filtres."
              : "Aucun futur apporteur dans cette vue."
          }
          primaryAction={
            <Link href={base} className="admin-button-secondary">
              {derive || sp["search"] ? "Retirer les filtres" : "Voir les fiches en cours"}
            </Link>
          }
        />
      ) : (
        <form>
          <AdminTable
            columns={colonnes}
            rows={affichees}
            getRowId={(l) => l.s.id}
            caption="Liste des futurs apporteurs"
            rowHref={(l) => `${base}/${l.s.id}`}
          />
          {/* Actions groupées : archiver (rien n'est effacé) et écrire à la
              sélection, à partir d'un modèle relu (L6b). */}
          <div className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-3)]">
            <ArchiverSelectionApporteurs />
            <ComposeurEnMasseApporteurs
              modeles={MODELES_GROUPE}
              plafond={PLAFOND_EN_MASSE}
              fichiers={fichiers}
            />
          </div>
        </form>
      )}

      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={base}
        preservedParams={garder}
      />
    </AdminPageShell>
  );
}
