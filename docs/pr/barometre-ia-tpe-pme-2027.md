# feat(seo): page Baromètre 2027 IA TPE/PME

Page publique FR `/fr/ressources/barometre-ia-tpe-pme-2027`, à partir de `data/barometre-2027/barometre-ia-tpe-pme-v1.md` et `sources.json` (branche `data/barometre-2027`). Chiffres repris tels quels, rapport seul (ni questionnaire, ni mention « brouillon »).

## Fichiers

- `src/content/barometre-2027/donnees.ts` : **seul fichier de chiffres** (chiffres clés, tableaux, sources, méthodologie, `barometrePublic()`). Une correction suite à la vérification des faits se fait là.
- `src/content/barometre-2027/jsonld.ts` : JSON-LD Article (+ `citation`) et Dataset (`variableMeasured`, creator Organization Axion-IA, `datePublished`, `citation`, `isBasedOn`), dérivés de `donnees.ts`.
- `src/app/[locale]/ressources/barometre-ia-tpe-pme-2027/page.tsx` : server component statique, zéro JS client, aucune image ; metadata (title, description, canonical, openGraph) via `buildProductMetadata`.
- `src/i18n/routing.ts` : entrée `pathnames` (slug identique FR/EN, comme `/ressources`).
- `src/app/sitemap.ts` : URL exclue de `pages.xml` tant que `BAROMETRE_2027_PUBLIC !== "true"`.
- `src/app/[locale]/ressources/page.tsx` : carte vers le baromètre dans le hub, affichée seulement si public.
- `src/content/barometre-2027/__tests__/barometre.spec.ts` : chiffres clés, JSON-LD valide, termes interdits, drapeau d'environnement.
- `tests/unit/e2e-harness/routes-publiques-existent.spec.ts` : route inscrite dans `HORS_AUDIT` (noindex) ; à déplacer vers `routes-publiques.json` à la publication.

## Publication

Tant que `BAROMETRE_2027_PUBLIC` n'est pas `"true"` : `noindex, nofollow`, hors sitemap, hors hub. Pour publier : poser la variable sur Coolify (app) et ajouter la route à `routes-publiques.json`.

## Vérifications

`pnpm typecheck` OK ; ESLint OK ; vitest : nouveau spec + `tests/unit/seo`, `tests/unit/e2e-harness`, `size-limit-buckets` verts (270 tests). Pas de build complet ni de mesure First Load JS faits ici. `pnpm-lock.yaml` : non touché.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
