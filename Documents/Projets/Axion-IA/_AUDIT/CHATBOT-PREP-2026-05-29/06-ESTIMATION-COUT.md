# 06 — Estimation de coût mensuel (Phase 5)

> Prix **vérifiés par recherche web le 2026-05-29** (sources citées). ⚠️ Les prix LLM bougent vite (addendum §0) — **à reconfirmer au jour de l'implémentation**.
> Facteur prod **3–5×** appliqué au coût prototype (addendum §2.4) : system prompt + historique + définitions d'outils + retries 429.

---

## 1. Prix unitaires (mai 2026, sourcés)

| Modèle / service | Entrée ($/M tok) | Sortie ($/M tok) | Notes | Source |
|---|---|---|---|---|
| **Gemini 2.5 Flash-Lite** | **0,10** | **0,40** | Le moins cher, idéal volume simple (classification, résumés) | pricepertoken / ai.google.dev |
| **Claude Haiku 4.5** | **1,00** | **5,00** | Cache lu **0,10**/M (−90 %), batch −50 % | platform.claude.com / OpenRouter |
| **Claude Sonnet 4.6** | 3,00 | 15,00 | Génération haut de gamme (cas complexes) | platform.claude.com |
| **DeepSeek V3.2** | 0,28 | 0,42 | Cache hit 0,028/M ; alternative cheap | api-docs.deepseek.com / VentureBeat |
| **Voyage voyage-3-lite** (embeddings, 1024) | **0,02** /M tok | — | **200 M tokens gratuits**/compte | docs.voyageai.com |
| **Voyage rerank-2.5-lite** | facturé sur (query×docs + docs) tokens | — | **200 M tokens gratuits**/compte | docs.voyageai.com |
| OpenAI text-embedding-3-large (fallback) | ~0,13 /M tok | — | 1536-dim (non retenu, ADR-CB-04) | (audit dépôt) |
| Cohere embed-v4 (alt.) | 0,12 /M tok | — | alternative | index.dev |

**Infra (déjà payée / gratuite) :** Hetzner CPX32 ~6,49 €/mois (existant), Postgres+Redis (containers), Cloudflare Free (CDN/Turnstile/WAF), Sentry free, Plausible self-hosted, BullMQ (Redis existant). → **coût marginal infra ≈ 0** pour le chatbot tant qu'on reste mono-instance.

---

## 2. Hypothèses de volume & coût par réponse

**Coût d'une réponse RAG type** (génération, hors cache hit) :
- Entrée : system prompt (~1,5 K) + 5 chunks (~2,5 K) + historique/résumé (~1 K) + définitions outils (~1 K) ≈ **6 K tokens entrée**.
- Sortie : ~400 tokens.
- Classification d'intention amont : ~0,5 K entrée / 50 sortie (modèle léger).
- Embedding de la question (cache + retrieval) : ~50 tokens Voyage (gratuit sous 200 M).

### Scénario cheap-first (Gemini Flash-Lite génération)
- Génération : 6 K×0,10/M + 0,4 K×0,40/M ≈ 0,0006 + 0,00016 ≈ **0,00076 $**
- Classification : négligeable (~0,00006 $)
- **≈ 0,0008 $/réponse** prototype → **×4 prod ≈ 0,0034 $/réponse**

### Scénario qualité (Claude Haiku 4.5 génération + prompt caching)
- Génération (cache lu sur system, ~1,5 K en cache à 0,10/M ; ~4,5 K frais à 1,00/M ; 0,4 K sortie à 5,00/M) ≈ 0,00015 + 0,0045 + 0,002 ≈ **0,0067 $**
- **≈ 0,007 $/réponse** prototype → **×4 prod ≈ 0,028 $/réponse**

### Effet du cache sémantique
À **40 % de hit** (questions fréquentes : prestations/tarifs/FAQ), 40 % des réponses coûtent **0 $ LLM**. Coût effectif moyen pondéré ≈ 0,6 × coût/réponse.

---

## 3. Coût mensuel projeté

### 3.1 Démarrage / faibles volumes (~3 000 réponses/mois)
| Poste | Cheap-first (Gemini) | Qualité (Haiku) |
|---|---|---|
| LLM (×4 prod, 40 % cache) | 3000×0,0034×0,6 ≈ **6 $** | 3000×0,028×0,6 ≈ **50 $** |
| Embeddings/rerank Voyage | **0 $** (sous 200 M gratuits) | 0 $ |
| Infra | ~0 (existant) | ~0 |
| **Total/mois** | **≈ 6–10 $** | **≈ 50 $** |

