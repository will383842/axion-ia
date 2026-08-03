/**
 * Admin — Qualiopi · Fiche formateur (R9).
 * Édition identité + habilitations par formation + vérification sous-traitant + activation.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
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
import { TrainerAfestPanel } from "@/components/admin/qualiopi/TrainerAfestPanel";
import { TrainerAvailabilityPanel } from "@/components/admin/qualiopi/TrainerAvailabilityPanel";
import { TrainerCompensationPanel } from "@/components/admin/qualiopi/TrainerCompensationPanel";
import {
  TrainerDevelopmentPanel,
  type TrainerDevelopmentActionType,
} from "@/components/admin/qualiopi/TrainerDevelopmentPanel";
import {
  addTrainerDevelopmentActionAction,
  deleteTrainerDevelopmentActionAction,
} from "@/server/actions/qualiopi/trainers";
import { listIndisposFormateur } from "@/server/qualiopi/trainers/availability-queries";
import {
  listReglesFormateur,
  listFormationOptions,
} from "@/server/qualiopi/remuneration/rules-queries";
import { getTrainer } from "@/server/qualiopi/trainers/trainers";
import { genererCvFormateurAction } from "@/server/actions/qualiopi/exports-pdf";
import { lireLettresMissionConsoleDuFormateur } from "@/server/qualiopi/documents/signature/lettre-mission-queries";
import { contresignerLettreMissionAction } from "@/server/actions/qualiopi/lettre-mission-signature";
import { SignatureDocument } from "@/components/espace-formateur/SignatureDocument";
import { PdfExportButton } from "@/components/admin/qualiopi/PdfExportButton";
import { VerserFicheFormateurButton } from "@/components/admin/qualiopi/VerserFicheFormateurButton";
import { Ban, TriangleAlert } from "lucide-react";

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
// sessions Qualiopi animées + interventions calendrier confirmées/réalisées.
// Stub-safe (build sans DB → 0).
async function getTrainerActivityCounts(
  trainerId: string,
): Promise<{ sessionsCount: number; interventionsCount: number }> {
  try {
    const [sessionsCount, interventionsCount] = await Promise.all([
      prisma.trainingSession.count({ where: { formateurPrincipalId: trainerId } }),
      prisma.booking.count({
        where: {
          formateurId: trainerId,
          status: {
            in: [
              "confirmed",
              "reminded_j7",
              "in_progress",
              "completed",
              "invoiced_balance",
              "paid_balance",
            ],
          },
        },
      }),
    ]);
    return { sessionsCount, interventionsCount };
  } catch {
    return { sessionsCount: 0, interventionsCount: 0 };
  }
}

export default async function FicheFormateurPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

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
  const { sessionsCount, interventionsCount } = await getTrainerActivityCounts(trainer.id);

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

  const afestHabiliteAtInitial = trainer.afestHabiliteAt
    ? trainer.afestHabiliteAt.toISOString().slice(0, 10)
    : "";

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
  const now = new Date();
  const conformite = await getTrainerConformite(trainer.id, now.getUTCFullYear(), now);
  const bloquants = conformite?.manquements.filter((m) => m.gravite === "bloquant") ?? [];
  const alertes = conformite?.manquements.filter((m) => m.gravite === "alerte") ?? [];

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
          <strong>{sessionsCount}</strong> session{sessionsCount > 1 ? "s" : ""} Qualiopi animée
          {sessionsCount > 1 ? "s" : ""} · <strong>{interventionsCount}</strong> intervention
          {interventionsCount > 1 ? "s" : ""} calendrier réalisée{interventionsCount > 1 ? "s" : ""}
          {" — soit "}
          <strong>{sessionsCount + interventionsCount}</strong> au total.
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
        Compétences ÉVALUÉES et habilitation AFEST (2026-08-02).

        Ces deux surfaces ferment des non-conformités, pas des manques de
        confort : la structure `{domaine, niveauMaitrise, verifiedAt}` et le
        champ `afestHabiliteAt` étaient LUS par les PDF et les garde-fous, et
        ÉCRITS par aucun écran. La fiche formateur sortait donc « — / Non
        vérifié » sur chaque compétence et « Non habilité » en AFEST, sans
        qu'aucune manipulation ne puisse y changer quoi que ce soit.
      */}
      <TrainerCompetencesPanel trainerId={trainer.id} domainesInitiaux={domainesInitiaux} />
      <TrainerAfestPanel trainerId={trainer.id} habiliteAtInitial={afestHabiliteAtInitial} />

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
