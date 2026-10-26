// Tour de France IA — l'interrupteur d'ouverture (2026-10-25).
//
// L'interrupteur vit dans le CODE, pas dans une variable d'environnement :
// l'ouverture au public est une petite PR relue (`TOUR_PUBLIC = true`), jamais
// un réglage qu'on bascule sur le serveur sans trace.
//
// Tant qu'il est faux :
//   · le proxy répond 404 à tout `/tourdefrance-ia…`, sauf aperçu par cookie
//     (`porte.ts`) ;
//   · la page est dynamique et `noindex` ;
//   · aucun sitemap, ni `llms.txt`, ne cite la route.
//
// Module PUR (aucun import) : le proxy, les pages, les sitemaps et les tests
// l'importent.

/** Faux tant que le Tour n'est pas ouvert au public. L'ouverture est une PR. */
export const TOUR_PUBLIC: boolean = false;

/** Le chemin de la landing, sans préfixe de langue. */
export const TOUR_PREFIX = "/tourdefrance-ia";
