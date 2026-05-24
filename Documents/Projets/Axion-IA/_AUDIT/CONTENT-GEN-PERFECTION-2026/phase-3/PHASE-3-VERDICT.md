# PHASE 3 VERDICT — SEO/AEO/GEO/AI OVERVIEWS
## Date : 2026-05-21
## HEAD commit : 37ca0147
## Baseline : P1.5 ~770-820/1000 (vitest 1376/1383)

---

## Scores par agent

| Agent | Score | Max | % | Verdict |
|-------|-------|-----|---|---------|
| A3-01 JSON-LD Schema Coverage | 67 | 100 | 67 % | 🟡 |
| A3-02 Featured Snippets & Position 0 | 38 | 80 | 47 % | 🔴 |
| A3-03 AI Overviews / SGE | 74 | 100 | 74 % | 🟡 |
| A3-04 Knowledge Graph & Wikidata | 34 | 80 | 43 % | 🔴 |
| A3-05 AEO Answer Engine | 57 | 80 | 71 % | 🟡 |
| A3-06 Sitemap & IndexNow | 55 | 70 | 79 % | 🟡 |
| A3-07 Local SEO & Villes | 67 | 90 | 74 % | 🟡 |
| A3-08 E-E-A-T Signals | 54 | 80 | 68 % | 🟡 |
| A3-09 Core Web Vitals & Mobile | 57 | 70 | 81 % | 🟡 |
| A3-10 Anti-concurrence Homonyme | 28 | 50 | 56 % | 🟠 |
| **Sous-total agents** | **531** | **800** | **66 %** | |
| **Cross-cuttings orchestrateur** | **158** | **200** | **79 %** | |
| **TOTAL PHASE 3** | **689** | **1000** | **69 %** | **🔴** |

### Détail cross-cuttings /200
| Critère | Score | Max |
|---------|-------|-----|
| Cohérence inter-agents (0 contradiction) | 36 | 40 |
| Priorisation P0/P1/P2 rigoureuse | 34 | 40 |
| Décisions Will identifiées clairement (4 DW) | 36 | 40 |
| Quick wins identifiés < 2h (10 QW, +46 pts) | 32 | 40 |
| Roadmap 30/60/90 jours réaliste | 20 | 40 |

---

## Verdict global

### 🔴 NO-GO — 689/1000 — Sprint correctif P0+P1 obligatoire

**Seuil GO : ≥ 900 | Seuil CONDITIONNEL : ≥ 750 | Seuil NO-GO : < 750**

Score 689 < 750 → Sprint correctif immédiat requis avant Phase 4.

**MAIS** : le projet dispose d'une architecture technique solide. Plusieurs déficits sont récupérables rapidement :
- +46 pts avec les 10 quick wins (< 2h chacun) → 735 (seuil conditionnel atteint)
- +34 pts avec Wikidata Q-ID (action Will 2h) → 769
- **Score post-sprint estimé : ~760-800 si QW + Wikidata → CONDITIONNEL**

---

## Top 5 issues critiques (P0)

### P0-1 : Wikidata Q-ID absent — Knowledge Panel impossible
- **Impact** : A3-04 (0/20), A3-08 (−5), A3-10 (−9) = −34 pts
- **Symptôme** : `wikidataQid` paramétré dans le code mais jamais valorisé. Concurrent axionai.fr rank #1 brand peut capturer le Knowledge Panel Google.
- **Correction** : Will crée https://www.wikidata.org/wiki/[nouveau Q] avec description `legalName: "Axion-IA OÜ"`, `sitelinks: axion-ia.com`, puis dev passe le Q-ID dans `buildOrganizationJsonLd`.
- **Délai** : < 48h

### P0-2 : Sources externes absentes dans les articles générés — filtre LLM
- **Impact** : A3-03 (−8 pts), A3-08 (−5 pts) = −13 pts
- **Symptôme** : SYSTEM_PROMPT blog impose `100% centré Axion-IA`, bloquant structurellement les liens externes. Les AI Overviews Google, Perplexity et ChatGPT filtrent les contenus sans sources tierces vérifiables.
- **Correction** : Ajouter dans `blog-article.ts` et `blog-from-keywords.ts` : "Inclure ≥ 2 liens externes vers sources d'autorité FR (INSEE, DARES, BPI France, McKinsey, Stanford AI Index, etc.)".
- **Délai** : < 24h dev

### P0-3 : CF WAF status — bots IA potentiellement bloqués
- **Impact** : A3-03 (−7 pts si bloqués), toute l'infrastructure AI Overviews inopérante
- **Symptôme** : Audit 2026-05-15 signalait ClaudeBot/GPTBot bloqués par CF Managed Content. `robots.ts` est impeccable mais CF peut bloquer en upstream. Non vérifié depuis.
- **Correction** : Cloudflare Dashboard > Security > WAF > Managed Rules > désactiver "Block AI Bots" ou créer exceptions.
- **Délai** : < 24h (Will)

