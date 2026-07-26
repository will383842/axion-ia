/**
 * Qualiopi 1-to-1 / AFEST — calcul des heures réelles (C1, 2026-06-14).
 *
 * Règle FONDAMENTALE : les heures d'un parcours 1-to-1 = Σ des durées de séance
 * réellement réalisées (`CompteRenduSeance.dureeMinutes`), JAMAIS
 * `Formation.dureeHeures × taux` (logique des formations collectives).
 *
 * Fonctions pures (testables sans DB) + lecteur DB stub-aware.
 */

import { prisma } from "@/lib/prisma";

/**
 * Somme pure des durées de séance (minutes) → heures décimales arrondies au
 * centième (format réglementaire R.6313-3). Les séances sans durée saisie
 * (`dureeMinutes` null) comptent pour 0.
 *
 * 🔴 Présence — on N'EXCLUT QUE les séances explicitement actées ABSENTES, à
 * savoir présence SIGNÉE (`presenceSigneeAt != null`) ET bénéficiaire déclaré
 * absent (`beneficiairePresent === false`). Compter la durée prévue d'une
 * absence avérée sur-déclarerait les heures réalisées.
 *
 * On NE filtre PAS sur `beneficiairePresent` seul : ce booléen vaut `false`
 * tant que la présence n'a pas été signée, si bien qu'un tel filtre mettrait à
 * zéro toutes les séances en attente de signature (régression). Le cas
 * résiduel « séance absente laissée non signée » n'est pas distinguable d'une
 * séance en attente et relève du chantier fondation signature AFEST (différé).
 */
export function sumHeuresReelles(
  comptesRendus: ReadonlyArray<{
    dureeMinutes: number | null;
    presenceSigneeAt?: Date | null;
    beneficiairePresent?: boolean;
  }>,
): number {
  const minutes = comptesRendus.reduce((acc, cr) => {
    const absenceActee = cr.presenceSigneeAt != null && cr.beneficiairePresent === false;
    if (absenceActee) return acc;
    return acc + (cr.dureeMinutes ?? 0);
  }, 0);
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Taux d'assiduité 1-to-1 = heures réalisées / heures prévues à la convention.
 *
 * 🔴 Audit certification 2026-07-26 (F65). Sans durée conventionnelle, la
 * fonction retournait **100 %** dès qu'une seule heure était réalisée — et ce
 * taux partait sur l'attestation. Un parcours de 2 h sur 30 prévues aurait été
 * attesté « 100 % d'assiduité » du seul fait qu'aucune durée n'était renseignée.
 *
 * Un taux d'assiduité SANS référence n'est pas 100 %, c'est un taux
 * **incalculable**. On retourne donc `null`, à charge de l'appelant d'afficher
 * « non calculable » plutôt qu'un chiffre flatteur et faux.
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

/**
 * Lecture DB : heures réelles d'un parcours coaching = Σ CompteRenduSeance.
 * Stub-aware (retourne 0 au build `stub.invalid`).
 */
export async function getHeuresReelles1to1(coachingSessionId: string): Promise<number> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return 0;
  const comptesRendus = await prisma.compteRenduSeance.findMany({
    where: { coachingSessionId },
    select: { dureeMinutes: true, presenceSigneeAt: true, beneficiairePresent: true },
  });
  return sumHeuresReelles(comptesRendus);
}
