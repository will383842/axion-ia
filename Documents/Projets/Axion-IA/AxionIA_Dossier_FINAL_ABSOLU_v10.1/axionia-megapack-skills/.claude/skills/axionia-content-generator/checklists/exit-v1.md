# EXIT V1 checklist — Sprint 6 GO/NEAR-GO/NO-GO

> Reference: § 22 of master prompt. Score gate: ≥ 160/200 = GO.

## DB & infra

- [ ] Migration `add_content_gen_core` applied prod without error (incl. `AuthorProfile`, `BannedPhrase` tables)
- [ ] Migration `add_rss_pipeline` applied prod without error
- [ ] Extension `pgvector` enabled prod Postgres
- [ ] Seeds idempotent (run 2× = same result), incl. seed `AuthorProfile[slug=manon]` from Q13
- [ ] `.env.local` + Coolify env vars synced (5 new vars)
- [ ] `pnpm content-gen:isolation-check` PASS (aucun fichier hors zones)
- [ ] `pnpm content-gen:exit-check` score 80/80

## Providers

- [ ] OpenAI text functional
- [ ] OpenAI image functional (`gpt-image-1` or `dall-e-3` fallback)
- [ ] Anthropic fallback tested (simulate OpenAI 503 → Claude responds)
- [ ] Perplexity Sonar functional
- [ ] Unsplash functional
- [ ] Toggle ON/OFF per provider from admin OK
- [ ] Cost cap hit → kill switch auto-activated (simulated test)

## Generators (9 types V1)

- [ ] `landing_ville` : 1 ville test (ex Lyon) → copy.ts generated + valid JSON-LD
- [ ] `blog_from_title` : 1 generated
- [ ] `blog_from_keywords` : 1 generated
- [ ] `blog_from_rss` : 1 generated
- [ ] `blog_from_pillar` : 1 generated
- [ ] `comparison` : 1 generated
- [ ] `guide_pilier` : 1 generated (with STOP & ASK outline)
- [ ] `qa_derived` : 1 generated from existing article
- [ ] `faq_standalone` : 1 generated + DB FAQ table row

## Quality

- [ ] Plagiarism Jaccard functional
- [ ] Dedup-guard pre-AI functional
- [ ] Doctrine check passing 3 test cases
- [ ] SEO score deterministic
- [ ] Readability FR computed

## KB (read-only consumption)

- [ ] `kb-client.ts` exports only `retrieve`, `rerank`, `getKbHealth` (no write methods, tested)
- [ ] Hard gate ≥ 300 chunks active and tested
- [ ] Retrieve cosine top-K functional p95 < 500 ms
- [ ] Canonical boost effective
- [ ] `KB_BYPASS=true` mode tested and clearly banner-flagged in admin

## SEO/AEO/GEO (perfection)

- [ ] § 9.7 checklist (60 items) at 100 % on 3 pilots (1 landing ville + 1 article + 1 guide)
- [ ] 32 `<head>` tags present (HTML validator)
- [ ] 14 Open Graph present
- [ ] 7 Twitter Cards present
- [ ] 4 Geo meta on landings villes
- [ ] Heading hierarchy strict (1×H1, 3-8×H2, no H5+)
- [ ] Semantic HTML5 compliant
- [ ] WCAG 2.2 AA compliant
- [ ] JSON-LD blocks per type implemented + Rich Results Test valid
- [ ] Direct answer + TL;DR + Key Facts + TOC always present
- [ ] FAQ Speakable JSON-LD OK
- [ ] Sitemap split per type, tier-1 only, FR-only
- [ ] llms.txt dynamic at root + `.md` machine-readable variants for tier-1
- [ ] hreflang FR-only + x-default compliant
- [ ] robots conditional per tier OK

## Author Manon (100 % admin-pilotable v1.5)

- [ ] Page `/fr/equipe/manon` created, indexable tier-1
- [ ] Photo Manon 3 AVIF variants (80, 256, 1024) in `public/auteurs/`
- [ ] `buildPersonManonJsonLd()` lit table `AuthorProfile[slug=manon]` (pas hardcoded)
- [ ] Admin page `/[adminPrefix]/content-gen/author/manon` permet edit nom/photo/bio/LinkedIn/Twitter/awards
- [ ] All `Article.author` reference Manon by `@id`
- [ ] Byline top + author card bottom on each generated piece
- [ ] `rel="author"` links to `/fr/equipe/manon`
- [ ] revalidatePath `/fr/equipe/manon` à chaque save admin

