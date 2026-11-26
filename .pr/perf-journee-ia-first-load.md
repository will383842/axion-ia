# perf(journee-ia) : First Load JS de /fr/journee-ia (B4)

## Résumé

**Aucune mesure ni aucune correction n'a pu être faite.** Aucun code de production n'est modifié.

Le build de mesure n'a pas pu être lancé dans l'environnement de cette session :

- `pnpm install --frozen-lockfile` échoue : le store pnpm par défaut est hors des chemins inscriptibles (`ENOENT mkdir .../setup-pnpm/node_modules/.bin/store`).
- Avec `--store-dir` dans `$TMPDIR`, il échoue aussi : `EROFS ... node_modules/.bin/commitlint`. `node_modules/` est monté en lecture seule.
- `node_modules` est à moitié rempli : `.pnpm/` contient `next@16.3.1`, mais `node_modules/.bin` est vide et `node_modules/next` n'existe pas. `pnpm next build` ne peut donc pas s'exécuter.

Je n'ai pas contourné la restriction (remontage ou désactivation du bac à sable), car elle fait partie du périmètre donné à la session.

## Tableau avant/après (KB gz)

| Route | Avant | Après |
| --- | --- | --- |
| `[locale]/journee-ia` | non mesuré | non mesuré |

## Constat statique (aucun chiffre de poids, à confirmer par une mesure)

- Dans `src/app/[locale]/journee-ia/`, un seul fichier est en `"use client"`. Il se trouve sous `_composants/` ; `page.tsx` est un composant serveur.
- `page.tsx` importe depuis `@/components/marketing` : `Cta`, `FaqAccordion`, `StickyMobileCta`, `JsonLd`. Il importe aussi `Breadcrumbs`, `Container` et `CarteDesGains`.
- Pistes à vérifier une fois le build possible : `FaqAccordion`, `StickyMobileCta` et `CarteDesGains`, qui sont probablement les composants client de la page, à passer en `next/dynamic` s'ils sont sous la ligne de flottaison. Le shell partagé pèse déjà 139 KB brotli d'après `AGENTS.md`, donc 75 KB par route est sans doute hors de portée par cette seule page.

## Fichiers modifiés

Aucun (hors ce fichier).

## Vérifications

- `pnpm install` : échec (voir ci-dessus).
- `next build --experimental-build-mode compile` : non lancé.
- `pnpm typecheck`, `pnpm lint`, `vitest` : non lancés, rien à vérifier sans changement de code.

## Relecteur Opus

Non lancé : il n'y a aucun diff de code à relire.

## À faire

Relancer la tâche dans un environnement où `pnpm install` peut écrire dans `node_modules`. La commande de mesure est celle de la consigne (build `compile` avec les stubs `stub.invalid`).
