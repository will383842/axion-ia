/**
 * La forme de l'état rendu par les actions « Créer » et « Renouveler » le jeton.
 * Hors du fichier `"use server"` : un tel fichier n'exporte que des fonctions
 * asynchrones (garde de la CI).
 */

export type EtatJeton =
  | { readonly etat: "initial" }
  | { readonly etat: "cree"; readonly jeton: string; readonly expireLe: string }
  | { readonly etat: "erreur"; readonly message: string };

export const ETAT_JETON_INITIAL: EtatJeton = { etat: "initial" };
