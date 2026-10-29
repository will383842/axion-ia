// Tour France IA — l'interrupteur d'ouverture (ouvert au public le 2026-10-25).
//
// L'interrupteur vit dans le CODE, pas dans une variable d'environnement :
// l'ouverture et la fermeture du Tour sont une petite PR relue (`TOUR_PUBLIC`),
// jamais un réglage qu'on bascule sur le serveur sans trace.
//
// Le Tour est OUVERT (`TOUR_PUBLIC = true`) :
//   · le proxy sert `/tour-france-ia…` à tout le monde (la porte d'aperçu par
//     cookie, `porte.ts`, ne sert plus qu'à la refermer) ;
//   · la page est statique et indexable ;
//   · `sitemap-tour-france-ia.xml`, `sitemap-index.xml` et `llms.txt` citent la route.
//
// Repasser à `false` referme tout d'un bloc : 404 sauf aperçu par cookie, page
// dynamique et `noindex`, route retirée des sitemaps et de `llms.txt`.
//
// Module PUR (aucun import) : le proxy, les pages, les sitemaps et les tests
// l'importent.

/** Vrai : le Tour est ouvert au public. Le fermer, comme l'ouvrir, est une PR. */
export const TOUR_PUBLIC: boolean = true;

/** Le chemin de la landing, sans préfixe de langue. */
export const TOUR_PREFIX = "/tour-france-ia";
