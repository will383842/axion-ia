/**
 * Formateurs indépendants — LES JOURNÉES D'UNE SESSION QUI REVIENNENT À UN
 * FORMATEUR (étape 4), pur.
 *
 * 🔑 SEULE règle, lue par le paiement par mission (`passage-mission-base.ts`),
 * la lettre de mission v2 et la proposition chiffrée : en co-animation, chacun
 * n'annonce et ne reçoit que SES journées.
 *
 *   - une journée désignée à ce formateur (`SessionJour.trainerId`) lui revient ;
 *   - une journée sans formateur désigné revient à TOUT formateur affecté à la
 *     session (principal ou co-formateur, `SessionFormateur`) ;
 *   - une journée désignée à un autre ne lui revient jamais.
 */

export function journeesDuFormateur<J extends { readonly trainerId: string | null }>(
  jours: ReadonlyArray<J>,
  trainerId: string,
  affectes: ReadonlyArray<{ readonly trainerId: string }>,
): J[] {
  const affecte = affectes.some((sf) => sf.trainerId === trainerId);
  return jours.filter((j) => j.trainerId === trainerId || (j.trainerId === null && affecte));
}
