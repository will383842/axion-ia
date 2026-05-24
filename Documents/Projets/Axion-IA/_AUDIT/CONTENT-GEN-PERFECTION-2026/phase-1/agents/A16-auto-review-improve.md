# A16 — Auto-Review LLM-as-Judge + Boucle Improve : État Forensique

**Agent** : A16 — Auto-Review LLM-as-Judge + Quality Improve Loop  
**Date** : 2026-05-21  
**HEAD** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
**Mode** : AUDIT-ONLY STRICT — 0 invention, citations fichier:ligne  
**Score final** : **7/50**

---

## Mission

Auditer l'existence et l'efficacité d'un reviewer LLM avec scoring multi-dimensionnel et boucle d'amélioration automatique avant publication. Vérifier la présence de mécanismes LLM-as-judge, multi-LLM consensus, A/B testing, active learning feedback Will, et calibration reviewer.

---

## Méthode

Lecture exhaustive de :
- `axionia/src/server/queue/workers/content-quality-improver-worker.ts`
- `axionia/src/server/queue/workers/content-gen-worker.ts`
- `axionia/src/server/queue/workers/content-fact-check-worker.ts`
- `axionia/src/server/queue/workers/content-publish-worker.ts`
- `axionia/src/server/content-gen/generators/blog-article.ts`
- `axionia/src/server/content-gen/generators/blog-from-keywords.ts` (via A03 cross-ref)
- `axionia/src/server/content-gen/generators/guide-pilier.ts`
- `axionia/src/server/content-gen/quality/seo-score.ts`
- `axionia/src/server/content-gen/quality/doctrine-check.ts`
- `axionia/src/server/content-gen/quality/readability.ts`
- `axionia/src/server/content-gen/quality/soft-404-gate.ts`
- `axionia/src/server/content-gen/quality/search-intent-validator.ts`
- `axionia/src/server/content-gen/generators/types.ts`
- `axionia/prisma/schema.prisma` (modèles Article, ContentGenJob, ReviewQueue, GenerationLog)
- `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/quality/_v2/QualityV2.tsx`
- Grep `editorialScore|WillReview|ReviewerPromptVersion|reviewer|LLM.*judge|as-judge|multi.*llm|A/B.*test|active.learning|calibrat|consensus` dans `axionia/src/`

---

## État Observé

### Architecture de review effective (V1 HEAD 2b98a70)

Le pipeline content-gen ne dispose d'aucun reviewer LLM autonome. L'architecture de "quality review" repose exclusivement sur :

**1. Quality gate déterministe inline dans les générateurs**

Chaque générateur (blog-article, blog-from-keywords, guide-pilier, etc.) embarque une boucle synchrone de 3 passes maximum qui calcule un `qualityScore` = `round((seoScore + readabilityScore) / 2)` — pénalité -30 si `doctrine.passed === false`. Cette boucle tourne dans le processus de génération lui-même (même provider, même modèle). Références :
- `axionia/src/server/content-gen/generators/blog-article.ts:105-195` : boucle `while (iteration < MAX_QUALITY_ITERATIONS)` avec `MAX_QUALITY_ITERATIONS = 3` et `BUDGET_CAP_USD = 0.15`
- `axionia/src/server/content-gen/generators/blog-article.ts:22-23` : `QUALITY_THRESHOLD = 60`
- `axionia/src/server/content-gen/generators/blog-article.ts:169-171` : formule `qualityScore = Math.round((seo.score + readability.score) / 2)` — pénalité -30 doctrine

Le feedback textuel interne pour les passes 2 et 3 cible trois dimensions : SEO score < 60, readability score < 60, violations doctrine, word count < 600. Exemple ligne 194 : `prevFeedback = "Score ${qualityScore}/100 insuffisant. Améliore : ${issues.join(' ; ')}"`. Ce n'est pas un reviewer LLM indépendant — c'est le même modèle générateur qui reçoit son propre feedback heuristique.

**2. content-quality-improver-worker — squelette V1 confirmé**

