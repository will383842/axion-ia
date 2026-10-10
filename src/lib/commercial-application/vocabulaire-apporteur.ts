/**
 * LE VOCABULAIRE INTERDIT CÔTÉ APPORTEUR — une seule liste, lue par les gardes.
 *
 * Un futur apporteur d'affaires est un indépendant qui RECOMMANDE Axion-IA. Lui
 * écrire — ou écrire sur lui dans la console — avec les mots d'une sélection
 * d'emploi, c'est écrire la preuve d'un lien de subordination
 * (`features/personne/fiche-personne.ts`, contrainte juridique). Les textes
 * pré-remplis du composeur apporteur, ses libellés et les pastilles d'étape
 * apporteur sont balayés par cette liste (tests `vocabulaire-apporteur.spec.ts`
 * et suivants).
 *
 * Module PUR : il est lu par des tests et par la console, jamais par le worker.
 */

export const MOTS_INTERDITS_APPORTEUR: ReadonlyArray<RegExp> = [
  /\bcandidat/i,
  /\bentretiens?\b/i,
  /\bpostes?\b/i,
  /\bembauch/i,
  /\brecrut/i,
  /\bobjectifs?\b/i,
  /\bhoraires?\b/i,
  /\bsalaires?\b/i,
  /\bsalariés?\b/i,
  /\bmissions?\b/i,
  /\bmanager\b/i,
  /\bvendeurs?\b/i,
  /\bagent commercial\b/i,
  /\bhiérarchie\b/i,
  /\bretenue?s?\b/i,
  /\bprocessus de sélection/i,
  /\bshortlist/i,
  /\bconsignes?\b/i,
  /\bCV\b/,
];

/** Les mots interdits trouvés dans `texte` (vide : le texte est propre). */
export function motsInterditsApporteur(texte: string): string[] {
  return MOTS_INTERDITS_APPORTEUR.filter((m) => m.test(texte)).map((m) => m.source);
}
