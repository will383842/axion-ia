# 00 — CARTOGRAPHIE DU CONTENT ENGINE AXION-IA

> **Adaptation de stack (règle 4 du prompt)** : le prompt d'audit présuppose un backend **Laravel/PHP/Eloquent/Artisan/Blade**. Ce projet n'utilise **AUCUN de ces composants** → marqués `Laravel ABSENT`. Stack réelle : **Next.js 16 (App Router) + React 19 + TypeScript + Prisma 5.22 (PostgreSQL) + BullMQ (Redis) + OpenAI/Anthropic + next-intl v4**. Build SSG externalisé GitHub Actions + stubs `stub.invalid` (ADR 0026). Hébergement Coolify/VPS + Cloudflare.

Date audit : 2026-06-25. Périmètre : génération → qualité → publication → rendu → console.

---

## VUE D'ENSEMBLE DU PIPELINE (flux nominal)

```
[Console admin] ou [Campagne/Scheduler cron]
   │  enqueue
   ▼
ContentGenJob (table Prisma, status=queued)
   │
   ▼
content-orchestrator-worker.ts ── (campagnes multi-axes : échantillonne type/intent/audience/ville/secteur par slot)
   │  enqueue "generate" sur la queue content-gen
   ▼
content-gen-worker.ts ──► getGenerator(contentType) ──► <generator>.generate()
   │     │                         (blog-from-keywords | v7-phase8 | comparison | faq | qa | rss | guide | landing-ville…)
   │     │  assemble contexte : keyword (selectKeywordRich, rotation cluster-aware) + KB retrieve (RAG) +
   │     │  pain-matrix + ancrage ville + intent (garde-fou) + liens externes/internes
   │     │  appel LLM (router providers OpenAI/Anthropic) → parse JSON → sanitize HTML
   │     ▼
   │  GATES qualité (bloquants/non-bloquants) :
   │    plagiarism · intent-alignment (→ tier demote) · dedup outline/topic (Hamming) ·
   │    doctrine (banned phrases) · benefit-concreteness · soft-404 · data-quality ·
   │    seo-score + readability → qualityFromScores ≥ seuil(70) ?
   │     ▼
   │  status = approved | quality_improving | needs_review | failed
   ▼
content-publish-worker.ts ──► crée Article + ArticleTranslation (troncature défensive title/meta) +
   │   persiste citations (ContentCitation/ExternalReference) + featuredImage + tier + categoryId
   ▼
[Frontend] /fr/blog/[slug] (ISR) — loader DB-first (loadBlogArticleForView) → rendu HTML sanitizé + JSON-LD
   │
   ▼
[Indexation] sitemap (generateSitemaps) + IndexNow + Google Indexing API + GSC
```

Workers de cycle de vie en aval : `content-quality-improver-worker` (2e passe si sous-seuil), `content-refresh-worker`, `content-tier-lifecycle-worker`, `content-news-lifecycle-worker`, `content-fact-check-worker`, monitoring (similarity, web-vitals, psi, gsc-hcu, weekly-report).

---

## ARBORESCENCE

