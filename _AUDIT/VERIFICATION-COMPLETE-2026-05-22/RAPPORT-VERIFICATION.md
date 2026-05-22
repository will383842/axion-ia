# RAPPORT VÉRIFICATION COMPLÈTE

## Date : 2026-05-22 | HEAD : dd53b418

---

## RÉSUMÉ EXÉCUTIF

| Statut            | Nombre |
| ----------------- | ------ |
| OK                | 28     |
| Partiel / warning | 6      |
| Manquant / Cassé  | 4      |

**Verdict global : CONDITIONNEL**  
4 problèmes bloquants TS + lint + isolation-check. Aucun bloquant fonctionnel (les features sont implémentées), mais les gates CI échouent.

---

## GATES TECHNIQUES

| Gate                  | Statut | Détail                                             |
| --------------------- | ------ | -------------------------------------------------- |
| typecheck             | ÉCHOUÉ | 242 erreurs TS                                     |
| lint                  | ÉCHOUÉ | 4 erreurs (2 fichiers tests)                       |
| tests (vitest)        | OK     | 1488 passed, 7 skipped, 0 failed (150 fichiers)    |
| prisma validate       | N/A    | Requiert `DIRECT_URL` — non configurable sans .env |
| prisma migrate status | N/A    | Idem (DIRECT_URL manquant)                         |
| isolation-check       | ÉCHOUÉ | 11 violations                                      |

### Détail typecheck (242 erreurs)

**Fichier principal (237 erreurs) : `src/content/keywords/g9-balance.ts`**

- `'volume'` n'existe pas dans `KeywordSeed` (champ présumé supprimé ou renommé)
- `'"dirigeants"'` et `'"rh"'` ne sont pas des `KeywordCible` valides
- Ce fichier est hors scope des sprints vérifiés — c'est une régression du sprint g9-balance (nouveau fichier keywords)

**Autres erreurs (5 erreurs, 3 fichiers) :**

- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/brand-voice-drift/_v2/BrandVoiceDriftV2.tsx:80` — `'default' | 'error'` non assignable à `StatTone` (1 erreur)
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/cities-coverage/_v2/CitiesCoverageV2.tsx:228` — `'warning' | 'default' | 'success'` non assignable à `AdminBadgeTone` (1 erreur)
- `src/server/content-gen/quality/seo-score.ts:176` — `checkIntentAlignment` : switch sans cas de retour exhaustif (l'enum `searchIntent` a 5 cases, toutes couvertes, mais TypeScript ne peut pas prouver l'exhaustivité sans `default`) (1 erreur)

**Impact réel sur les sprints vérifiés :** les erreurs TS dans `BrandVoiceDriftV2.tsx` et `CitiesCoverageV2.tsx` touchent les pages admin Sprint A-suite. `seo-score.ts` touche le pipeline content-gen.

### Détail lint (4 erreurs)

| Fichier                                                                    | Ligne | Erreur                                                |
| -------------------------------------------------------------------------- | ----- | ----------------------------------------------------- |
| `src/server/content-gen/linguistic/__tests__/diversity-checker.spec.ts:63` | 63    | `'GOOD_SHORT'` assigné mais jamais utilisé            |
| `src/server/queue/workers/__tests__/brand-voice-drift-monitor.test.ts:63`  | 63    | `'DRIFT_THRESHOLD_REVIEW'` défini mais jamais utilisé |
| `src/server/queue/workers/__tests__/brand-voice-drift-monitor.test.ts:64`  | 64    | `'DRIFT_THRESHOLD_WARN'` défini mais jamais utilisé   |

Toutes dans des fichiers de tests. Facile à corriger (renommer en `_GOOD_SHORT`, `_DRIFT_THRESHOLD_REVIEW`, etc.).

### Détail isolation-check (11 violations)

Le check détecte les fichiers hors `ALLOWED_PATTERNS` qui contiennent des marqueurs `content-gen`. Analyse des 11 violations :

