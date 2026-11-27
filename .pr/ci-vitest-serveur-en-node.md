# CI plus rapide : tests serveur en environnement node

PR 3 du plan `.pr/plan-ci-rapide.md` (branche `plan/ci-rapide`), **sans la file de fusion** : la protection de
`main` est `strict=false`, donc la file n'est pas activée et Gate C n'est pas touchée (`merge_group` inchangé).

## Changement

- `vitest.config.ts` : `environmentMatchGlobs: [["src/server/**", "node"], ["tests/unit/ci/**", "node"]]`.
  Le défaut `jsdom` reste pour le reste. L'en-tête `@vitest-environment` d'un fichier garde la priorité.
- Deux fichiers de `src/server/**` reçoivent `// @vitest-environment jsdom` (ils utilisent `@testing-library/react`) :
  - `src/server/qualiopi/adaptation/automatique/__tests__/formulaire-positionnement.spec.tsx`
  - `src/server/qualiopi/documents/templates/mandat-opco.spec.tsx`
- Seuils de couverture inchangés (même code, même fournisseur v8).

## Comment la liste a été établie

Grep sur `src/server/**` et `tests/unit/ci/**` (tests seulement) de `document.`, `window`, `localStorage`,
`sessionStorage`, `HTMLElement`, `MutationObserver`, `matchMedia`, `DOMParser`, `navigator.`, `@testing-library`,
`jsdom`, `IntersectionObserver`, `ResizeObserver`, `createObjectURL`, `stubGlobal('window')`, `global(This).window|document`.
Hits réels : 2 fichiers `@testing-library` (ci-dessus) ; `regles.spec.ts` importe `JSDOM` explicitement (fonctionne
sous node) ; `transformations.spec.ts` et `verdict-export.spec.ts` ne citent `window` que dans des chaînes/regex.
Aucun hit dans `tests/unit/ci/**`. La liste est donc de **2 fichiers**, pas ~30 comme estimé dans le plan.

Risque silencieux (`typeof window` dans le code serveur testé) : sources concernées `retrait-financement/regles.ts`,
`brand/glossary-context.ts`, `qualiopi/documents/verdict-export.ts`, `queue/workers/content-web-vitals-monitor-worker.ts` ;
leurs specs passent sous node. Non revérifié : que chaque branche `typeof window` testée vise bien le côté serveur.

## Vérifications locales (`npx vitest run`, lots de 10 fichiers max, jamais la suite complète)

- Les 52 tests `.tsx` de `src/server/**` sans en-tête + specs liés aux sources ci-dessus : 2 échecs attendus avant
  l'en-tête (les deux fichiers jsdom), puis **tous verts** (2/2 après correction, autres lots 10/10, 10/10, 10/10, 10/10, 2/2).
- 10 specs de `tests/unit/ci/` : 10/10 verts.
- **Non couvert localement** : les ~1 990 autres fichiers de `src/server/**` (suite complète interdite ici). Un test
  qui dépendrait du DOM sans que le grep le voie échouera en rouge à la CI : corriger par l'en-tête jsdom.
- `pnpm typecheck` / `pnpm lint` non lancés (aucun code TypeScript modifié hors commentaire de config et en-têtes).

## Mesure à faire (obligatoire)

Durée de « Vitest (with coverage) — morceau » sur les 3 morceaux, **avant et après, sur 2 runs chacun** (un temps se
lit sur plusieurs runs, cf. AGENTS.md). **Si le gain est inférieur à 10 %, fermer la PR.**

Si `pnpm-lock.yaml` diffère de `main` : aucune réinstallation faite.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
