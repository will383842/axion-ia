# RAPPORT D'EXPLORATION — T0 (Phase 0 grounding)

> Sortie de la Phase 0 (aucun code métier avant ce rapport). Confirme les briques réelles
> d'`axionia` avec `fichier:ligne`, les divergences vs le dossier, et le plan de tranches.
> Établi le 2026-07-03. Branche `feat/prospection` · worktree `.claude/worktrees/prospection`.

## Stack réelle confirmée (package.json)

next `16.2.6` · prisma / @prisma/client `^5.22.0` · bullmq `^5.76.5` · ioredis `^5.10.1` ·
next-intl `^4.11.0` · zod `^3.25.76` · tailwindcss `^4` · vitest `^2.1.9` · react `19.2.4` ·
next-auth `5.0.0-beta.31`. Gestionnaire = **pnpm 10.33** (lockfile `pnpm-lock.yaml`).

Gates disponibles : `typecheck` (tsc --noEmit) · `lint` (eslint) · `format:check` (prettier) ·
`i18n:check` · `test` (vitest run, unit) · `test:integration` (config séparée) · `bundle:check`
(size-limit) · `lhci`. Garde-fous additionnels du repo : `anti-siren:check`, `anti-hex:check`,
`use-client:check`, `zod:check`, `schemacheck`, `contrast:check`, `radius:check`, isolation-checks
par module.

## Briques confirmées (fichier:ligne)

| Brique                      | Chemin réel                                                                                                                                                                                | API                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Prisma singleton stub-aware | `src/lib/prisma.ts:81`                                                                                                                                                                     | `export const prisma`; stub si `DATABASE_URL` inclut `stub.invalid` (`:79`). Types Prisma importés de `prisma/generated/client` (**pas** `@prisma/client`).                                  |
| Redis singleton stub-aware  | `src/lib/redis.ts:68`                                                                                                                                                                      | `export const redis`, `pingRedis()`; stub si `REDIS_URL` inclut `stub.invalid` (`:66`).                                                                                                      |
| Connexion BullMQ + kill     | `src/server/queue/connection.ts`                                                                                                                                                           | `isBullmqDisabled()` (`:19`), `getBullConnection()→Queue                                                                                                                                     | null` (`:23`), `getBullConnectionOrThrow()` (`:47`).                                   |
| Registre files              | `src/server/queue/queues.ts`                                                                                                                                                               | `export const xQueue: Queue                                                                                                                                                                  | null = connection ? new Queue(...) : null`; crons dans`bootRepeatableJobs()` (`:639`). |
| Registre workers            | `src/server/queue/worker.ts:70`                                                                                                                                                            | tableau `workers[]`, chaque worker = `startXWorker()`. `main()` early-exit si disabled (`:64`).                                                                                              |
| Wrapper Sentry              | `src/server/queue/lib/sentry-worker.ts:124`                                                                                                                                                | `captureWorkerError(workerName, queueName, job, error)`; union `WorkerName` fermée (`:50`) → **ajouter les noms prospection**.                                                               |
| Fetch SSRF-safe             | `src/lib/ssrf-safe-fetch.ts:139`                                                                                                                                                           | `ssrfSafeFetch(input, opts)` (DNS-resolve, rejette IP privées). **DIVERGENCE** : `src/lib/`, pas `src/server`.                                                                               |
| Robots + extraction HTML    | `src/server/content-gen/kb-ingest/{robots-respect,url-extractor}.ts`                                                                                                                       | `getRobotsRules(origin)`, `checkUrlAllowed(url)`, `extractArticleFromUrl(url)`. **Zone cloisonnée content-gen** → on ré-implémente en local prospection (cf. décision D-T0-1).               |
| Token-bucket                | `src/server/chatbot/resilience/token-bucket.ts`                                                                                                                                            | classe `TokenBucket` **pure mémoire** (pas Redis). Pour le rate-limit distribué → BullMQ `limiter:{max,duration}` (Redis-coordonné) + token-bucket Redis local prospection.                  |
| Rate-limit Redis            | `src/lib/rate-limit.ts`                                                                                                                                                                    | `checkRateLimit()` sliding-window fail-open (dispo si besoin).                                                                                                                               |
| Scheduler drip              | `src/server/queue/workers/content-gen-scheduler-worker.ts`                                                                                                                                 | cron `*/5`, flip `scheduled→running`. Modèle du `prospection-scheduler-worker`.                                                                                                              |
| Nav admin SSOT              | `src/lib/admin-nav.ts:25`                                                                                                                                                                  | union `AdminNavGroup` + `ADMIN_NAV_GROUP_LABELS` (`:82`) + `_ORDER` (`:124`) + `buildAdminNav(adminPrefix)` (`:145`). `base=/fr/${adminPrefix}`. Icônes = emoji.                             |
| Coverage-map (modèle)       | `CityGenerationOrder` (`prisma/schema.prisma:3319`) + `src/server/actions/content-gen/coverage-map.ts`                                                                                     | rollup via `groupBy` global + `Map` JS agrégée (pas de N+1). Modèle exact du suivi.                                                                                                          |
| SiteSetting                 | `SiteSetting` (`schema.prisma:2116`) + enum `SiteSettingCategory` (`:485`)                                                                                                                 | **ajouter `prospection`** à l'enum. Pas de helper générique → cloner le pattern qualiopi `src/server/qualiopi/config/site-settings.ts` (prefix-keyed + registry Zod + defaults, stub-aware). |
| Purge rétention             | `src/server/queue/workers/retention-purge-worker.ts`                                                                                                                                       | cron 03:00, delete par table piloté par env + `DEFAULTS`. Étendre aux entités prospection.                                                                                                   |
| Import open data (réf)      | `scripts/import-insee-villes.ts`                                                                                                                                                           | fetch → interface typée → slug/dedup → write, idempotent. Modèle du stock-ingestor.                                                                                                          |
| Admin route + auth          | `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx`                                                                                                                                        | `force-dynamic`, `robots:noindex`, guard prefix+locale FR + `auth()`. Prefix via `src/lib/admin-path.ts:26` `adminSegment()`. Authz page = `requireAdmin()` dans les server actions.         |
| Guard server action         | `src/server/actions/content-gen/_auth.ts:56`                                                                                                                                               | `requireAdmin()` (rôles `super_admin                                                                                                                                                         | admin                                                                                  | editor`), `requireSuperAdmin()`, `requireAdminWriteRateLimited()`. |
| Design system admin         | `src/components/admin/ui/` (`AdminTable`, `AdminPageHeader`, `AdminPagination`, `AdminEmptyState`, `AdminFilterTabs`, `AdminBulkActions`, …) + tokens `src/app/admin.css` (`--*-admin-*`). |
| Isolation-check             | `scripts/{content-gen,image-bank,qualiopi}/isolation-check.ts`                                                                                                                             | path `ALLOWED_PATTERNS` + markers contenu. **Créer `scripts/prospection/isolation-check.ts`** + script npm.                                                                                  |