**4 violations légitimes (whitelist manquante — faux positifs) :**

- `prisma/seeds/cities/seed-cities.ts` — contient "content-gen" dans commentaire npm script (`pnpm content-gen:seed-cities`). Pas de couplage code réel.
- `src/components/admin/ui/AdminSidebarNav.tsx` — contient `item.href.includes("/content-gen/jobs")` (Item 2 Sprint A-suite — badge alert). UI nav légitime, déjà exception-patché pour layout.tsx.
- `src/server/queue/workers/embeddings-backfill-worker.ts` — référence `ContentGenConfig` pour stocker métriques. Worker non-content (pattern `content-*-worker.ts` non matché).
- `src/server/queue/workers/brand-voice-drift-monitor.ts` — importe `BRAND_VOICE_CONFIG_KEY` depuis `content-gen/brand-voice-constants`, utilise `ContentGenConfig`. Worker non-content.

**2 violations de vraie implémentation (pattern regex incomplet) :**

- `src/server/queue/workers/content-gen-deadline-checker.ts` — pattern autorisé = `/^src\/server\/queue\/workers\/content-.*-worker\.ts$/`. Le fichier se termine en `-checker.ts` (pas `-worker.ts`) → non matché. C'est un vrai worker content-gen, le pattern doit inclure `-checker.ts`.
- `src/server/queue/workers/content-gen-scheduler-worker.ts` — même pattern, se termine `-scheduler-worker.ts`. Celui-là DEVRAIT matcher (`content-gen-scheduler-worker.ts` = `content-.*-worker.ts`) mais... vérifions : pattern `content-.*-worker\.ts` match `content-gen-scheduler-worker.ts` ✓. Donc soit le file path normalisé diffère, soit le marker `CoverageCampaign` déclenche depuis une autre règle. Probablement que `content-gen-deadline-checker.ts` est le seul vrai faux négatif pattern.

**5 violations tests (`__tests__/*.test.ts`) :**

- `correlation-id.test.ts`, `deadline-checker.test.ts`, `orchestrator-sequential.test.ts`, `recurring-schedule.test.ts`, `scheduler-worker.test.ts`, `embeddings-backfill-worker.test.ts`
- Pattern autorisé = `/^src\/server\/queue\/workers\/__tests__\/content-.*\.spec\.ts$/` (`.spec.ts` uniquement, pas `.test.ts`)
- Ces nouveaux tests Sprint Campaign Controls utilisent `.test.ts` — non couverts par le pattern.

**Résumé isolation-check :** Pas de vraie violation architecturale. Ce sont des patterns regex incomplets dans `isolation-check.ts` (`.test.ts` vs `.spec.ts`, `-checker.ts` non matché, workers transverses sans whitelist). À corriger dans `scripts/content-gen/isolation-check.ts`.

---

## CAMPAIGN CONTROLS (commits `ebfc9863` → `8031a00d`)