```
src/server/content-gen/                → CŒUR du moteur | état : actif, très riche (~200 fichiers)
├── generators/                        → 1 fichier par type de contenu | appelé par : content-gen-worker
│   ├── blog-from-keywords.ts          → article long-form 3-appels (plan→expand) | modèle de référence
│   ├── blog-article.ts, blog-from-title.ts, blog-from-rss.ts  → variantes long-form / news digest
│   ├── comparison.ts                  → comparatif (triple-verrou <table>) intent commercial
│   ├── faq-standalone.ts, qa-derived.ts → formats courts (FAQ / Q-R)
│   ├── guide-pilier.ts                → guide pilier long (cible 2000 mots) → /guides
│   ├── barometer-insight.ts           → insight baromètre (données vérifiées)
│   ├── landing-ville-*.ts (5 fichiers) → landing locales par ville (cas-usage/eco/ecosystem/faq/secteurs)
│   ├── v7-phase8-generators.ts        → 12 types déclaratifs (long_tail/pain_point/vs/alternative/top_x/
│   │   + v7-phase8-shared.ts            how_to/best_for/calculator_roi/glossary/what_is_x/faq_geo/case_study)
│   ├── seo-content-kind.ts            → mapping type→contentKind (cible longueur scorer)
│   ├── index.ts / registered-types.ts / types.ts → registre getGenerator
│   └── ville-hub-copy.ts, anti-duplicate-check.ts
├── quality/                           → GATES + scoring | appelé par : content-gen-worker
│   ├── seo-score.ts                   → score SEO déterministe /100 (13 critères)
│   ├── article-quality.ts             → qualityFromScores + articlePageSeoDefaults + readabilityFit
│   ├── readability.ts, doctrine-check.ts, plagiarism.ts, soft-404-gate.ts
│   ├── benefit-concreteness-gate.ts, benefit-judge-llm.ts, data-quality-gate.ts
│   ├── multi-judge-ensemble.ts, originality-ai-client.ts, search-intent-validator.ts
│   ├── outline-validator.ts, dedup-guard.ts, price-gate.ts
├── shared/ (21)                       → helpers transverses (expand-outline-chunked, generation-log,
│                                          faq-items, keyword-match, article-quality helpers…)
├── providers/ (7)                     → clients LLM (router OpenAI/Anthropic, retry, cost)
├── kb/ (9) + kb-client/feeder/health  → Knowledge Base RAG (retrieve vectoriel, ingest)
├── links/ (10)                        → catalogue liens internes/externes (injectInternalLinks,
│                                          appendSourcesSection, ALL_EXTERNAL_LINKS ~2400 vérifiés)
├── dedup/ (5)                         → empreintes topic/outline (Hamming)
├── keywords/ + keyword-selector.ts    → pool mots-clés (table `keywords`, rotation cluster-aware, intent)
│   + keyword-templates.ts               + génération géo à la volée
├── blog/ (4)                          → loader.ts (loadBlogArticleForView), category-loader,
│                                          resolve-article-route, slug-history
├── guides/, local/, villes/, profiles/, reviewer/, seo/, scheduler/, lifecycle/, linguistic/,
│   provenance/, fact-check/, brand/, images/, indexing/  → modules spécialisés
├── prompt-augmentation.ts             → pain-matrix sectorielle (gated QUALITY_PROFILES_ENABLED)
├── template-resolver.ts, tombstone.ts, audit-log.ts, slug-history.ts
└── README.md

src/server/queue/workers/             → ~45 workers BullMQ | état : actif
├── content-orchestrator-worker.ts     → crée les ContentGenJob d'une campagne (échantillonnage multi-axes)
├── content-gen-worker.ts              → CŒUR : génère + applique les gates (concurrence 5-10)
├── content-publish-worker.ts          → crée Article + ArticleTranslation + citations + tier
├── content-quality-improver-worker.ts → 2e passe si sous-seuil (maxAttemptsAuto)
├── content-scheduler/deadline/refresh/tier-lifecycle/news-lifecycle/fact-check-worker
├── content-rss-fetch / qa-extract / keyword-sync / similarity-monitor / monitoring
├── content-google-indexing / indexnow / psi-monitor / web-vitals-monitor / weekly-report
├── gsc-hcu-monitor / site-route-{discovery,inspector,gsc,anomaly-detector}
├── image-bank-{import,enrich,translate,auto-convert,crons}  → banque d'images
└── (hors content : booking, qualiopi, email, observatoire, retention, embeddings…)

src/app/[locale]/                      → rendu public (App Router, ISR) | next-intl, EN désactivé→301 FR
├── blog/[slug]/page.tsx               → détail article (DB-first + FS fallback) + JSON-LD + generateMetadata
├── blog/page.tsx                      → fil chronologique (paginé 20/page)
├── blog/categorie/[slug]/page.tsx     → fil d'une catégorie (DB+FS merge, filtre client)
├── blog/categorie/page.tsx            → index des 5 catégories (taxonomie)
├── blog/{auteur,secteur,service,tag,taille}/[slug] → facettes taxonomiques (FS)
├── blog/feed.xml                      → flux RSS blog
├── guides/[slug], actualites/[slug], connaissances/[slug], glossaire, comparaisons, cas-concrets,
│   secteurs, ressources  → autres hubs de contenu
└── <ADMIN_PREFIX>/…                   → console admin (segment = secret env)

src/components/                        → marketing/ (ArticleCard, Cta…), blog/ (CategoryArticlesFilter,
                                          BlogSearch, ArticleFaq…), layout/ (Section, Header), ui/
src/lib/                               → seo.ts (factory metadata + JSON-LD), prisma.ts (stub-aware),
                                          redis.ts (stub-aware), i18n/, csp.ts, slug.ts, brand.ts
src/proxy.ts                           → middleware Next 16 : auth + i18n + redirects (EN→FR, legacy) + CSP + cache-strip
prisma/schema.prisma                   → modèles (Article, ArticleTranslation, ContentGenJob, Keyword,
                                          Category, ContentCitation, ExternalReference, CoverageCampaign,
                                          GenerationLog, ArticleSlugHistory, ArticleTombstone…)
prisma/seeds/content-gen/              → seeds (keywords 747+, content-gen-config, content types)
```

