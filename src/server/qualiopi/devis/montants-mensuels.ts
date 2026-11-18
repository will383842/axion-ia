/**
 * Calculs mensuels PURS (aucun hachage, aucun import Node) : importables par un composant
 * client sans tirer `node:crypto`. Réexportés par `offre-calculs`.
 */

/** Mensuel net après remise, arrondi AVANT toute multiplication par les mois. */
export function prixMensuelNet(mensuelHtCents: number, remiseBps: number): number {
  if (!Number.isInteger(remiseBps) || remiseBps < 0 || remiseBps > 10000) {
    throw new RangeError(`Remise hors [0, 10000] points de base : ${remiseBps}.`);
  }
  if (mensuelHtCents < 0) throw new RangeError("Mensuel négatif refusé.");
  return Math.round((mensuelHtCents * (10000 - remiseBps)) / 10000);
}

/**
 * Plafond de l'indemnité de sortie anticipée : taux × mensualités restantes
 * (somme en centimes, hors IA).
 */
export function indemniteSortieMaxCents(
  mensualitesRestantesCents: number,
  tauxBps: number,
): number {
  if (!Number.isFinite(mensualitesRestantesCents) || mensualitesRestantesCents < 0) {
    throw new RangeError(
      `Mensualités restantes invalides (≥ 0 attendu) : ${mensualitesRestantesCents}.`,
    );
  }
  if (!Number.isInteger(tauxBps) || tauxBps < 0 || tauxBps > 10000) {
    throw new RangeError(`Taux hors [0, 10000] points de base : ${tauxBps}.`);
  }
  return Math.round((mensualitesRestantesCents * tauxBps) / 10000);
}
