Confirmation finale : `wordCount = view.body.trim().split(/\s+/).length` au rendu (corps seul, sans FAQ/blocks AEO) — la discordance wordCount est confirmée. J'ai tous les éléments. Voici la cartographie de référence.

---

# CARTOGRAPHIE DE RÉFÉRENCE — Système Content-Gen Axion-IA

> Worktree audité : `axionia-wt-blog-cat` · branche `feat/blog-article-template-refonte` · 2026-06-25
> Statut : audit read-only. Modifs de session NON COMMITÉES signalées par ⚠️.

---

## 1. Architecture d'ensemble

```
ContentGenJob (DB, queue "content-gen")
        │
        ▼
content-gen-worker.ts  ──► getGenerator(contentType)  ──►  Generator.generate(input)
   (13+ étapes, gates)         REGISTRY (21 types)            │ 1 ou N appels LLM (provider-router)
        │                                                      │ boucle qualité interne
        │  ◄────────────────── GeneratorOutput ◄──────────────┘
        ▼
  Gates POST-IA (plagiarism, intent, outline, doctrine, topic, benefit)
        │  blockingFail = OR des 6 → tier_3
        ▼
  Orchestration statut: quality_improving / approved / needs_review
        │ (approved)
        ▼
content-publish-worker.ts ──► Article + ArticleTranslation (UPDATE si refreshArticleId)
   (drip 8h-22h, daily cap, fact-check, citations, embeddings, IndexNow)
        │
        ▼
  /blog/[slug]/page.tsx  ──► rendu 2-colonnes + 6 blocs AEO + JSON-LD
```

**4 niveaux de configuration** (décentralisée — voir §7) :
1. `ProviderConfig` (DB) — modèles/caps LLM, cache 60s, fallback `V0_DEFAULTS`
2. `ContentGenConfig` (DB key/value JSON) — politiques métier globales
3. `ContentTemplate` (DB par contentType) — override systemPrompt/temperature/maxTokens
4. **Constantes hardcodées dans 10+ fichiers générateurs** (P0 de dispersion)

---

## 2. Inventaire des générateurs

`REGISTRY` (`index.ts:58`) = 21 types ; `getGenerator()` throw `UnrecoverableError` si absent (`index.ts:85`). `landing_ville` = enum legacy (`schema.prisma:2724`), JAMAIS enregistré, CLI-only.

### Tableau maître