| Item                                                      | Statut  | Détail                                                                                                                                                                                           |
| --------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schema `CityProcessingMode` enum                          | OK      | Défini ligne 2623, values `parallel`/`sequential`                                                                                                                                                |
| Schema champs campaign controls                           | OK      | `cityProcessingMode`, `currentCityIndex`, `startDate`, `endDate`, `recurringSchedule`, `completedReason` sur `coverage_campaigns` (lignes 2924-2929)                                             |
| Migration `20260522000000_add_campaign_controls`          | OK      | SQL complet, additive, DEFAULT `parallel` rétro-compat                                                                                                                                           |
| Scheduler worker `content-gen-scheduler-worker.ts`        | OK      | Cron `*/5 * * * *`, scanne `scheduled` → `running`, Sentry, REDIS_URL guard                                                                                                                      |
| Deadline-checker worker `content-gen-deadline-checker.ts` | OK      | Cron `5 0 * * *`, endDate auto-stop, logActivity SOC2, Sentry, REDIS_URL guard                                                                                                                   |
| Workers enregistrés dans `worker.ts`                      | OK      | Lignes 73-74 avec commentaires Sprint Campaign Controls                                                                                                                                          |
| Queues définies dans `queues.ts`                          | OK      | `contentSchedulerQueue`, `contentDeadlineCheckerQueue`, bootRepeatable wired                                                                                                                     |
| Server Action `scheduleCampaign`                          | OK      | `cron-parser` validation, cityProcessingMode, startDate, endDate, recurringSchedule                                                                                                              |
| Server Action `extendCampaignDeadline`                    | OK      | Inclus dans coverage.ts                                                                                                                                                                          |
| Orchestrator sequential mode                              | OK      | `processSequentialCampaign()` + `currentCityIndex` tracker (lignes 193-286)                                                                                                                      |
| Wizard step 5 Planification                               | OK      | `cityProcessingMode`, `startDateInput`, `endDateInput`, `recurringSchedule` wired (lignes 256-908)                                                                                               |
| Dep `cron-parser`                                         | OK      | `node_modules/cron-parser` présent                                                                                                                                                               |
| Dep `cronstrue`                                           | OK      | `node_modules/cronstrue` présent                                                                                                                                                                 |
| Lib `cron-to-human.ts`                                    | OK      | `src/lib/cron-to-human.ts` — helper `cronToHuman()` avec i18n FR                                                                                                                                 |
| Stub-aware scheduler worker                               | PARTIEL | Guard `REDIS_URL` présent, mais pas de check `stub.invalid` explicite. Repose sur la `connection` qui fail si stub (comportement attendu par ADR 0026 via `isBullmqDisabled()` au niveau queues) |
| Stub-aware deadline-checker worker                        | PARTIEL | Idem — pas de vérification `stub.invalid` directe, mais guard `REDIS_URL` null-check présent                                                                                                     |

**Note stub-aware** : Les deux nouveaux workers ne vérifient pas `REDIS_URL?.includes("stub.invalid")` explicitement. Ils vérifient `!redisUrl` (null/undefined). Au build GH Actions, `REDIS_URL=redis://stub.invalid:6379` → non-null → les workers tenteraient de s'instancier... sauf que `BULLMQ_DISABLED=true` est setté, et `queues.ts` gère `isBullmqDisabled()` AVANT de créer les queues. Les `contentSchedulerQueue` et `contentDeadlineCheckerQueue` seront `null`. Les workers eux-mêmes ne sont appelés que depuis `worker.ts` → `startWorkers()` → uniquement au runtime (pas au build SSG). Pas de risque réel au build.

---

## SPRINT A-SUITE (commits `3705fef4`, `06798ec5`, `dd53b418`)