`axionia/src/server/queue/workers/content-quality-improver-worker.ts:1-13` (docstring) documente explicitement :
> "V1 = skeleton functional. Pipeline complet (re-prompt LLM avec system prompt enrichi sections sous-performantes) arrive V2 quand on a un dataset pour identifier patterns de re-prompt utiles."

Le corps effectif du worker (lignes 143-156) se limite à :
```
// V1 = increment attempts + log. V2 = re-prompt LLM avec system prompt
// enrichi (sections sous-score identifiées via heuristic on body).
await prisma.contentGenJob.update({ data: { status: "needs_review", qualityImprovementAttempts: { increment: 1 } } });
await logStep(contentGenJobId, "quality_loop_pass", `Pass quality loop ...`);
```
Aucun appel LLM n'est effectué. Le worker reçoit un job `quality_improving`, incrémente le compteur, et bascule en `needs_review`. Ce comportement est conforme à ce qu'a observé A03 (F03).

**3. Seuils quality loop dans content-gen-worker**

`axionia/src/server/queue/workers/content-gen-worker.ts:344-354` :
- `qualityLoopEnabled` : default ON (config DB `quality_loop.enabled`)
- `qualityThreshold` : default 75 (`QUALITY_LOOP_THRESHOLD_DEFAULT`)
- `qualityMaxAttempts` : default 2 (`QUALITY_LOOP_MAX_ATTEMPTS_DEFAULT`)
- `eligibleQualityLoop` : `score > 0 && score < qualityThreshold && dbJob.qualityImprovementAttempts < qualityMaxAttempts`

Mais quand `eligibleQualityLoop = true`, le job est basculé en `quality_improving` et confié au worker squelette qui ne fait rien. Résultat effectif : un job avec score < 75 est incrémenté 1-2 fois puis part en `needs_review` sans jamais avoir été amélioré par un LLM.

**4. Fact-check worker — Perplexity post-publish**

`axionia/src/server/queue/workers/content-fact-check-worker.ts:15-20` : le worker post-publish interroge Perplexity pour valider les claims chiffrés. Il calcule un `factCheckScore` (0-100) et le persiste dans `Article.factCheckScore`. Ce n'est pas un reviewer LLM-as-judge : c'est une validation factuelle limitée aux assertions numériques, après publication. Il n'influence pas la décision publish/reject.

**5. editorialScore — champ fantôme**

`axionia/prisma/schema.prisma:897` : `editorialScore Int? @map("editorial_score")` existe en schema depuis la migration `20260514120000_add_content_gen_core` (ligne 73). Le dashboard admin `QualityV2.tsx:42-76` l'affiche. Aucun worker, aucun générateur, aucun service ne le calcule ni ne le persiste. Confirmé :
- Grep `editorialScore` dans `axionia/src/server/` : 0 résultat
- Grep `editorial_score` dans `axionia/src/server/` : 0 résultat
- `axionia/src/lib/knowledge/legacy-import-mapping.test.ts:37` : `editorialScore: null` (valeur par défaut explicite dans les tests)

**6. ReviewQueue — review humaine Will, pas LLM**

`axionia/prisma/schema.prisma:2961-2974` : `ReviewQueue` n'a que des champs `reviewNotes String?` et `reviewedBy String?`. Aucun champ `llmReviewScore`, `reviewerModel`, `reviewerDimensions`, `reviewerComments`. La review est exclusivement humaine (Will).

**7. Absence confirmée de toute infrastructure LLM-as-judge**

Grep `LLM.*judge|as-judge|as_judge|reviewer.*model|multi.*llm|consensus|WillReview|ReviewerPromptVersion` dans `axionia/src/` : 0 résultat dans les fichiers serveur ou workers. Les seules occurrences sont dans le contenu glossaire (`glossary-extension.ts:707-720`) et une mention dans `it-cyber.ts:458` — en tant que concept expliqué dans le contenu Axion-IA, pas en tant qu'implémentation.

