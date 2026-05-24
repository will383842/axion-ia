# A02-ADDENDUM — 7 flows distincts par type de contenu

> **Mode** : AUDIT-ONLY strict (zéro commit, zéro modification)
> **Date** : 2026-05-21
> **HEAD audité** : `37ca0147` (origin/main)
> **Baseline P1.5** : score ~770-820/1000, Vitest 1376/1383
> **Périmètre parent** : addendum P1 — complète A02 du PHASE-1-VERDICT.md

---

## Score final : **15/35 (43 %)** — 🟠 SPRINT CORRECTIF

| Catégorie | Score | Notes |
|---|---|---|
| 7 flows distincts existence + spec | 9/15 | 2/7 fully distinct, 3 stubs, 2 delegations |
| Métriques cross-flow (latence + cost + success rate per-flow) | 2/8 | Cost partial (per-job seulement), latence/success absent |
| Réutilisabilité workers | 2/4 | Worker générique paramétré OK, mais 5 flows sous-spécialisés |
| Tests + doc | 1/4 | 3/7 snapshot tests, aucun `_AUDIT/CONTENT-GEN-FLOWS.md` |
| Failure modes per-flow | 1/4 | Soft-fail BullMQ présent, **pas de DLQ explicite ni Telegram alerts dead-letter** |

---

## 1. Tableau récap 7 flows

| # | Flow | Fichier generator | État | Cost obs. | Latence obs. | Tests | Status |
|---|---|---|---|---|---|---|---|
| 1 | `article_titre_manuel` | `blog-from-title.ts` | Delegation `landing-ville` — pas de title-anchor validator | inconnu | inconnu | ❌ | ⚠️ STUB |
| 2 | `article_keywords` | `blog-from-keywords.ts` | Pipeline complet : KB retrieve + quality loop ×3 + cap $0.15 | ~$0.05-0.10 | inconnu | ✅ | ✅ |
| 3 | `longue_traine_intention` | `blog-article.ts` | Stub delegation, **aucun filtre intent-specific KB** | inconnu | inconnu | ✅ partiel | ⚠️ STUB |
| 4 | `comparatif` | `comparison.ts` | **Stub pur, ZÉRO génération tableau, aucun ClaimReview JSON-LD** | inconnu | inconnu | ❌ | 🔴 P0 |
| 5 | `pilier` | `guide-pilier.ts` | 2-step : outline + 8-15 sections seq. ~$0.04-0.12/guide. **Pas d'étape outline review humain.** | $0.04-0.12 | ~3-5 min seq | ❌ | ⚠️ INCOMPLET |
| 6 | `qr_auto_genere` | `qa-derived.ts` | **Stub, ZÉRO check anti-cannibalisation cosine vs parent < 0.7** | inconnu | inconnu | ❌ | 🔴 P0 |
| 7 | `article_rss` | `blog-from-rss.ts` | Delegation OK + NewsArticle JSON-LD + auto-publish ≥60. **Délai 48h post-pub source NON enforced.** | ~$0.03-0.05 | inconnu | ✅ | ⚠️ |

---

## 2. Top 10 P0 (bloquants)

| # | Fichier:ligne | P0 | Action |
|---|---|---|---|
| 1 | `src/server/content-gen/generators/qa-derived.ts` | `qa_derived` stub : delegation vers `landing-ville` sans aucune logique Q/R, ni cosine cannibalisation check | Implémenter le flow réel : crawl corpus interne → extract questions → générer réponse 600-800 mots + cosine < 0.7 vs article parent (utiliser embedding-similarity.ts existant) |
| 2 | `src/server/content-gen/generators/comparison.ts` | `comparison` stub : commentaire référence `prompts/comparatif.md megapack` introuvable, aucun tableau structuré généré | Implémenter outline imposé (cols: option/pricing/features/pros/cons/verdict) + JSON-LD `ClaimReview` + fact-check pricing/features externes |
| 3 | Cross-cutting tous workers | **Aucune métrique per-flow agrégée** (latence p50/p95/p99, cost moyen, success rate, refusal reasons distribution) | Ajouter table SQL `ContentGenFlowMetrics` daily aggregation + dashboard admin |
| 4 | `src/server/content-gen/generators/guide-pilier.ts` | `pilier` skyscraper sans étape `pending_human_outline_review` (Will doit valider outline avant body 3000-6000 mots) | Ajouter status `pending_human_outline_review` + notif Telegram + bouton admin valider/éditer/regénérer outline |
| 5 | `src/server/content-gen/generators/blog-from-rss.ts` | Délai 48h post-publication source non enforced — risque signal Google anti-scrape | Ajouter check `Date.now() - sourceItem.pubDate > 48h` avant generate, sinon enqueue delay |
| 6 | Tous workers | **DLQ explicite + Telegram dead-letter alerts absents** — jobs morts invisibles monitoring | Ajouter `removeOnFail: { count: 5000 }` + cron worker DLQ → Telegram bot |
| 7 | `src/server/content-gen/generators/blog-from-title.ts` | Pas de validator « titre saisi Will reste intact post-LLM » — risque LLM rewrite du titre | Ajouter `validateTitleAnchoring(input.title, output.title) <= 10% drift` |
| 8 | `src/server/content-gen/generators/blog-article.ts` (longue_traine flow) | Pas de filtre `intent IN (informational, transactional) AND isLongTail=true AND volume < N AND difficulty < M` côté selectKeyword | Étendre `selectKeyword(options)` avec filtres intent/volume/difficulty + pattern AEO renforcé (abstract early + speakable + h2 question) |
| 9 | Tous générateurs | **0 documentation `_AUDIT/CONTENT-GEN-FLOWS.md`** — connaissance tribale | Créer doc canonique : 1 section par flow × {prompt template, étapes, cost, latence, success rate, tests} |
| 10 | `guide-pilier.ts` | Génération sections 8-15 séquentielle ~3-5 min — pas de parallélisation | Paralléliser sections via `Promise.all` (cap concurrence 3) → ~÷2-3 latence |

