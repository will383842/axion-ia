# CROSS-CUTTING — Phase 3 SEO/AEO/GEO/AI Overviews
## Date : 2026-05-21
## HEAD : 37ca0147

---

## Patterns transverses détectés

### Pattern 1 : Wikidata Q-ID absent — bloquant multi-agents
- **Impact sur** : A3-04 (P0 −20 pts), A3-08 (−5 pts), A3-10 (P0 −9 pts)
- **Priorité** : P0
- **Symptôme** : `wikidataQid` paramétré dans `image-jsonld-graph.service.ts` et `buildLocalBusinessJsonLd` mais jamais valorisé. `Organization.sameAs` ne contient que LinkedIn + Facebook.
- **Fix** : Action humaine unique (Will) — créer l'entrée Wikidata en 2h max, puis passer `wikidataQid` dans tous les call-sites Organization. Impact estimé : +29 pts sur 3 agents.

### Pattern 2 : Sources externes absentes — filtre LLM bloquant
- **Impact sur** : A3-03 (P0 −8 pts), A3-08 (P1 −5 pts), A3-05 (P2 −2 pts)
- **Priorité** : P0
- **Symptôme** : SYSTEM_PROMPT des générateurs blog (`blog-article.ts`, `blog-from-keywords.ts`) impose une règle `100% centré Axion-IA` qui exclut structurellement tout lien externe. Les AI Overviews (Google SGE, Perplexity) filtrent les contenus sans sources tierces.
- **Fix** : Modifier les SYSTEM_PROMPTs pour imposer ≥ 2 liens externes autorité FR par article (INSEE, DARES, BPI France, McKinsey, Stanford AI Index). Durée : 1-2h.

### Pattern 3 : CF WAF status incertain — risque systémique AI Overviews
- **Impact sur** : A3-03 (P0 condition −7 pts potentiels), A3-10 (−2 pts)
- **Priorité** : P0
- **Symptôme** : Audit 2026-05-15 signalait ClaudeBot/GPTBot bloqués. `robots.ts` est impeccable (15 bots IA allowés), mais CF Managed Content Override peut bloquer les bots en amont de Next.js. Checklist 2026-05-15 non cochée.
- **Fix** : Vérifier Cloudflare Dashboard > Security > WAF > Managed Rules > CF Bot Management (30 min).

### Pattern 4 : Champs 2026 AEO manquants (abstract, isBasedOn, mentions)
- **Impact sur** : A3-01 (P1 −8 pts), A3-03 (P1 −4 pts), A3-05 (P2 −3 pts)
- **Priorité** : P1
- **Symptôme** : L'interface `BlogPosting` dans `seo.ts` supporte `abstract`, `isBasedOn`, `mentions` (lignes 565, 578, 588) mais `buildArticleBase` dans `seo-content-gen-factories.ts` ne les inclut pas. Les `lastCitations` collectées par le pipeline ne sont jamais injectées dans le JSON-LD.
- **Fix** : Modifier `buildArticleBase` pour passer `abstract`, `isBasedOn` depuis les métadonnées de génération. Durée : 2-3h.

### Pattern 5 : SpeakableSpecification drift partiel
- **Impact sur** : A3-01 (P1 −5 pts), A3-03 (P1 −3 pts)
- **Priorité** : P1
- **Symptôme** : Patch QW-2 (commit ffdb49a6) a corrigé FAQPage/QAPage/NewsArticle, mais `buildArticleJsonLd` (pages blog DB dans `seo.ts`) n'émet toujours pas de `speakable`. Fix = 1 ligne.
- **Fix** : Ajouter `speakable: buildSpeakableSpec(['.article-intro', '.key-takeaway', 'h1'])` dans `buildArticleJsonLd`. Durée : 30 min.

### Pattern 6 : Composants créés mais non utilisés
- **Impact sur** : A3-08 (P1 −5 pts `AuthorByline`), A3-07 (P2 `getNearbyVillesExtended`), A3-10 (P2 `AggregateRating`)
- **Priorité** : P1
- **Symptôme** : Plusieurs composants et factories livrés mais jamais branchés :
  - `AuthorByline.tsx` — créé mais aucune page article ne l'importe
  - `buildAggregateRatingJsonLd()` — factory existante, 0 instanciation prod
  - `getNearbyVillesExtended()` — livrée, non utilisée dans le template ville
