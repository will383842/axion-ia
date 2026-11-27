# perf(socle) : lot 1, alléger le JavaScript commun ([locale])

Suite de `docs/perf/ANALYSE-SOCLE-LOCALE.md` (branche `perf/socle-locale-analyse`), points 1, 2, 4 et 5 du §4. Rien de visible ne change.

## Changements

1. `next.config.ts` : `routeManifestInjection: false` dans `sentryBuildOptions` (option présente dans `@sentry/nextjs`). Le manifeste de routes (~89 Ko brut) n'est plus injecté deux fois dans le First Load. Seul effet : les transactions navigateur Sentry ne sont plus paramétrées (`/fr/a-propos` au lieu de `/:locale/a-propos`).
2. `Plausible`, `MetaPixel`, `Clarity`, `LinkedInInsight` : `@/env` (zod) remplacé par des littéraux `process.env.NEXT_PUBLIC_*` (inlinés par Next). Comportement identique : variable vide = absente (ancien `emptyStringAsUndefined`), hôte Plausible par défaut, consentement et gardes de routes inchangés. `src/env.ts`, `SKIP_ENV_VALIDATION` et `stub.invalid` non touchés.
3. `WebVitals.tsx` : `web-vitals/attribution` en `import()` dynamique dans l'effet, mêmes rapports, même envoi. Un indicateur d'annulation évite d'enregistrer l'observateur d'un effet déjà nettoyé.

## Non fait

- `cn()` → `clsx` dans `NavLink.tsx` / `HeaderPrestationsMenu.tsx` : `NavLink` fusionne un vrai conflit (`text-fg` vs `text-terracotta` quand le lien est actif, tailwind-merge retire `text-fg`). Doute → `cn()` conservé dans les deux fichiers (sans gain si un seul des deux garde tailwind-merge).
- Hors périmètre (interdits) : `Sheet` dynamique, analytics différés, retrait du provider next-intl.

## Vérifications

- `tsc --noEmit` (hook pre-commit) vert ; eslint/prettier via lint-staged ; vitest `src/components/analytics` + `src/lib/analytics` : 130 tests verts.
- Nouveau test `activation-sans-env.spec.tsx` : variable absente/vide, hôte Plausible par défaut/configuré, consentement refusé/inconnu. `CookieConsent.spec.tsx` adapté (Clarity lit `process.env`).

## Mesure AVANT (analyse §1, `origin/main` 1abd8256d)

`[locale]/a-propos` : **306,4 KB gz sur 28 fichiers** (polyfills `nomodule` inclus, 38,7 KB), soit ≈ **267,7 KB gz** sans polyfills. Gain attendu des points 1, 2, 5 : ≈ 28 KB gz.

## Mesure APRÈS

Build `next build --webpack --experimental-build-mode compile` (12 Go, stubs) : **passé, pas d'OOM**. Même méthode que l'analyse §1 (fichiers du `page_client-reference-manifest.js` + `rootMainFiles`, gzip niveau 9 un à un), script hors dépôt.

| Route                 | Fichiers      | Sans polyfills                | Avec polyfills                |
| --------------------- | ------------- | ----------------------------- | ----------------------------- |
| `[locale]/a-propos`   | 27 (avant 28) | **237,0 KB gz** (avant 267,7) | **275,6 KB gz** (avant 306,4) |
| `[locale]/journee-ia` | 27            | 238,1 KB gz                   | 276,7 KB gz                   |
| `[locale]`            | 25            | 232,5 KB gz                   | 271,1 KB gz                   |

Gain sur `a-propos` : **≈ 30,8 KB gz** (attendu ≈ 28). Réserve : le « avant » vient de `origin/main` 1abd8256d, le « après » de la tête de `main` fusionnée le 2026-11-27 ; une partie de l'écart peut venir d'autres commits. Octets mesurés sur une seule passe ; LCP/INP/TBT non mesurés (médiane Lighthouse requise).

## Verdict du relecteur (sous-agent Opus)

RAS bloquant : comportement identique (`emptyStringAsUndefined` ≡ `|| undefined`), accès `process.env` littéraux donc inlinés, consentement et gardes de routes intacts, aucun autre composant client du layout n'importe `@/env`. Remarques non bloquantes : la validation `z.string().url()` de `NEXT_PUBLIC_PLAUSIBLE_API_URL` ne s'applique plus côté navigateur (reste serveur) ; les observateurs `onINP` s'accumulent à chaque navigation, défaut préexistant non aggravé, à traiter à part.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