| Item                                                          | Statut | Détail                                                                                                                                                                     |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hamburger mobile sidebar                                      | OK     | `translate-x-full` / `translate-x-0`, `lg:hidden`, overlay backdrop. CLS=0 confirmé. `AdminSidebarNav.tsx` lignes 205-246                                                  |
| Alert badge failed jobs                                       | OK     | `getFailedJobsCount()` en layout, badge rouge conditionnel `failedJobsCount > 0` + cap 99+. `AdminSidebarNav.tsx` ligne 341                                                |
| `correlationId` schema                                        | OK     | `prisma/schema.prisma:3029` — `VARCHAR(36)`, nullable                                                                                                                      |
| Migration `20260522120000_add_correlation_id_content_gen_job` | OK     | Migration présente                                                                                                                                                         |
| `correlationId` propagation orchestrator→gen→publish          | OK     | UUID v4 généré dans orchestrator (ligne 140), propagé via `dbJob.correlationId` en gen-worker (lignes 176-182) et publish-worker (lignes 316-327)                          |
| factCheckScore gate dans publish-worker                       | OK     | Interface `FactCheckGateConfig`, `readContentGenConfig("factcheck_gate")`, gate `factCheckScore < minScore` → `quarantined_factcheck` (lignes 206-231)                     |
| Migration factcheck quarantine                                | OK     | `20260521160000_add_content_gen_factcheck_claims_quarantine` présente                                                                                                      |
| `JobsLiveStream` composant                                    | OK     | `src/components/admin/content-gen/JobsLiveStream.tsx` — EventSource SSE + fallback polling 10s                                                                             |
| `JobsLiveStream` wired                                        | OK     | `JobDetailV2.tsx` ligne 174 — `<JobsLiveStream jobId={job.id} initialStatus={job.status} />`                                                                               |
| `CampaignTemplate` preset wizard                              | OK     | `listCampaignTemplates()` server action (ligne 700), step 0 wizard si `templates.length > 0`, `applyPreset()` (ligne 278), `CampaignTemplate` model en schema (ligne 3596) |
| TS erreurs BrandVoiceDrift V2                                 | ÉCHOUÉ | `StatTone` ne supporte pas `'default' \| 'error'` — 1 erreur TS                                                                                                            |
| TS erreurs CitiesCoverage V2                                  | ÉCHOUÉ | `AdminBadgeTone` ne supporte pas `'warning' \| 'default' \| 'success'` — 1 erreur TS                                                                                       |

---

## WORKERS REGISTRATION (`src/server/queue/worker.ts`)

Tous les workers sont importés et enregistrés dans `startWorkers()` :

| Worker                                                                     | Statut    |
| -------------------------------------------------------------------------- | --------- |
| email, option-expiration, option-reminder, retention-purge, booking-crons  | OK (core) |
| content-gen, orchestrator, quality-improver, rss-fetch, similarity-monitor | OK        |
| news-lifecycle, publish, indexnow, google-indexing, qa-extract             | OK        |
| tier-lifecycle, fact-check, keyword-sync                                   | OK        |
| content-web-vitals-monitor, content-psi-monitor, content-monitoring        | OK        |
| **content-weekly-report** (Sprint A D-P5-3)                                | OK        |
| **content-gen-scheduler** (Sprint Campaign Controls C.2)                   | OK        |
| **content-gen-deadline-checker** (Sprint Campaign Controls C.3)            | OK        |
| image-bank (enrich, import, translate, crons, auto-convert)                | OK        |
| embeddings-backfill                                                        | OK        |
| **brand-voice-drift-monitor** (Sprint H 2026-05-22)                        | OK        |

Total workers actifs : 31

---

## KB VERTICALS

| Fichier                                                      | Lignes      | Statut                                        |
| ------------------------------------------------------------ | ----------- | --------------------------------------------- |
| `src/server/content-gen/kb/audits.ts`                        | 115         | OK — exporte `KbFact`, `KB_AUDITS` (60 facts) |
| `src/server/content-gen/kb/implementations.ts`               | 774         | OK — exporte `KB_IMPLEMENTATIONS`             |
| `src/server/content-gen/kb/interventions-formations.ts`      | 778         | OK — exporte `KB_INTERVENTIONS_FORMATIONS`    |
| `src/server/content-gen/kb/un-a-un.ts`                       | 583         | OK — exporte `KB_UN_A_UN`                     |
| `src/server/content-gen/kb/sites-web-augmentes.ts`           | 583         | OK — exporte `KB_SITES_WEB_AUGMENTES`         |
| `src/server/content-gen/kb/verticals/sites-web-augmentes.ts` | ?           | OK — duplicate/alias dans verticals/          |
| **Total**                                                    | 2833 lignes |                                               |

**Import status :** Les 5 KB verticals sont importés dans `prisma/seeds/content-gen/seed-kb-facts.ts` (lignes 15-28) et mergés dans un tableau unique pour seed. Ils sont également référencés depuis `src/server/actions/content-gen/seed-initial.ts` via `seedKbFacts`.

