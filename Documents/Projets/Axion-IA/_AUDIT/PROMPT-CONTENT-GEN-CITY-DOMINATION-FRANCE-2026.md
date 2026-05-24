---
name: PROMPT-CONTENT-GEN-CITY-DOMINATION-FRANCE-2026
version: 2.0 (PERFECTION EDITION)
date: 2026-05-18
owner: Will (Axion-IA OÜ)
mode: AUTOPILOT — AUDIT-ONLY puis PRESCRIPTIF — STOP & ASK avant tout code
target_score: /3200 (16 agents × 100 + 16 cross-cutting × 100) + verdict /4 (🔴🟠🟡🟢)
estimated_duration: 28-38 h autopilote (16 sous-agents //) + 4-5 h synthèse
deliverables_count: 42 fichiers minimum dans _AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/
output_dir: _AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/
supersedes: v1.0 (12 agents) — cette v2.0 ajoute 4 agents (KB, concurrents, GBP/Local, Entity Graph) + 12 cross-cuttings
---

# 🏛️ PROMPT MASTER v2.0 — CONTENT-GEN × VILLES × DOMINATION FRANCE 2026

> **Objectif business absolu** : Axion-IA doit être **n°1 SEO/AEO/GEO dans CHAQUE ville de France** (≥5 000 hab, ~2 150 communes) pour les 4 verticales business — **interventions, 1-to-1, audits, implémentations**. Ce prompt audite intégralement la chaîne génération → publication `/blog` + pSEO villes + signaux off-page + EEAT + Knowledge Graph + concurrence + GBP, en croisant la stratégie **pSEO villes × types business × moteurs 2026** (Google AI Overviews, ChatGPT Search, Perplexity, Claude, Gemini, Bing Copilot, Mistral Le Chat, Yandex Neuro).
>
> **Doctrine de référence** : Helpful Content Update 2024-2026, Google AI Overviews & AI Mode 2026, Bing IndexNow + llms.txt v0.2, ai.txt Spawning Protocol, ChatGPT Search citations playbook, Perplexity sources requirements, Claude Search, AI Act EU 2026 (art. 50 transparence), DSA, RGPD, ePrivacy, WCAG 2.2 AA, Web Vitals 2026 (LCP ≤1800 / INP ≤80 / CLS ≤0,05 / TTFB ≤600 p75 CrUX).
>
> **Mode** : AUTOPILOT AUDIT-ONLY (lecture seule). Aucune écriture code/migration/commit. Écriture exclusivement sous `_AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/`.

---

## 0. RÔLE & POSTURE

Tu es **Architecte SEO/AEO/GEO Senior + Lead Engineer Content Platform + Local SEO Strategist + Entity SEO Expert**, mandaté par Will pour certifier qu'Axion-IA peut **dominer toutes les SERPs locales France 2026** (Google + IA génératives + Bing Copilot + Yandex + DuckDuckGo).

Tu raisonnes en **vérités vérifiables** : aucune affirmation sans `fichier:ligne` ou commande reproductible. Tu ne flattes pas, tu ne minimises pas, tu ne brodes pas. Chaque écart est **chiffré, daté, priorisé** (P0/P1/P2/P3 + effort homme-jour + ROI estimé).

**Ce qui distingue la perfection 2026 du "très bon"** :
- ✅ Citation dans Google AI Overviews ≥ 80 % des requêtes locales IA cibles.
- ✅ Citation ChatGPT Search top 3 + Perplexity/Claude/Gemini/Copilot top 5.
- ✅ Position Google #1-#3 pour Top 50 villes + top 10 pour les ~2 100 autres.
- ✅ Entity reconnue Knowledge Graph (Wikidata + sameAs).
- ✅ Topical authority maximale (clusters complets, pas de trous).
- ✅ EEAT visible (auteurs identifiés, sources citées, dates révision, editorial policy publique).
- ✅ Backlinks locaux de qualité (CCI, médias régionaux, partenaires).
- ✅ AI Act EU 2026 conforme dès août 2026.
- ✅ Web Vitals 100/100/100/100 sur tous templates clés.

---

## 1. CONTEXTE PROJET (figé — vérifier au début, signaler tout drift)

### 1.1 Stack technique
- Next.js 16 App Router (standalone) + React 19 + TypeScript strict.
- Prisma 5.22 + Postgres 16 + Redis 7 + BullMQ.
- Hetzner CPX42 (8c/16GB/320GB/fsn1) + Coolify + Caddy 2 + Cloudflare Free.
- Bilingue **FR canonique / EN miroir** (`/fr/*` + `/en/*` indexables, hreflang + x-default `/fr/`).
- Workers : `content-gen-worker`, `image-bank-*-worker`.
- IndexNow actif, robots.ts, 7+ sitemaps split, 5 feeds RSS dédiés.

### 1.2 Génération de contenus (à auditer end-to-end)
**Générateurs** `axionia/src/server/content-gen/generators/` :
- `blog-article.ts`, `blog-from-keywords.ts`, `blog-from-rss.ts`, `blog-from-title.ts`
- `comparison.ts`, `faq-standalone.ts`, `guide-pilier.ts`, `qa-derived.ts`
- `landing-ville.ts` + `landing-ville-templates.ts`

**Modules transverses** :
- `kb-feeder`, `kb-ingest`, `kb-health`, `kb-client.ts`, `kb-readonly`
- `slug-history`, `tombstone`, `similarity-monitor`, `dedup`, `fact-check`
- `quality`, `images`, `indexing`, `lifecycle`, `providers`, `scheduler`, `seo`
- `shared/editorial-mix-rules.ts` (13 tests verts)
- `shared/content-gen-alerts.ts`, `shared/generation-log.ts`

**Admin** `[adminPrefix]/content-gen/` (30+ sous-pages) :
- `orchestrator`, `coverage` (campagnes), `geo` (villes/batches/history), `jobs`
- `kb-readonly`, `keyword-tracking`, `landing-variants`, `onboarding`
- `publications`, `publications-status`, `quality`, `queue`, `review-queue`, `rss`
- `settings/*` (audience-mix, banned-phrases, batches, coverage-distribution, kb-ingest, kill-switch, llms-txt, policies, providers, qa-policies, quality-loop, search-intent-distribution)
- `similarity-monitor`, `templates`, `costs`, `author/manon`

### 1.3 Segmentation business EXISTANTE (3 secteurs)
- `interventions_formations`
- `audits`
- `implementations`

### 1.4 ⚠️ GAP STRATÉGIQUE — 4 VERTICALES CIBLES (Will 2026-05-18)
Will exige **4 verticales** par ville :
1. **Interventions** (mission ponctuelle ou formation)
2. **1-to-1** (coaching/conseil individuel — **ABSENT du code**)
3. **Audits** (diagnostic IA)
4. **Implémentations** (déploiement IA)

Le 4e (`1-to-1`) n'existe pas (routes, templates, sitemap, mega-menu, copy, JSON-LD, mesh). Chiffrer le delta + plan d'ajout sans casser l'existant. STOP & ASK sur naming définitif (`coaching`, `un-a-un`, `mentoring`, `1-to-1`, `accompagnement-individuel`, `executive-coaching`).

### 1.5 pSEO villes EXISTANT
- 13 régions + 2 157 villes SSG (~17 500 routes prerendered).
- 3 templates `par-ville/[ville]` (audit, interventions, implementation) = 12 942 pages SSG.
- Doctrine doorway-safe ≥40 % unique vs INSEE (cap ~95 % AxionIA-centric).
- 4 tailles entreprise (TPE/PME/ETI/grande-entreprise).

### 1.6 Blog public
- Routes : `/blog`, `/blog/[slug]`, `/blog/secteur/[s]`, `/blog/service/[s]`, `/blog/tag/[t]`, `/blog/taille/[t]`, `/blog/auteur/[a]`, `/blog/categorie/[c]`, `/blog/feed.xml`.
- Auteur principal : **Manon** (persona IA + supervision humaine).

### 1.7 Mémoire utile (lire AVANT d'auditer)
- `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (5 182 lignes, doctrine maître)
- `_AUDIT/CONTENT-GEN-PASS-B-VERDICT-2026-05-15.md` (175.5/200 🟢)
- `_AUDIT/CONTENT-GEN-AUDIT-OPERATIONNEL-FLOWS-2026-05-15.md` (50.7/60 🟢)
- `_AUDIT/CONTENT-GEN-AUDIT-INDEXATION-FR-2026-05-15.md`
- `_AUDIT/CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL-2026-05-15.md`
- `_AUDIT/CONTENT-GEN-AUDIT-{A1-DEPS,A2-REGRESSION,A5-RUNBOOKS,A7-MIGRATION,B5-DPA-RGPD,D5-D6-DR}-2026-05-15.md`
- `_AUDIT/INDEXATION-DISCOVERY-2026-05-18/` (87.2 % 🟢 GO limite)
- `_AUDIT/PSEO-VILLES-INDUSTRIALISATION-DECISION.md`
- `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md`
- `axionia/docs/` (charte éditoriale Manon, KB, ADRs)

---

## 2. PÉRIMÈTRE EXACT

### 2.1 IN-SCOPE (élargi v2.0)
1. **Chaîne génération end-to-end** : briefing → orchestrator → KB lookup → generator (11) → quality/fact-check/similarity → review-queue → publication → indexing → sitemap → feed RSS → IndexNow → AI engines pickup.
2. **Knowledge Base** : KB-feeder, KB-ingest, KB-health, sources, refresh cadence, qualité ingest, sources opt-out, droit d'auteur.
3. **Onglet `/blog` public** : rendu, JSON-LD, perf, A11y, SEO/AEO/GEO, cohérence visuelle, breadcrumb, pagination, filtres facettés (crawl traps !).
4. **Pages par-ville × 4 types** : couverture actuelle (3/4), gap `1-to-1`, doctrine doorway-safe, cap AxionIA-centric, qualité texte, JSON-LD complet, internal mesh.
5. **Sitemaps & discovery** : sitemap-index, sub-sitemaps, lastmod, IndexNow, GSC, Bing Webmaster, Yandex Webmaster, llms.txt, ai.txt, security.txt.
6. **Citations IA génératives** : robots.txt par crawler, JSON-LD complet, format cite-friendly, signaux EEAT.
7. **Admin content-gen workflows** : 30+ sous-pages, kill-switch, providers, audience-mix, quality-loop.
8. **Manon persona + AI Act 2026** : transparence, watermark, supervision.
9. **Mesh interne** : graph mesh ville↔ville↔région↔national, profondeur clic ≤3.
10. **Performance Web Vitals** : CrUX p75 par template, INP listes, LCP hero, bundle.
11. **i18n FR/EN parité** : hreflang, fallback, qualité EN.
12. **RGPD + AI Act + DSA** : conformité légale 2026.
13. **🆕 KB profondeur** : sources, ingestion, refresh, qualité, KB-health metrics.
14. **🆕 Audit concurrentiel SERP Top 50 villes** : qui est en place, gaps de positionnement.
15. **🆕 Google Business Profile + Local SEO physique** : GBP fiche, Maps, NAP cohérence, avis.
16. **🆕 Entity SEO + Knowledge Graph + Wikidata + Wikipedia** : Axion-IA reconnue comme entité.
17. **🆕 Crawl budget + log files analysis** : ce que crawle vraiment Googlebot/Bingbot/PerplexityBot.
18. **🆕 Backlinks profile + netlinking strategy** : profil actuel, stratégie locale.
19. **🆕 Topical authority + hub-spoke + pillar pages** : clusters complets.
20. **🆕 EEAT signals avancés** : editorial policy, corrections, "last reviewed", équipe.
21. **🆕 Video content + VideoObject** : AI Overviews favorise vidéo 2026.
22. **🆕 AggregateRating + Review schema** par ville/service.
23. **🆕 Featured snippets + PAA optimization**.
24. **🆕 Title rewrites Google + CTR SERP**.
25. **🆕 Intl expansion francophone** : Belgique, Suisse, Québec, Luxembourg.
26. **🆕 Link health 404/410/301 audit complet** + canonical.
27. **🆕 Faceted nav crawl traps** sur `/blog/` (7 dimensions).
28. **🆕 JS vs no-JS rendering** : Bingbot + AI bots faible rendu JS.
29. **🆕 Resource hints + HTTP/3 + Brotli + edge functions Cloudflare**.
30. **🆕 Anchor text distribution** (sur-optimisation HCU risk).
31. **🆕 Soft 404 detection** sur pages ville faible contenu.
32. **🆕 Content velocity + refresh signals**.
33. **🆕 Privacy Sandbox 2026 + cookieless analytics**.

### 2.2 OUT-OF-SCOPE
- Image-bank (audit séparé v1.5 prévu).
- Booking, Stripe, paiements, DocuSeal.
- CRM (`axion-crm-pro` sibling).
- Avocat-IA project.

---

## 3. RÈGLES DE TRAVAIL

### 3.1 AUDIT-ONLY strict
- Aucune modification code/prisma/config/env/sitemap/robots.
- Lecture seule (Grep/Glob/Read/Bash non destructifs).
- Écriture exclusive sous `_AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/`.

### 3.2 Vérité chiffrée
- Aucune affirmation sans `fichier.ts:ligne` + extrait code ou commande reproductible.
- Donnée inconnue → "**UNKNOWN — requires fact-check**" + commande/URL pour résoudre.
- Pas d'extrapolation.

### 3.3 STOP & ASK
- Chaque agent termine par bloc **STOP & ASK Will**.
- Aucune décision unilatérale sur : naming 4e verticale, autorisation crawler IA training (GPTBot/Google-Extended), périmètre GBP, budget industrialisation, périmètre netlinking, intl expansion francophone.

### 3.4 Sous-agents //
- Lance les 16 sous-agents A1→A16 **en parallèle** dans un seul tour multi-tool_use.
- Chaque rapport ≤ 800 lignes dans `A{n}-{slug}.md`, sinon découpe `PART-1/2/3`.
- `subagent_type: "Explore"` (read-only) pour A1-A16.

### 3.5 Style
- Pas d'emoji décoratif (sauf verdict 🔴🟠🟡🟢 et flags ⚠️✅🆕).
- Pas de "Excellent !", "Très bien !", "Génial !".
- Phrases courtes, dense, actionnable.

### 3.6 Anti-régression
- Aucune reco ne doit casser 945/945 vitest verts.
- Toute reco prescriptive cite **fichiers à toucher + tests à ajouter**.

---

## 4. LIVRABLES OBLIGATOIRES (42 fichiers minimum)

Tous sous `_AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/` :

```
# Méta & synthèse (10 fichiers)
00-MANIFEST.md                                       # Index livrables + status agents
01-EXEC-SUMMARY-WILL.md                              # ≤ 2 pages, décisions Will, top 10 P0
02-VERDICT-GLOBAL.md                                 # Score /3200 + verdict + roadmap
03-STOP-AND-ASK-WILL.md                              # Toutes décisions ouvertes
04-ARCHITECTURE-MAP.md                               # Schéma chaîne complète
05-GAP-TYPE-1-TO-1.md                                # Plan complet 4e verticale
06-CITY-DOMINATION-STRATEGY-2026.md                  # Roadmap #1 France
07-AI-ENGINES-CITATION-PLAYBOOK.md                   # ChatGPT/Claude/Perplexity/Gemini
08-MESH-INTERNAL-LINKING-AUDIT.md                    # Graph mesh + recos
09-MANON-AI-AUTHOR-COMPLIANCE.md                     # AI Act EU 2026

# 16 agents spécialisés (16 fichiers)
A1-CONTENT-GEN-CHAIN-E2E.md                          # Orchestrator → publication
A2-BLOG-PUBLIC-AUDIT.md                              # /blog public 360°
A3-CITY-PAGES-COVERAGE-4-TYPES.md                    # 3/4 + gap 1-to-1
A4-SEO-AEO-GEO-PERFECTION-2026.md                    # JSON-LD, hreflang, schemas
A5-SITEMAPS-DISCOVERY-INDEXNOW.md                    # Sitemaps + IndexNow
A6-AI-CRAWLERS-ACCESS.md                             # robots.txt + llms.txt + ai.txt
A7-QUALITY-DEDUP-DOORWAY-GUARD.md                    # Anti-doorway HCU
A8-EDITORIAL-MIX-VILLE-COVERAGE.md                   # editorial-mix × villes
A9-WEB-VITALS-CRUX-VILLES.md                         # Perf p75 par template
A10-ADMIN-CONTENT-GEN-WORKFLOWS.md                   # 30+ sous-pages admin
A11-I18N-PARITY-FR-EN.md                             # hreflang + EN
A12-RGPD-AI-ACT-LEGAL.md                             # AI Act + RGPD content-gen
A13-KNOWLEDGE-BASE-DEEP-AUDIT.md                     # 🆕 KB-feeder/ingest/health
A14-COMPETITIVE-SERP-TOP-50-VILLES.md                # 🆕 Audit concurrentiel
A15-GOOGLE-BUSINESS-PROFILE-LOCAL-SEO.md             # 🆕 GBP + Maps + NAP
A16-ENTITY-SEO-KNOWLEDGE-GRAPH-WIKIDATA.md           # 🆕 Entity + KG + Wikipedia

# Cross-cutting bonus (12 fichiers)
11-CRAWL-BUDGET-LOG-FILES-ANALYSIS.md                # 🆕 Crawl réel vs prévu
12-BACKLINKS-NETLINKING-STRATEGY.md                  # 🆕 Profil + stratégie locale
13-TOPICAL-AUTHORITY-HUB-SPOKE.md                    # 🆕 Clusters + pillar pages
14-EEAT-EDITORIAL-POLICY.md                          # 🆕 Editorial/corrections/team
15-VIDEO-CONTENT-STRATEGY.md                         # 🆕 VideoObject + chapters
16-REVIEWS-AGGREGATERATING-RICH-SNIPPETS.md          # 🆕 Reviews schema
17-FEATURED-SNIPPETS-PAA-OPTIMIZATION.md             # 🆕 Position 0 + PAA
18-TITLE-REWRITES-CTR-SERP-OPTIMIZATION.md           # 🆕 Title/meta CTR
19-INTL-EXPANSION-FRANCOPHONE.md                     # 🆕 BE/CH/QC/LU
20-LINK-HEALTH-404-410-301-CANONICAL.md              # 🆕 Liens cassés + canonical
21-FACETED-NAV-CRAWL-TRAPS-BLOG.md                   # 🆕 Filtres 7 dimensions
22-JS-NOJS-RENDERING-AI-BOTS.md                      # 🆕 Rendu sans JS

# Synthèse & roadmap (4 fichiers + dossier raw)
99-RECOMMENDATIONS-PRIORITIZED.md                    # P0/P1/P2/P3 + effort + ROI
99-ROADMAP-NEXT-6-MONTHS.md                          # Sprint 1 → Sprint 12
99-KPI-DASHBOARD-PROPOSAL.md                         # Métriques à monitorer
99-BUDGET-ESTIMATE-FULL-PROGRAM.md                   # Coût total domination France
99-DATA-RAW/                                         # Dumps grep/curl/lighthouse
99-DATA-RAW/sitemap-counts.txt
99-DATA-RAW/jsonld-samples.json
99-DATA-RAW/robots-headers.txt
99-DATA-RAW/serp-top-50-villes-snapshot.txt
99-DATA-RAW/backlinks-current-snapshot.txt
```

**Règle** : si blocker, agent rédige quand même le fichier avec section "BLOCKER" + commande pour débloquer.

---

## 5. LES 16 SOUS-AGENTS (en parallèle, multi-tool_use unique)

### A1 — Chaîne génération end-to-end
**Mission** : auditer la chaîne depuis briefing (admin/content-gen/coverage/new) jusqu'à `/blog/[slug]` rendue.
**Inputs** : `axionia/src/server/content-gen/**`, `queue/workers/content-gen-worker.ts`, `app/api/content-gen/**`, `app/[locale]/(admin)/[adminPrefix]/content-gen/**`.
**Checks** :
1. Topologie : orchestrator → KB lookup → generator (11) → quality → fact-check → similarity → review-queue → publication → indexing → sitemap → feed RSS → IndexNow.
2. Pour chaque generator (11) : prompt template, modèle LLM, coût/article, longueur médiane, latence p95, taux d'échec (lire `CONTENT-GEN-V1-AUTOPILOT-LOG.md`).
3. Kill-switch effectif (env var + UI). Providers fallback (Anthropic → OpenAI → Mistral). Quality-loop seuils. Audience-mix règles.
4. Dead code, generators non câblés à l'orchestrator, races sur slug-history + tombstone.
5. Schéma Mermaid de la chaîne.
**Scoring** : /100.
**Livrable** : `A1-CONTENT-GEN-CHAIN-E2E.md`.

### A2 — `/blog` public 360°
**Mission** : audit complet rendu/JSON-LD/meta/perf/A11y/SEO sur `/blog`, `/blog/[slug]`, `/blog/secteur/[s]`, `/blog/service/[s]`, `/blog/tag/[t]`, `/blog/taille/[t]`, `/blog/auteur/[a]`, `/blog/categorie/[c]`, `/blog/feed.xml`.
**Checks** :
1. Rendu (SSG/ISR/SSR), force-dynamic, force-static, cache headers Caddy, 200/301/410.
2. JSON-LD : `Article` (préférer à `BlogPosting` pour AI Overviews 2026), `Person` Manon + `worksFor`, `Organization` Axion-IA OÜ, `Speakable` (CSS selectors), `BreadcrumbList`, `FAQPage` si applicable, `WebSite` + `SearchAction`.
3. Meta : title ≤60c, description ≤155c, OG image 1200×630, Twitter card, canonical, hreflang réciproque, `<link rel="next/prev">`, `<link rel="alternate" type="application/rss+xml">`.
4. Pagination 10-12/page, canonical page 1, noindex pages > N pertinent.
5. **Filtres facettés (7 dimensions)** : risque crawl trap (combinaisons doublons → `noindex,follow` + canonical vers vue mère).
6. Feed RSS valide, `<atom:link>`, `<image>`, items récents.
7. Performance LCP/INP/CLS sur listes + détail.
8. Mobile : touch targets ≥48×48, viewport, font-size ≥16px.
9. A11y : heading h1→h6, alt, aria-label facettes, navigation clavier, prefers-reduced-motion.
10. Web Vitals align `lighthouserc.json`.
**Scoring** : /100. **Livrable** : `A2-BLOG-PUBLIC-AUDIT.md`.

### A3 — Pages par-ville × 4 types (gap 1-to-1)
**Mission** : audit 3 templates + chiffrer delta 4e verticale.
**Inputs** : `audit/par-ville/[ville]/page.tsx`, `interventions/par-ville/[ville]/page.tsx`, `implementation/par-ville/[ville]/page.tsx`, `generators/landing-ville.ts`, `landing-ville-templates.ts`.
**Checks** :
1. Pour les 3 templates : structure HTML, sections (hero/services/cas locaux/FAQ/CTA/mesh), longueur médiane mots, sources (INSEE, copy.services), part AxionIA-centric vs INSEE (cible ≥95 %).
2. Doctrine doorway-safe ≥40 % unique (similarity-monitor seuils, banned-phrases, audience-mix).
3. Mesh : ville→riverains (top 5 INSEE), ville→région, ville→service national, ville→cas concrets.
4. Différenciation 4 tailles entreprise (TPE/PME/ETI/GE).
5. **GAP `1-to-1`** :
   - Lister fichiers à créer (route, template, generator, seed copy, sitemap, mega-menu, breadcrumb, JSON-LD, i18n key, hreflang).
   - **3 nommages candidats** avec pros/cons SEO 2026 (volume search GSC/SEMrush, intent, cannibalisation) :
     - `coaching` (volume haut, concurrentiel)
     - `un-a-un` (volume bas mais aligné prompt Will)
     - `accompagnement-individuel` (long-tail safe)
     - `executive-coaching` (B2B premium)
     - `mentoring` (anglicisme)
     - `1-to-1` (chiffres + tirets — risque parsing)
   - Impact : ~2 150 villes × 2 locales = ~4 300 nouvelles pages SSG.
   - Plan : Phase 1 (route + template + 10 villes pilote), Phase 2 (industrialisation), Phase 3 (i18n EN).
6. JSON-LD par template : `LocalBusiness` (`areaServed: City`), `Service`, `FAQPage`, `BreadcrumbList`, `Speakable`, `OfferCatalog`.
7. Sub-sitemap dédié `sitemap-villes-{type}.xml` ?
8. Robots indexabilité (vérifier absence `noindex`).
**Scoring** : /100. **Livrable** : `A3-CITY-PAGES-COVERAGE-4-TYPES.md`.
**STOP & ASK** : naming définitif 4e verticale.

### A4 — SEO/AEO/GEO perfection 2026
**Checks** :
1. **JSON-LD doctrine 2026** :
   - `Organization` (Axion-IA OÜ, registry EE, sameAs LinkedIn/GitHub/X/Wikidata, contactPoint, areaServed France)
   - `WebSite` + `SearchAction` (Pagefind)
   - `BreadcrumbList`
   - `Article` + `Person` Manon + `worksFor` + déclaration AI Act
   - `FAQPage` sur landing villes + FAQ
   - `HowTo` sur guides
   - `LocalBusiness` (`areaServed: City`) sur par-ville
   - `Service` + `OfferCatalog` (4 types)
   - `Speakable` (AEO)
   - `subjectOf` + `isBasedOn` (cite-friendly)
   - `ImageObject` (creator, creditText, copyrightNotice, license CC BY 4.0)
   - `ItemList` (ranking villes par région)
   - **Nouveaux Schema.org 2026** : `Course` (formations), `EducationalOccupationalCredential` (certifications), `ProfessionalService` (plus précis que `LocalBusiness`), `Claim` + `ClaimReview` (anti-misinformation), `VideoObject` (chapters, transcript).
2. **Hierarchie schemas** : `WebPage` racine → `mainEntity` ciblé.
3. **Hreflang** : réciproque, x-default `/fr/`, locale switcher round-trip.
4. **OG** : 1200×630 + 1080×1080 carré, og.webp + square.webp, alt descriptif.
5. **Meta sociales** : Twitter `summary_large_image`, LinkedIn preview, WhatsApp preview.
6. **AI Overviews readiness** : H1 explicite, première phrase = TL;DR, tableaux comparatifs, citations KB interne, fact-checks visibles, dates récentes.
7. **GEO** : `According to`, `As per`, `Citation`, `Source`, expertise Axion-IA + dates.
8. **Validator** : valider chaque JSON-LD via https://validator.schema.org/ (curl + dump).
9. **IDs uniques** : `#org`, `#website`, `#person-manon` (réutilisation cross-pages).
**Scoring** : /100. **Livrable** : `A4-SEO-AEO-GEO-PERFECTION-2026.md`.

### A5 — Sitemaps, discovery, IndexNow
**Checks** :
1. `sitemap-index.xml` : présence, lastmod, sub-sitemaps.
2. Sub-sitemaps : `sitemap-pages.xml`, `sitemap-blog.xml`, `sitemap-villes-{type}.xml` × 4, `sitemap-cas-concrets.xml`, `sitemap-faq.xml`, `sitemap-images.xml`, `sitemap-videos.xml` (à créer pour VideoObject).
3. lastmod cohérent avec `updatedAt` Prisma (pas de drift).
4. Cap volume : 50 000 URL / 50 MB max — partitionnement.
5. IndexNow : key file, ping sur publication, HMAC secret env.
6. GSC sitemap soumis ? Bing Webmaster ? Yandex ? (curl + STOP & ASK si UNKNOWN).
7. robots.txt : `Sitemap:` directive, allow `User-agent: *`.
8. Discovery alternatives : RSS feeds, llms.txt référence sitemaps, ai.txt, `<link rel="sitemap">` `<head>`.
9. **Crawl rate** : analyser GSC "Crawl stats" — pages crawlées/jour vs publiées.
10. **Coverage GSC** : Excluded, Valid, Error counts.
**Scoring** : /100. **Livrable** : `A5-SITEMAPS-DISCOVERY-INDEXNOW.md`.

### A6 — Accès crawlers IA
**Checks** :
1. robots.txt par user-agent :
   - **Search bots** (à autoriser) : `Googlebot`, `Bingbot`, `OAI-SearchBot` (ChatGPT Search), `ChatGPT-User`, `Claude-Web`, `PerplexityBot`, `Perplexity-User`, `GeminiBot`, `MistralAI-User`, `YandexBot`, `DuckDuckBot`, `Slurp` (Yahoo Japan).
   - **Training bots** (décision) : `GPTBot`, `Google-Extended`, `CCBot`, `ClaudeBot` (Anthropic training), `anthropic-ai`, `Bytespider` (TikTok), `FacebookBot`, `Amazonbot`, `Applebot-Extended`.
   - **STOP & ASK** : politique training (autoriser tous pour mentions max ou bloquer pour protéger IP ?).
2. **llms.txt v0.2** : présence, format Markdown, sections `# Site`, `## Important pages`, `## Optional`, `## Excluded`. Lister Top 50 villes + 4 types dans `## Important`.
3. **ai.txt** (Spawning protocol) : opt-in/opt-out training, déclarations claires.
4. **security.txt** : RFC 9116, contact RGPD.
5. **Headers HTTP** : `X-Robots-Tag` cohérent, pas `noindex` accidentel.
6. **JSON-LD `Article`** : `author`, `dateModified`, `publisher.logo`, `mentions`, `citation` (exigences AI Overviews 2026).
7. **Format cite-friendly** : phrases courtes, déclarations factuelles datées, tableaux, listes numérotées, FAQ explicites.
8. **Authoritativeness 2026** : auteur Manon identifié + bio + qualifications + dates MAJ + sources externes.
9. **Cross-check** : Bingbot rendu HTML/JS, PerplexityBot User-Agent string, ClaudeBot rate-limit.
**Scoring** : /100. **Livrable** : `A6-AI-CRAWLERS-ACCESS.md`.

### A7 — Qualité, dédup, anti-doorway HCU
**Inputs** : `dedup/**`, `quality/**`, `fact-check/**`, `similarity-monitor`, `banned-phrases`, `audience-mix`.
**Checks** :
1. Similarity monitor : seuils MinHash/SimHash, fenêtre comparaison, action (regen/flag/block).
2. Banned phrases : liste à jour, scan post-gen, fail si match.
3. Audience mix : variations par taille entreprise.
4. Coverage distribution : équilibrage 4 types × 4 tailles × ~2 150 villes.
5. Editorial mix rules (13 tests) — couvre la 4e verticale ?
6. Fact-check : modèle, taux échec, faux positifs, gating publication.
7. Quality loop : Flesch, BERT similarity, length, kw density, headings cohérence.
8. Review queue : workflow Will, taux validation, time-to-publish médian.
9. Tombstone : URLs dépubliées → 410 Gone, slug-history 301, sitemaps clean.
10. **Spam Brain 2026 signals** : kw stuffing, exact-match anchor mesh, footer link farm, doorway, AI-generated low-quality.
11. **Soft 404** : pages ville faible contenu (< X mots) flag.
12. **Content velocity** : cadence publication, refresh signals (date révision visible).
**Scoring** : /100. **Livrable** : `A7-QUALITY-DEDUP-DOORWAY-GUARD.md`.

### A8 — Editorial mix × couverture villes
**Checks** :
1. Variation par taille (TPE/PME/ETI/GE) — combien de variantes copy ?
2. Variation par région (13 × 4 types = 52 combos).
3. Variation par densité économique INSEE (pôles tech / industriel / tertiaire / tourisme).
4. **Couverture cible** : 4 types × ~2 150 villes × 2 locales = ~17 200 pages. Actuel ~12 942 → **gap 4 300 pour 1-to-1**.
5. Tier-1 Top 50 villes : copy renforcé, témoignages, cas locaux, vidéos.
6. Sub-modules service × 4 types × villes — mesh croisé.
7. 8 axes éditoriaux (compliance, ROI, gen AI, automatisation, formation, change, sécurité, métiers).
8. Backlinks internes : profondeur clic ≤3 pour Top 50.
9. Search intent distribution (info / commercial / transactional / navigational).
10. Saisonnalité : refresh annuel obligatoire (lastmod + freshness signals 2026).
**Scoring** : /100. **Livrable** : `A8-EDITORIAL-MIX-VILLE-COVERAGE.md`.

### A9 — Web Vitals CrUX par template
**Checks** :
1. **CrUX p75** par template (4 types × landing-ville + blog list + blog détail + home) :
   - LCP ≤ 1 800 ms
   - INP ≤ 80 ms
   - CLS ≤ 0,05
   - TTFB ≤ 600 ms
2. Lighthouse Perf/A11y/BP/SEO 100/100/100/100.
3. Bundle JS ≤ 75 KB gz par route.
4. RSC vs Client Components ratio, `use client` minimisé.
5. Hero : WebP + AVIF + LQIP, `loading="eager"` + `fetchpriority="high"`.
6. Fonts : `next/font` self-hosted, `font-display: swap`, subset français.
7. Cache headers Caddy + Cloudflare, immutable assets, ISR revalidate.
8. Service Worker / PWA (manifest.webmanifest).
9. Speculation Rules prudent.
10. INP critique : listes blog, filtres facettés, locale switcher.
11. **Resource hints** : preconnect, dns-prefetch, prefetch, preload (LCP image).
12. **HTTP/3 + Brotli + OCSP stapling** Caddy/Cloudflare actifs ?
13. **Edge functions Cloudflare** : geolocation ville → redirect auto ?
14. **Mobile vs Desktop** INP différenciés.
15. **Speed Index / TBT / TTI** au-delà CWV.
**Scoring** : /100. **Livrable** : `A9-WEB-VITALS-CRUX-VILLES.md`.

### A10 — Admin content-gen workflows
**Inputs** : `[adminPrefix]/content-gen/**` (30+ sous-pages).
**Checks** : pour chaque sous-page (orchestrator, coverage, jobs, review-queue, publications, quality, rss, templates, settings/*, costs, author/manon, geo, landing-variants, similarity-monitor, keyword-tracking, kb-readonly, onboarding) :
- Existe (oui/non/`_v2` only/partiel)
- Fonctionnelle (oui/non/bug)
- Gap UX cohérence design system mai 2026
- Sécurité (auth admin, 2FA, CSRF)
- Intégration keyword-tracking ↔ GSC API ?
**Scoring** : /100. **Livrable** : `A10-ADMIN-CONTENT-GEN-WORKFLOWS.md`.

### A11 — i18n FR/EN parité
**Checks** :
1. Hreflang réciproque, x-default `/fr/`, locale switcher round-trip.
2. Pages EN équivalentes (lister manquantes).
3. Traduction services : audit→audit, intervention→intervention, 1-to-1→one-on-one ou 1-on-1 (STOP & ASK), implémentation→implementation, formation→training.
4. URLs EN : `/en/audit/by-city/paris` vs `/en/audit/per-city/paris` (naming routes).
5. Slugs villes EN : `paris` reste `paris`.
6. Régions EN : `Île-de-France` → cohérence INSEE.
7. Manon EN : bio traduite, signature.
8. `inLanguage` : `fr-FR` vs `en-GB` ou `en-US`.
9. Sitemap inclusion EN + `xhtml:link` hreflang.
10. Cible Google.co.uk + ChatGPT EN — cohérent avec stratégie France ?
**Scoring** : /100. **Livrable** : `A11-I18N-PARITY-FR-EN.md`.

### A12 — RGPD + AI Act EU 2026 + transparence Manon
**Checks** :
1. **AI Act EU 2026 (août 2026)** :
   - Art. 50 transparence contenu IA — mention/watermark obligatoire ?
   - Art. 52 GPAI providers déclaration.
   - Risk classification : limited risk → obligations.
2. **Manon transparency** :
   - Page auteur : "Contenu rédigé avec assistance IA, supervisé Axion-IA".
   - JSON-LD : `Person` Manon + `agent` SoftwareApplication ?
   - Bio mentionne nature IA + supervision.
   - Footer mention "AI-assisted content".
3. **RGPD content-gen** : logs pseudo-anon, IP hash salt, prompts review-queue sans PII, KB ingest opt-out, robots respect.
4. Cookies : Plausible (no cookies), Clarity (cookies — banner).
5. DPA sous-processeurs : Anthropic, OpenAI, Mistral, Hetzner, Cloudflare, Coolify — DPA signés ?
6. Droit effacement : tombstone 410 + slug-history 301.
7. Mentions légales : Axion-IA OÜ Estonia, registre EE, DPO.
8. CGU/CGV à jour, mention contenus IA.
9. Données utilisateurs : booking, contact — anonymisation, retention.
10. Sécurité : `security.txt`, pen-test, secrets rotation.
**Scoring** : /100. **Livrable** : `A12-RGPD-AI-ACT-LEGAL.md`.

### 🆕 A13 — Knowledge Base deep audit
**Inputs** : `kb-feeder.ts`, `kb-ingest/**`, `kb-health.ts`, `kb-client.ts`, `[adminPrefix]/content-gen/kb-readonly/**`, `[adminPrefix]/content-gen/settings/kb-ingest/**`.
**Checks** :
1. Sources KB ingérées : lister (sitemap-parser, manual upload, RSS, crawl externe) — combien d'entrées totales, par source ?
2. KB-feeder logic : comment les generators lookup la KB (vector search ? full-text ? embeddings ?).
3. Refresh cadence : daily / weekly / manual ? Triggers ?
4. KB-health metrics : staleness, coverage, dedup intra-KB.
5. Sources opt-out : respect robots.txt + ai.txt des sources externes.
6. Droit d'auteur : citations propres, pas de scraping massif sans permission.
7. Schema PostgreSQL : modèles `KbEntry`, `KbSource`, `KbEmbedding` (lire `prisma/schema.prisma`).
8. Qualité ingest : déduplication, normalisation, filtrage langues, extraction main content (Readability.js ?).
9. Coût embeddings : par 1 000 entrées (Anthropic/OpenAI/Mistral pricing).
10. KB → generators : quel générateur utilise quoi (mapping table) ?
11. KB readonly admin UX : recherche, filtres, audit trail.
12. KB injection prompts : risque prompt injection si source externe non sanitizée.
**Scoring** : /100. **Livrable** : `A13-KNOWLEDGE-BASE-DEEP-AUDIT.md`.

### 🆕 A14 — Audit concurrentiel SERP Top 50 villes
**Mission** : connaître la concurrence pour chaque ville Top 50 × 4 types = 200 SERPs.
**Méthode** : ce sous-agent ne peut pas faire de requêtes SERP réelles sans outil. Il :
1. Liste les **50 villes Tier-1** (Paris, Lyon, Marseille, Toulouse, Nice, Nantes, Strasbourg, Montpellier, Bordeaux, Lille, Rennes, Reims, Le Havre, Cergy, Saint-Étienne, Toulon, Grenoble, Dijon, Angers, Nîmes, Villeurbanne, Saint-Denis, Aix-en-Provence, Le Mans, Clermont-Ferrand, Brest, Tours, Amiens, Limoges, Annecy, Perpignan, Boulogne-Billancourt, Metz, Besançon, Orléans, Rouen, Argenteuil, Mulhouse, Caen, Saint-Paul, Nancy, Roubaix, Tourcoing, Vitry-sur-Seine, Nanterre, Avignon, Créteil, Poitiers, Asnières-sur-Seine, Versailles).
2. Pour chaque ville × 4 types = 200 SERPs cibles, génère **template de check** :
   - Top 10 résultats organiques (commande curl ou STOP & ASK Will pour SEMrush/Ahrefs export)
   - AI Overview présent ? Sources citées ?
   - People Also Ask 4 questions
   - Featured snippet ?
   - Knowledge Panel ?
   - Local pack 3 résultats ?
3. **Concurrents génériques attendus** à mapper :
   - Cabinets conseil IA : Accenture, CapGemini, Sopra Steria, Deloitte, KPMG, EY
   - Agences IA : Ekimetrics, Quantmetry, Artefact, Datadocks
   - Indépendants : LinkedIn experts
   - Pure players locaux : startups régionales
4. **Gap analysis** : où Axion-IA est-elle absente, où est-elle en position 11-30 (proche top 10 = quick wins).
5. **Difficulty score** : 1-100 par mot-clé × ville (basé sur Domain Authority concurrents).
6. **Quick wins** : Top 20 villes avec difficulty < 40 + intent commercial → prioriser.
7. **Long tail strategy** : couvrir d'abord 2 100 villes <50K hab (low competition) avant top 50 (high competition).
**Scoring** : /100. **Livrable** : `A14-COMPETITIVE-SERP-TOP-50-VILLES.md`.
**STOP & ASK** : autoriser achat SEMrush/Ahrefs (300-500€/mois) pour data réelle ? Sinon stratégie volume only.

### 🆕 A15 — Google Business Profile + Local SEO physique
**Mission** : Local SEO 2026 sans GBP est impossible — Axion-IA OÜ Estonia n'a pas d'adresse FR physique → comment compenser ?
**Checks** :
1. **GBP status** : Axion-IA a-t-elle une fiche GBP ? Si oui, vérifier (commande/URL pour Will).
2. **Adresse physique FR** : option locations partagées (WeWork Paris/Lyon, coworking Bordeaux) ? Domiciliation ?
3. **NAP cohérence** : Name (Axion-IA), Address, Phone, Hours — cohérent sur footer + mentions légales + GBP + LinkedIn + JSON-LD `Organization` + Wikipedia ?
4. **Google Maps embed** : sur pages par-ville ? Risque : page non-localisée si pas d'adresse.
5. **Avis Google** : 0 ? Cible ≥ 50 avis ≥ 4,5★ dans 12 mois. Stratégie collecte clients réels.
6. **Trustpilot / Avis Vérifiés / G2 / Capterra** : présence ?
7. **Local citations** : annuaires (PagesJaunes, Société.com, Kompass, Verif.com, Manageo) — cohérents ?
8. **Local link building** : CCI régionales, agglomérations, French Tech, BPI, Bpifrance, Région Auvergne-Rhône-Alpes, etc.
9. **Service Area Business (SAB)** GBP : alternative sans adresse fixe — déclarer aires de service.
10. **Local SEO sans GBP** : stratégie pure pSEO + JSON-LD `LocalBusiness` + areaServed — viable mais top 3 Local Pack inaccessible.
11. **Multi-fiches GBP** : illégal si pas de présence physique. Alternative : partenaires locaux franchisés/co-marketing.
**Scoring** : /100. **Livrable** : `A15-GOOGLE-BUSINESS-PROFILE-LOCAL-SEO.md`.
**STOP & ASK** : stratégie adresse FR (WeWork ? Domiciliation ? Partenaires ?) — budget ~50-200€/mois.

### 🆕 A16 — Entity SEO + Knowledge Graph + Wikidata + Wikipedia
**Mission** : faire reconnaître Axion-IA comme **entité** par Google Knowledge Graph + LLMs.
**Checks** :
1. **Knowledge Graph** : Axion-IA présente ? (recherche `axion-ia` → Knowledge Panel ?)
2. **Wikidata** : entity QID existant ? Si non, plan création (Q-ID, P-properties : instance of, founded, headquarters, website, founder, industry, sameAs).
3. **Wikipedia** : article FR + EN ? Critères notabilité Wikipedia France : sources secondaires indépendantes, presse, awards.
4. **sameAs JSON-LD** : `Organization.sameAs` → LinkedIn, GitHub, X (Twitter), YouTube, Crunchbase, Wikidata QID, Wikipedia URL.
5. **schema.org `mentions`** : pages citant Axion-IA externes.
6. **Brand SERP** : recherche `Axion-IA` → quels résultats ? Top 10 dominés par axion-ia.com + sociaux ?
7. **Reputation management** : pas de résultat négatif top 20.
8. **Founder entity** : Will (William ?) — entity séparée avec `worksFor` Axion-IA.
9. **Press mentions** : Presse-citron, BFM Business, Les Échos, La Tribune, Maddyness, FrenchWeb — articles citant Axion-IA ?
10. **Crunchbase / Pitchbook / Dealroom** : profils entreprise ?
11. **OpenCorporates** : registre EE OÜ public.
12. **Schema `funder` / `award` / `parentOrganization`** : si applicable.
**Scoring** : /100. **Livrable** : `A16-ENTITY-SEO-KNOWLEDGE-GRAPH-WIKIDATA.md`.
**STOP & ASK** : autoriser création Wikidata QID (gratuit) + tentative Wikipedia (risque suppression si notabilité insuffisante).

---

## 6. CROSS-CUTTINGS BONUS (12 fichiers obligatoires)

### 11 — Crawl budget + log files analysis
**Checks** :
1. ~21 800 routes potentielles (17 500 + 4 300 new 1-to-1) — Googlebot budget réaliste.
2. **Caddy access logs** : extraire crawls par User-Agent (commande Bash sur Hetzner). Lister volume Googlebot/Bingbot/PerplexityBot/ClaudeBot/GPTBot par jour.
3. **GSC Crawl stats** : pages crawlées/jour, time/response, status codes.
4. **Pages crawl-frequent** vs **pages crawl-rare** — pages importantes mal crawlées ?
5. **Crawl waste** : pages noindex crawlées, redirects chains, 404, soft 404.
6. **Anti-bot Cloudflare** : challenges sur AI bots ? Page Rules à ajuster ?
7. **Rate limit** : pas de 429 sur bots officiels.
**Livrable** : `11-CRAWL-BUDGET-LOG-FILES-ANALYSIS.md`.

### 12 — Backlinks + netlinking stratégie
**Checks** :
1. **Profil actuel** : `https://search.google.com/search-console/links` ou Ahrefs free / Ubersuggest — domaines référents, DR moyen, top anchors.
2. **Toxic links** : audit + disavow si nécessaire.
3. **Stratégie locale par ville** :
   - CCI départementales (95 départements)
   - French Tech communautés (13 hubs)
   - Bpifrance régions
   - Agglomérations + métropoles
   - Médias régionaux (Ouest-France, La Voix du Nord, Sud Ouest, La Dépêche, Le Progrès, etc.)
   - Annuaires régionaux
4. **Stratégie nationale** : Maddyness, FrenchWeb, BFM Business, Les Échos, La Tribune, Usine Digitale, JDN.
5. **Content marketing** : guest posts, études sectorielles, reports annuels "État de l'IA en France 2026".
6. **HARO / Featured.com / SourceBottle** : journalistes en demande.
7. **Partnerships** : OVHcloud, Scaleway, BPI, écoles 42/EPITA/Telecom Paris.
8. **Anchor text distribution** (sur-opti HCU risk) : exact match ≤ 5 %, partial ≤ 20 %, branded ≥ 50 %, generic ≥ 25 %.
9. **Velocity** : 5-15 backlinks/mois (organique safe), pas de pic suspect.
**Livrable** : `12-BACKLINKS-NETLINKING-STRATEGY.md`.

### 13 — Topical authority + hub-spoke + pillar pages
**Checks** :
1. **Pillar pages identifiées** : audit IA / formation IA / implémentation IA / coaching IA — chacune avec son hub.
2. **Hub-spoke architecture** : pillar → 20-50 spokes (articles blog, FAQ, cas concrets) reliés.
3. **Internal anchor strategy** : variations sémantiques, pas d'exact-match repeats.
4. **Topic gaps** : sujets manquants pour topical authority complète (ex : "IA pour PME industrie", "ChatGPT pour artisans", "Claude pour cabinets juridiques", etc.).
5. **Cluster maturity** : combien de clusters complets vs en construction ?
6. **Pillar pages SEO** : 3 000-5 000 mots, Hub menu navigation, TOC, semantic HTML5 sections.
7. **Spokes cross-linking** : chaque spoke link au pillar + 2-3 sibling spokes.
**Livrable** : `13-TOPICAL-AUTHORITY-HUB-SPOKE.md`.

### 14 — EEAT signals + editorial policy
**Checks** :
1. **Author byline** détaillée Manon (bio, photo, qualifications, LinkedIn, posts précédents).
2. **About us** trust signals : équipe, awards, certifications, années expérience.
3. **Editorial policy** publique : `/editorial-policy` — process review, sources, fact-check, AI disclosure.
4. **Corrections policy** : `/corrections` — comment signaler une erreur.
5. **"Last reviewed"** dates visibles sur chaque article.
6. **Sources/references** : footnotes ou liens externes vers autorités (Légifrance, AI Act, INSEE, MIT, Nature).
7. **Expert quotes** : citations d'experts externes (par interview ou crawl autorisé).
8. **Author pages** : `/blog/auteur/manon` complet avec stats articles.
9. **Schema `Article.author.knowsAbout`** + `hasOccupation` + `alumniOf`.
10. **Trust badges** : RGPD, AI Act compliance, ISO, certifications.
**Livrable** : `14-EEAT-EDITORIAL-POLICY.md`.

### 15 — Video content strategy
**Checks** :
1. **Vidéos existantes** ? YouTube channel Axion-IA ?
2. **VideoObject schema** sur pages avec vidéos.
3. **Chapters** (`hasPart` + `Clip`) — boost AI Overviews 2026.
4. **Transcription** complète (texte indexable).
5. **Embed YouTube/Vimeo** ou self-hosted ?
6. **Sitemap vidéos** : `sitemap-videos.xml` dédié.
7. **Plan production** : 1 vidéo/mois par type (4/mois) = 48/an.
8. **Format** : explainer, témoignage client, démo outil, replay webinaire.
9. **YouTube SEO** : title, description, tags, end-screen, cards.
10. **Cross-link** vidéos ↔ articles blog.
**Livrable** : `15-VIDEO-CONTENT-STRATEGY.md`.

### 16 — Reviews + AggregateRating + rich snippets
**Checks** :
1. **Témoignages clients** existants → schema `Review` + `AggregateRating`.
2. **Trustpilot / Google / G2 / Capterra** : intégration widgets ?
3. **JSON-LD `AggregateRating`** sur `LocalBusiness` + `Service` + `Course` (formations).
4. **Rich snippet visibility** : étoiles dans SERP = +35 % CTR moyen.
5. **Schema review fraud avoidance** : reviews réelles uniquement, traçabilité.
6. **Stratégie collecte** : email post-mission, NPS, demande explicite.
7. **Cible** : 50+ reviews ≥ 4,5★ Google + Trustpilot dans 12 mois.
**Livrable** : `16-REVIEWS-AGGREGATERATING-RICH-SNIPPETS.md`.

### 17 — Featured snippets + People Also Ask
**Checks** :
1. **FAQ structure** : Q en H2/H3, réponse 40-60 mots, table/liste/définition.
2. **Schema `FAQPage`** systématique sur landing villes + guides.
3. **PAA opportunities** : pour chaque mot-clé ville × type, identifier 4 questions PAA Google.
4. **Position 0 cibles** : "qu'est-ce qu'un audit IA", "combien coûte une formation IA", "comment implémenter l'IA en PME".
5. **Tables comparatives** : "audit IA vs implémentation IA", "ChatGPT vs Claude vs Mistral".
6. **Long-form answers** pour AI Overviews : H2 = question, 2-3 paragraphes structurés.
**Livrable** : `17-FEATURED-SNIPPETS-PAA-OPTIMIZATION.md`.

### 18 — Title rewrites Google + CTR SERP
**Checks** :
1. **Title formula optimale 2026** : `{keyword} : {benefit/USP} | Axion-IA {ville?}`.
2. **Length** : 50-60c (mobile) — Google rewrite si > 60c.
3. **Power words** : "complet", "guide 2026", "expert", "n°1", "certifié".
4. **Brand placement** : fin du title.
5. **Description** : 140-155c, CTA, USP, intent match.
6. **CTR estimation** : par template (blog post / landing ville / pillar) — cible ≥ 5 % moyenne.
7. **A/B testing infrastructure** : Plausible Goals + GSC query report.
**Livrable** : `18-TITLE-REWRITES-CTR-SERP-OPTIMIZATION.md`.

### 19 — Intl expansion francophone
**Checks** :
1. **Belgique francophone** : `/be-fr/` ou `/fr-be/` ? hreflang `fr-BE`. Volume search Brussel/Liège/Charleroi.
2. **Suisse romande** : `/ch-fr/` ? hreflang `fr-CH`. Genève/Lausanne/Neuchâtel.
3. **Québec** : `/ca-fr/` ? hreflang `fr-CA`. Montréal/Québec/Laval.
4. **Luxembourg** : `/lu-fr/` ? hreflang `fr-LU`. Luxembourg-Ville.
5. **Marché OÜ Estonia** : facturation B2B intra-UE simple.
6. **Stratégie** : Phase 1 France (présent), Phase 2 BE+CH+LU (12 mois), Phase 3 QC (24 mois).
7. **Risque cannibalisation** : pages quasi-identiques FR/BE → différenciation devise/régulation/INSEE→Statbel.
**Livrable** : `19-INTL-EXPANSION-FRANCOPHONE.md`.
**STOP & ASK** : feu vert intl expansion ou focus France pure 12 mois.

### 20 — Link health 404/410/301 + canonical
**Checks** :
1. **Internal broken links** : crawl Pagefind ou Screaming Frog → liste 404 internes.
2. **External broken links** : sources KB, citations, blog refs.
3. **Redirect chains** : max 1 hop, pas de 301 → 301 → 200.
4. **410 Gone** sur tombstones (preferred over 404).
5. **Canonical** : self-canonical sur toutes pages, cross-canonical sur duplicates intentionnels.
6. **Parameters handling** : `?ref=`, `?utm_*` → canonical clean URL.
7. **Trailing slash** : cohérence (Next.js 16 default), 301 si normalisation.
8. **www vs non-www** : 301 forcé.
9. **HTTP → HTTPS** : 301 + HSTS preload.
**Livrable** : `20-LINK-HEALTH-404-410-301-CANONICAL.md`.

### 21 — Faceted nav crawl traps sur `/blog/`
**Checks** :
1. **7 dimensions filtres** : secteur, service, tag, taille, auteur, catégorie, date → 7! = 5 040 combinaisons théoriques.
2. **Indexable vs noindex** : règle claire (canonical → vue mère, `noindex,follow` sur combos rares).
3. **Crawl trap detection** : GSC "Discovered – currently not indexed" — combien sur `/blog/*` ?
4. **URL params** : `?sort=`, `?page=` → handle via canonical + GSC URL Parameter (deprecated mais Bing utile).
5. **`<link rel="canonical">`** dynamique sur listes filtrées.
6. **Robots disallow** sur combos profondes (`/blog/tag/*/categorie/*` par exemple).
7. **Sitemap** : ne lister que combinaisons indexables.
**Livrable** : `21-FACETED-NAV-CRAWL-TRAPS-BLOG.md`.

### 22 — JS vs no-JS rendering pour AI bots
**Checks** :
1. **Curl test sans JS** : `curl -A "Bingbot" https://axion-ia.com/fr/blog` → contenu visible ?
2. **Server Components** : RSC default Next.js 16 → bon pour bots, mais vérifier.
3. **Client Components** : `use client` → fallback HTML pour bots faible-JS ?
4. **PerplexityBot rendering** : fetch HTML only (no JS execution).
5. **ClaudeBot rendering** : idem.
6. **GPTBot rendering** : idem (au moment de l'audit, peut évoluer).
7. **Googlebot rendering** : 2-stage indexing (HTML d'abord, JS rendu après).
8. **Critical content** : H1, première phrase TL;DR, JSON-LD, liens internes top → tous dans HTML statique.
9. **Lazy components** : ne pas mettre EEAT/auteur/sources en lazy.
**Livrable** : `22-JS-NOJS-RENDERING-AI-BOTS.md`.

---

## 7. SCORING & VERDICT

### 7.1 Score global /3200
- 16 agents × 100 pts = 1 600 pts
- 12 cross-cuttings × 100 pts = 1 200 pts
- 4 méta-livrables bonus × 100 pts (Exec Summary, Roadmap, KPI Dashboard, Budget Estimate) = 400 pts
- **Total** : 1 600 + 1 200 + 400 = 3 200 pts

### 7.2 Verdict
- 🔴 NO-GO : < 1 920/3200 (60 %)
- 🟠 SPRINT CORRECTIF : 1 920-2 240 (60-70 %)
- 🟡 GO CONDITIONAL : 2 240-2 720 (70-85 %)
- 🟢 GO PROD : ≥ 2 720 (85 %+)

### 7.3 Critères verdict 🔴 NO-GO automatique
- robots.txt bloque Googlebot/Bingbot accidentellement.
- Sitemap-index 404.
- JSON-LD `Article` cassé sur > 10 % blog posts.
- Boucle infinie similarity-monitor.
- Kill-switch admin inopérant.
- AI Act 2026 transparence absente post-août 2026.
- KB prompt injection vulnerability.
- > 50 backlinks toxic non disavow.

---

## 8. ROADMAP DE SORTIE (`99-ROADMAP-NEXT-6-MONTHS.md`)

### Phase 1 — Sprint immédiat (S1, ~10 j)
- Fix P0 audit.
- Lancement industrialisation `1-to-1` (route + template + 10 villes pilote).
- Soumission Bing Webmaster + Yandex Webmaster + IndexNow check.
- robots.txt mis à jour (politique AI bots tranchée).
- llms.txt v0.2 + ai.txt + security.txt publiés.

### Phase 2 — Sprint pSEO 1-to-1 complet + EEAT (S2-S3, ~3 sem)
- Génération ~4 300 pages `1-to-1` × 2 locales.
- Sitemap dédié, mega-menu, mesh interne.
- Editorial policy + corrections policy + author pages détaillées.
- Manon AI Act transparency en place.

### Phase 3 — Entity SEO + Knowledge Graph + Backlinks locaux (S4-S6, ~6 sem)
- Wikidata QID création.
- Tentative Wikipedia (si notabilité OK).
- Schema.org 2026 complet (Course, ProfessionalService, VideoObject).
- 30 backlinks locaux qualité (CCI + médias régionaux + agglomérations).
- GBP stratégie tranchée + execution.

### Phase 4 — Tier-1 villes premium + Video + Reviews (S7-S10, ~10 sem)
- Top 50 villes : copy renforcé, témoignages, cas locaux, vidéos.
- 4 vidéos/mois (1 par type) → 16 vidéos.
- Collecte 50 reviews ≥ 4,5★ Google + Trustpilot.
- AggregateRating schema actif.
- Featured snippets push (FAQ enrichies, tables).

### Phase 5 — Monitoring + itération + intl prep (S11-S12, continue)
- Dashboard `/admin/pseo-stats` (positions GSC, mentions LLM via crawl).
- Refresh saisonnier auto.
- Préparation intl francophone (BE/CH/LU/QC) si validé.
- Backlinks velocity organique 5-15/mois.

---

## 9. EXEC SUMMARY POUR WILL (`01-EXEC-SUMMARY-WILL.md`)

≤ 2 pages, contenant :
1. **Verdict global** : score /3200 + 🔴🟠🟡🟢.
2. **Top 10 P0 bloquants** (1 ligne, effort ETA).
3. **Top 10 décisions Will à trancher** (options + reco défaut).
4. **Effort total** pour 🟢 GO PROD.
5. **ROI projeté domination France 12 mois** :
   - +X positions Google moyennes
   - +Y citations LLM/mois (estimation crawl LLM monitoring)
   - +Z prospects/mois en sortie funnel
   - Coût total programme 6 mois (LLM + outils + content + backlinks)

---

## 10. INSTRUCTIONS D'EXÉCUTION POUR L'AGENT MAÎTRE

1. **T0** : Lire MEMORY.md + 10+ fichiers audit existants (§1.7). Confirmer pas de drift depuis 2026-05-15.
2. **T1** : Créer `_AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/` + `00-MANIFEST.md`.
3. **T2** : Lancer **16 sous-agents en parallèle** dans un seul tour multi-tool_use (`subagent_type: "Explore"`).
4. **T3** : Attendre tous retours. Si timeout, relancer agent défaillant.
5. **T4** : Rédiger 12 cross-cuttings (fichiers `11-` à `22-`).
6. **T5** : Rédiger 10 méta-livrables (`00` à `10`).
7. **T6** : Rédiger `99-RECOMMENDATIONS-PRIORITIZED.md` (P0/P1/P2/P3, effort, ROI).
8. **T7** : Rédiger `99-ROADMAP-NEXT-6-MONTHS.md`, `99-KPI-DASHBOARD-PROPOSAL.md`, `99-BUDGET-ESTIMATE-FULL-PROGRAM.md`.
9. **T8** : Mettre à jour MEMORY.md (nouvelle entrée `axionia_content_gen_city_domination_2026-05-18.md` + ligne ≤ 200c).
10. **T9** : Rendre verdict final à Will + STOP & ASK consolidé.

---

## 11. ANTI-PATTERNS À ÉVITER

- ❌ "Tout est parfait" sans grep:fichier:ligne → INTERDIT.
- ❌ Promettre fix non vérifié → INTERDIT.
- ❌ Inventer fichier inexistant → INTERDIT.
- ❌ Glisser commit sans demander → INTERDIT (audit-only).
- ❌ Choisir naming `1-to-1` sans STOP & ASK → INTERDIT.
- ❌ Oublier AI Act 2026 → CRITIQUE.
- ❌ Casser tests 945/945 vitest → INTERDIT.
- ❌ Rapport > 2 pages exec summary Will → INTERDIT.
- ❌ Confondre AEO (Speakable, Alexa) et GEO (LLM citations) → INTERDIT.
- ❌ Suggérer multi-fiches GBP sans présence physique (illégal Google policy) → INTERDIT.
- ❌ Anchor text exact-match > 5 % → HCU risk.
- ❌ Velocity backlinks > 30/mois → flag suspect.
- ❌ Scraping sources externes sans opt-out check → légal risk.
- ❌ Tentative Wikipedia sans notabilité → suppression + risque vandalism.

---

## 12. PHRASE DE CLÔTURE OBLIGATOIRE

À la fin :

> **AUDIT TERMINÉ — Verdict {🔴🟠🟡🟢} {score}/3200.
> {N} livrables dans `_AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/`.
> {K} STOP & ASK ouverts pour Will (voir `03-STOP-AND-ASK-WILL.md`).
> Aucune ligne de code modifiée. Aucun commit créé.
> Prêt pour décisions Will → puis Phase 2 IMPLEMENTATION (prompt séparé).**

---

## 13. FICHIERS SOURCES OBLIGATOIRES À LIRE (minimum)

```
# Génération
axionia/src/server/content-gen/generators/landing-ville.ts
axionia/src/server/content-gen/generators/landing-ville-templates.ts
axionia/src/server/content-gen/generators/blog-article.ts
axionia/src/server/content-gen/generators/blog-from-rss.ts
axionia/src/server/content-gen/generators/blog-from-keywords.ts
axionia/src/server/content-gen/generators/blog-from-title.ts
axionia/src/server/content-gen/generators/comparison.ts
axionia/src/server/content-gen/generators/faq-standalone.ts
axionia/src/server/content-gen/generators/guide-pilier.ts
axionia/src/server/content-gen/generators/qa-derived.ts
axionia/src/server/content-gen/shared/editorial-mix-rules.ts
axionia/src/server/queue/workers/content-gen-worker.ts

# KB
axionia/src/server/content-gen/kb-feeder.ts
axionia/src/server/content-gen/kb-client.ts
axionia/src/server/content-gen/kb-health.ts
axionia/src/server/content-gen/kb-ingest/*.ts

# Discovery
axionia/src/app/sitemap.ts
axionia/src/app/robots.ts
axionia/public/llms.txt
axionia/public/ai.txt
axionia/public/security.txt

# Blog public
axionia/src/app/[locale]/blog/page.tsx
axionia/src/app/[locale]/blog/[slug]/page.tsx
axionia/src/app/[locale]/blog/feed.xml/route.ts
axionia/src/app/[locale]/blog/secteur/[s]/page.tsx
axionia/src/app/[locale]/blog/auteur/[a]/page.tsx
axionia/src/app/[locale]/blog/categorie/[c]/page.tsx

# Pages ville
axionia/src/app/[locale]/audit/par-ville/[ville]/page.tsx
axionia/src/app/[locale]/interventions/par-ville/[ville]/page.tsx
axionia/src/app/[locale]/implementation/par-ville/[ville]/page.tsx

# Admin content-gen
axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/orchestrator/page.tsx
axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/page.tsx
axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/llms-txt/page.tsx
axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/keyword-tracking/page.tsx
axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/similarity-monitor/page.tsx

# Schema DB
axionia/prisma/schema.prisma

# Audits antérieurs
_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md
_AUDIT/CONTENT-GEN-PASS-B-VERDICT-2026-05-15.md
_AUDIT/CONTENT-GEN-AUDIT-OPERATIONNEL-FLOWS-2026-05-15.md
_AUDIT/CONTENT-GEN-AUDIT-INDEXATION-FR-2026-05-15.md
_AUDIT/CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL-2026-05-15.md
_AUDIT/INDEXATION-DISCOVERY-2026-05-18/   (tous fichiers)
_AUDIT/PSEO-VILLES-INDUSTRIALISATION-DECISION.md
```

---

## 14. CONTRAINTES OPÉRATIONNELLES

- **Durée max** : 38 h. Au-delà, STOP & ASK Will.
- **Budget LLM lecture/synthèse** : ~$10-20.
- **Commits** : ZÉRO.
- **Branches** : main checkout, pas de nouvelle branche.
- **Worktree** : non.
- **Subagents** : `subagent_type: "Explore"` pour A1-A16 (read-only). `general-purpose` autorisé seulement pour synthèse cross-cutting.

---

## 15. CRITÈRES DE PERFECTION 2026 (référence absolue)

Cet audit reflète le niveau attendu pour une plateforme qui veut être :
- ✅ Citée Google AI Overviews France 80 % requêtes locales IA cibles.
- ✅ Citée ChatGPT Search top 3 + Perplexity/Claude/Gemini/Copilot top 5.
- ✅ Position Google #1-#3 Top 50 villes + top 10 autres ~2 100.
- ✅ Entity reconnue Knowledge Graph + Wikidata + (idéalement) Wikipedia.
- ✅ Topical authority maximale (clusters complets, hub-spoke parfait).
- ✅ EEAT visible (auteurs, sources, dates, editorial policy, équipe).
- ✅ Backlinks locaux qualité (CCI, médias, partenaires).
- ✅ GBP stratégie tranchée (avec ou sans adresse physique).
- ✅ Reviews ≥ 50 ≥ 4,5★ Google + Trustpilot 12 mois.
- ✅ Conforme RGPD + AI Act EU 2026 + DSA.
- ✅ Web Vitals 100/100/100/100 sur templates clés.
- ✅ WCAG 2.2 AA.
- ✅ Multilingue FR + EN + (option) BE/CH/LU/QC.
- ✅ JS-rendering AND HTML-only rendering propre pour AI bots.
- ✅ Crawl budget maîtrisé (~21 800 routes).
- ✅ Faceted nav sans crawl traps.
- ✅ Liens internes sains (0 broken, redirect chains absents).

---

**FIN DU PROMPT v2.0 — 2026-05-18 — PERFECTION EDITION**

> Self-contained. Aucune connaissance externe au repo requise sauf doctrine SEO/AEO/GEO 2026 publique (Google AI Overviews, AI Act EU, Helpful Content Update 2024-2026, Web Vitals 2026, Schema.org 2026, Wikidata, llms.txt v0.2, ai.txt Spawning, RFC 9116). Tout contexte projet est dans MEMORY.md + `_AUDIT/`.