## Mobile-first & Web Vitals

- [ ] Lighthouse local PASS budget on 5 pilots
- [ ] LCP ≤ 1 800 ms p75
- [ ] INP ≤ 100 ms p75 (150 ms exception for generated)
- [ ] CLS = 0 strict
- [ ] First Load JS ≤ 75 KB gz/route
- [ ] AVIF + WebP + JPG + srcset 3 variants
- [ ] `width`/`height` mandatory anti-CLS
- [ ] LCP image `fetchpriority="high"` + preload
- [ ] `content-visibility: auto` below-fold
- [ ] web-vitals RUM wired
- [ ] Touch targets ≥ 44×44
- [ ] Reading 60-75 chars/line, ≥ 16 px body

## Génération speed (§ 9.11)

- [ ] Anti-waterfall implemented (parallel KB + Perplexity + SSOT load)
- [ ] LLM streaming functional (text streaming + early image gen trigger)
- [ ] Anthropic prompt caching active, cache hit rate ≥ 70 % in batch mode
- [ ] OpenAI prompt caching exploited (stable prefix in head)
- [ ] Circuit breaker on provider down (≤ 1 s detection)
- [ ] BullMQ concurrency=5, rate limits respected
- [ ] SSE realtime UI admin (`<JobLogStream>`)
- [ ] SLO p50 landing ville ≤ 90 s, p95 ≤ 150 s achieved
- [ ] SLO p50 blog article 1500 mots ≤ 40 s

## Queue & monitoring

- [ ] 4 workers running (`pnpm worker`)
- [ ] BullMQ rate-limit respected
- [ ] Sentry captures errors
- [ ] Plausible events fired
- [ ] Telegram alerts wired (3 cases tested)
- [ ] Cron retention tier-3 90d running

## Tests

- [ ] `pnpm verify:all` PASS
- [ ] Unit tests ≥ 80 % coverage `src/server/content-gen/`
- [ ] E2E Playwright 3 scenarios PASS
- [ ] JSON-LD snapshots PASS

## Docs

- [ ] ADR 0012 merged
- [ ] CLAUDE.md root « Content Generator » section added
- [ ] `_AUDIT/CONTENT-GEN-V1-CHANGELOG.md` written
- [ ] `src/server/content-gen/README.md`
- [ ] `_AUDIT/02-PLAN.md` updated

## Security

- [ ] Admin role restricted (super_admin V1 or editor_ai)
- [ ] CSP nonce respected
- [ ] HTML sanitised before DB insert (DOMPurify)
- [ ] No PII client leaks in prompts
- [ ] No secrets in commits
- [ ] RGPD: prompts logged but PII redacted (`pii-redaction.ts` reused)

## 🆕 v1.7/v1.8 — Campagnes de couverture (§ 25)

- [ ] Tables `CoverageCampaign`, `CoverageDistributionProfile`, `AudienceMixProfile` créées + seeds (3 profils distribution + 4 profils audience)
- [ ] Admin `/coverage/new` : sélecteur périmètre + sliders distribution + matrice audiences + preview coût + bouton Lancer
- [ ] Admin `/coverage/[id]` : burndown chart + boutons Pause/Resume/Cancel + live SSE
- [ ] Test E2E : 1 campagne Lyon 20 contenus → exécution complète + distribution réelle vs planifiée ≤ ±5 %
- [ ] Multi-campagnes parallèles (2 simultanées sans conflit)

## 🆕 v1.7/v1.8 — Intention de recherche (§ 26)

- [ ] Enum `SearchIntent` (5 values) en Prisma
- [ ] `ContentGenJob.targetSearchIntent` requis NOT NULL
- [ ] 9 generators consomment `searchIntent` en system prompt
- [ ] Validation `posts:validate` étendue : alignement slug/meta/CTA/JSON-LD par intent
- [ ] Test : 4 contenus 4 intents distincts → alignement vérifié
- [ ] Admin `/settings/search-intent-distribution` sliders somme = 100 %

## 🆕 v1.7/v1.8 — Boucle d'amélioration qualité (§ 27)

