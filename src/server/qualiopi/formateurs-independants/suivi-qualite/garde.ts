/**
 * Suivi de la qualité pédagogique des intervenants (Qualiopi ind. 21) — ce que la GARDE
 * DE MISSION aux portes refuse en plus : 2e mission sans observation favorable de la 1re,
 * suspension après une satisfaction sous le seuil, réévaluation annuelle échue.
 *
 * Module NEUTRE (le worker charge la garde). Interrupteur `formateurs.suivi_qualite`
 * éteint : rien n'est lu, rien n'est refusé. Allumé : ÉCHOUE FERMÉE. Les seuils sont les
 * réglages de la console ; illisibles, ce sont les défauts (jamais plus permissifs).
 */

import { prisma } from "@/lib/prisma";

import type { MissionEnJeu } from "../montant-mission-lecture";
import { lireAllumageSuiviQualite, lireFaitsSuiviQualite } from "./lecture";
import { lireReglagesSuiviQualite } from "./reglages-lecture";
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
    const [f, reglages] = await Promise.all([
      lireFaitsSuiviQualite(trainerId, allumeLe),
      lireReglagesSuiviQualite(),
    ]);
    if (!f.trouve) return [MANQUES_SUIVI_QUALITE.erreur];
    const sessionId = sessionDeLaMissionEnJeu(enJeu);
    return manquesSuiviQualite(
      f,
      sessionId === undefined ? undefined : { sessionId },
      maintenant,
      reglages,
    );
  } catch {
    return [MANQUES_SUIVI_QUALITE.erreur];
  }
}

/**
 * La session dont on décide, jamais comptée comme « autre mission » : la session même
 * (acceptation, lettre, affectation), ou au REPORT la session reportée — la mission que
 * le report remplace. Création d'une session : aucune (elle n'existe pas encore). Sans
 * mission en jeu (mission déjà acceptée) : aucune.
 */
export function sessionDeLaMissionEnJeu(enJeu: MissionEnJeu | undefined): string | undefined {
  if (enJeu === undefined) return undefined;
  if ("sessionId" in enJeu) return enJeu.sessionId;
  return enJeu.nouvelleSession.remplaceSessionId;
}