| Générateur | Archi appel LLM | Longueur cible (prompt) | Longueur réelle observée | maxTokens | Quality thr. | MAX_ITER | BUDGET_CAP | MIN_WORD_COUNT | Provider | Gates additionnels |
|---|---|---|---|---|---|---|---|---|---|---|
| **blog_article** | **Mono** (1 JSON/passe) | 1200-2000 | **~400-600** ❌ | 8000 ⚠️ | 60 | 3 | 0.30 ⚠️ | **1200** ⚠️ | OpenAI (pas de preferred) | metaTitle keyword (si primaryKw) |
| **blog_from_keywords** | **Mono** | 1500 (8-10 H2×180-260) | **~400-600** ❌ | 8000 ⚠️ | 60 | 3 | 0.30 ⚠️ | **1500** ⚠️ | OpenAI | H1+metaTitle via `keywordPresentInText()` ✅ |
| **blog_from_title** | **Mono** | 1200-2000 | **~400-600** ❌ | 8000 ⚠️ | 60 | 3 | 0.30 ⚠️ | **1200** ⚠️ | OpenAI | H1 = `includes(kw.slice(0,30))` ⚠️ fragile |
| **blog_from_rss** | **Mono** | ~source ±25% (min 450) | court (intentionnel) | 3072 | 55 | 2 | 0.10 | 400 inline | OpenAI | RSS similarity ≤0.10 (plagiat) |
| **comparison** | **Mono** | 1500-2000 | court | 8000 ⚠️ | 60 | 3 ⚠️(était 2) | 0.30 ⚠️ | **1200** ⚠️ | OpenAI | ≥2 H2 + `<table>` HARD throw → BullMQ retry |
| **barometer_insight** | **Mono** | 1000-1800 | **~400-600** ❌ | 8000 ⚠️ | 60 | 3 | 0.30 ⚠️ | **1000** ⚠️ | OpenAI | données snapshot vérifiées, metaTitle keyword |
| **qa_derived** | **Mono** | answerHtml 250-400 | ~300-500 | 2048 | 55 | 2 | 0.08 | — (gate ≥300 en boucle) | OpenAI | wordCount≥300, directAnswer<30 mots pénalisé |
| **faq_standalone** | **Mono** | 10-15 Q/A | variable | 5000 | 55 | 2 | 0.10 | — (faqCount≥10) | OpenAI | faqCount≥10 + doctrine ; **PAS de gate wordCount** ❌ |
| **guide_pilier** | **MULTI** (outline + N sections) | 2000-5000 (8-12×250-450) | **2000+** ✅ | 2048 (outline) + 900/section | 60 | — (2-step) | — (cumulé) | implicite ≥2000 | OpenAI | sectionFailures −10/échec (max −50) ; **JAMAIS tier_1** (design Batch 3.C) |
| **12× Phase 8** (long_tail_keyword, pain_point_solution, vs_comparator, alternative_to, top_x_in_y, how_to_x_in_y, best_for_x_in_y, calculator_roi, glossary_term, what_is_x, faq_geo, case_study_local) | **Mono** (pipeline partagé `runV7Phase8Pipeline`) | 1200-2000 (≥6 H2, ≥10 H3) | **~400-600** ❌ | 8000 | 60 | 3 | **0.15** | 1200 | OpenAI | H1 gate **`title.includes(kw)` substring** ⚠️ BUG (n'appelle PAS `keywordPresentInText`), multi-judge Claude, Originality.ai 5s |
| landing-ville-* (5, CLI/registry mixtes) | Mono | 70-250 flexible | court (voulu) | — | 55/50 | pas de MAX_ITER | 0.05-0.20 | — | **anthropic** (preferred) | bonus longueur, soft404 |
| landing_ville (legacy) | CLI-only | — | — | — | — | — | — | — | — | hors registry, `GeneratedVilleCopy` |

❌ = symptôme « article court bloqué needs_review » (Will, 2026-06-25). ✅ = atteint sa cible. ⚠️ = modif non commitée ou bug.

### Constat architectural central

**Mono-appel JSON** (tous les blog + Phase 8) : un seul `routerGenerate()` par itération renvoie `{title, metaTitle, metaDescription, slug, directAnswer, bodyHtml, faq[8], tags, keyTakeaway, expertTake}` d'un coup. Le modèle répartit son budget tokens entre 9-10 champs → **compresse `bodyHtml` à ~400-600 mots** quel que soit le prompt.
- Preuve mono-appel : `blog-article.ts:187-195`, `v7-phase8-shared.ts:202-210`.
- **Multi-appel** (guide-pilier seul) : `STEP 1` outline (`guide-pilier.ts:245-253`, maxTokens 2048) puis `STEP 2` boucle `for (const section of sections)` (`guide-pilier.ts:276-315`, 900 tokens/section). Chaque section isolée force 250-450 mots → cumul ≥2000 garanti. **C'est la décomposition architecturale, pas le maxTokens, qui produit la longueur.**

---

## 3. Pipeline worker (`content-gen-worker.ts`)

Ordre d'exécution (références ligne) :

| # | Étape | Ligne | Effet si échec |
|---|---|---|---|
| 1 | Kill-switch hard-gate (DB) | 243-248 | requeue |
| 2 | Lookup `ContentGenJob` | 252-266 | UnrecoverableError |
| 3 | KB health assertion (`assertKbReady`) | 269-285 | status=failed + Telegram |
| 4 | Dedup pré-IA (Levenshtein 0.85 + topic fp + decay 90j + exception multi-audience) | 288-320 | status=cancelled |
| 5 | `getGenerator(contentType)` | 323 | UnrecoverableError |
| 6 | Sélection keyword (vertical → géo si anchorVille, fallback 747 seeds) | 328-382 | warning |
| 7 | Keyword lock Redis (`SET NX EX 1800`) | 391-423 | status=cancelled si lock tenu |
| 8 | Résolution template (`resolveTemplateById`/`Override`) | 454-475 | fallback prompt code |
| 9 | **`generator.generate()`** (~30-90s) | 477-506 | — |
| 10 | Validation keyword-in-title (non-bloquant) | 509-519 | warning |
| 11 | Hero image cascade Unsplash | 521-561 | `hero_image_pending` |
| 12 | Plagiarism Jaccard 5-gram (seuil 0.30 / RSS 0.10) | 572-600 | → blockingFail |
| 13 | Intent alignment validator | 602-639 | → blockingFail |
| 14 | Outline SimHash dedup (Hamming ≤4 = dup) | 641-659 | → blockingFail |
| 15 | Doctrine hard-fault (SIREN/SIRET/RCS, ratio axion <60%) | 677-695 | → blockingFail |
| 16 | Topic-fingerprint Voyage (fail-soft) | 697-728 | → blockingFail si dup |
| 17 | Benefit-gate (commercial-only, **DORMANT** flag) | 730-793 | → blockingFail si on |
| 18 | `blockingFail` = OR des 6 | 798-804 | → tier_3 forcé |
| 19 | Orchestration statut | 849-957 | voir §5 |

**`finalIndexationTier = blockingFail ? tier_3_noindex_nofollow : output.indexationTier`** (`content-gen-worker.ts:805`).

---

## 4. Boucle qualité

**Source unique du score** : `qualityFromScores(seo, readability, doctrine)` (`article-quality.ts:57-64`) :
```
base = round((seoScore + readabilityFitScore(readability)) / 2)
return doctrinePassed ? base : max(0, base - 30)
```
**wordCount n'entre PAS dans le score — c'est un GATE bloquant séparé.**

**Condition de sortie** (mono-appel) : `if (qualityScore >= QUALITY_THRESHOLD && wordCount >= MIN_WORD_COUNT) break` (`blog-article.ts:255`, `blog-from-keywords.ts:276`, `v7-phase8-shared.ts:311`). Les DEUX doivent être vrais.

**3 conditions de break** : (1) exit qualité ci-dessus ; (2) `accumulatedCostUsd >= BUDGET_CAP_USD` ; (3) `iteration >= MAX_QUALITY_ITERATIONS`.

**Température** : passe 0 = 0.7 (0.65 comparison/qa, 0.6 barometer) → passes suivantes 0.5/0.4/0.3.

**Feedback inter-passes** (`prevFeedback`, section « ## Retour qualité passe précédente ») accumule : wordCount insuffisant (« étoffe CHAQUE section »), SEO<60, readability<60, doctrine, H1/metaTitle keyword, table manquante.

**Le piège du deadlock** : pour un blog mono-appel, la passe 1 produit ~500 mots. Le feedback « étoffe les sections » ne change PAS l'architecture mono-appel → la passe 2-3 reproduit ~500 mots. Après 3 passes (ou budget 0.30 épuisé), break forcé avec `wordCount < MIN_WORD_COUNT` → exit qualité jamais atteint → `needs_review`. Le MIN_WORD_COUNT ajouté cette session **rend le symptôme visible** (avant : score 60 seul suffisait → court mais publié) mais **ne le corrige pas** (pas de levier structurel sur la longueur).

**Worker-level vs generator** (incohérence) : `content-gen-worker.ts:103-105` déclare `QUALITY_LOOP_THRESHOLD_DEFAULT=75` et `QUALITY_LOOP_MAX_ATTEMPTS_DEFAULT=2`, alors que les générateurs hardcodent threshold=60 / MAX_ITER=3. La boucle interne du generator (3 passes) et la boucle externe `quality_improving` (2 tentatives, seuil 75) sont deux mécanismes distincts.

---

## 5. Gates et orchestration de statut

**`blockingFail`** (`content-gen-worker.ts:798-804`) = `!plagiarism.passed || !intent.aligned || outlineBlockingFail || doctrineHardFail || topicDuplicateFail || benefitFail`.

**Décision `nextStatus`** (ordre de priorité, `849-903`) :
1. **quality_improving** si `qualityLoop.enabled && !blockingFail && 0 < score < 60 && attempts < maxAttemptsAuto(2)` → enqueue `quality-improver-worker`
2. **approved** (RSS) si `blog_from_rss && autoPublish && !blockingFail && score ≥ 60`
3. **approved** (factory full) si `factoryAutoPublishAllBlogTypes !== false && !blockingFail && score ≥ 60`
4. **needs_review** (défaut)

**Plancher P1-1 (2026-06-15)** : score=0 (scorer raté) ou `0<score<60` après épuisement boucle → `needs_review` (jamais auto-pub).

**Intent validator** (`search-intent-validator.ts`) — hard-fails par intent :
- informational : citationCount < 3 (`88-90`) — correctif 2026-06-20 : `citationCount = max(citations JSON, liens externes HTML)` (`614-625`)
- local : LocalBusiness JSON-LD + geo meta ; transactional : CTA ; commercial_investigation : `<table>` ; featured_snippet : `data-aeo="tldr"` ; ai_overview : ≥1 source ; voice_search : <30% phrases >15 mots

**Soft-404** (`soft-404-gate.ts:33-34`) : <350 mots (ou <280 avec JSON-LD riche) → tier_3 ; bonus FAQ ≥4 = +50 mots équivalents. **Force le tier seulement, n'influence PAS nextStatus** (un article court non-bloquant peut être auto-publié en tier_3/noindex).

**Indexation tier dans les générateurs** : `tier_1_indexable` exige `doctrine.passed && qualityScore ≥ 70 && kbChunks.length > 0` (`blog-article.ts:335-343`). Sans KB chunk → tier_2 max (anti-HCU, 2026-06-25). guide_pilier plafonné tier_2 par design.

---

## 6. Providers (`providers/`)

**Routing** `ROLE_TO_PROVIDERS` (`provider-router.ts:102-117`) :
- `text` → `[openai, anthropic]` (OpenAI primaire, Claude fallback — fix A-P1-01)
- `data` → `[perplexity]` · `stock_image` → `[unsplash]` · `image`/`rerank` → `[openai]`

**`preferredProvider`** réordonne la liste (`129-146`). ⚠️ **Tous les blog/guide generators ne passent PAS `preferredProvider` → OpenAI gpt-4o forcé.** Seuls les 5 landing-ville (+ benefit-judge) passent `anthropic` (audit 2026-06-22).

**Modèles** (`config-reader.ts`, cache 60s, fallback V0) : openai=`gpt-4o` ($200/mois), anthropic=`claude-sonnet-4-6` ($100), perplexity=`sonar-pro` ($80). LLM-judge = Claude.

**Circuit breaker** (`28-91`) : 5 erreurs/30s → ouvert 60s → half-open. In-memory per-worker (PAS Redis-shared V0).

**Cost-cap** (`cost-tracker.ts`) : `assertCostCapAvailable` pré-call (throw `cost_cap_reached` non-retryable si ≥100%), `trackCost` atomique post-call ($transaction CostLedger + increment). Estimés hardcodés : openai 0.1, anthropic 0.15, perplexity 0.05.

**Anthropic default maxTokens = 4096** (`anthropic.ts`, distinct du 8000 demandé par les générateurs blog) → si fallback Claude se déclenche, output plafonné plus bas.

**Note coût** : `BUDGET_CAP_USD` (0.15-0.30) = budget **par article** (boucle locale). `ContentGenConfig.quality_loop.monthlyBudgetCapUsd=100` = cap **mensuel**. Sémantiques différentes, pas de lien entre les deux.

---

## 7. Config / SSOT — dispersion (P0)

Les seuils qualité sont **hardcodés en haut de 10+ fichiers générateurs** au lieu d'être dans `ContentGenConfig`. Changer `MIN_WORD_COUNT` 1200→1500 = éditer 5 fichiers + redéployer (pas de tuning console). Preuves : `blog-article.ts:38-42`, `blog-from-keywords.ts:48`, `v7-phase8-shared.ts:59-65`, `guide-pilier.ts:245-325`.

`ContentTemplate` peut overrider systemPrompt/temperature/maxTokens au runtime (`template-resolver.ts:33-64`), mais **pas les constantes de boucle qualité** (threshold/iter/budget/min_word). Les compteurs `generatedItems/publishedItems` de ContentTemplate sont gelés (jamais incrémentés).

---

## 8. Grounding / RAG

**4 couches** : (1) Retrieval `kbRetrieve()` hybride FTS+Vector RRF K=60 (`kb-client.ts`) avec fallback FTS si embeddings stub ; (2) KB health hard-gate (≥50 entries, ≥60% public, <90j — `kb-health.ts:25-27`) ; (3) Feeder HMAC vers KB (`kb-feeder.ts`) — **⚠️ les blog generators ne RÉINJECTENT JAMAIS leurs articles en KB** (lecture seule, pas de cycle vertueux) ; (4) KB Facts (6513 lignes, 8 fichiers sectoriels dont `sector-pain-matrix.ts` 1509L, `villes-facts.ts` 1719L).

**Retrieval par générateur** : blog-* k=8, blog_from_rss k=6, guide_pilier k=10, qa_derived k=6, faq_standalone k=10. Filtres : `audiences=["public"]`, `types=[industry_use_case, case_study, methodology, guide]`. Phase 8 exclut `case_study` auto-générés (anti-collapse).

**External links** (`external-links-injector.ts`) : catalogue `ALL_EXTERNAL_LINKS` ~2400 liens vérifiés (`master.ts`), 4 liens minAuthority=4 injectés en markdown dans userPrompt. ⚠️ Aucune vérification que le LLM cite réellement les URLs inline ni que les KB chunks récupérés sont réellement utilisés.

**System prompt directive paradoxale** : « GROUNDING OBLIGATOIRE » vs « si fait précis manque, reste général SANS rien inventer » (`blog-article.ts:48-50`) — ambiguïté.

---

## 9. Rendu (`/blog/[slug]/page.tsx` + composants AEO)

Architecture 2-colonnes (TOC sticky gauche + corps droit). `loadBlogArticleForView()` → `BlogArticleView`. `buildToc(sanitizeContentGenHtml(body))` injecte `id` + `data-speakable` sur les h2.

**6 blocs séquentiels** : `AnswerCard` (TL;DR), `ArticleKeyTakeaway`, corps, `ArticleExpertQuote` (Person JSON-LD), `ArticleFaq` (`<details>` natif + FAQPage JSON-LD), `ArticleSources` (nofollow/dofollow par trust-tier), `ArticleTransparencyBlock`.

**Sanitization** : `html-sanitizer.ts` whitelist 17 tags (FORBID h1/script/iframe) ; `faq-sanitizer.ts` whitelist 8 tags (exclut blockquote/img — risque truncation).

### ⚠️ Discordance wordCount CRITIQUE (probablement la vraie racine business)

- **Rendu page** : `wordCount = view.body.trim().split(/\s+/).length` (`page.tsx:275`) = **corps seul, ~400-600 mots** → c'est cette valeur qui part dans `Article.wordCount` JSON-LD (sous-évaluation pour les LLM/Google).
- **Site-inspector** : `countWords(html)` extrait `<main>/<article>` rendu = inclut FAQ + directAnswer + expertQuote = **1500-2000+ mots** (`site-route-inspector-worker.ts:49-58`).
- **Gate générateur** : `MIN_WORD_COUNT` mesure `bodyText` aplati du `bodyHtml` SEUL (après `appendSourcesSection`, mais AVANT FAQ/directAnswer/expertQuote qui sont des champs JSON séparés). `blog-article.ts:227-231`.

**Conséquence** : un article dont le **contenu total** (corps + 8 FAQ substantielles + directAnswer + expertTake) dépasse 1500 mots peut être bloqué `needs_review` parce que le **corps seul** fait <1200. Et inversement, le JSON-LD émis sous-déclare la longueur réelle aux moteurs/LLM. Le gate et le rendu et le JSON-LD comptent **trois périmètres différents**.

---

## 10. Citations / AEO

**Tables** : `ExternalReference` (url unique, trustTier via `mapAuthorityToTrustTier`, citationCount incrémenté) + `ContentCitation` (articleId, anchorText, jobId). **Vides avant juin 2026** (writer ajouté seulement à cette date).

**Flux** : `injectExternalLinks` (génération) → `detectHallucinations` (`helpers.ts:227-250`, valide `<a href>` contre catalogue) → `trackExternalLinksUsage` (rotation) → `persistArticleCitations` (`persist-citations.ts:82-144`, idempotent deleteMany+insert, post-publish best-effort).

**Signaux JSON-LD** : `Article.citation[]` (CreativeWork, +20-40% citation rate Perplexity), `isBasedOn` (RSS uniquement), `FAQPage`, Speakable (8 selectors, `speakable-universal.ts`).

**Trous** : (1) `detectHallucinations` ne scanne que le bodyHtml, **pas les FAQ** → URLs hallucinées en FAQ non détectées ; (2) deux sources de vérité pour citationCount (parsing `<a>` vs champ LLM souvent vide chez Anthropic) ; (3) `LOCAL_CITATIONS_FR.listingUrl` tous null → `buildLocalBusinessSameAsFR` retourne `[]` (zéro signal local Google/Bing Places).

---

## 11. Régénération en place (refresh)

`regenerateArticle(articleId)` → si job source purgé (18/18 en local) : `deriveSourceJobFromArticle()` (`regenerate-helpers.ts:140-165`) dérive `RegenSourceJob` depuis le titre, ⚠️ condense « Intelligence Artificielle » → « IA » (`:149`), force `contentType=blog_from_keywords`. Injecte `refreshArticleId`/`refreshOfSlug` dans inputPayload. Idempotence SHA256 [refresh, articleId, fenêtre 60s]. Anti-doublon en vol. priority=4.

À la publication : `Article.update()` réécrit le contenu MAIS préserve `status/publishedAt/promotedAt/indexationTier` ; `ArticleTranslation.update()` réécrit title/body/meta mais **slug PRÉSERVÉ** (`content-publish-worker.ts:693`, « slug volontairement NON modifié ») → URL stable, zéro 301. Tags purgés+recréés. Batch : `regenerateTier1Corpus(limit=25)` (oldest-first).

⚠️ Le refresh **réutilise la même architecture mono-appel** → la régénération reste courte (même cause racine). Le condense « IA » améliore le passage des gates H1/metaTitle mais n'augmente PAS la longueur.

---

## 12. Jugement sur les modifs NON COMMITÉES de la session

| Modif | Fichier:ligne | Effet réel |
|---|---|---|
| `MIN_WORD_COUNT` 1200-1500 ajouté (5 gén.) | blog-article:42, blog-from-keywords:48, barometer:40, blog-from-title:45, comparison:53 | **Rend le symptôme visible** (force needs_review au lieu de publier court), **ne corrige pas** la longueur. Sans levier structurel, garantit le needs_review. |
| `maxTokens` 4096→8000 | blog-article:193, etc. | Lève un plafond de troncature mi-section, mais 8000 reste un **plafond, pas un forçage**. Le modèle compresse bien en-deçà. Marginal. |
| `BUDGET_CAP_USD` 0.15→0.30 | blog-article:40 | Permet 3 passes complètes au lieu de ~2. Sans effet sur l'architecture mono-appel → 3 passes courtes = toujours court. |
| `keyword-match.ts` (`keywordPresentInText`) | keyword-match.ts:47-75 | ✅ **Correct et utile** : règle les faux-négatifs gate H1 « IA »⇄« intelligence artificielle ». Appelé par blog_from_keywords (`:225`). ⚠️ **PAS appelé par v7-phase8-shared** (`:234` reste `title.includes(kw)`) ni qa_derived/faq_standalone/blog_from_title → fix incomplet. |
| Condense « IA » regenerate | regenerate-helpers.ts:149 | Débloque les gates metaTitle 50-60 car. Récursif : article court régénéré reste court. |
| Gate H1 vérifie le title | blog-article / v7-phase8:234 | Corrige un faux-négatif (le H1 rendu = `parsed.title`, le sanitizer interdit `<h1>` dans body). Correct mais n'augmente pas la longueur. |

**Verdict d'audit** : ces 6 modifs traitent les **gates** (faux-négatifs keyword, plafonds budget/tokens) et **durcissent l'exigence de longueur**, mais **aucune ne s'attaque à la cause racine architecturale** (mono-appel JSON qui compresse le bodyHtml). Sans passer les blog generators à une décomposition type guide_pilier (outline → N sections), le durcissement `MIN_WORD_COUNT` **transforme « article court auto-publié » en « article court bloqué needs_review »** — ce qui correspond exactement au symptôme rapporté par Will cette session.

---

## 13. Causes racines (synthèse priorisée)

1. **[STRUCTUREL — racine] Mono-appel JSON comprime le bodyHtml.** Les blog + Phase 8 demandent 1200-2000 mots dans un seul JSON à 9-10 champs → ~400-600 mots. guide_pilier l'évite par décomposition outline+sections. Preuves : `blog-article.ts:187-195` vs `guide-pilier.ts:276-315`. **Le passage à 2 passes (question de Will) ne résout rien** : c'est l'architecture par appel, pas le nombre de passes.
2. **[MESURE — aggravant] Trois périmètres wordCount divergents.** Gate (corps seul) ≠ rendu (corps seul) ≠ inspector (corps+FAQ+blocks). Le gate `MIN_WORD_COUNT` exclut FAQ/directAnswer/expertQuote alors que ceux-ci constituent l'essentiel du contenu réel. Un article « substantiel au total » échoue un gate « corps seul ». `page.tsx:275`, `blog-article.ts:227`, `site-route-inspector-worker.ts:49-58`.
3. **[GATE — bug confirmé] v7-phase8 H1 gate utilise `includes(kw)` substring**, pas `keywordPresentInText` (`v7-phase8-shared.ts:234`) → boucle qualité épuisée sur titres abrégés « IA » avant d'atteindre l'enforcement longueur, pour les 12 types Phase 8. blog_from_title a un défaut similaire (`includes(kw.slice(0,30))`).
4. **[CONFIG — friction] Seuils dispersés dans 10+ fichiers**, non tunables console. Tout ajustement = edit multi-fichiers + redeploy.
5. **[PROVIDER — angle non exploré] Blog generators forcés sur OpenAI gpt-4o** (pas de `preferredProvider`). Les landing-ville sur Anthropic. Tester Claude (qui par défaut produit du long-form dense) sur blog-article est un levier non testé — mais `anthropic.ts` default maxTokens=4096 devrait alors être relevé.

---

Fichiers de référence clés : `src/server/content-gen/generators/{blog-article,blog-from-keywords,blog-from-title,comparison,barometer-insight,guide-pilier,qa-derived,faq-standalone}.ts`, `v7-phase8-{generators,shared}.ts`, `index.ts`, `shared/keyword-match.ts` · `src/server/queue/workers/content-gen-worker.ts` + `content-publish-worker.ts` · `quality/article-quality.ts` · `providers/{provider-router,config-reader,cost-tracker,anthropic}.ts` · `src/app/[locale]/blog/[slug]/page.tsx` · `src/server/actions/content-gen/{regenerate,regenerate-helpers}.ts`.