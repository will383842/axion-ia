/**
 * Libellés des types de partenariat — source unique.
 *
 * 🔴 POURQUOI CE FICHIER (audit du code, 2026-08-03). La table existait déjà,
 * mais en TROIS exemplaires, tous écrits à la main dans du JSX : les `<option>`
 * de `PartenariatForm`, celles de `PartenariatRowActions`, et… nulle part pour
 * la LISTE, qui affichait donc la valeur brute — « reseau_handicap »,
 * « co_traitance » — dans sa colonne « Type ». La page filtrait même sur cette
 * valeur sans jamais la traduire.
 *
 * Trois copies d'une même table, dont une manquante : le jour où l'on ajoute un
 * type, il apparaît traduit dans un formulaire, brut dans l'autre, et absent de
 * la liste. Une seule table, consommée partout.
 */

/** Ordre d'affichage dans les listes déroulantes, et VOCABULAIRE de la colonne. */
export const PARTENARIAT_TYPES = [
  "sous_traitance",
  "co_traitance",
  "reseau_handicap",
  "orientation",
  "autre",
] as const;

export type PartenariatType = (typeof PARTENARIAT_TYPES)[number];

/**
 * Le type qui COUVRE l'indicateur 26 ⭐.
 *
 * 🔴 2026-09-02 (audit certificateur) — nommé plutôt que recopié, parce qu'un
 * littéral s'écrit de travers et que celui-ci s'est écrit de travers. Le seed de
 * démonstration posait, dans cette colonne, la PHRASE « réseau handicap /
 * inclusion numérique » — lisible, plausible, et invisible au moteur, qui compte
 * `type: "reseau_handicap"`. Résultat mesuré : l'écran affichait « Réseau
 * handicap actifs : 0 » au-dessus d'une ligne dont la colonne Type disait
 * « réseau handicap / inclusion numérique », et l'indicateur 26 — un
 * SUPER-indicateur — restait rouge, motif « 0 partenariat réseau handicap sur 1
 * au total ».
 *
 * Le libellé, lui, faisait déjà son travail : il rendait la valeur inconnue
 * ENTRE GUILLEMETS. C'est l'écrivain qui manquait de garde, pas le lecteur.
 */
export const TYPE_PARTENARIAT_HANDICAP: PartenariatType = "reseau_handicap";

/** `Record` exhaustif : ajouter un type sans son libellé ne compile plus. */
export const PARTENARIAT_TYPE_LABELS: Record<PartenariatType, string> = {
  sous_traitance: "Sous-traitance",
  co_traitance: "Co-traitance",
  reseau_handicap: "Réseau handicap",
  orientation: "Orientation / prescription",
  autre: "Autre",
};

/**
 * Libellé d'un type. Un type inconnu n'est jamais maquillé en français : il est
 * cité tel quel, pour qu'on voie qu'il manque à cette table plutôt que de lire
 * un identifiant machine pris pour une phrase.
 */
export function libellerTypePartenariat(type: string): string {
  return PARTENARIAT_TYPE_LABELS[type as PartenariatType] ?? `« ${type} »`;
}
