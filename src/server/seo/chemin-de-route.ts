/**
 * Conversion « chemin servi » → « chemin de FICHIER de route ».
 *
 * 🔴 POURQUOI CE FICHIER EXISTE À PART.
 *
 * Cette fonction vivait dans `src/server/actions/site-explorer/og-surcharge.ts`,
 * qui porte `"use server"`. Next.js exige que **tout export** d'un module
 * `"use server"` soit une Server Action, donc `async` — un helper synchrone
 * exporté fait échouer le build entier :
 *
 *   Failed to compile.
 *   Error:   x Server Actions must be async functions.
 *
 * Le défaut ne se voit ni au `tsc --noEmit` (le typage est correct) ni aux
 * tests : uniquement au `next build`, donc en Gate B et Gate C. La rendre
 * `async` « pour reverdir » aurait été le mauvais geste — c'est une fonction
 * pure, sans I/O, appelée en plein calcul ; l'`await` se serait propagé sans
 * raison. On la sort du module d'actions, elle reste synchrone et exportable.
 *
 * 🔑 Et surtout : elle redevient TESTABLE. La dé-exporter aurait aussi réparé
 * le build, mais aurait enterré une règle dont l'échec est silencieux (voir
 * ci-dessous) dans un fichier où rien ne peut la vérifier.
 */

/**
 * Convertit un chemin servi en chemin de FICHIER de route.
 *
 * `revalidatePath` raisonne sur l'arborescence des fichiers, pas sur les URLs :
 * `/fr/audit/par-ville/[ville]` doit lui être présenté comme
 * `/[locale]/audit/par-ville/[ville]`. Vérifié sur reproduction minimale le
 * 2026-08-17 — sans cette conversion, la régénération par modèle ne fait rien
 * et **l'échec est SILENCIEUX** : `revalidatePath` ne signale pas qu'il n'a
 * rien trouvé à régénérer.
 */
export function cheminDeRoute(cible: string): string {
  const segments = cible.split("/").filter(Boolean);
  if (segments.length === 0) return "/[locale]";
  return `/[locale]/${segments.slice(1).join("/")}`.replace(/\/$/, "");
}
