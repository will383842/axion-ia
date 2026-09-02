/**
 * Les statuts d'une revue de direction — écrits une seule fois, en module PUR.
 *
 * ## Le défaut que ce module ferme (2026-09-02, audit certificateur)
 *
 * `RevueDirection.statut` est une colonne `VarChar(20)` libre : le schéma
 * n'impose rien. La liste des trois valeurs vivait dans le module des Server
 * Actions — donc inaccessible à un seed, à un test pur, ou à tout écrivain qui
 * passe à côté de l'action. Et c'est exactement ce qui s'est produit.
 *
 * **Le seed de démonstration écrit `"valide"`.** Toute l'application lit
 * `"validee"`. Conséquences mesurées sur la base de recette le 2026-09-02 :
 *
 *   - l'écran « Revue de direction » affiche « Total revues 1 · **Validées 0** »
 *     au-dessus d'une ligne dont la colonne STATUT affiche « valide » — l'écran
 *     se contredit lui-même, sur un écran d'audit ;
 *   - l'indicateur **32 ⭐** (mise en œuvre de l'amélioration continue,
 *     NC majeure) reste « à compléter » avec le motif « Aucune revue de
 *     direction VALIDÉE pour 2026 », alors que la revue existe, qu'elle porte
 *     ses trois décisions, ses trois actions et son instantané d'indicateurs ;
 *   - et **un test verrouillait la faute** : `demo.spec.ts` affirmait
 *     `expect(data.revueDirection.statut).toBe("valide")`.
 *
 * 🔑 Le repli silencieux a rendu la faute invisible : l'écran écrivait
 * `LIBELLES[statut] ?? statut`, donc une valeur inconnue s'affichait telle
 * quelle et passait pour un statut légitime. Un repli qui recopie l'entrée ne
 * signale rien — il déguise. Ici, il rend la valeur brute ENTRE GUILLEMETS,
 * comme le fait déjà le vocabulaire des types de pièces.
 *
 * ⚠️ Tout nouvel écrivain de cette colonne — seed, script, migration — importe
 * ces valeurs. `statuts-revue.spec.ts` refuse tout littéral hors liste dans le
 * code qui écrit `RevueDirection`.
 */

/** Les TROIS statuts d'une revue de direction, et rien d'autre. */
export const STATUTS_REVUE = ["brouillon", "validee", "archivee"] as const;

export type StatutRevue = (typeof STATUTS_REVUE)[number];

/**
 * Le statut qui COUVRE l'indicateur 32.
 *
 * Nommé plutôt que recopié : la règle de couverture, l'écran, l'alerte et le
 * manifeste doivent parler du même statut, et un littéral répété quatre fois
 * finit par diverger — c'est la faute que ce module répare.
 */
export const STATUT_REVUE_COUVRANTE: StatutRevue = "validee";

/** Libellé humain de chaque statut. `Record` exhaustif : oublier ne compile pas. */
export const LIBELLES_STATUT_REVUE: Record<StatutRevue, string> = {
  brouillon: "Brouillon",
  validee: "Validée",
  archivee: "Archivée",
};

/** Vrai si la valeur lue en base est l'un des statuts connus. */
export function estStatutRevueConnu(statut: string): statut is StatutRevue {
  return (STATUTS_REVUE as readonly string[]).includes(statut);
}

/**
 * Libellé d'un statut lu en base.
 *
 * Le repli reste VISIBLEMENT anormal : une valeur inconnue s'affiche entre
 * guillemets, précédée de la mention qui dit que ce n'est pas un statut du
 * système. C'est ce repli-là qui manquait, et son absence a laissé « valide »
 * passer pour un statut pendant tout le temps où l'indicateur 32 restait rouge.
 */
export function libelleStatutRevue(statut: string): string {
  if (estStatutRevueConnu(statut)) return LIBELLES_STATUT_REVUE[statut];
  return `Statut inconnu « ${statut} »`;
}
