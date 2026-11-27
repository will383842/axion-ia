# F1 — Un seul BreadcrumbList sur /guides/[slug]

## But

La page `/guides/[slug]` émettait deux `BreadcrumbList` : le sien (sans « Accueil »)
et celui du composant `<Breadcrumbs>` (avec « Accueil »), au même `@id` `#breadcrumb`.
Il n'en reste qu'un : celui de `<Breadcrumbs>`. Correctif SEO direct, hors interrupteur
`BLOG_GABARITS_V2` ; le graphe de cette page change, à valider par le propriétaire.

## Fichiers

- `src/app/[locale]/guides/[slug]/page.tsx` : retrait du `JsonLd` en double et de l'import devenu inutile.
- `tests/unit/seo/guides-un-seul-breadcrumb.spec.ts` : nouveau test.

## Tests

- Le test vérifie que la page n'appelle plus `buildBreadcrumbJsonLd`, que `<Breadcrumbs>` reste le seul émetteur, et que le nœud commence par « Accueil » avec `#breadcrumb`.
- Exécutés le 2026-11-27, après `pnpm install --frozen-lockfile` et rebase sur `origin/main` (6765b2bc, sans conflit) :
  - `vitest run tests/unit/seo/guides-un-seul-breadcrumb.spec.ts` : **3/3 verts** avec le correctif ;
  - même test avec la `page.tsx` d'`origin/main` (sans correctif) : **rouge** (1 échec : `buildBreadcrumbJsonLd` toujours présent) ;
  - `pnpm typecheck` : OK.

## Risques

Faible. Aucun JS client ajouté. Le nœud restant est identique en `@id` à celui retiré, avec « Accueil » en plus.

Relecture Opus : `<Breadcrumbs>` émet bien par défaut (avec « Accueil », même `@id`), aucun import orphelin, test pertinent, rien d'interdit. Réserve mineure : le 3e test vérifie la fonction de construction, pas la préfixation du composant.

VERDICT OPUS : BON
