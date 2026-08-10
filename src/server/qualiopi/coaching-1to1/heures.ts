/**
 * Coaching 1-to-1 (conseil) — calcul des heures réelles.
 *
 * 2026-08-10 (décision Will) : issu de la réduction de l'ancien
 * `coaching-afest/heures.ts`. Le 1-to-1 est une prestation de CONSEIL hors
 * Qualiopi : la chaîne de preuve AFEST (régimes de preuve `legacy_boolean` /
 * `signature_reelle`, neutralisation par statut de séance, signatures de
 * séance) a disparu avec le module. Les heures réelles redeviennent la somme
 * brute des durées saisies au compte-rendu, sans gate de régime de preuve :
 *
 *   heures = Σ CompteRenduSeance.dureeMinutes / 60 (arrondi au centième).
 *
 * Fonctions pures (testables sans DB) + lecteurs DB stub-aware.
 */

import { prisma } from "@/lib/prisma";

/** Une séance, réduite à ce que le comptage lit. */
export interface SeancePourHeures {
  dureeMinutes: number | null;
}

/**
 * Σ des durées de séance, en heures décimales arrondies au centième.
 * Une séance sans durée (null) compte pour zéro.
 */
export function sumHeuresReelles(comptesRendus: ReadonlyArray<SeancePourHeures>): number {
  const minutes = comptesRendus.reduce((acc, cr) => acc + (cr.dureeMinutes ?? 0), 0);
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Taux d'avancement 1-to-1 = heures réalisées / heures prévues au contrat.
 *
 * 🔴 Sans durée prévue, le taux est INCALCULABLE, pas 100 % : on retourne
 * `null`, à charge de l'appelant d'afficher « non calculable » plutôt qu'un
 * chiffre flatteur et faux (leçon de l'audit F65 du 2026-07-26).
 *
 * @returns Le taux en %, ou `null` si aucune durée prévue n'est renseignée.
 */
export function computeTaux1to1(
  heuresReelles: number,
  heuresPrevues: number | null,
): number | null {
  if (heuresPrevues == null || heuresPrevues <= 0) {
    return null;
  }
  return Math.round((heuresReelles / heuresPrevues) * 100);
}

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** Heures réelles d'UN parcours. Stub-aware. */
export async function getHeuresReelles1to1(coachingSessionId: string): Promise<number> {
  if (estStub()) return 0;
  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingSessionId },
    select: { comptesRendus: { select: { dureeMinutes: true } } },
  });
  if (cs === null) return 0;
  return sumHeuresReelles(cs.comptesRendus);
}

/** Heures réelles d'un CONTRAT = Σ des parcours qu'il regroupe. Stub-aware. */
export async function getHeuresReellesContrat(coachingContractId: string): Promise<number> {
  if (estStub()) return 0;
  const sessions = await prisma.coachingSession.findMany({
    where: { coachingContractId },
    select: { comptesRendus: { select: { dureeMinutes: true } } },
  });
  const total = sessions.reduce((acc, cs) => acc + sumHeuresReelles(cs.comptesRendus), 0);
  return Math.round(total * 100) / 100;
}
