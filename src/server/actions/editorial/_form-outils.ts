/**
 * Console éditoriale — les outils communs aux adaptateurs de formulaire.
 *
 * Trois fonctions de trois lignes, dans leur propre fichier, pour une raison
 * précise : **un module `"use server"` ne peut exporter que des fonctions
 * asynchrones.** Ces trois-là sont synchrones, elles ne peuvent donc pas vivre
 * à côté des adaptateurs qui les utilisent.
 *
 * ── Pourquoi les adaptateurs sont dispersés ───────────────────────────────
 *
 * Ils vivaient tous ensemble dans un `formulaires.ts`. C'était un mauvais
 * découpage, et c'est la garde `D3-3-05` du dépôt
 * (`toute-action-a-une-surface.spec.ts`) qui l'a montré :
 *
 * > « un module d'actions dont AUCUNE n'atteint jamais un écran »
 *
 * Cette garde raisonne au grain du FICHIER, et tolère qu'une action ne soit
 * appelée que par une autre **du même module**. Avec un `formulaires.ts`
 * central, `idees.ts` et `recettes.ts` paraissaient orphelins : aucun écran ne
 * nommait leurs actions, puisque les écrans nommaient les adaptateurs, qui
 * vivaient ailleurs.
 *
 * 🔑 La garde avait raison de rougir, même si les actions étaient bel et bien
 * atteignables. Un lecteur qui ouvre `recettes.ts` et cherche qui l'appelle ne
 * trouve rien non plus — et c'est exactement ce que la garde imite. Le dépôt
 * avait d'ailleurs déjà tranché : `equipe.ts` et `metriques.ts` hébergent
 * leurs propres adaptateurs depuis le début.
 *
 * Chaque adaptateur vit donc désormais à côté de l'action qu'il adapte.
 */

/** Lit un champ de formulaire en chaîne propre, ou `undefined` s'il est vide. */
export function champ(donnees: FormData, nom: string): string | undefined {
  const v = donnees.get(nom);
  if (typeof v !== "string") return undefined;
  const propre = v.trim();
  return propre.length > 0 ? propre : undefined;
}

/**
 * Ajoute un message d'erreur à une URL de retour.
 *
 * ⚠️ L'erreur revient par la querystring, et l'écran l'affiche. C'est fruste,
 * mais c'est visible — et un formulaire qui échoue en silence est pire qu'un
 * formulaire laid. C'est aussi ce qui permet aux écrans de saisie de rester
 * des Server Components : consommer une valeur de retour demanderait
 * `useActionState`, donc du JavaScript sur chaque écran.
 */
export function avecErreur(base: string, message: string): string {
  const separateur = base.includes("?") ? "&" : "?";
  return `${base}${separateur}erreur=${encodeURIComponent(message)}`;
}

/** Ajoute un drapeau de succès à l'URL de retour. */
export function avecSucces(base: string, cle: string, valeur = "1"): string {
  const separateur = base.includes("?") ? "&" : "?";
  return `${base}${separateur}${cle}=${valeur}`;
}
