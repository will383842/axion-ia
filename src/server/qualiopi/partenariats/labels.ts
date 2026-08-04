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

export const PARTENARIAT_TYPE_LABELS: Record<string, string> = {
  sous_traitance: "Sous-traitance",
  co_traitance: "Co-traitance",
  reseau_handicap: "Réseau handicap",
  orientation: "Orientation / prescription",
  autre: "Autre",
};

/** Ordre d'affichage dans les listes déroulantes. */
export const PARTENARIAT_TYPES = [
  "sous_traitance",
  "co_traitance",
  "reseau_handicap",
  "orientation",
  "autre",
] as const;

/**
 * Libellé d'un type. Un type inconnu n'est jamais maquillé en français : il est
 * cité tel quel, pour qu'on voie qu'il manque à cette table plutôt que de lire
 * un identifiant machine pris pour une phrase.
 */
export function libellerTypePartenariat(type: string): string {
  return PARTENARIAT_TYPE_LABELS[type] ?? `« ${type} »`;
}