---

## Findings

### Tableau P0/P1/P2

| # | Sévérité | Dimension | Problème | Fichier:ligne |
|---|----------|-----------|---------|---------------|
| F01 | **P0** | Reviewer LLM absent | Aucun reviewer LLM indépendant du générateur n'existe. L'`editorialScore` n'est jamais calculé. La "review" est exclusivement déterministe (SEO score + readability + doctrine) exécutée par le générateur lui-même | `schema.prisma:897` / grep 0 résultat `server/` |
| F02 | **P0** | Quality improver worker = squelette pur | `content-quality-improver-worker.ts:143-157` : le worker incrémente un compteur et bascule en `needs_review` sans appeler aucun LLM. Commentaire docstring ligne 13 le documente explicitement : "V2 quand on a un dataset" | `content-quality-improver-worker.ts:13,143-157` |
| F03 | **P0** | Reviewer ≠ Generator : non respecté | Le même modèle/provider qui génère le contenu évalue sa propre qualité dans la boucle inline. Biais auto-évaluation structurel garanti | `blog-article.ts:121-194` (routerGenerate = même provider pour generate et quality feedback) |
| F04 | **P0** | Scoring multi-dim absent | Dimensions `factual_accuracy / depth / originality / readability / seo_completeness / value_to_reader / tone_axionia` non existantes. Seules dimensions scorées : SEO /100 (déterministe, 13 critères) + Flesch-Kincaid FR + score doctrine binaire | `seo-score.ts:199-234` / `readability.ts:49-82` |
| F05 | **P0** | Seuils incohérents avec mission | Mission : `publish >= 8.5, improve 7-8.5, reject < 7` sur échelle /10. Réel : `qualityThreshold = 75` (config DB) pour trigger quality loop, `QUALITY_THRESHOLD = 60` pour passer la boucle inline générateur — sur échelle /100. Aucune normalisation vers les seuils mission | `content-gen-worker.ts:347` / `blog-article.ts:22` |
| F06 | **P0** | editorialScore jamais peuplé | Champ existe en schema et affiché dans dashboard QualityV2.tsx mais aucun code ne le calcule. Tous les articles ont `editorialScore = null` | `schema.prisma:897` / `QualityV2.tsx:42,76` |
| F07 | **P1** | Multi-LLM consensus absent | Aucun vote croisé Sonnet + Opus. Un seul modèle via `provider-router.ts` (routing par provider_key, pas consensus) | `content-gen-worker.ts:228` / `providers/provider-router.ts` |
| F08 | **P1** | A/B testing best-of-N absent | Aucune génération de 2 versions pour sélection par score. La boucle inline est séquentielle améliorative, pas comparative | `blog-article.ts:105-195` |
| F09 | **P1** | Active learning Will feedback absent | Aucune table `WillReview`, aucun schéma de feedback structuré Will sur la qualité. `reviewNotes` dans `ReviewQueue` est un champ texte libre non exploité pour calibrer les prompts | `schema.prisma:2967` |
| F10 | **P1** | Max iterations boucle : 2 worker + 3 inline = confusion | La boucle inline des générateurs tourne jusqu'à 3 passes (`MAX_QUALITY_ITERATIONS=3`). Le worker externe tourne jusqu'à `maxAttemptsAuto=2` (config). Les deux sont indépendants et non coordonnés. Le comportement effectif quand les deux s'enchaînent n'est pas documenté | `blog-article.ts:22` / `content-quality-improver-worker.ts:78,128` |
| F11 | **P1** | Improve multi-axis targeting absent | Quand le reviewer (déterministe) flag "depth insuffisant", la boucle inline génère un feedback générique (`issues.join(' ; ')`). Pas de ciblage section par section ni de re-prompt focalisé sur la section faible | `blog-article.ts:185-194` |
| F12 | **P1** | Cost cap quality loop partiel | `monthlyBudgetCapUsd` est implémenté dans le worker (`content-quality-improver-worker.ts:110-123`) mais la valeur `monthSpentUsd` reste toujours 0 (V1 = pas de LLM call). Le cap inline des générateurs est `BUDGET_CAP_USD = 0.15` par article (`blog-article.ts:23`) — effectif mais bas | `content-quality-improver-worker.ts:43-65` / `blog-article.ts:23,143` |
| F13 | **P1** | Failure mode reviewer down : inexistant | Pas de reviewer LLM = pas de failure mode à gérer. Mais si le reviewer était créé sans fallback rule-based, tout contenu serait bloqué en cas de panne API | N/A (infrastructure absente) |
| F14 | **P2** | Heuristiques rule-based pré-LLM existent mais partielles | 5 heuristiques actives : word count (soft-404 gate), H2 count, FAQ count, keyword density, doctrine check. Manquantes : longueur titre/meta sans appel LLM (déjà dans seo-score mais threshold enforced ?), external links, hook structure | `soft-404-gate.ts:76-94` / `seo-score.ts:199-234` |
| F15 | **P2** | Admin UX reviews : scores affichés, comments reviewer absents | `QualityV2.tsx` affiche les scores agrégés par jour (SEO, Quality, Readability, Fact-check, Editorial). Mais aucune vue par article avec `reviewerComments`, aucun drill-down sur les dimensions de score | `QualityV2.tsx:108-181` |
| F16 | **P2** | Calibration reviewer absente | Aucune procédure de calibration périodique. Will n'a aucun outil pour noter manuellement 10 articles et comparer avec les scores automatiques | N/A (infrastructure absente) |
| F17 | **P2** | Explainability : partielle | `breakdown` de `SeoScoreResult` contient un `reason` par critère (`seo-score.ts:44-53`). `DoctrineCheckResult` contient `blockingViolations[].reason`. Mais ces raisons ne remontent pas dans l'UI ReviewQueue ni dans le `reviewerComments` de l'article | `seo-score.ts:44-53` / schema.prisma (ReviewQueue sans champ breakdown) |
| F18 | **P2** | Reviewer prompts versioning absent | Aucune table `ReviewerPromptVersion`. Les prompts systèmes des générateurs sont des constantes inline non versionnées en DB | `blog-article.ts:25-33` (SYSTEM_PROMPT const inline) |

