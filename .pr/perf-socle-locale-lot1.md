## perf(socle) : lot 1, alléger le JavaScript commun de `[locale]`

Applique les points **1, 2, 4 et 5** du plan de `docs/perf/ANALYSE-SOCLE-LOCALE.md` (branche `perf/socle-locale-analyse`). Aucun texte, aucune fonction, aucun style visibles ne changent.

### Mesures (First Load JS, gzip fichier par fichier)

Méthode de l'analyse (§1) : fichiers de `page_client-reference-manifest.js` + `rootMainFiles` (+ `polyfillFiles`), `next build --webpack --experimental-build-mode compile` avec les stubs `stub.invalid`, avant et après sur le même environnement. Script de mesure hors dépôt. Les octets se lisent sur une passe (cf. `AGENTS.md`) ; rien ici ne dit quoi que ce soit du LCP/INP/TBT, qui demandent une médiane sur plusieurs runs Lighthouse.

| Route                 | Avant sans polyfills    | Après sans polyfills | Δ             | Avant avec polyfills | Après avec polyfills |
| --------------------- | ----------------------- | -------------------- | ------------- | -------------------- | -------------------- |
| `[locale]/a-propos`   | 267,14 KB (27 fichiers) | 245,96 KB (26)       | **−21,18 KB** | 305,73 KB            | 284,56 KB            |
| `[locale]/journee-ia` | 268,54 KB (27)          | 247,37 KB (26)       | **−21,17 KB** | 307,13 KB            | 285,96 KB            |
| `[locale]` (accueil)  | 262,11 KB (25)          | 240,94 KB (24)       | **−21,17 KB** | 300,70 KB            | 279,53 KB            |

« Sans polyfills » = ce que télécharge un navigateur moderne (`polyfills-*.js` est `noModule`). Aucune route ne grossit. Le gain (≈ 21 KB) est inférieur à la somme des estimations de l'analyse (≈ 28 KB pour les points 1, 2, 5, plus 0 à 8,6 pour le 4) : les chunks se redécoupent et l'estimation par tranches de texte était approximative.

### Changements

1. **Manifeste de routes Sentry** (`next.config.ts`) : `routeManifestInjection: false` (option présente dans `@sentry/nextjs` 10.70.0). Aucune contrepartie visible : le client Sentry tourne sans traces (`tracesSampleRate: 0`), le manifeste ne servait pas.
2. **zod hors du socle client** : `Plausible`, `MetaPixel`, `Clarity`, `LinkedInInsight` lisent `process.env.NEXT_PUBLIC_*` en littéral. Même comportement : `|| undefined` reproduit `emptyStringAsUndefined: true` de `src/env.ts` (chaîne vide = absent), même valeur par défaut Plausible, mêmes conditions et consentement. Autre importeur client trouvé : `MobileNav` → `@/lib/brand` → `@/env` (pour `BRAND.name` seul) ; il lit désormais `NOM_MARQUE`, ajouté au module pur `identite-legale-ssot.ts` dont `BRAND.name` dérive (une seule source). `src/env.ts`, `SKIP_ENV_VALIDATION` et `stub.invalid` ne sont pas touchés.
3. **tailwind-merge** : `NavLink.tsx` et `HeaderPrestationsMenu.tsx` passent de `cn()` à `clsx`. **Gain nul à ce stade** : `components/ui/sheet.tsx` (importé statiquement par `MobileNav`) utilise encore `cn()`, donc tailwind-merge reste dans le socle ; il ne partira qu'avec le point 3 (Sheet dynamique, hors périmètre) ou un passage de `sheet.tsx` à clsx. Les deux composants sont prêts. Chaque appel a été vérifié en comparant `twMerge` à la concaténation : un seul conflit réel (lien mobile : `text-fg` vs `text-terracotta` quand actif), remplacé par un ternaire explicite qui produit exactement la même chaîne de classes que `twMerge`.
4. **web-vitals/attribution** : `WebVitals.tsx` charge `onINP` par `import()` dynamique dans l'effet. Mêmes rapports, même envoi. L'observateur INP s'enregistre un instant plus tard ; comme avant, il n'est pas désinscrit au changement de page.

### Non fait (hors périmètre, demandé)

Points 3 (Sheet/Radix Dialog dynamique), 6 (différer les composants analytics) et 7 (provider next-intl) : non touchés.

### Vérifications

- `pnpm typecheck` (via pre-commit) : OK ; eslint/prettier sur les fichiers touchés : OK.
- Vitest : analytics, nav, `src/lib/analytics`, `tests/unit/{seo,ci,console}` : 0 échec.
- `CookieConsent.spec.tsx` adapté (le mock de `@/env` devient `vi.stubEnv`). Nouveau test `analytics-env-litterale.spec.tsx` : variable absente / vide / posée, consentement refusé ou inconnu, URL d'API Plausible par défaut, et garantie que `@/env` n'est plus importé par ces composants.
- Le hook `pre-push` (`vitest related` sur `next.config.ts`) est très long ici : il a été laissé aller au bout pour le push final.

### Relecture

Relecteur (Opus) : **aucun point bloquant**. Équivalence des quatre balises, gardes de consentement/secret, absence d'`@/env` dans le graphe client du layout et classes Tailwind confirmées. Corrigé suite à la relecture : `.catch` ajouté sur l'import dynamique de `web-vitals/attribution` ; commentaire Sentry corrigé ; constat que tailwind-merge reste via `sheet.tsx` (consigné ci-dessus). Nit accepté : une interaction INP de 40 à 104 ms avant la résolution de l'import n'est plus vue (sans effet sur les INP « poor »).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
