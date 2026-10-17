/**
 * Qualiopi ind. 21 — lecture de la garde de mission « décision d'habilitation en
 * vigueur » : les lignes du formateur et la formation de la mission en jeu, puis le
 * verdict pur (`garde-mission-q21.ts`).
 *
 * Module NEUTRE (Prisma seulement) : appelé par `garde-mission-portes.ts`, que le worker
 * charge. N'est appelé que quand `formateurs.garde_mission_portes` est allumé.
 */

import { prisma } from "@/lib/prisma";

import type { MissionEnJeu } from "../montant-mission-lecture";
import { manqueHabilitationMission } from "./garde-mission-q21";
import { lireEvaluationsDuFormateur } from "./lecture";

/**
 * La formation de la mission en jeu : `undefined` sans mission précise, `null` si elle
 * est illisible (session introuvable, nouvelle session sans formation).
 */
export async function formationDeLaMission(
  enJeu: MissionEnJeu | undefined,
): Promise<string | null | undefined> {
  if (enJeu === undefined) return undefined;
  if ("nouvelleSession" in enJeu) return enJeu.nouvelleSession.formationId;
  const session = await prisma.trainingSession.findUnique({
    where: { id: enJeu.sessionId },
    select: { formationId: true },
  });
  return session?.formationId ?? null;
}

/** Le manque « pas de décision d'habilitation en vigueur », ou `null`. Lève sur panne. */
export async function lireManqueHabilitationMission(
  trainerId: string,
  statut: string,
  enJeu: MissionEnJeu | undefined,
): Promise<string | null> {
  const [lignes, formationId] = await Promise.all([
    Promise.resolve().then(() => lireEvaluationsDuFormateur(trainerId)),
    Promise.resolve().then(() => formationDeLaMission(enJeu)),
  ]);
  return manqueHabilitationMission(statut, lignes, formationId);
}