---

## Scoring /50

| Dimension | Max | Obtenu | Justification |
|-----------|-----|--------|---------------|
| Reviewer existe + multi-dim scoring | /10 | **0** | Aucun reviewer LLM. `editorialScore` = null. Scoring = déterministe SEO+readability uniquement, pas multi-dim LLM |
| Multi-LLM consensus (Reviewer ≠ Generator) | /8 | **0** | Même provider génère et évalue. Aucun consensus cross-modèle |
| A/B testing / Best-of-N | /6 | **0** | Boucle séquentielle améliorative uniquement. Aucune génération comparative |
| Active learning Will feedback loop | /6 | **0** | Aucune table feedback structuré. `reviewNotes` texte libre non exploité |
| Boucle improve max iter + multi-axis targeting | /6 | **3** | Boucle inline 3 passes avec feedback heuristique (SEO/readability/doctrine/wordcount) réellement actif dans les générateurs. Worker externe = squelette. Targeting = générique (issues.join) pas section-ciblé. Crédit partiel pour le mécanisme inline qui fonctionne |
| Heuristiques rule-based pré-LLM | /4 | **3** | 5 heuristiques actives (soft-404, H2 count, FAQ count, keyword density, doctrine check, word count, plagiarism, dedup Levenshtein). Bien implémentées. Manque external links et hook check |
| Calibration reviewer + explainability | /5 | **1** | `SeoScoreResult.breakdown` avec `reason` par critère = explainability partielle. Calibration = 0. Aucune remontée breakdown dans UI |
| Failure mode + cost cap par article | /3 | **1** | `BUDGET_CAP_USD = 0.15` inline effectif. `monthlyBudgetCapUsd` du worker = fictif (0 LLM calls). Fallback Redis absent → `needs_review` (fail-soft acceptable) |
| Admin UX reviews visibles | /2 | **0** | QualityV2 = scores agrégés par jour sans drill-down article. Aucun `reviewerComments`. Aucune vue dimensions par article |
| **TOTAL** | **/50** | **7/50** | |

