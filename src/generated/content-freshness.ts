// ⚠️ FICHIER GÉNÉRÉ — ne pas éditer à la main.
// Source : `scripts/gen-content-freshness.mjs` (exécuté en CI avant `docker build`).
// Date du dernier commit git ayant touché les sources de chaque famille de
// contenu → alimente les `<lastmod>` des sub-sitemaps (audit indexation
// 2026-07-31). Une famille absente d'ici retombe sur la constante figée
// correspondante dans `src/app/sitemap.ts` (fail-soft, aucune régression).
//
// La version COMMITÉE de ce fichier sert au typecheck et au dev local ; la CI
// la régénère avant chaque build (elle n'est jamais recommitée).

export const CONTENT_FRESHNESS: Readonly<Record<string, string>> = {
  villes: "2026-07-28T07:30:58.000Z",
  formations: "2026-07-19T13:25:16.000Z",
  secteurs: "2026-06-21T09:56:15.000Z",
  glossaire: "2026-07-27T04:35:55.000Z",
  faq: "2026-07-28T07:30:58.000Z",
  help: "2026-07-17T11:40:04.000Z",
  "cas-concrets": "2026-05-24T09:18:53.000Z",
  comparaisons: "2026-06-22T09:40:36.000Z",
  "stack-ia-tools": "2026-07-04T07:53:49.000Z",
  implementation: "2026-05-29T14:39:04.000Z",
  pages: "2026-07-31T21:27:54.000Z",
};