---

## 3. Top 15 P1 (optimisations)

1. `blog_from_keywords` : `BUDGET_CAP_USD = 0.15` hardcodé → migrer vers `ContentGenConfig.flow_budget_cap_keywords`
2. `blog_from_title` : ajouter helper NER FR (`fr_core_news_lg` ou regex simple) pour extraire keyword principal depuis titre
3. `blog_from_title` : si keyword extrait absent table `Keyword` → confirmer (Will) ou refuser ? Logique manquante.
4. `comparatif` : input source = saisie Will (« ChatGPT vs Claude ») OU détection auto depuis keyword — non implémenté
5. `comparatif` : image par option comparée — assignment depuis image-bank tagged `option_name` (extension de assign-hero-image.ts)
6. `comparatif` : anti-bias éditorial (conclusion objective, pas systématique « notre service meilleur »)
7. `pilier` : table of contents auto via composant React `<TableOfContents>` qui parse h2
8. `pilier` : si Will absent >24h post-outline → auto-approve avec watermark « auto-approved »
9. `pilier` : re-review humain post-body avant publish (optionnel ou obligatoire ?)
10. `qa_derived` : cadence — max Q/R généré par article parent (3 / 5 / illimité ?) à trancher
11. `qa_derived` : cross-link vers article source via JSON-LD `isBasedOn` + `<a rel="prev">`
12. `qa_derived` : matching keyword associé à la question — algorithme non spécifié
13. `article_rss` : Copyscape ou équivalent pour vérification originalité externe
14. `article_rss` : prompt instruit explicitement « notre prise sur X, pas paraphrase » (angle éditorial original)
15. Tous workers : **tagging job metadata** pour analyse Anthropic Console — permet drill-down cost par flow

---

## 4. Délégations downstream

### → P2 (Architecture data pipeline)
- **Table `ContentGenFlowMetrics`** : daily aggregation per-flow (latence p50/p95/p99, cost mean, success rate, refusal reasons)
- **Worker architecture** : confirmer pattern « 1 worker générique paramétré » vs « 1 worker par flow » — recommandation P1.5 = générique (déjà en place)
- **DLQ infrastructure** : worker dédié `content-dlq-worker.ts` consomme jobs failed × N retries → Telegram alert + audit log

### → P5 (Console Admin Ops)
- **Vue admin per-flow** : page `/content-gen/flows` avec tableau 7 flows × KPIs
- **Drill-down** : cliquer flow → liste 50 derniers articles + metrics + boutons retry/discard
- **Pilier outline review UI** : Will reçoit notif → ouvre admin → édite outline (markdown) → valide/regénère

### → P4 (Editorial Quality)
- Doctrines spécifiques par flow (pilier review humain, qa_derived anti-cannibalisation, RSS valeur ajoutée 48h)

---

## 5. Failure modes par flow

| Flow | DLQ | Retry | Alert | Fallback |
|---|---|---|---|---|
| `article_titre_manuel` | ❌ | BullMQ backoff exp ×3 | ❌ | aucun |
| `article_keywords` | ❌ | ×3 | ❌ | aucun |
| `longue_traine_intention` | ❌ | ×3 | ❌ | aucun |
| `comparatif` | ❌ | ×3 | ❌ | aucun |
| `pilier` | ❌ | ×3 | ❌ | aucun |
| `qr_auto_genere` | ❌ | ×3 | ❌ | aucun |
| `article_rss` | ❌ | ×3 | feed RSS down → log seulement | aucun |

**P0 cross-cutting** : aucune visibilité ops sur jobs morts. Action P5.

---

## 6. Cross-flow metrics gap

Aucun de ces 4 observables n'est implémenté actuellement :
- **Latence p50 / p95 / p99 par flow** — pas de tracker BullMQ → SQL
- **Cost moyen Claude par flow** — `CostLedger` track per-job mais pas tagué `contentType` → impossible agréger
- **Success rate par flow** — `nb publish / nb attempted` non calculé
- **Refusal reasons distribution per flow** — `plagiarism_check`, `intent_check`, `outline_dedup_check` logs présents mais non agrégés

**Impact** : Will ne peut pas répondre à « quel flow coûte le plus cher ? » ni « lequel a le pire refusal rate ? ». Cécité ops.

---

## 7. Doctrine + références

- `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` §28-29 — definition canonique 7 types
- Memory [[axionia_content_gen_p1_5_livre_2026-05-21]] — context P1.5 livré
- `src/server/content-gen/generators/index.ts` — registry generators

---

*Fin A02-Addendum. Verdict 15/35 — SPRINT CORRECTIF requis avant scale.*