---

## DÉPENDANCES CLÉS (qui appelle quoi)

| Module                        | Appelle                                                                                    | Appelé par                          |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| `content-orchestrator-worker` | `createJobForSlot` → `prisma.contentGenJob.create` + queue                                 | scheduler/cron, campagnes           |
| `content-gen-worker`          | `getGenerator`, `selectKeywordRich`, KB retrieve, gates (quality/\*), `acquireKeywordLock` | queue `content-gen`                 |
| générateurs                   | providers LLM, KB, links, `computeSeoScore`, `checkDoctrine`, `appendSourcesSection`       | `content-gen-worker`                |
| `content-publish-worker`      | `prisma.article*.create`, `persist-citations`, `resolveArticleRoute`                       | queue `content-publish`             |
| `blog/[slug]/page.tsx`        | `loadBlogArticleForView` (loader.ts), `buildArticleMetadata` (seo.ts), JSON-LD builders    | Next ISR/runtime                    |
| `keyword-selector`            | `prisma.$queryRaw` (table `keywords`), seeds in-memory fallback                            | `content-gen-worker`                |
| `seo.ts`                      | — (factory pure)                                                                           | toutes les pages (generateMetadata) |

---

## ÉTAT APPARENT PAR ZONE

| Zone                                   | État                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| Génération (générateurs + gates)       | ✅ très mature, dense, bien testé (>1000 tests content-gen)                                 |
| Sélection mots-clés (table `keywords`) | ✅ pool câblé (rotation/usage) ; ⚠️ métadonnées intent en vocabulaire FR non-enum (voir 01) |
| Qualité / scoring                      | ✅ déterministe, multi-juges ; quelques mesures fines à ajuster (voir 02)                   |
| Publication                            | ✅ fonctionnel (troncature défensive, citations, tier)                                      |
| Rendu frontend                         | ✅ ISR + JSON-LD + sanitize ; colonnes OG dormantes (voir 02/07)                            |
| Console admin                          | ✅ refonte UX récente (6 pôles + wizard)                                                    |
| Indexation/sitemap                     | ✅ runtime + IndexNow + GSC ; sensible au build stub (voir 06)                              |
| Laravel/PHP                            | ❌ ABSENT (stack Next.js/Prisma)                                                            |

_(Détail des problèmes par sévérité dans les fichiers 01→07.)_