### P0-4 : Featured Snippets — aucune infrastructure tableau + TOC absente
- **Impact** : A3-02 (38/80 = 47%) — le score le plus bas de l'audit
- **Symptôme** : `comparison.ts` est un stub qui délègue à `landingVilleGenerator` sans prompt tableau. Aucun `<table><thead>` jamais généré. TOC absente sur guides/piliers > 1500 mots.
- **Correction** : Sprint dédié — prompt tableau pour comparatifs + composant TOC sur guides.
- **Délai** : Sprint 1 semaine

### P0-5 : SpeakableSpecification absente sur articles blog DB
- **Impact** : A3-01 (−5 pts), A3-03 (−3 pts) = −8 pts
- **Symptôme** : Patch QW-2 (ffdb49a6) corrigeait FAQPage/QAPage/NewsArticle mais `buildArticleJsonLd` (pages blog DB) n'émet toujours pas de `speakable`. Fix = 1 ligne.
- **Correction** : Ajouter `speakable` dans `buildArticleJsonLd` (src/lib/seo.ts).
- **Délai** : < 30 min dev

---

## Top 5 quick wins (< 2h)

| Rang | Action | Gain | Fichier |
|------|--------|------|---------|
| 1 | Vérifier CF WAF bots IA (30 min Will) | +7 pts potentiels | Cloudflare Dashboard |
| 2 | `speakable` dans `buildArticleJsonLd` (30 min) | +8 pts | `src/lib/seo.ts` |
| 3 | `legalName: "Axion-IA OÜ"` + `alternateName` (50 min) | +10 pts A3-04/A3-10 | `src/lib/brand.ts:16` |
| 4 | SYSTEM_PROMPT ≥ 2 liens externes/article (1h) | +10 pts A3-03/A3-08 | `src/server/content-gen/blog-article.ts` |
| 5 | `AuthorByline` sur routes articles (1h) | +5 pts E-E-A-T | `src/app/[locale]/blog/[slug]/page.tsx` |

---

## Décisions Will requises
Voir **CROSS-CUTTING.md** section "Décisions Will — Blocantes"

| ID | Décision | Deadline |
|----|---------|---------|
| DW-3-01 | Wikidata Q-ID Axion-IA | URGENT < 48h |
| DW-3-02 | Adresse FR (WeWork/domiciliation/rien) | < 7 jours |
| DW-3-03 | GSC service account JSON | < 7 jours |
| DW-3-04 | CF WAF — vérifier bots IA | URGENT < 24h |

---

## Analyse par agent

### A3-01 JSON-LD — 67/100 🟡
**Points forts** : `aiGenerated:true` propagé (QW-1 ✅), BreadcrumbList quasi-universel, DefinedTerm glossaire complet, LocalBusiness graphe 8 schémas sur pages villes.
**Gaps** : Wikidata absent de `Organization.sameAs`, `abstract`/`isBasedOn`/`mentions` non câblés dans `buildArticleBase`, `AggregateRating` factory existante mais 0 instanciation prod, `FAQPage Question` sans `@id` stable (sauf ville-service-jsonld).
**Fichier** : `agents/A3-01-jsonld-schema.md`

### A3-02 Featured Snippets — 38/80 🔴
**Points forts** : `directAnswer` 50-80 mots dans tous les générateurs, `AnswerCard.tsx` avec `data-aeo="tldr"`, `FaqAccordion` Radix + FAQPage JSON-LD, meta description auto-générée conforme.
**Gaps** : TOC absente sur guides/piliers, `comparison.ts` stub sans prompt tableau, FAQ guides non affichée, introduction non contrainte en longueur, H2/H3 non systématiquement formulés en questions.
**Fichier** : `agents/A3-02-featured-snippets.md`

### A3-03 AI Overviews — 74/100 🟡
**Points forts** : `robots.ts` 15 bots IA allowés, `ai.txt` (route handler edge) standard IAB complet, `llms.txt` structuré avec catalogue image-bank, `/.well-known/ai-policy.json`, `AnswerCard` + `SpeakableSpec` sur FAQ/QA/News.
**Gaps** : CF WAF non confirmé (P0), sources externes bloquées par SYSTEM_PROMPT (P0), `citations` → `isBasedOn` JSON-LD non câblé, `speakable` absent de `buildArticleJsonLd`.
**Fichier** : `agents/A3-03-ai-overviews.md`

### A3-04 Knowledge Graph — 34/80 🔴
**Points forts** : `buildLocalBusinessJsonLd` complète, `foundingDate`/`areaServed`/`contactPoint`/`knowsLanguage` présents, `WebSite` + `SearchAction` implémentés.
**Gaps** : Wikidata absent (0/20 = P0), `legalName` sans "OÜ", `alternateName` absent, `hasOfferCatalog` absent, `addressLocality` placeholder non résolu, `PRESS_MEDIA_COVERAGE = []`.
**Fichier** : `agents/A3-04-knowledge-graph.md`