### 3.2 Production soutenue (~30 000 réponses/mois)
| Poste | Cheap-first | Qualité (Haiku) | Mix recommandé* |
|---|---|---|---|
| LLM (×4, 40 % cache) | ≈ **60 $** | ≈ **500 $** | ≈ **140–200 $** (sans Gemini) |
| Embeddings/rerank Voyage | ~0–5 $ (proche du free tier) | ~0–5 $ | ~0–5 $ |
| Infra | ~0 | ~0 | 0 → +scale vertical éventuel |
| **Total/mois** | **≈ 60–70 $** | **≈ 500 $** | **≈ 140–205 $** (retenu, sans Gemini) |

\* **Mix retenu (décision Will 2026-05-29 — SANS Gemini)** : cache sémantique d'abord → **Haiku 4.5** pour le volume (classification + génération courante) → **Sonnet** réservé aux cas complexes (~10–15 % des réponses). Cap budgétaire mensuel par tenant via `cost-tracker` existant. Coût ~**140–205 $/mois** à 30 K réponses (≈ +20 $/mois vs scénario avec Gemini, soit ~1 sous-traitant Google en moins — voir §2). Gemini ajoutable plus tard via le router si le volume le justifie.

### 3.3 Pic « 200 simultanés »
Le coût ne dépend pas du *pic* mais du *volume total*. Le pic impacte le **palier de rate-limit** du fournisseur (addendum §2.5) : il faut un **tier payant** avec des limites de débit correctes (les free tiers lâchent). Coût du palier ≈ inclus dans le coût/token ci-dessus tant qu'on reste chez un fournisseur payant. Mitigation pic = token-bucket + cache + backpressure (pas de surcoût direct).

---

## 4. Garde-fous de coût (réutilise l'existant)
- **Cap mensuel par tenant** : seed `ProviderConfig.monthlyCapUsd` + cap dédié chatbot (ex. 150 $/mois MVP). `assertCostCapAvailable` bloque + cascade (Telegram + mode dégradé) à 100 %, alerte à 80 % (doc 02 §3.3).
- **Budget tokens/réponse** : `maxTokens` plafonné (évite les réponses qui s'emballent).
- **Mode économie** au plafond : cache sémantique prioritaire + bascule modèle le moins cher + file d'attente.
- **Retries 429** comptabilisés (chaque retry double le coût de la requête — addendum §2.4).

---

## 5. Synthèse coût

| | Démarrage | Prod 30 K/mois (mix) |
|---|---|---|
| **Coût mensuel réaliste** | **≈ 6–50 $** | **≈ 140–205 $** (retenu, sans Gemini) |
| Dont infra | ~0 (existant) | ~0 (+scale vertical éventuel) |
| Dont embeddings/rerank | 0 (free tier Voyage) | ~0–5 $ |

**Conclusion :** « quasi-gratuit au démarrage, quelques dizaines à ~150 $/mois en production » (addendum §2.1) est **atteignable** grâce à : pgvector/FTS gratuits (existant), Voyage free tier 200 M, cache sémantique, cheap-first, prompt caching, cost-cap. Le poste dominant reste le LLM de génération → arbitrage qualité/coût à trancher (Q-LLM, doc 07).

---

## Sources (mai 2026)
- Gemini 2.5 Flash-Lite : [pricepertoken](https://pricepertoken.com/pricing-page/model/google-gemini-2.5-flash-lite), [ai.google.dev](https://ai.google.dev/gemini-api/docs/pricing)
- Claude Haiku 4.5 / Sonnet 4.6 : [platform.claude.com](https://platform.claude.com/docs/en/about-claude/pricing), [OpenRouter](https://openrouter.ai/anthropic/claude-haiku-4.5)
- DeepSeek V3.2 : [api-docs.deepseek.com](https://api-docs.deepseek.com/quick_start/pricing), [VentureBeat](https://venturebeat.com/ai/deepseeks-new-v3-2-exp-model-cuts-api-pricing-in-half-to-less-than-3-cents)
- Voyage embeddings/rerank : [docs.voyageai.com](https://docs.voyageai.com/docs/pricing)
- Cohere embed-v4 : [index.dev](https://www.index.dev/skill-vs-skill/ai-openai-embed-vs-cohere-vs-voyage)

*Fin de l'estimation de coût.*
