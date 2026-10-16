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
 *
 * Vérification 2, V2-A-4 — une journée désignée à un formateur qui s'est DÉSISTÉ
 * (mission `desistee`, plus affecté à la session) n'est plus à lui : sa désignation
 * est caduque. Elle revient aux formateurs affectés qui n'ont aucune journée désignée
 * en propre (le remplaçant) ; s'il n'y en a aucun, à tous les affectés, comme une
 * journée sans désignation. Seuls les lecteurs qui connaissent les désistés
 * (`desistes`) appliquent cette règle ; sans eux, rien ne change.
 */

export function journeesDuFormateur<J extends { readonly trainerId: string | null }>(
  jours: ReadonlyArray<J>,
  trainerId: string,
  affectes: ReadonlyArray<{ readonly trainerId: string }>,
  desistes: ReadonlySet<string> = new Set(),
): J[] {
  const estAffecte = (id: string) => affectes.some((sf) => sf.trainerId === id);
  const caduque = (j: J) =>
    j.trainerId !== null && desistes.has(j.trainerId) && !estAffecte(j.trainerId);
  const affecte = estAffecte(trainerId);
  let recoitLesCaduques = false;
  if (affecte && jours.some(caduque)) {
    const designesEnPropre = new Set(
      jours.flatMap((j) => (j.trainerId !== null && !caduque(j) ? [j.trainerId] : [])),
    );
    const remplacants = affectes.filter((sf) => !designesEnPropre.has(sf.trainerId));
    recoitLesCaduques =
      remplacants.length === 0 || remplacants.some((sf) => sf.trainerId === trainerId);
  }
  return jours.filter((j) => {
    if (caduque(j)) return recoitLesCaduques;
    return j.trainerId === trainerId || (j.trainerId === null && affecte);
  });
}

/**
 * V2-A-4 — les formateurs DÉSISTÉS d'une session : leur sollicitation la plus récente
 * est `desistee` et ils ne sont plus affectés. `missions` est trié de la plus récente à
 * la plus ancienne (la première rencontrée par formateur fait foi).
 */
export function desistesDeLaSession(
  missions: ReadonlyArray<{ readonly trainerId: string; readonly statut: string }>,
  affectes: ReadonlyArray<{ readonly trainerId: string }>,
): Set<string> {
  const vus = new Set<string>();
  const desistes = new Set<string>();
  for (const m of missions) {
    if (vus.has(m.trainerId)) continue;
    vus.add(m.trainerId);
    if (m.statut === "desistee" && !affectes.some((sf) => sf.trainerId === m.trainerId))
      desistes.add(m.trainerId);
  }
  return desistes;
}