- **Fix** : 3 intégrations indépendantes, < 1h chacune.

### Pattern 7 : Locale EN désactivée — hreflang dégradé
- **Impact sur** : A3-05 (P2 −4 pts hreflang), A3-06 (P1 −2 pts sitemaps), A3-09 (−0 pts perf OK)
- **Priorité** : P2
- **Symptôme** : Locale EN désactivée depuis 2026-05-16. Les sitemaps émettent hreflang FR-only. Bing Copilot/Perplexity EN ne voient aucun signal FAQ anglophone.
- **Fix** : Décision Will (DW-3-02 étendu) — réactiver EN ou accepter le déficit bilingue.

### Pattern 8 : GSC non configurée — soumission manuelle uniquement
- **Impact sur** : A3-06 (P1 −5 pts), A3-04 (P2)
- **Priorité** : P1
- **Symptôme** : `GSC_OAUTH_*` absents prod, `GOOGLE_INDEXING_API_ENABLED=false`. Les 4 nouveaux sitemaps images (services T1/T2/T3-T4) non soumis à Google Search Console depuis leur création.
- **Fix** : Action humaine Will (15 min) — soumettre manuellement dans GSC + créer service account JSON.

---

## Quick wins (< 2h) — Top 10

| Rang | Action | Gain estimé | Fichier | Durée |
|------|--------|-------------|---------|-------|
| 1 | Vérifier/désactiver CF WAF Managed Content | +7 pts A3-03 | Cloudflare Dashboard | 30 min |
| 2 | Ajouter `speakable` dans `buildArticleJsonLd` | +8 pts A3-01/A3-03 | `src/lib/seo.ts` | 30 min |
| 3 | Intégrer `AuthorByline` sur 4 routes articles | +5 pts A3-08 | blog/[slug], cas-concret/[slug] | 1h |
| 4 | Modifier SYSTEM_PROMPT : ≥ 2 liens externes/article | +10 pts A3-03/A3-08 | `src/server/content-gen/blog-article.ts` | 1h |
| 5 | Corriger `search_term_string` dans SiteLinksSearchBox | +1 pt A3-10 | `src/lib/seo.ts` WebSite schema | 30 min |
| 6 | Ajouter `legalName: "Axion-IA OÜ"` dans brand.ts | +6 pts A3-04/A3-10 | `src/lib/brand.ts:16` | 20 min |
| 7 | Ajouter `alternateName: ["Axion IA", "AxionIA"]` | +4 pts A3-04/A3-10 | `src/lib/seo.ts` Organization | 30 min |
| 8 | Soumettre 4 sitemaps images nouveaux en GSC | +3 pts A3-06 | Google Search Console (Will) | 15 min |
| 9 | Ajouter retry `attempts: 3` sur worker IndexNow BullMQ | +1 pt A3-06 | `src/server/queue/workers/indexnow-worker.ts` | 30 min |
| 10 | Ajouter `export const revalidate = 3600` sur /fr/faq | +1 pt A3-09 | `src/app/[locale]/faq/page.tsx` | 10 min |

**Gain total quick wins estimé : +46 pts si tous réalisés (hors Wikidata)**

---

## Décisions Will — Blocantes

| ID | Décision | Deadline | Impact |
|----|---------|---------|--------|
| DW-3-01 | Créer Wikidata Q-ID Axion-IA (avec legalName OÜ, sameAs axion-ia.com) | URGENT < 48h | A3-04 +20 pts, A3-08 +5, A3-10 +9 = +34 pts |
| DW-3-02 | Adresse FR : WeWork Paris / domiciliation / zone service / Estonie | < 7 jours | A3-07 +12 pts — débloque GBP complet |
| DW-3-03 | GSC service account JSON setup + activer GOOGLE_INDEXING_API_ENABLED | < 7 jours | A3-06 +5 pts — soumission auto sitemaps |
| DW-3-04 | CF WAF — vérifier ClaudeBot/GPTBot/PerplexityBot = Allow | URGENT < 24h | A3-03 +7 pts si bloqués actuellement |

