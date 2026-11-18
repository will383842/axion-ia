/**
 * Comparatif — contrôle du tableau récapitulatif (lot L3, audit du 24/10/2026).
 *
 * Un comparatif doit comparer : un tableau d'une ou deux lignes n'est pas un
 * comparatif. Module PUR (aucun import), testable sans base ni réseau.
 */

/** Nombre minimal de lignes de données (hors en-tête) dans le tableau comparatif. */
export const MIN_LIGNES_TABLEAU = 3;

/**
 * Compte les lignes de DONNÉES du tableau : une ligne `<tr>` qui porte au moins
 * une cellule `<td>`. L'en-tête (`<th>` seul) n'est pas compté. Tous les
 * tableaux du corps sont additionnés.
 */
export function compterLignesTableau(bodyHtml: string): number {
  const lignes = bodyHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  return lignes.filter((l) => /<td[\s>]/i.test(l)).length;
}

/** `true` si le corps contient un tableau avec au moins `MIN_LIGNES_TABLEAU` lignes de données. */
export function tableauSuffisant(bodyHtml: string): boolean {
  return compterLignesTableau(bodyHtml) >= MIN_LIGNES_TABLEAU;
}