- [ ] Worker `content-quality-improver-worker` concurrency 3
- [ ] Toggle `/settings/quality-loop` fonctionnel + seuils + cost cap
- [ ] Test : 1 contenu score 65 → re-prompt section faible → score > 75 → review-queue tier-1
- [ ] Status `quality_improving` apparaît dans logs ContentGenJob
- [ ] Max 2 passages auto respecté
- [ ] Cost cap mensuel boucle qualité respecté

## 🆕 v1.7/v1.8 — Pipeline 2 Actualités RSS (§ 28)

- [ ] Route `/fr/actualites/[slug]` créée
- [ ] Generator `blog_from_rss` émet `NewsArticle` JSON-LD (pas Article)
- [ ] Extension Article : isNews + newsSourceUrl + newsSourceName + newsCategory + publishedAtDateline
- [ ] Sitemap `sitemap-news.xml` séparé, lastmod seconde
- [ ] Worker `news-lifecycle-worker` cron 05:00 (rétrogradation J+30 si CTR < 2 %)
- [ ] Test E2E : 1 RSS → génération → publication tier-2 auto score ≥ 60 → NewsArticle + sitemap-news + citation source

## 🆕 v1.7/v1.8 — Q/R post-process automatique (§ 29)

- [ ] Hook post-process déclenché sur landing/blog/comparatif/guide/faq-standalone complétés
- [ ] 8 micro-jobs `qa_extract_and_publish` enqueue par contenu parent
- [ ] Route `/fr/[locale]/faq/[slug]/page.tsx` créée
- [ ] Extension FAQ Prisma : slug, parentArticleId, enrichmentContext, indexationTier, qualityScore, viewCount, publishedAt, isAutoGenerated
- [ ] Test : 1 article → 8 pages /fr/faq/[slug] créées + indexables tier-2
- [ ] Chaque page Q/R ≥ 300 mots (anti-thin)
- [ ] JSON-LD QAPage + Speakable + Person Manon + BreadcrumbList
- [ ] Sitemap `sitemap-faq.xml` chunked à 1 000
- [ ] Admin `/settings/qa-policies` toggle + seuils

## 🆕 v1.7/v1.8 — Anti-doublon 4 couches durci (§ 25.5)

- [ ] Couche A : Levenshtein 0.85 vs 5 000 titres + topic fingerprint + cosine 0.85 + exception multi-audiences
- [ ] Couche B : Jaccard ≥ 0.30 → re-write (déjà v1.5)
- [ ] **Couche C** : `similarity-monitor-worker` quotidien 04:30 + admin `/similarity-monitor` (top 100 paires + bulk archive/merge/ignore)
- [ ] **Couche D** time decay : test re-gen même topic mois 6 → BLOQUE (12 mois min)

## 🆕 v1.7/v1.8 — Dashboard Kanban Publications (§ 12.1)

- [ ] Admin `/publications-status` 5 colonnes (Brouillon / En revue / Approuvé / Publié / Refusé)
- [ ] Filtres : type / tier / ville / dépt / campagne / audience / score / date
- [ ] Bulk approve ≥ 75 + reject < 50 + retry failed + archive drafts > 30j testés
- [ ] Export CSV fonctionnel
- [ ] KPIs : rate publish/jour + time-to-publish moyen + score moyen
- [ ] Drag & drop entre colonnes (changement statut)

## 🆕 v1.7/v1.8 — Pilotage admin v1.7 (§ 12.5 tableau 27 réglages)

- [ ] `/settings/coverage-distribution` sliders 5 types
- [ ] `/settings/audience-mix` matrice taille × organisation
- [ ] `/settings/search-intent-distribution` sliders 5 intents
- [ ] `/settings/quality-loop` toggle + seuils
- [ ] `/settings/qa-policies` toggle Q/R + CTR seuil
- [ ] `/similarity-monitor` anti-doublon couche C
- [ ] `/publications-status` kanban
- [ ] `/coverage` campagnes CRUD
- [ ] `/orchestrator` vue globale
- [ ] `/author/manon` profil Manon éditable
- [ ] `/landing-variants` activation/override variants
- [ ] `/settings/banned-phrases` CRUD phrases interdites

## Pass B final audit

- [ ] 5 parallel agents audit on V1 (incl. axes v1.7 : campagnes, intent, qualité, NewsArticle, Q/R, similarity, kanban)
- [ ] Score ≥ 160/200
- [ ] Verdict 🟢 GO or 🟡 NEAR-GO (with corrective sprint fixed)
- [ ] `pnpm content-gen:exit-check` score ≥ 95 % (sur 100+ items)