**Verdict** : 7/50 = **14% — P0 CRITIQUE**

---

## Délégations

Aucune délégation — périmètre couvert exhaustivement en lecture directe des fichiers source.

---

## UNKNOWNs

| # | Inconnu | Raison |
|---|---------|--------|
| U1 | Modèle reviewer cible si V2 implémenté | Non documenté (commentaire V1 mentionne "re-prompt LLM" sans préciser lequel). Le `provider-router.ts` route selon config DB mais aucune config "reviewer model" n'existe |
| U2 | Dataset "patterns de re-prompt utiles" mentionné dans docstring V1 | `content-quality-improver-worker.ts:13` : "arrive V2 quand on a un dataset pour identifier patterns de re-prompt utiles" — aucune trace de collecte de ce dataset en cours |
| U3 | Plan V2 quality improver | Aucune issue, aucun ADR, aucun backlog document trouvé décrivant le design V2 du reviewer |

---

## Références

| Fichier | Lignes clés | Objet |
|---------|------------|-------|
| `axionia/src/server/queue/workers/content-quality-improver-worker.ts` | 1-13, 143-157 | Squelette V1 confirmé — zéro LLM call |
| `axionia/src/server/queue/workers/content-gen-worker.ts` | 344-431 | Orchestration quality loop + seuils (threshold=75, maxAttempts=2) |
| `axionia/src/server/content-gen/generators/blog-article.ts` | 22-23, 105-195 | Boucle inline 3 passes — seul reviewer actif, non indépendant |
| `axionia/prisma/schema.prisma` | 897, 2961-2974 | editorialScore fantôme / ReviewQueue sans champs LLM |
| `axionia/src/server/content-gen/quality/seo-score.ts` | 44-53, 199-234 | Seul scoring multi-critère — déterministe, 13 dimensions, /100 |
| `axionia/src/server/content-gen/quality/readability.ts` | 49-82 | Flesch-Kincaid FR — score /100 |
| `axionia/src/server/content-gen/quality/doctrine-check.ts` | 69-240 | Doctrine check — binaire (passed/blocked) |
| `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/quality/_v2/QualityV2.tsx` | 42, 76, 108-181 | Dashboard scores agrégés — editorialScore affiché mais null systématique |
| `axionia/src/server/queue/workers/content-fact-check-worker.ts` | 15-20, 79-148 | Perplexity post-publish — factCheckScore uniquement, pas reviewer |

---

## Synthèse pour Will

**Ce qui fonctionne** : La boucle de qualité inline dans les générateurs (3 passes, feedback heuristique SEO+readability+doctrine, budget cap $0.15) est réellement active et économise des appels LLM inutiles en rejetant les contenus thin avant publish. Les 5+ heuristiques rule-based (soft-404, dedup, plagiarism, doctrine, intent) constituent un solide premier filtre sans coût LLM.

**Ce qui est vide** :
1. `content-quality-improver-worker` = squelette pur (0 LLM, 0 amélioration). Les jobs `quality_improving` sont immédiatement rebasculés en `needs_review`.
2. `editorialScore` = null sur tous les articles publiés.
3. Aucun reviewer LLM indépendant du générateur n'existe — le biais auto-évaluation est structurel.
4. Aucun mécanisme d'active learning Will, de calibration, de A/B testing, ou de multi-LLM consensus.

**Gap critique** : Le pipeline actuel publie des contenus tier-2 sans jamais avoir été évalués par un LLM indépendant sur des dimensions éditoriales (depth, originality, value_to_reader, tone_axionia). La seule barrière automatique est un calcul arithmétique (SEO + Flesch) / 2 ≥ 60.