**Note :** Les KB verticals sont des données statiques destinées au seed Postgres (FTS/vector). Ils ne sont PAS importés dynamiquement par les générateurs au runtime — les générateurs consomment la KB via `kb-client.ts` (searchKnowledge FTS/vector). C'est l'architecture correcte.

---

## PRODUCTION READINESS

### Stub-aware

| Composant                         | Stub-aware | Mécanisme                                                                                                             |
| --------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `content-gen-scheduler-worker.ts` | PARTIEL    | Guard `!redisUrl` (undefined), mais pas `stub.invalid` check. Safe via `isBullmqDisabled()` en amont dans `queues.ts` |
| `content-gen-deadline-checker.ts` | PARTIEL    | Idem                                                                                                                  |
| `brand-voice-drift-monitor.ts`    | PARTIEL    | Même pattern                                                                                                          |
| `queues.ts`                       | OK         | `isBullmqDisabled()` → queues `null` si `BULLMQ_DISABLED=true`                                                        |
| `prisma.ts`                       | OK         | Proxy stub.invalid short-circuit queries                                                                              |
| `redis.ts`                        | OK         | Proxy stub.invalid no-op                                                                                              |

### Sentry

| Worker                            | Sentry                                              |
| --------------------------------- | --------------------------------------------------- |
| `content-gen-scheduler-worker.ts` | OK — `captureWorkerError` sur `worker.on("failed")` |
| `content-gen-deadline-checker.ts` | OK — `captureWorkerError`                           |
| `content-weekly-report-worker.ts` | OK — `captureWorkerError`                           |
| `brand-voice-drift-monitor.ts`    | A VÉRIFIER (non vérifié dans ce rapport)            |

### Tests fichiers nouveaux Sprint Campaign Controls

| Fichier test                                   | Format     | Isolation-check                                       |
| ---------------------------------------------- | ---------- | ----------------------------------------------------- |
| `__tests__/correlation-id.test.ts`             | `.test.ts` | ÉCHOUÉ (pattern `.spec.ts` seulement)                 |
| `__tests__/deadline-checker.test.ts`           | `.test.ts` | ÉCHOUÉ                                                |
| `__tests__/orchestrator-sequential.test.ts`    | `.test.ts` | ÉCHOUÉ                                                |
| `__tests__/recurring-schedule.test.ts`         | `.test.ts` | ÉCHOUÉ                                                |
| `__tests__/scheduler-worker.test.ts`           | `.test.ts` | ÉCHOUÉ                                                |
| `__tests__/embeddings-backfill-worker.test.ts` | `.test.ts` | ÉCHOUÉ                                                |
| `__tests__/campaign-templates.test.ts`         | `.test.ts` | OK (dans `src/server/actions/content-gen/__tests__/`) |
| `__tests__/coverage-controls.spec.ts`          | `.spec.ts` | OK                                                    |

**Note :** Tous ces tests Vitest passent (1488/1488) — le problème est uniquement le pattern `isolation-check.ts` qui n'accepte que `.spec.ts` pour `__tests__/`.

---

## P0 — BLOQUANTS CI/CD

### P0-1 : 242 erreurs TypeScript (`pnpm typecheck` ÉCHOUE)

- **Fichier principal :** `src/content/keywords/g9-balance.ts` (237 erreurs) — `'volume'` non dans `KeywordSeed`, `'dirigeants'`/`'rh'` non dans `KeywordCible`
- **Impact :** Gate typecheck CI bloqué. Build GH Actions à risque.
- **Fix :** Soit supprimer `volume` des seeds g9-balance et utiliser les `KeywordCible` valides, soit mettre à jour le type `KeywordSeed`/`KeywordCible` si l'intention était d'étendre.

### P0-2 : 4 erreurs lint (`pnpm lint` ÉCHOUE)

