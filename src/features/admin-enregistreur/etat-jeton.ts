/**
 * La forme de l'état rendu par les actions « Créer » et « Renouveler » le jeton.
 * Hors du fichier `"use server"` : un tel fichier n'exporte que des fonctions
 * asynchrones (garde de la CI).
 *
 * La consigne affichée sous le jeton est rédigée ICI, côté serveur, et non dans le
 * composant client : le texte voyage dans la réponse de l'action au lieu de peser
 * dans le JavaScript de la console (cliquet « SOMME des page chunks de la CONSOLE
 * ADMIN »). Le jeton n'expire pas (révision du 02/10, décision de Williams) :
 * la consigne ne donne ni durée ni date.
 */

export type EtatJeton =
  | { readonly etat: "initial" }
  | { readonly etat: "cree"; readonly jeton: string; readonly consigne: string }
  | { readonly etat: "erreur"; readonly message: string };

export const ETAT_JETON_INITIAL: EtatJeton = { etat: "initial" };

export function etatJetonCree(jeton: string): EtatJeton {
  return {
    etat: "cree",
    jeton,
    consigne:
      "Copiez ce jeton maintenant et collez-le dans les options de l'extension. " +
      "Il ne sera plus jamais affiché. Valable jusqu'à sa révocation.",
  };
}
