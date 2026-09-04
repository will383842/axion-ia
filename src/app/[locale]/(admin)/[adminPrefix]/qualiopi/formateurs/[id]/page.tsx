/**
 * Admin — Qualiopi · Fiche formateur (R9).
 * Édition identité + habilitations par formation + vérification sous-traitant + activation.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import {
  getTrainerConformite,
  listTrainerDocumentsFull,
} from "@/server/qualiopi/trainers/documents";
import { TrainerForm } from "@/components/admin/qualiopi/TrainerForm";
import { TrainerManageForm } from "@/components/admin/qualiopi/TrainerManageForm";
import { TrainerDocumentsPanel } from "@/components/admin/qualiopi/TrainerDocumentsPanel";
import { TrainerCompetencesPanel } from "@/components/admin/qualiopi/TrainerCompetencesPanel";
import { TrainerAvailabilityPanel } from "@/components/admin/qualiopi/TrainerAvailabilityPanel";
import { TrainerCompensationPanel } from "@/components/admin/qualiopi/TrainerCompensationPanel";
import {
  TrainerDevelopmentPanel,
  type TrainerDevelopmentActionType,
} from "@/components/admin/qualiopi/TrainerDevelopmentPanel";
import {
  addTrainerDevelopmentActionAction,
  deleteTrainerDevelopmentActionAction,
  updateTrainerSousTraitancePiecesAction,
} from "@/server/actions/qualiopi/trainers";
import { TrainerSousTraitancePanel } from "@/components/admin/qualiopi/TrainerSousTraitancePanel";
import { listIndisposFormateur } from "@/server/qualiopi/trainers/availability-queries";
import {
  listReglesFormateur,
  listFormationOptions,
} from "@/server/qualiopi/remuneration/rules-queries";
import { getTrainer } from "@/server/qualiopi/trainers/trainers";
import { whereSessionsDuFormateur } from "@/server/formateur/collectif-queries";
import { fiabiliteFormateur } from "@/server/qualiopi/trainers/fiabilite-service";
import { statsMissionsFormateur } from "@/server/qualiopi/trainers/mission-formateur";
import { listIncidents } from "@/server/qualiopi/registres/incidents-service";
import { genererCvFormateurAction } from "@/server/actions/qualiopi/exports-pdf";
import { lireLettresMissionConsoleDuFormateur } from "@/server/qualiopi/documents/signature/lettre-mission-queries";
import { contresignerLettreMissionAction } from "@/server/actions/qualiopi/lettre-mission-signature";
import { SignatureDocument } from "@/components/espace-formateur/SignatureDocument";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";
import { VerserFicheFormateurButton } from "@/components/admin/qualiopi/VerserFicheFormateurButton";
import { Ban, TriangleAlert } from "lucide-react";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Fiche formateur | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

async function listFormationsLite(): Promise<Array<{ id: string; titre: string }>> {
  try {
    return await prisma.formation.findMany({
      select: { id: true, titre: true },
      orderBy: { titre: "asc" },
    });
  } catch {
    return [];
  }
}

// « Nombre de formations faites » — calculé automatiquement (Will 2026-06-10) :
// sessions Qualiopi animées. Stub-safe (build sans DB → 0).
//
// 🔴 Recette 2026-09-03. Ce compteur disait « 5 sessions Qualiopi animées »
// pour une formatrice qui n'en avait animé AUCUNE : il comptait toutes les
// `TrainingSession` la portant comme formateur principal, quel que soit leur
// statut. Trois faussetés dans un seul chiffre, et il part à l'auditeur —
// c'est la fiche versée au dossier (ind. 21) :
//
//   1. il comptait des sessions PLANIFIÉES, qui n'ont pas eu lieu ;
//   2. il comptait la session dont la formatrice s'est DÉSISTÉE le matin même ;
//   3. il ne lisait que `formateurPrincipalId` — un cache dénormalisé qui ne
//      porte QUE le principal. Toute co-animation restait invisible, le piège
//      que `fiabilite-service.ts` documente déjà pour son dénominateur.
//
// On compte donc les sessions RÉALISÉES, par l'invariant nommé du dépôt
// (`whereSessionsDuFormateur` : principal OU co-animateur), et on rend à part
// celles qui restent À VENIR — l'information que le chiffre gonflé prétendait
// donner, cette fois sous son vrai nom.
async function getTrainerActivityCounts(
  trainerId: string,
  now: Date,
): Promise<{ sessionsAnimees: number; sessionsAVenir: number }> {
  try {
    const [sessionsAnimees, sessionsAVenir] = await Promise.all([
      prisma.trainingSession.count({
        where: { statut: "realisee", ...whereSessionsDuFormateur(trainerId) },
      }),
      prisma.trainingSession.count({
        where: {
          statut: "planifiee",
          dateDebut: { gt: now },
          ...whereSessionsDuFormateur(trainerId),
        },
      }),
    ]);
    return { sessionsAnimees, sessionsAVenir };
  } catch {
    return { sessionsAnimees: 0, sessionsAVenir: 0 };
  }
}

export default async function FicheFormateurPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const role = acces.role;

  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;
  const trainer = await getTrainer(id);
  if (!trainer) notFound();

  const formations = await listFormationsLite();
  const [documents, indispos, regles, formationOptions, lettresConsole] = await Promise.all([
    listTrainerDocumentsFull(trainer.id),
    listIndisposFormateur(trainer.id),
    listReglesFormateur(trainer.id),
    listFormationOptions(),
    // Lettres de mission à contresigner — la fiche formateur est la SEULE
    // surface qui couvre les lettres-cadre sans session (coaching/audit).
    lireLettresMissionConsoleDuFormateur(trainer.id, role),
  ]);
  // Un seul instant pour toute la page — conformité, missions et activité —,
  // sinon deux compteurs voisins peuvent se contredire d'une milliseconde.
  const now = new Date();
  const { sessionsAnimees, sessionsAVenir } = await getTrainerActivityCounts(trainer.id, now);

  // Domaines de compétences au format d'ÉDITION (input date = `YYYY-MM-DD`).
  // Le stockage historique accepte aussi des chaînes nues (« IA générative »)
  // sans niveau ni date : on les normalise ici plutôt que de perdre la donnée.
  const domainesInitiaux = (
    Array.isArray(trainer.domainesCompetences) ? trainer.domainesCompetences : []
  ).flatMap((entree) => {
    if (typeof entree === "string" && entree.trim() !== "") {
      return [{ domaine: entree.trim(), niveauMaitrise: "", verifiedAt: "" }];
    }
    if (typeof entree !== "object" || entree === null) return [];
    const o = entree as Record<string, unknown>;
    const domaine = typeof o["domaine"] === "string" ? o["domaine"].trim() : "";
    if (domaine === "") return [];
    const brut = typeof o["verifiedAt"] === "string" ? o["verifiedAt"] : "";
    // `slice(0, 10)` couvre l'ISO complet comme la date seule ; une valeur
    // illisible devient "" plutôt que de casser l'input date.
    const iso = brut !== "" && !Number.isNaN(Date.parse(brut)) ? brut.slice(0, 10) : "";
    return [
      {
        domaine,
        niveauMaitrise: typeof o["niveauMaitrise"] === "string" ? o["niveauMaitrise"] : "",
        verifiedAt: iso,
      },
    ];
  });

  // Actions de développement des compétences (ind. 22).
  const devActionsRaw = await prisma.trainerDevelopmentAction.findMany({
    where: { trainerId: trainer.id },
    orderBy: { dateAction: "desc" },
    take: 50,
    select: { id: true, type: true, dateAction: true, description: true },
  });
  const devActions = devActionsRaw.map((a) => ({
    id: a.id,
    type: a.type as TrainerDevelopmentActionType,
    dateAction: a.dateAction.toISOString(),
    description: a.description,
  }));

  // Conformité documentaire (URSSAF, NDA, RC pro…). Les manquements « bloquant »
  // empêchent d'envoyer le formateur chez un client ; les « alerte » signalent
  // une règle non tranchée (seuil URSSAF) ou une pièce à rafraîchir.
  const conformite = await getTrainerConformite(trainer.id, now.getUTCFullYear(), now);
  const bloquants = conformite?.manquements.filter((m) => m.gravite === "bloquant") ?? [];
  const alertes = conformite?.manquements.filter((m) => m.gravite === "alerte") ?? [];

  // Fiabilité (art. 7 et 8 de la procédure de sous-traitance). Chargée pour les
  // seuls sous-traitants : un formateur salarié ne se « reconduit » pas, la
  // notion n'a pas de sens pour lui et le bloc se lirait comme un reproche.
  const fiabilite =
    trainer.statut === "sous_traitant" ? await fiabiliteFormateur(trainer.id) : null;
  const incidents =
    trainer.statut === "sous_traitant"
      ? await listIncidents({ trainerId: trainer.id, take: 20 })
      : [];
  // Missions proposées, acceptées, refusées, restées sans réponse ; absences
  // consignées. Pour TOUS les statuts : un salarié qui refuse ou ne vient pas
  // est un fait à piloter, même s'il ne se « reconduit » pas (2026-09-03).
  const missions = await statsMissionsFormateur(trainer.id, now);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`${trainer.prenom} ${trainer.nom}`}
        description={trainer.email}
        actions={
          <div className="flex flex-wrap items-start gap-[var(--space-admin-3)]">
            <PdfExportButton
              label="Aperçu de la fiche (PDF)"
              input={{ trainerId: trainer.id }}
              action={genererCvFormateurAction}
            />
            <VerserFicheFormateurButton
              trainerId={trainer.id}
              dejaVersee={trainer.cvUrl !== null}
            />
          </div>
        }
      />

      <div className="mb-[var(--space-admin-5)]">
        <Link href={base} className="text-[color:var(--color-admin-accent)] underline">
          ← Retour aux formateurs
        </Link>
      </div>

      <div className="admin-card mb-[var(--space-admin-5)]">
        <p className="admin-meta">Activité (calculée automatiquement)</p>
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          <strong>{sessionsAnimees}</strong> session{sessionsAnimees > 1 ? "s" : ""} Qualiopi animée
          {sessionsAnimees > 1 ? "s" : ""}
          {sessionsAVenir > 0 ? (
            <>
              {" "}
              · <strong>{sessionsAVenir}</strong> à venir
            </>
          ) : null}
          .
        </p>
      </div>

      {conformite !== null && (
        <div className="admin-card mb-[var(--space-admin-5)]">
          <p className="admin-meta">Conformité documentaire</p>

          {conformite.manquements.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)]">
              Dossier complet — aucun manquement.
            </p>
          ) : (
            <>
              <p className="text-[length:var(--text-admin-sm)]">
                {bloquants.length > 0 ? (
                  <strong>
                    <Ban
                      size={14}
                      aria-hidden="true"
                      className="inline-block shrink-0 align-[-0.125em]"
                    />{" "}
                    {bloquants.length} manquement{bloquants.length > 1 ? "s" : ""} bloquant
                    {bloquants.length > 1 ? "s" : ""} — ce formateur ne devrait pas être affecté.
                  </strong>
                ) : (
                  <strong>Aucun manquement bloquant.</strong>
                )}
              </p>

              {bloquants.length > 0 && (
                <ul className="mt-2 space-y-1 text-[length:var(--text-admin-sm)]">
                  {bloquants.map((m) => (
                    <li key={m.code}>
                      <Ban
                        size={14}
                        aria-hidden="true"
                        className="inline-block shrink-0 align-[-0.125em]"
                      />{" "}
                      {m.message}
                    </li>
                  ))}
                </ul>
              )}

              {alertes.length > 0 && (
                <ul className="mt-2 space-y-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                  {alertes.map((m) => (
                    <li key={m.code}>
                      <TriangleAlert
                        size={14}
                        aria-hidden="true"
                        className="inline-block shrink-0 align-[-0.125em]"
                      />{" "}
                      {m.message}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {trainer.statut === "sous_traitant" && (
            <p className="admin-meta mt-3">
              Cumul {conformite.annee} retenu pour le seuil URSSAF :{" "}
              <strong>{(conformite.montantRetenuCents / 100).toLocaleString("fr-FR")} €</strong>{" "}
              (approché sur les tarifs figés des affectations).
            </p>
          )}
        </div>
      )}

      {/*
        Saisie des pièces de sous-traitance (art. 4 et 8) — 2026-08-03.

        Placé AVANT le bloc fiabilité : on renseigne le dossier d'un intervenant
        avant de regarder son historique. Rendu pour les seuls sous-traitants —
        un formateur salarié n'a ni contrat-cadre ni vérification annuelle.
      */}
      {trainer.statut === "sous_traitant" && (
        <TrainerSousTraitancePanel
          trainerId={trainer.id}
          action={updateTrainerSousTraitancePiecesAction}
          contratSigneAt={trainer.sousTraitantContratSigneAt}
          screenshotUrl={trainer.sousTraitantScreenshotUrl}
          screenshotDate={trainer.sousTraitantScreenshotDate}
          prochaineVerifAt={trainer.sousTraitantProchaineVerifAt}
          rcProAttestationUrl={trainer.rcProAttestationUrl}
          rcProEcheanceAt={trainer.rcProEcheanceAt}
        />
      )}

      {/*
        Fiabilité — articles 7 et 8 de la procédure de sous-traitance (2026-08-03).

        Ce bloc DIT des faits, il ne note pas une personne : le niveau est dérivé
        des incidents consignés, jamais saisi à la main. Il n'interdit rien —
        décision de Will, cohérente avec la RC pro non bloquante : un formateur
        qui a fait tomber deux sessions peut rester le bon choix pour une mission
        donnée, et l'arbitrage lui revient.
      */}
      {fiabilite !== null && (
        <div className="admin-card mb-[var(--space-admin-5)]">
          <p className="admin-meta">Fiabilité (24 derniers mois)</p>

          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            {fiabilite.resume}
            {fiabilite.tauxIncidentsBloquants !== null && fiabilite.incidentsBloquants > 0 && (
              <> Soit {fiabilite.tauxIncidentsBloquants} % des missions.</>
            )}
          </p>

          {fiabilite.niveauVigilance !== "aucune" && (
            <p className="mt-2 text-[length:var(--text-admin-sm)]">
              <strong>
                {fiabilite.niveauVigilance === "vigilance_forte"
                  ? "Vigilance forte"
                  : "À surveiller"}
              </strong>{" "}
              — à prendre en compte lors de la reconduction (article 8). Cette mention
              n&apos;empêche pas de l&apos;affecter.
            </p>
          )}

          {incidents.length > 0 && (
            <ul className="mt-3 space-y-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              {incidents.map((i) => (
                <li key={i.id}>
                  {i.dateIncident.toLocaleDateString("fr-FR")} — {i.titre}
                  {i.session !== null && <> (session {i.session.numero})</>}
                </li>
              ))}
            </ul>
          )}

          <p className="admin-meta mt-3">
            Les incidents se consignent depuis le registre des incidents, en désignant
            l&apos;intervenant mis en cause.
          </p>
        </div>
      )}

      {/* Missions — refus et absences (2026-09-03). Des FAITS, datés et motivés. */}
      <div className="admin-card mb-[var(--space-admin-5)]">
        <p className="admin-meta">Missions proposées (24 derniers mois)</p>
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          {missions.proposees === 0
            ? "Aucune mission proposée par l'outil à ce jour."
            : `${missions.proposees} proposée${missions.proposees > 1 ? "s" : ""} · ` +
              `${missions.acceptees} acceptée${missions.acceptees > 1 ? "s" : ""} · ` +
              `${missions.refusees} refusée${missions.refusees > 1 ? "s" : ""} · ` +
              `${missions.sansReponse} sans réponse · ` +
              `${missions.expirees} expirée${missions.expirees > 1 ? "s" : ""}.`}{" "}
          {missions.absences > 0
            ? `${missions.absences} absence${missions.absences > 1 ? "s" : ""} consignée${missions.absences > 1 ? "s" : ""} (désistement ou annulation tardive).`
            : "Aucune absence consignée."}
        </p>
        {missions.derniersRefus.length > 0 && (
          <ul className="mt-3 space-y-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {missions.derniersRefus.map((r, i) => (
              <li key={`${r.session.numero}-${i}`}>
                {r.reponduAt !== null ? `${r.reponduAt.toLocaleDateString("fr-FR")} — ` : ""}
                refus de {r.session.titreSession} ({r.session.numero})
                {r.motifRefus !== null ? ` : « ${r.motifRefus} »` : ""}
              </li>
            ))}
          </ul>
        )}
        <p className="admin-meta mt-3">
          Une absence se consigne depuis la fiche de session (« Déclarer une absence ») ou depuis le
          registre des incidents.
        </p>
      </div>

      {/*
        Compétences ÉVALUÉES (2026-08-02).

        Cette surface ferme une non-conformité, pas un manque de confort : la
        structure `{domaine, niveauMaitrise, verifiedAt}` était LUE par les PDF
        et les garde-fous, et ÉCRITE par aucun écran.

        (2026-08-10, décision Will : le panneau d'habilitation AFEST a été
        retiré — le 1-to-1 est une prestation de conseil hors Qualiopi.)
      */}
      <TrainerCompetencesPanel trainerId={trainer.id} domainesInitiaux={domainesInitiaux} />

      {/* Saisie des pièces qui alimentent la carte conformité ci-dessus. */}
      <TrainerDocumentsPanel trainerId={trainer.id} documents={documents} />

      {/*
        Lettres de mission du formateur — contreseing de l'organisme (2026-08-01).

        Cette surface existe pour un cas que la page de session ne couvre pas :
        une lettre-CADRE ne couvrant QUE des coachings ou des audits n'apparaît
        sur aucune page de session — sans bloc ici, l'organisme ne pourrait
        jamais la contresigner et elle resterait à demi signée pour toujours.

        ⚠️ Rendu SEULEMENT s'il y en a : un formateur salarié ou dirigeant n'a
        aucune lettre (le générateur les refuse), un bloc vide se lirait comme
        une pièce manquante.
      */}
      {lettresConsole.length > 0 && (
        <div className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]">
          <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            Lettres de mission — contreseing de l&apos;organisme
          </h2>
          <div className="flex flex-col gap-[var(--space-admin-4)]">
            {lettresConsole.map((lettre) => (
              <div key={lettre.documentGenereId}>
                <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                  {lettre.estCadre
                    ? `Lettre-cadre — ${lettre.periodeLisible ?? "période non renseignée"}`
                    : `${lettre.sessionTitre} · ${lettre.sessionNumero}`}
                </p>
                <SignatureDocument
                  documentGenereId={lettre.documentGenereId}
                  titrePiece={lettre.estCadre ? "Lettre de mission-cadre" : "Lettre de mission"}
                  numero={lettre.numero}
                  parties={lettre.parties}
                  peutAgir={lettre.peutAgir}
                  motifBlocage={lettre.motifBlocage}
                  mentions={lettre.mentions}
                  plafondProbant={lettre.plafondProbant}
                  libelleBouton="Contresigner la lettre de mission"
                  labelSignature="Signature pour l'organisme de formation"
                  signerAction={contresignerLettreMissionAction}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <TrainerAvailabilityPanel trainerId={trainer.id} indispos={indispos} />

      <TrainerCompensationPanel
        trainerId={trainer.id}
        regles={regles}
        formations={formationOptions}
      />

      {/* Développement des compétences dans le temps (indicateur 22) */}
      <div className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]">
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Développement des compétences (ind. 22)
        </h2>
        <TrainerDevelopmentPanel
          trainerId={trainer.id}
          actions={devActions}
          addAction={addTrainerDevelopmentActionAction}
          deleteAction={deleteTrainerDevelopmentActionAction}
        />
      </div>

      <div className="mb-[var(--space-admin-6)]">
        <TrainerForm
          mode="edit"
          baseHref={base}
          trainerId={trainer.id}
          initial={{
            nom: trainer.nom,
            prenom: trainer.prenom,
            email: trainer.email,
            telephone: trainer.telephone,
            statut: trainer.statut,
            region: trainer.region,
            regionsIntervention: trainer.regionsIntervention,
            interventionFranceEntiere: trainer.interventionFranceEntiere,
            adresseProfessionnelle: trainer.adresseProfessionnelle,
            tarifJourneeHtCents: trainer.tarifJourneeHtCents,
            sousTraitantNda: trainer.sousTraitantNda,
          }}
        />
      </div>

      <TrainerManageForm
        trainerId={trainer.id}
        statut={trainer.statut}
        actif={trainer.actif}
        sousTraitantVerifie={trainer.sousTraitantVerifieAt != null}
        sousTraitantNda={trainer.sousTraitantNda}
        formations={formations}
        // 🔴 Constaté EN PRODUCTION le 2026-07-26 — l'écran était en impasse
        // fermée, et l'indicateur 21 structurellement inatteignable.
        //
        // `formationsHabilitees` est le tableau legacy : il tolère des ids de
        // formations supprimées. Celui du dirigeant en portait 33, tous
        // orphelins (formations de génération 1, remplacées à la refonte du
        // catalogue). Le formulaire s'initialisait avec ces 33 ids, ne pouvait
        // pas les AFFICHER — aucune case n'existe pour une formation supprimée —
        // et les renvoyait quand même à l'enregistrement. La clé étrangère de
        // `trainer_habilitations` les rejetait, toute la transaction était
        // annulée, et le `catch` avalait l'erreur : plus aucune habilitation ne
        // pouvait être enregistrée, pour personne, sans aucun moyen de s'en
        // sortir par l'interface.
        //
        // On ne transmet donc que les ids qui existent réellement au catalogue.
        // Effet de bord voulu : le premier enregistrement réécrit le tableau
        // legacy sans les orphelins, ce qui nettoie la donnée au passage.
        habilitations={trainer.formationsHabilitees.filter((id) =>
          formations.some((f) => f.id === id),
        )}
      />
    </AdminPageShell>
  );
}
