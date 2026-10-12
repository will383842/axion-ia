/**
 * Alerte `formateur_desistement_lettre_signee` — la DÉCISION préparée quand un formateur
 * se désiste alors que sa lettre de mission est signée (lot C, M11, hors argent).
 *
 * Le désistement annule la lettre NON signée ; une lettre signée est gardée au registre
 * (`seDesister`). Rien ne disait alors à l'administrateur qu'il lui restait à trancher.
 * Cette alerte le dit, avec les deux issues possibles :
 *   · annuler la lettre, avec un motif ;
 *   · ou constater le fait : consigner un incident « désistement » sur la session.
 * Elle se referme d'elle-même dès que l'une des deux est faite (une alerte qu'aucun
 * geste ne ferme est pire qu'une alerte absente : cf. `formateur_mission_expiree`).
 *
 * ⚠️ Aucun montant, aucune indemnité : ce que coûte le désistement est le lot D.
 * Éteinte tant que `formateurs.lettre_auto` n'est pas allumé. Aucun nom dans le texte.
 */

import { prisma } from "@/lib/prisma";
import { envoiAllume } from "@/server/qualiopi/formateurs-independants/interrupteurs-envoi";
import type { AlerteNiveau } from "../../../../prisma/generated/client";
import type { AlerteCandidate } from "./evaluateur";

const PLAFOND_MISSIONS = 200;

interface MissionDesistee {
  readonly sessionId: string;
  readonly numero: string;
  readonly titre: string;
  readonly debutLe: Date;
}

/** Décision PURE : une alerte par session, la plus récente d'abord, sans doublon. */
export function candidatsDesistementLettreSignee(
  missions: readonly MissionDesistee[],
): AlerteCandidate[] {
  const vues = new Set<string>();
  const out: AlerteCandidate[] = [];
  for (const m of missions) {
    if (vues.has(m.sessionId)) continue;
    vues.add(m.sessionId);
    out.push({
      code: "formateur_desistement_lettre_signee",
      niveau: "important" as AlerteNiveau,
      titre: "Désistement après lettre signée : à vous de décider",
      message:
        `Le formateur de la session ${m.numero} (${m.titre}, début le ${m.debutLe.toLocaleDateString("fr-FR")}) ` +
        "s'est désisté alors que sa lettre de mission était signée. Elle reste au registre. " +
        "Deux issues : annuler la lettre en indiquant le motif, ou constater le fait en " +
        "consignant un incident « désistement » sur la session.",
      cibleType: "TrainingSession",
      cibleId: m.sessionId,
    });
  }
  return out;
}

export async function regleDesistementLettreSignee(now: Date): Promise<AlerteCandidate[]> {
  if (!(await envoiAllume("lettre_auto"))) return [];
  const lues = await prisma.missionFormateur.findMany({
    where: {
      statut: "desistee",
      role: "principal",
      session: { is: { dateFin: { gt: now } } },
      // La lettre de CE formateur sur CETTE session : vivante et signée par lui.
      lettreMission: {
        is: { annuleeAt: null, signatures: { some: { revokedAt: null, partie: "formateur" } } },
      },
    },
    orderBy: { desisteAt: "desc" },
    take: PLAFOND_MISSIONS,
    select: {
      trainerId: true,
      session: {
        select: {
          id: true,
          numero: true,
          titreSession: true,
          dateDebut: true,
          incidents: { select: { trainerId: true } },
        },
      },
    },
  });
  return candidatsDesistementLettreSignee(
    lues
      // Constaté : un incident visant CE formateur est consigné sur la session.
      .filter((m) => !m.session.incidents.some((i) => i.trainerId === m.trainerId))
      .map((m) => ({
        sessionId: m.session.id,
        numero: m.session.numero,
        titre: m.session.titreSession,
        debutLe: m.session.dateDebut,
      })),
  );
}