### A3-05 AEO — 57/80 🟡
**Points forts** : FAQ 30Q globale conforme, FAQPage + SpeakableSpec sur /faq, Q/R auto pipeline BullMQ opérationnel, sub-sitemap FAQ dédié, 65 seeds AEO voix naturelle (g4-aeo.ts).
**Gaps** : Q/R auto en `tier_2_noindex_follow` (non indexables), verticales `un_a_un` + `sites_web_augmentes` absentes de g4-aeo.ts, hreflang EN absent (locale désactivée), `isBasedOn`/`about` absents du QAPage JSON-LD.
**Fichier** : `agents/A3-05-aeo.md`

### A3-06 Sitemap & IndexNow — 55/70 🟡
**Points forts** : `sitemap-index` avec 20+ sub-sitemaps, lastmod différencié, 4 sitemaps images Google Image 1.1 complets, clé IndexNow valide, pipeline BullMQ événementiel + postbuild batch, hreflang FR/EN dans les sitemaps (EN désactivé = partiel).
**Gaps** : GSC non configurée (-5 pts), délai IndexNow non mesuré empiriquement, retry BullMQ absent, sitemaps images villes potentiellement vides si images non importées.
**Fichier** : `agents/A3-06-sitemap-indexnow.md`

### A3-07 Local SEO — 67/90 🟡
**Points forts** : Architecture URL villes cohérente, JSON-LD LocalBusiness graphe 8 schémas sur 4 verticales × 39 villes, données economic-data 16 dimensions V3 pour les 39 villes, maillage interne Haversine 6 villes proches, sitemap auto-scalable.
**Gaps** : `streetAddress` + `telephone` absents (GBP Local Pack 3-pack inaccessible), 5e verticale `sites-web-augmentes` sans pages villes (78 pages manquantes), GBP non créée, `getNearbyVillesExtended()` livrée mais non utilisée.
**Fichier** : `agents/A3-07-local-seo.md`

### A3-08 E-E-A-T — 54/80 🟡
**Points forts** : `AiContentDisclaimer` déployé 6 routes (AI Act art. 50), `aiGenerated:true` + `additionalType: AIGeneratedContent`, `GenerationProvenance` SHA-256, HSTS preload 2 ans, pages légales complètes (mentions-légales, CGV, RGPD, /transparence, /corrections).
**Gaps** : `AuthorByline` composant créé mais aucune page l'importe, backlinks FR autorité = 0, `external links` absents des templates de génération, `citations` Perplexity non injectées JSON-LD final.
**Fichier** : `agents/A3-08-eeat.md`

### A3-09 Core Web Vitals — 57/70 🟡
**Points forts** : `lighthouserc.json` gates ERROR stricts (LCP ≤ 1800ms, CLS ≤ 0.1, TBT ≤ 200ms), ajouts P1.5 architecturalement neutres (`AiContentDisclaimer` Server Component pur), SSG sur toutes les routes villes, `optimizePackageImports` 15 packages, fonts optimisées.
**Gaps** : INP non gaté en CI (`"off"`), FAQ 30Q sans virtualisation (DOM ~1500-2000 nœuds → INP mobile), CLS `/fr/audit` > 0.05 (exception documentée), `width`/`height` optionnels dans `ImageBankPicture` (risque CLS).
**Fichier** : `agents/A3-09-web-vitals.md`

### A3-10 Anti-concurrence — 28/50 🟠
**Points forts** : `WebSite` + `SearchAction` déployé en layout racine, arsenal rich results complet disponible (FAQPage, HowTo, Product, AggregateRating, etc.), seeds keywords H/I pour brand queries.
**Gaps** : `legalName` sans "OÜ" (6 occurrences), `alternateName` absent, Wikidata Q-ID non créé (risque Knowledge Panel capturé par axionai.fr), `search_term_string` incorrect dans `urlTemplate`, `AggregateRating` factory existante mais 0 instanciation.
**Fichier** : `agents/A3-10-anti-concurrence.md`

---

## Score pré/post-sprint estimé

| Scénario | Score estimé | Verdict |
|----------|-------------|---------|
| HEAD actuel | **689/1000** | 🔴 NO-GO |
| + Quick wins 10 QW (< 20h dev) | ~735/1000 | 🟡 CONDITIONNEL |
| + Wikidata Q-ID (Will, 2h) | ~769/1000 | 🟡 CONDITIONNEL |
| + Sprint Featured Snippets (1 semaine) | ~800/1000 | 🟡 CONDITIONNEL |
| + Sources externes + E-E-A-T backlinks (1 mois) | ~850/1000 | 🟡 CONDITIONNEL |
| + Knowledge Panel + GBP + presse (3 mois) | ~920/1000 | 🟢 GO |

---

*Audit généré par 10 agents parallèles — 2026-05-21 — AUDIT-ONLY, 0 commit, 0 modification code*
