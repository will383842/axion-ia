# A24 — Env vars audit

## Statut : SAFE

Toutes les nouvelles env vars Sessions 4-11 ont un fallback safe documenté, sont
non-bloquantes à l'absence, et respectent le contrat `stub.invalid` (cf. AGENTS.md).

## Env vars nouvelles (table)

| Var                           | File:line                                                                                 | Fallback safe                                                                                                                                                                        | Non-bloquant                                            | Phase                  |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------- |
| `WIKIDATA_QNUMBER_AXIONIA`    | `src/lib/seo/wikidata-sameas.ts` (`buildOrganizationSameAs`, `getWikidataConfigStatus`)   | `?? null` + regex `/^Q\d+$/` valide → sinon `sameAs: []`                                                                                                                             | OUI (sameAs array vide si absent/invalide)              | 10 (Wikidata)          |
| `WIKIDATA_QNUMBER_MANON`      | `src/lib/seo/wikidata-sameas.ts` (`buildPersonManonSameAs`)                               | `?? null` + regex `/^Q\d+$/` valide → sinon `sameAs: []`                                                                                                                             | OUI (sameAs array vide si absent/invalide)              | 10 (Wikidata)          |
| `GSC_HCU_MONITOR_ENABLED`     | `src/server/queue/workers/gsc-hcu-monitor-worker.ts:L~30` (`ENABLED_ENV = ...=== "true"`) | runJob early-return stub `{indexedCount:0,...}` + console.log si !=true ; `startWorker` throw si called sans flag                                                                    | OUI (worker pas démarré sans flag, run job skip propre) | 9 (GSC HCU)            |
| `CONTENT_REFRESH_ENABLED`     | `src/server/queue/workers/content-refresh-worker.ts:L~30` (`ENABLED_ENV = ...=== "true"`) | runJob early-return stub `{scannedCount:0,...}` + console.log si !=true ; `startWorker` throw si called sans flag                                                                    | OUI (worker pas démarré sans flag, run job skip propre) | 13 (content-refresh)   |
| `MULTI_JUDGE_ENABLED`         | `src/server/content-gen/quality/index.ts` (`isMultiJudgeEnabled()`)                       | `=== "true"` strict → sinon retourne `judge[0]` single-judge                                                                                                                         | OUI (multi-judge dégrade gracefully en single-judge V1) | 16 (multi-judge)       |
| `ORIGINALITY_AI_API_KEY`      | `src/server/content-gen/quality/originality-ai.ts` (`getApiKey()`)                        | `if (!getApiKey())` → fallback `originalityScore:100`, `aiDetectedScore:0`, `fallback:true`, `costUsd:0`, gate `passed:true reason:"fallback_no_api_key"` + console.log non-bloquant | OUI (gate désactivé, fallback warning loggé)            | 16 (originality.ai)    |
| `ORIGINALITY_MIN_SCORE`       | `src/server/content-gen/quality/originality-ai.ts`                                        | `Number(... ?? 75)`                                                                                                                                                                  | OUI (default 75)                                        | 16                     |
| `ORIGINALITY_MAX_AI_SCORE`    | `src/server/content-gen/quality/originality-ai.ts`                                        | `Number(... ?? 90)`                                                                                                                                                                  | OUI (default 90)                                        | 16                     |
| `ORIGINALITY_MAX_PLAGIARISM`  | `src/server/content-gen/quality/originality-ai.ts`                                        | `Number(... ?? 20)`                                                                                                                                                                  | OUI (default 20)                                        | 16                     |
| `WEB_VITALS_TOP_1PCT_ENABLED` | `src/lib/web-vitals/top1pct-thresholds.ts` (`getActiveWebVitalThresholds`)                | `=== "true"` strict → sinon `THRESHOLDS_V1` (cibles V1 actuelles)                                                                                                                    | OUI (thresholds V1 par défaut, top1% opt-in)            | 17 (web vitals)        |
| `ADMIN_URL_PREFIX`            | `src/server/actions/content-gen/{rss-sources,city-equity,...}.ts` (revalidatePath)        | `?? "admin"` (default historique projet, déjà utilisé ailleurs)                                                                                                                      | OUI (default `admin`)                                   | Sessions 6+ (refactor) |

## Phases env-gated — couverture