---

## Roadmap correctifs

### 0-24h (P0 critiques)
- [ ] **DW-3-04** : CF WAF — vérifier Cloudflare Dashboard > Security > WAF > CF Bot Management (30 min Will)
- [ ] QW-1 : `speakable` dans `buildArticleJsonLd` (30 min dev)
- [ ] QW-3 : `legalName: "Axion-IA OÜ"` dans `src/lib/brand.ts` (20 min dev)
- [ ] QW-4 : `alternateName` dans Organization schema (30 min dev)
- [ ] QW-2 : Corriger `search_term_string` SiteLinksSearchBox (30 min dev)

### 0-7 jours (P1 importants)
- [ ] **DW-3-01** : Wikidata Q-ID Axion-IA (2h Will) — impact le plus élevé
- [ ] **DW-3-02** : Décision adresse FR (WeWork/domiciliation/rien)
- [ ] **DW-3-03** : GSC service account JSON + soumettre sitemaps images (15 min Will)
- [ ] QW-4 : SYSTEM_PROMPT blog — ajouter règle ≥ 2 liens externes/article (1h dev)
- [ ] QW-5 : Intégrer `AuthorByline` sur routes articles (1h dev)
- [ ] Câbler `citations` → `isBasedOn` JSON-LD dans `blog/[slug]/page.tsx` (2h dev)
- [ ] Câbler `abstract` dans `buildArticleBase` (1h dev)
- [ ] Ajouter retry BullMQ IndexNow `attempts: 3` (30 min dev)
- [ ] Promouvoir Q/R auto tier_2 → tier_1 sur réponses > 150 mots (2h dev)

### 8-30 jours (P2 amélioration)
- [ ] Adresse FR → `streetAddress` + `telephone` dans LocalBusiness (selon DW-3-02)
- [ ] GSC service account + soumission programmatique sitemaps
- [ ] `AggregateRating` instancié sur pages service/landing (factory existe)
- [ ] `subjectOf` + `contentLocation` + `audience` sur pages cas-concret
- [ ] Intégrer `getNearbyVillesExtended()` dans template ville (3 buckets géo)
- [ ] Activer TOC sur guides/piliers (ancres déjà disponibles)
- [ ] Activer `FaqBlock` sur pages guides
- [ ] Seeds AEO pour verticales `un_a_un` + `sites_web_augmentes` (manquantes dans g4-aeo.ts)
- [ ] Seeds longtail AEO géo-localisés ville × verticale × question

### 31-90 jours (P3 roadmap)
- [ ] Knowledge Panel obtenu (Wikidata + GBP + presse) — monitoring hebdo
- [ ] 120 villes couvertes (extension progressive)
- [ ] Featured Snippets obtenus — monitoring SERPWatcher
- [ ] AI Overviews citations confirmées — monitoring Perplexity/ChatGPT
- [ ] 1 interview ou guest post dans JDN / Silicon.fr / LeMagIT (backlink autorité)
- [ ] Reactivation locale EN (décision DW-3-02 étendu)
- [ ] Tableau comparatif généré dans `comparison.ts` (prompt tableau structuré)
- [ ] HowTo sur guides : intégrer `totalTime` + `estimatedCost` depuis economic-data

---

## Cohérence inter-agents — Notes

| Signal | Agents concordants |
|--------|-------------------|
| Wikidata P0 | A3-04, A3-08, A3-10 — consensus fort |
| CF WAF P0 | A3-03, A3-10 — à vérifier manuellement |
| Sources externes manquantes | A3-03, A3-08 — cause racine = SYSTEM_PROMPT |
| SpeakableSpec drift partiel | A3-01, A3-03 — patch incomplet QW-2 |
| GSC non configurée | A3-06, A3-04 — actions Will distinctes |
| legalName OÜ manquant | A3-04, A3-10 — même fichier `brand.ts` |
| AuthorByline non branché | A3-08 seul — composant existant |
| TOC manquant guides | A3-02 seul — impact snippet liste fort |

Aucune contradiction inter-agents détectée.
