/**
 * Lot L08 — le formateur saisit l'évaluation finale DANS SON ESPACE.
 *
 * L'évaluation passe par `createEvaluation` (même barème, même seuil figé, même
 * règle « aucun objectif non acquis », même garde de chronologie que la console),
 * dans la transaction qui vérifie « pas de finale en double ». La grille PDF est
 * produite APRÈS l'enregistrement, à partir de la saisie (O13) : si le rendu
 * échoue, l'évaluation reste enregistrée et la production automatique reprend la
 * grille au passage suivant.
 *
 * Toute porte est fermée par défaut : interrupteur éteint, session qui n'est pas
 * la sienne, stagiaire qui n'en est pas, dossier clos, finale déjà saisie.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { whereSessionsDuFormateur } from "@/server/formateur/collectif-queries";
import { produireGrilleEvaluation } from "@/server/qualiopi/documents/production/producteurs";
import { createEvaluation } from "@/server/qualiopi/evaluations/evaluations-service";
import { normaliserObjectifsPedagogiques } from "@/server/qualiopi/formations/objectifs";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { assertDossierOuvert } from "@/server/qualiopi/sessions/verrou-dossier-garde";
import { pedagogieActivePour } from "./interrupteur";
import { validerSaisieEvaluation } from "./saisie-evaluation";

export type IssueSaisie =
  | "ok"
  | "ok_sans_grille"
  | "non_active"
  | "non_membre"
  | "stagiaire_inconnu"
  | "invalide"
  | "dossier_clos"
  | "deja_evalue"
  | "erreur";

export interface VueSaisie {
  readonly objectifs: string[];
  readonly stagiaires: ReadonlyArray<{
    readonly enrollmentId: string;
    readonly prenom: string;
    readonly nom: string;
    readonly finale: {
      readonly niveauGlobal: string;
      readonly scorePct: number;
      readonly reussite: boolean;
    } | null;
  }>;
}

/** La session du formateur, ses objectifs et le gel de l'interrupteur — ou `null`. */
async function garder(sessionId: string, trainerId: string) {
  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, ...whereSessionsDuFormateur(trainerId) },
    select: {
      id: true,
      estTestInterne: true,
      formationSnapshot: true,
      formation: { select: { titre: true, objectifsPedagogiques: true } },
    },
  });
  if (session === null) return { issue: "non_membre" as const };
  if (!(await pedagogieActivePour({ estTestInterne: session.estTestInterne }))) {
    return { issue: "non_active" as const };
  }
  const formation = readFormationForDocs(session.formationSnapshot, session.formation);
  return {
    issue: "ok" as const,
    objectifs: normaliserObjectifsPedagogiques(formation.objectifsPedagogiques),
  };
}

/** Ce que l'écran affiche. `null` : pas de bloc (éteint, ou pas sa session). */
export async function lireSaisieFormateur(
  sessionId: string,
  trainerId: string,
): Promise<VueSaisie | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;
  const g = await garder(sessionId, trainerId);
  if (g.issue !== "ok") return null;
  const inscrits = await prisma.enrollment.findMany({
    where: { sessionId, ...inscriptionsActives(), trainee: { deletedAt: null } },
    select: {
      id: true,
      trainee: { select: { prenom: true, nom: true } },
      evaluations: {
        where: { type: "finale" },
        orderBy: { dateEvaluation: "desc" },
        take: 1,
        select: { niveauGlobal: true, scorePct: true, reussite: true },
      },
    },
    orderBy: { trainee: { nom: "asc" } },
  });
  return {
    objectifs: g.objectifs,
    stagiaires: inscrits.map((i) => ({
      enrollmentId: i.id,
      prenom: i.trainee.prenom,
      nom: i.trainee.nom,
      finale:
        i.evaluations[0] === undefined
          ? null
          : {
              niveauGlobal: String(i.evaluations[0].niveauGlobal),
              scorePct: i.evaluations[0].scorePct,
              reussite: i.evaluations[0].reussite,
            },
    })),
  };
}

export async function enregistrerEvaluationFormateur(i: {
  readonly sessionId: string;
  readonly trainerId: string;
  readonly enrollmentId: string;
  readonly notes: ReadonlyArray<number>;
  readonly observations: ReadonlyArray<string>;
  readonly recommandations?: string;
  /** Date serveur, posée par l'action : jamais lue du navigateur. */
  readonly maintenant: Date;
}): Promise<{ issue: IssueSaisie; erreurs?: string[] }> {
  const g = await garder(i.sessionId, i.trainerId);
  if (g.issue !== "ok") return { issue: g.issue };

  const inscription = await prisma.enrollment.findFirst({
    where: { id: i.enrollmentId, sessionId: i.sessionId, ...inscriptionsActives() },
    select: { id: true },
  });
  if (inscription === null) return { issue: "stagiaire_inconnu" };

  const saisie = validerSaisieEvaluation({
    objectifs: g.objectifs,
    notes: i.notes,
    observations: i.observations,
    ...(i.recommandations !== undefined ? { recommandations: i.recommandations } : {}),
  });
  if (!saisie.ok) return { issue: "invalide", erreurs: saisie.erreurs };

  const verrou = await assertDossierOuvert({ enrollmentId: i.enrollmentId });
  if (!verrou.ok) return { issue: "dossier_clos" };

  const issue = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`evaluation.finale.${i.enrollmentId}`}))`;
    const deja = await tx.evaluationAcquis.count({
      where: { enrollmentId: i.enrollmentId, type: "finale" },
    });
    if (deja > 0) return "deja_evalue" as const;
    const created = await createEvaluation(
      {
        enrollmentId: i.enrollmentId,
        type: "finale",
        dateEvaluation: i.maintenant.toISOString(),
        competences: saisie.competences,
        ...(saisie.recommandations !== undefined
          ? { recommandations: saisie.recommandations }
          : {}),
        evalueParId: i.trainerId,
      },
      tx,
    );
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.evaluation_finale_saisie",
        targetType: "EvaluationAcquis",
        targetId: created.id,
        changes: {
          sessionId: i.sessionId,
          trainerId: i.trainerId,
          nbCompetences: saisie.competences.length,
        },
        session: null,
      },
      { exiger: true },
    );
    return "ok" as const;
  });
  if (issue !== "ok") return { issue };

  // La grille naît de la saisie. Son échec ne défait pas l'évaluation.
  try {
    const grille = await produireGrilleEvaluation(i.enrollmentId);
    return { issue: grille.ok ? "ok" : "ok_sans_grille" };
  } catch {
    return { issue: "ok_sans_grille" };
  }
}