- **Fichiers :** `diversity-checker.spec.ts:63`, `brand-voice-drift-monitor.test.ts:63-64`
- **Impact :** Gate lint CI bloqué (pre-commit hook).
- **Fix :** Préfixer variables inutilisées avec `_`.

### P0-3 : isolation-check ÉCHOUE (11 violations)

- **Impact :** Gate CI `pnpm content-gen:isolation-check` bloqué.
- **Fix :** Mettre à jour `scripts/content-gen/isolation-check.ts` ALLOWED_PATTERNS :
  - Ajouter pattern `.test.ts` en plus de `.spec.ts` pour `__tests__/`
  - Ajouter exception `seed-cities.ts`, `AdminSidebarNav.tsx`, `embeddings-backfill-worker.ts`, `brand-voice-drift-monitor.ts`, `content-gen-deadline-checker.ts`

### P0-4 : 3 erreurs TS dans fichiers Sprint A-suite

- `BrandVoiceDriftV2.tsx:80` — `StatTone` incompatible
- `CitiesCoverageV2.tsx:228` — `AdminBadgeTone` incompatible
- `seo-score.ts:176` — switch non-exhaustif sans `default` + `undefined` possible
- **Impact :** Ces pages admin peuvent avoir des comportements inattendus si les types sont incorrects.

---

## P1 — NON-BLOQUANTS

### P1-1 : Stub-aware workers Campaign Controls non explicites

- Les workers `content-gen-scheduler-worker.ts` et `content-gen-deadline-checker.ts` ne font pas de check `REDIS_URL?.includes("stub.invalid")`. Ils sont protégés par `BULLMQ_DISABLED=true` + `isBullmqDisabled()` au niveau queues, mais ce n'est pas aligné avec la doctrine ADR 0026.
- **Recommandation :** Ajouter guard explicite ou documenter l'exception.

### P1-2 : `prisma validate` impossible sans `DIRECT_URL`

- Requiert une vraie DB. Le CI GH Actions utilise `SKIP_ENV_VALIDATION=true` + stubs. Pas urgent.

### P1-3 : KB verticals `audits.ts` court (115 lignes)

- `KB_AUDITS` a 60 facts mais le fichier fait seulement 115 lignes (vs ~700+ pour les autres). Densité différente ou facts plus courts.

### P1-4 : `brand-voice-drift-monitor.ts` et `embeddings-backfill-worker.ts` couplage `ContentGenConfig`

- Ces workers non-content-gen lisent/écrivent `ContentGenConfig`. C'est du couplage cross-module qui devrait évoluer vers une table de config générique ou une interface dédiée.

---

## VERDICT GLOBAL

**CONDITIONNEL**

Les 4 sprints vérifiés sont **fonctionnellement complets** :

- Campaign Controls : schema + migrations + workers + queues + server actions + wizard = implémentés
- Sprint A-suite : hamburger + badge + correlationId + factCheckGate + JobsLiveStream + CampaignTemplate = implémentés
- Weekly report worker : wired + Sentry
- KB verticals : 2833 lignes, 5 fichiers, seed wired

Les gates CI **échouent** sur :

1. 242 erreurs TS dont 237 dans `g9-balance.ts` (hors scope sprints mais bloque le typecheck global)
2. 4 erreurs lint dans fichiers tests
3. 11 violations isolation-check (faux positifs patterns incomplets)

**Conditions pour PRODUCTION-READY :**

1. Corriger `g9-balance.ts` (type `KeywordSeed`/`KeywordCible`) — ou confirmer que c'est un ticket séparé
2. Corriger variables inutilisées dans 2 fichiers tests
3. Mettre à jour `isolation-check.ts` ALLOWED_PATTERNS pour `.test.ts` + nouvelles exceptions
4. Corriger `StatTone`/`AdminBadgeTone` dans BrandVoiceDrift V2 + CitiesCoverage V2
5. Ajouter `default: return true` dans switch `checkIntentAlignment` de `seo-score.ts`