| Phase              | Var attendue                                     | Trouvée                                                                                                                           | Fallback                                                             |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 9 GSC HCU          | `GSC_HCU_*`                                      | OUI : `GSC_HCU_MONITOR_ENABLED`                                                                                                   | OUI : worker skip + run job stub `{indexedCount:0,...}` non-bloquant |
| 13 content-refresh | `CONTENT_REFRESH_*`                              | OUI : `CONTENT_REFRESH_ENABLED` (PAS de `AB_META_ENABLED` — ab-test-meta toujours actif, déterministe sans flag, conforme prompt) | OUI : worker skip + run job stub `{scannedCount:0,...}` non-bloquant |
| 16 multi-judge     | `MULTI_JUDGE_ENABLED` + `ORIGINALITY_AI_API_KEY` | OUI : les 2 (+ 3 thresholds `ORIGINALITY_MIN_SCORE`, `ORIGINALITY_MAX_AI_SCORE`, `ORIGINALITY_MAX_PLAGIARISM`)                    | OUI : single-judge fallback + gate désactivé `fallback_no_api_key`   |
| 17 web vitals      | `WEB_VITALS_*`                                   | OUI : `WEB_VITALS_TOP_1PCT_ENABLED`                                                                                               | OUI : `THRESHOLDS_V1` (cibles actuelles AGENTS.md) par défaut        |

## Contrat stub.invalid respecté : OUI

- `src/lib/prisma.ts` : 0 ligne modifiée dans le diff `c39f08db..98e7626a` (Glob/Grep
  confirmé : aucune entrée pour ces fichiers dans `git diff --stat`).
- `src/lib/redis.ts` : 0 ligne modifiée dans le diff.
- Les nouvelles fonctions DB-aware Sessions 4-11 ajoutent des **early-exits explicites**
  `if (process.env.DATABASE_URL?.includes("stub.invalid")) return [...];` aux endroits
  où le SSG / pages publiques peuvent tirer la fonction au build :
  - `getRealTestimonialsOnly()` — return `[]` (Phase 15)
  - `listRssSourcesFromDb()` — return `[]` (Phase 6)
  - `getRssSourceByIdFromDb()` — return `null` (Phase 6)
- Les workers BullMQ Phase 9/13 utilisent `redisUrl.includes("stub.invalid")` comme
  guard supplémentaire avant `new Queue(...)` (cohérent avec `BULLMQ_DISABLED=true`
  build-arg AGENTS.md).
- Aucune mutation du magic string `"stub.invalid"` (grep verbatim conservé).

## Cohérence décisions Will memory

- `WIKIDATA_QNUMBER_*` attendu après création items Wikidata (~3-5h async) — action
  Will documentée FINAL-REPORT (item 2 actions Coolify env vars).
- `MULTI_JUDGE_ENABLED` + `ORIGINALITY_AI_API_KEY` Phase D mois 13+ — action Will
  documentée FINAL-REPORT (item 5).
- `GSC_HCU_MONITOR_ENABLED` + `CONTENT_REFRESH_ENABLED` Sessions 12+ après config
  OAuth GSC — action Will documentée FINAL-REPORT (item 4).
- `WEB_VITALS_TOP_1PCT_ENABLED` opt-in compatible avec budgets stricts AGENTS.md
  (LCP≤1800ms p75, INP≤100ms, CLS=0). Top1% activable post-baseline RUM.
- Aucune référence à `EN_LOCALE_ENABLED` ajoutée (locale EN désactivé 2026-05-16,
  cohérent — le flag existe déjà côté `src/proxy.ts`, hors scope Sessions 4-11).

## Verdict / écarts trouvés

VERDICT : SAFE. 11 env vars nouvelles, 100% avec fallback safe documenté,
100% non-bloquantes (no-throw, no-build-fail), 100% cohérentes avec décisions Will
memory. Contrat `stub.invalid` (ADR 0026) respecté zéro propagation requise sur
`src/lib/prisma.ts` ou `src/lib/redis.ts`.

Écarts : aucun bloquant. Notes :

- `AB_META_ENABLED` non introduit (prompt mentionnait Phase 13 `AB_META_ENABLED`).
  Implémentation Phase 13 a choisi un A/B meta **déterministe sans flag** (hash modulo
  variants). Conforme intention prompt (« A/B meta déterministe »), gate env non
  nécessaire.
- `WEB_VITALS_STRICT_MODE` non introduit (prompt suggérait nom). Implémentation
  Phase 17 a choisi `WEB_VITALS_TOP_1PCT_ENABLED` (sémantique plus claire : top1%
  industrie vs V1 cibles internes AGENTS.md). Acceptable.
- Workers Phase 9 + 13 throw à l'appel explicite `startWorker()` sans flag — c'est
  le comportement attendu (caller doit gate explicite côté queues.ts). Vérifié :
  `src/server/queue/queues.ts` ne démarre PAS ces workers dans son boot routine
  (lignes ajoutées 20 lignes — env-aware register seulement).