## Divergences dossier ↔ code (corrigées dans l'implémentation)

1. **Robots/extraction HTML** vivent dans la zone cloisonnée `content-gen`. Les importer depuis
   prospection risquerait de faire échouer `content-gen:isolation-check`. **Décision D-T0-1** :
   ré-implémenter en local (`src/server/prospection/enrichment/robots.ts` + extracteur contacts),
   au-dessus du brick partagé `ssrfSafeFetch` (`src/lib`, réellement transverse). Cohérent avec la
   philosophie « on porte les idées, pas le code » (reference/01 §backlink-engine).
2. **token-bucket** de chatbot est **en mémoire** (pas Redis). Le rate-limit distribué réel repose
   donc sur le **limiter BullMQ** (Redis-coordonné, global sur la file) + un token-bucket Redis
   local prospection pour la limite globale multi-source.
3. **cost-tracker** est spécifique aux providers LLM payants → **non utilisé** (prospection = 0 API
   payante). Le suivi des appels réseau se fait via `CollectRun.apiCalls` + `ProspectionEvent`.
4. **RBAC** : les rôles user réels sont `super_admin|admin|editor`. La matrice prospection
   (`viewer|operator|dpo|admin`) est **module-specific** → mappée sur les rôles existants
   (**décision D-T0-2**) : `super_admin`+`admin` → capacités `dpo/admin` (export/bulk/opt-out) ;
   `editor` → `viewer/operator` (consultation). Pas de migration des rôles globaux (non invasif).
5. **Admin i18n** : la console admin est **FR hardcodée** (aucun `getTranslations`) par doctrine
   (CLAUDE.md). L'UI prospection suit la même convention → pas de namespace messages.
6. **Prisma client** généré dans `prisma/generated/client` (import relatif ou `@/…` selon le
   fichier), jamais `@prisma/client`.

## Gate juridique (Q9)

✅ **Non bloquant pour le build** (directive Will + `07-DECISIONS.md` Q9) : AIPD + LIA + mention
pré-remplies (`AIPD-ET-MENTIONS-PRETES.md`). Les valeurs légales (raison sociale, SIREN, DPO) sont
des **placeholders de config** (`SiteSetting` catégorie `prospection` + champs `[À COMPLÉTER]`),
remplies APRÈS l'implémentation. Tout T3+ est construit et testé sur **fixtures/mocks**, jamais sur
un SIREN réel ni une collecte prod. Aucune collecte en production tant que la relecture juriste +
les 3 champs ne sont pas faits (reste côté Will).

## Plan de tranches confirmé (T0→T9 + pilote)

Conforme à `06-MATRICE-ACCEPTATION.md` et `reference/02`. Ordre :
T0 grounding → **T1 SSOT+config** → **T2 schéma** → T3 stock/delta/rate-limit → T4 collecte+coverage
→ T5 enrichissement 2 passes → T6 admin pilotage → T7 admin exploitation → T8 export+RGPD →
T9 durcissement → Final pilote Isère 38 (BTP+Santé) + 2 vérifs E2E. Chaque tranche :
schéma → action/worker → UI → test → GATE → CROISEMENT → vérif ADVERSARIALE → réconciliation → commit.

## Sécurité git

Worktree isolé `.claude/worktrees/prospection` (`.claude/` gitignoré → aucune pollution `git status`).
Branche `feat/prospection` off `main`. `git add` chemins explicites, jamais `git add .`. Jamais de
push `main` sans accord (push = deploy). node_modules = **install pnpm réel** dans le worktree (pas de
jonction → pas de danger au `worktree remove`).
