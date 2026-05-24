# A16 Phase 16 — Multi-judge + Originality.ai

## Statut : STUB-OK (env-gated, conforme au scope déclaré)

Helpers livrés conformes à la description du commit aab650c9 ("V1 squelette stub").
Productionisation et wiring pipeline reportés explicitement à "Sessions 11+".

## Files claimed vs found

Commit aab650c9 (3 fichiers, +375 lignes) :

| Fichier annoncé                                                                   | Présent | Lignes |
| --------------------------------------------------------------------------------- | ------- | ------ |
| axionia/src/server/content-gen/quality/multi-judge-ensemble.ts                    | oui     | 119    |
| axionia/src/server/content-gen/quality/originality-ai-client.ts                   | oui     | 113    |
| axionia/src/server/content-gen/quality/\_\_tests\_\_/multi-judge-ensemble.spec.ts | oui     | 143    |

Commit 6bcdbcc8 (2 fichiers, +73 lignes) :

| Fichier                                                                     | Présent | Lignes |
| --------------------------------------------------------------------------- | ------- | ------ |
| axionia/src/server/content-gen/quality/index.ts                             | oui     | 38     |
| axionia/src/server/content-gen/quality/\_\_tests\_\_/quality-barrel.spec.ts | oui     | 35     |

## Multi-judge ensemble (≥2 judges) : oui

- `composeMultiJudge(judges, tieBreakerJudge?)` accepte `ReadonlyArray<JudgeResult>`.
- Env-gate `MULTI_JUDGE_ENABLED === "true"` (sinon retourne `judge[0]` single = no-régression).
- Médiane consensus si variance < 15 (seuil `VARIANCE_ARBITRATION_THRESHOLD`).
- Tie-breaker arbitre si variance ≥ 15 ET tie-breaker fourni.
- Fonction pure (juges en input). Pas d'appel LLM ici — déterministe pour tests.
- Tests MJ1-MJ6 couvrent : off-default, médiane, arbitrage, fallback no-tiebreaker, defensive empty, somme coûts.

## Originality.ai env-gated fallback : oui

- `scanWithOriginalityAi(input)` lit `process.env.ORIGINALITY_AI_API_KEY` via `getApiKey()`.
- Key absente → retourne `{ fallback: true, originalityScore: 100, aiDetectedScore: 0, plagiarismScore: 0, costUsd: 0 }` + log warning non-bloquant.
- Key présente → V1 stub fake data (HTTP réel reporté Sessions 11+).
- Guard input : throw `originality_min_length` si `contentText.trim().length < 100`.
- `passesOriginalityGate(result)` court-circuite à `passed: true, reason: "fallback_no_api_key"` si fallback.
- Seuils env configurables : `ORIGINALITY_MIN_SCORE` (75), `ORIGINALITY_MAX_AI_SCORE` (90), `ORIGINALITY_MAX_PLAGIARISM` (20).
- Tests OA1-OA5 couvrent : fallback no-key, throw min-length, gate fallback passed, fail originality threshold, fail plagiarism threshold.

## Quality barrel SSOT (commit 6bcdbcc8) : oui

`src/server/content-gen/quality/index.ts` ré-exporte :

- V1 : `computeReadabilityFr`, `computeSeoScore`, `checkDoctrine`, `evaluateSoft404`, `jaccardSimilarity`, `checkPlagiarism`.
- Phase 16 : `composeMultiJudge` + types, `scanWithOriginalityAi`, `passesOriginalityGate` + types.

Smoke tests Q1-Q3 (quality-barrel.spec.ts) :

- Q1 : barrel exporte les 6 V1 helpers (typeof === "function").
- Q2 : barrel exporte les 3 Phase 16 helpers.
- Q3 : `composeMultiJudge` via barrel (env off) = single-judge no-regression.

## Cross-checks

- Wiring avec pipeline content-gen : non.
  - Grep `composeMultiJudge|scanWithOriginalityAi|passesOriginalityGate|MULTI_JUDGE_ENABLED|ORIGINALITY_AI_API_KEY` sur `axionia/src` retourne 5 fichiers, tous internes au module `quality/` (index.ts + 2 helpers + 2 spec). Aucun consommateur dans `workers/`, `runners/`, `orchestrator/`, `generators/`, ni server actions.
  - Cohérent avec le commit aab650c9 ("productionisation Sessions 11+ : adapter llm-judge.ts existant") et le commentaire en-tête multi-judge-ensemble.ts ligne 11-12.
- TypeScript types exposés (`JudgeResult`, `MultiJudgeEnsembleResult`, `OriginalityScanInput`, `OriginalityScanResult`) : oui via barrel.
- Activation prod : OFF par défaut (env vars absentes) — pas d'impact runtime sur le pipeline V1.

## Verdict / écarts trouvés

Phase 16 livre exactement ce que le commit annonce : 2 helpers env-gated, pure functions, fallback safe, 11 tests passants (MJ1-MJ6 + OA1-OA5) + 3 smoke barrel (Q1-Q3). Le commit aab650c9 mentionne lui-même "V1 squelette" et "productionisation Sessions 11+" — l'absence de wiring pipeline n'est donc pas un écart mais une livraison conforme au scope déclaré.

Points à noter pour Sessions 11+ (hors-scope Phase 16, pas un écart) :

- Aucune intégration dans `quality-loop` / `llm-judge.ts` existant — `composeMultiJudge` reste appelable uniquement si un consommateur lui fournit les `JudgeResult[]` déjà calculés.
- `scanWithOriginalityAi` retourne data stub quand `ORIGINALITY_AI_API_KEY` est définie (la vraie URL `api.originality.ai/v1/scan` est documentée en JSDoc mais non implémentée). Activation prod sans appel HTTP réel serait silencieusement no-op côté détection.
- Pas de schéma DB pour persister `OriginalityScanResult` / `MultiJudgeEnsembleResult` (audit trail AI Act art. 50 reporté).

Aucun blocage. STUB-OK conforme.
