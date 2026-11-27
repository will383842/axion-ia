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
- ⚠️ NON EXÉCUTÉS : `node_modules` est absent de l'environnement (vitest, eslint, tsc indisponibles), et la consigne interdit `pnpm install`. Prettier lancé sans le plugin tailwind. À faire passer par la CI.

## Risques

Faible. Aucun JS client ajouté. Le nœud restant est identique en `@id` à celui retiré, avec « Accueil » en plus.

VERDICT OPUS : À CORRIGER (relecture Opus non lancée : tests non exécutables ici ; à relire en CI)
