/**
 * Suivi de la qualité pédagogique des intervenants (Qualiopi ind. 21) — ce que la GARDE
 * DE MISSION aux portes refuse en plus : 2e mission sans observation favorable de la 1re,
 * suspension après une satisfaction sous le seuil, réévaluation annuelle échue.
 *
 * Module NEUTRE (le worker charge la garde). Interrupteur `formateurs.suivi_qualite`
 * éteint : rien n'est lu, rien n'est refusé. Allumé : ÉCHOUE FERMÉE.
 */

import { prisma } from "@/lib/prisma";

import type { MissionEnJeu } from "../montant-mission-lecture";
import { lireAllumageSuiviQualite, lireFaitsSuiviQualite } from "./lecture";
import { MANQUES_SUIVI_QUALITE, manquesSuiviQualite } from "./regles";

export async function manquesDuSuiviQualite(
  trainerId: string,
  maintenant: Date,
  enJeu?: MissionEnJeu,
): Promise<string[]> {
  let allumeLe: string | null;
  try {
    allumeLe = await lireAllumageSuiviQualite();
  } catch {
    // Un client sans table `setting` (doublure de test d'une autre suite) n'est pas une
    // panne : comportement d'avant le lot, comme `garde-mission-portes.ts`.
    if (
      typeof (prisma as { setting?: { findUnique?: unknown } }).setting?.findUnique !== "function"
    ) {
      return [];
    }
    return [MANQUES_SUIVI_QUALITE.erreur];
  }
  if (allumeLe === null) return [];
  try {
    const f = await lireFaitsSuiviQualite(trainerId, allumeLe);
    if (!f.trouve) return [MANQUES_SUIVI_QUALITE.erreur];
    const sessionId = enJeu !== undefined && "sessionId" in enJeu ? enJeu.sessionId : undefined;
    return manquesSuiviQualite(f, sessionId === undefined ? undefined : { sessionId }, maintenant);
  } catch {
    return [MANQUES_SUIVI_QUALITE.erreur];
  }
}
