# feat(seo): page Baromètre 2027 IA TPE/PME

Page publique FR `/fr/ressources/barometre-ia-tpe-pme-2027`, à partir de `data/barometre-2027/barometre-ia-tpe-pme-v1.md` et `sources.json` (branche `data/barometre-2027`). Chiffres repris tels quels, rapport seul (ni questionnaire, ni mention « brouillon »).

## Fichiers

- `src/content/barometre-2027/donnees.ts` : **seul fichier de chiffres** (chiffres clés, tableaux, sources, méthodologie, `BAROMETRE_PUBLIC` (constante)). Une correction suite à la vérification des faits se fait là.
- `src/content/barometre-2027/jsonld.ts` : JSON-LD Article (+ `citation`) et Dataset (`variableMeasured`, creator Organization Axion-IA, `datePublished`, `citation`, `isBasedOn`), dérivés de `donnees.ts`.
- `src/app/[locale]/ressources/barometre-ia-tpe-pme-2027/page.tsx` : server component statique, zéro JS client, aucune image ; metadata (title, description, canonical, openGraph) via `buildProductMetadata`.
- `src/i18n/routing.ts` : entrée `pathnames` (slug identique FR/EN, comme `/ressources`).
- `src/app/sitemap.ts` : URL exclue de `pages.xml` tant que `BAROMETRE_PUBLIC` vaut `false` ; la locale EN n'y figure jamais (page FR seule).
- `src/app/[locale]/ressources/page.tsx` : carte vers le baromètre dans le hub, affichée seulement si public.
- `src/content/barometre-2027/__tests__/barometre.spec.ts` : chiffres clés, JSON-LD valide, termes interdits, drapeau `BAROMETRE_PUBLIC`, sitemap, noindex, JSON-LD (auteur, pas d'`aggregateRating`/`review`).
- `tests/unit/e2e-harness/routes-publiques-existent.spec.ts` : route inscrite dans `HORS_AUDIT` (noindex) ; à déplacer vers `routes-publiques.json` à la publication.

## Publication

Tant que la constante `BAROMETRE_PUBLIC` (dans `donnees.ts`) vaut `false` : `noindex, nofollow`, hors sitemap, hors hub. C'est une constante et non une variable d'environnement : la page est générée au build, une variable Coolify ne suffirait pas.

Pour publier : PR qui passe `BAROMETRE_PUBLIC` à `true` et met la vraie date de publication, et ajoute la route à `routes-publiques.json`.

Dates : `2026-11-26` est provisoire. Mettre la vraie date de publication dans la PR de publication (`BAROMETRE_DATE_PUBLICATION` et `BAROMETRE_DATE_MODIFICATION`).

## Vérifications

`pnpm typecheck` OK ; ESLint OK ; vitest : nouveau spec + `tests/unit/seo`, `tests/unit/e2e-harness`, `size-limit-buckets` verts (270 tests). Pas de build complet ni de mesure First Load JS faits ici. `pnpm-lock.yaml` : non touché.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
