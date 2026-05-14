# Plan Sprint 1 Day-by-Day — Content Generator V1

> **Sprint 1 = Foundations DB + Providers + Quality core + SEO factories** (7 jours).
> Timeline horaire détaillée + commits Conventional ordonnés + DAG dépendances inter-agents.
> Référence master prompt § 17.

## Vue d'ensemble

- **8 agents parallèles** : AGT-A (DB), AGT-B (Providers), AGT-E (Quality), AGT-F (SEO factories) en S1. Les AGT-C/D/G/H démarrent en S2+.
- **Dépendances dures** :
  - AGT-A doit livrer **migration appliquée** avant que B/E/F puissent importer types Prisma
  - AGT-B doit livrer **interface IProvider** avant que générateurs (Sprint 2) puissent l'utiliser
  - AGT-F doit livrer **enums + Person Manon JSON-LD factory** avant que générateurs (Sprint 2) puissent émettre JSON-LD

## Jour 1 — Foundations DB schema + SDK installs

### 09:00 — 10:00 — Phase 0 reality-check (master prompt § 2.1)

Vérifie présence : Prisma 5.22, BullMQ, `regions.ts`, `villes/data/*.ts`, layout admin, `src/lib/seo.ts`, env.ts Zod schema. Bloquer si KO.

→ commit : `chore(content-gen): phase 0 reality-check ok`

### 10:00 — 12:00 — AGT-A : Migration Prisma v1.7 complète

Fichier : `prisma/migrations/20260601000000_add_content_gen_core/migration.sql`

Tables à créer (dans cet ordre pour respecter FK) :
1. Enums : `ContentType`, `ContentGenJobStatus`, `LogLevel`, `IndexationTier`, `Locale`, `ExpansionMode`, `ProviderKey`, `ProviderRole`, `ReviewStatus`, `KbSource`, `CoverageStatus`, `CoverageScope`, `CompanySize`, `OrganisationType`, `SearchIntent`
2. `ContentGenConfig`
3. `ProviderConfig`
4. `ContentTemplate` (avec ExpansionMode + variant)
5. `KbDocument` + `KbChunk` (commentaire : alimenté par outil KB externe)
6. `AuthorProfile` (Manon)
7. `BannedPhrase`
8. `CoverageDistributionProfile`
9. `AudienceMixProfile`
10. `CoverageCampaign`
11. `ContentGenJob` (FK vers CoverageCampaign + ContentTemplate, searchIntent NOT NULL)
12. `GenerationLog` (FK ContentGenJob)
13. `ReviewQueue` (FK ContentGenJob)
14. `CostLedger`
15. `ContentMetric`
16. Extension `FAQ` (ALTER TABLE)
17. Extension `Article` (ALTER TABLE)
18. Index pgvector HNSW sur `KbChunk.embedding`

→ commit : `feat(content-gen): prisma migration add_content_gen_core v1.7`

### 12:00 — 13:00 — Pause déjeuner

### 13:00 — 15:00 — AGT-A : Seeds idempotents

Fichier : `prisma/seeds/content-gen/index.ts` + sous-modules :
- `provider-config.ts` : 5 rows (openai-text, openai-image, anthropic-text, perplexity-data, unsplash-stock)
- `content-templates.ts` : 9 templates (1 par ContentType) + variantes landing-ville × 6
- `coverage-distribution-profiles.ts` : 3 profils (Mix premium 2026, Mix industrie, Mix tertiaire)
- `audience-mix-profiles.ts` : 4 profils (Mixte équilibré DÉFAUT, Tertiaire urbain, Industriel régional, Public et parapublic)
- `author-profile.ts` : 1 row Manon (Q13 INPUT WILL — bio + photo + LinkedIn + Twitter)
- `banned-phrases.ts` : phrases interdites de doctrine (« unique », « le meilleur », « révolutionnaire », SIREN, etc.)
- `rss-sources.ts` : 5 sources (LeMondeInfo, ZDNet FR, Usine Digitale, JournalDuNet, Frenchweb)

Tous en upsert idempotent. Test : run 2× = même résultat.

→ commit : `feat(content-gen): seeds idempotents content-gen + Manon + RSS + distribution profiles`

### 15:00 — 16:30 — AGT-B (parallèle) : SDK installs + package.json

`pnpm add openai@^4.80.0 @anthropic-ai/sdk@^0.40.0 axios isomorphic-dompurify sharp p-limit bullmq`
`pnpm add -D vitest @vitest/coverage-v8 @playwright/test`

Patcher `src/env.ts` Zod schema avec les 5 nouvelles env vars (OPENAI_API_KEY, ANTHROPIC_API_KEY, PERPLEXITY_API_KEY, UNSPLASH_ACCESS_KEY, OPENAI_IMAGE_API_KEY optionnel).

→ commit : `chore(content-gen): install SDKs + env.ts validation Zod`

### 16:30 — 18:00 — AGT-B : Stubs providers + interface IProvider

Fichier : `src/server/content-gen/providers/IProvider.ts` (interface abstraite)
Stubs : `openai.ts`, `anthropic.ts`, `perplexity.ts`, `unsplash.ts`, `openai-image.ts` (uniquement signatures, pas d'impl encore)
Fichier : `src/server/content-gen/providers/provider-router.ts` (squelette)
Fichier : `src/server/content-gen/providers/health-check.ts` (squelette)

→ commit : `feat(content-gen): provider interface + 5 stubs`

### 🎯 Gate fin Jour 1
- ✅ `pnpm prisma migrate deploy` PASS sur DB locale
- ✅ `pnpm prisma generate` types générés
- ✅ `pnpm typecheck` PASS (stubs typés)
- ✅ 4 commits Conventional sur `main`
- ❌ Pas encore de code exécutable (juste squelette)

## Jour 2 — Provider OpenAI + circuit breaker + cost tracking

### 09:00 — 12:00 — AGT-B : Implémentation OpenAI text

Fichier : `src/server/content-gen/providers/openai.ts` complet
- Méthode `generate(req: GenerationRequest)` avec streaming `stream: true`
- Hook `onStreamChunk` pour early-action (déclencher image gen mid-stream)
- Gestion timeout 30 s, retry × 3 backoff exponentiel (10/30/60 s)
- Parsing JSON output strict (Zod validation)
- Tracking cost en `CostLedger` (atomic Prisma transaction)
- Détection content_filter → re-prompt avec note neutre

Tests : `src/server/content-gen/providers/__tests__/openai.spec.ts`
- Mock fetch, vérifier streaming chunks
- Vérifier retry sur 429
- Vérifier cost ledger inséré
- Vérifier timeout fallback

→ commit : `feat(content-gen): OpenAI provider with streaming + retry + cost tracking`

### 12:00 — 13:00 — Pause

### 13:00 — 16:00 — AGT-B : Provider Anthropic + Perplexity + Unsplash

Implémentation similaire à OpenAI, mais avec :
- Anthropic : prompt caching `cache_control: ephemeral` (cf. § 9.11.3)
- Perplexity : `search_recency_filter`, citations extraites
- Unsplash : rate-limit Redis `unsplash:rate:{Y-m-d-H}`, srcset auto, attribution

→ 3 commits : `feat(content-gen): {anthropic | perplexity | unsplash} provider`

### 16:00 — 18:00 — AGT-B : Provider router + circuit breaker

Fichier : `src/server/content-gen/providers/provider-router.ts`
- Fonction `generate(req)` qui route selon role + primary/fallback
- Cost cap check pré-call (assertion DB)
- Health check Redis cached 60s
- Circuit breaker `opossum`-style (5 erreurs / 30 s → ouvert 60 s)
- État partagé Redis (tous les workers voient le même circuit)

Tests : simuler OpenAI 503 → fallback Claude automatique en < 1 s.

→ commit : `feat(content-gen): provider router + circuit breaker shared Redis state`

### 🎯 Gate fin Jour 2
- ✅ 4 providers fonctionnels (1 call live OpenAI réel test PASS)
- ✅ Fallback testé (simuler OpenAI 503 → Claude répond < 1 s)
- ✅ Cost tracking testé (1 call → row dans `CostLedger`)
- ✅ Unit tests coverage providers ≥ 80 %

## Jour 3 — Quality core + SEO factories

### 09:00 — 12:00 — AGT-E (parallèle Jour 1-2) : Modules quality

Tous dans `src/server/content-gen/quality/` :

1. **`dedup-guard.ts`** (4 couches v1.7) :
   - Title Levenshtein 0.85 vs 5 000 derniers
   - Topic fingerprint (hash 8-12 KW)
   - Embedding cosine 0.85 (via OpenAI text-embedding-3-small)
   - Exception multi-audiences (couple taille × organisation)
   - Time decay 12 mois

2. **`plagiarism.ts`** :
   - Shingling 5-gram + Jaccard similarity
   - Seuil interne 0.30 → re-write section
   - Seuil RSS 0.10 → re-write strict
   - Top 5 phrases matching loggées

3. **`doctrine-check.ts`** :
   - Anti-SIREN regex (réutiliser script existant)
   - Naming Axion-IA strict (regex « Axion-IA » exact)
   - Banned phrases lookup table `BannedPhrase`
   - Ratio ≥ 95 % AxionIA-centric (heuristic word ratio)

4. **`seo-score.ts`** :
   - Scoring déterministe /100 selon grille § 10.2 (13 critères pondérés)
   - Validation searchIntent alignement (slug pattern + meta verb + CTA position)

5. **`readability.ts`** :
   - Flesch-Kincaid FR formula
   - Score 0-100 (idéal 60-70 pour Axion-IA B2B)

6. **`search-intent-validator.ts`** (v1.7) :
   - Vérifie alignement structure selon intent (cf. § 26.3)
   - Returns warnings array + pass/fail

→ 6 commits successifs : `feat(content-gen): quality {dedup-guard | plagiarism | doctrine-check | seo-score | readability | intent-validator}`

### 12:00 — 13:00 — Pause

### 13:00 — 17:00 — AGT-F : Extension `src/lib/seo.ts` avec factories JSON-LD

Étendre le fichier existant avec :

1. `buildPersonManonJsonLd()` — lit `AuthorProfile[slug=manon]` DB
2. `buildArticleJsonLd({article, manon})`
3. `buildBlogPostingJsonLd()` (variant)
4. `buildTechArticleJsonLd()` (variant)
5. `buildNewsArticleJsonLd({article, manon, source, dateline})` — v1.7 actualités
6. `buildQAPageJsonLd({faqItem, manon, parentArticle})` — v1.7 pages Q/R
7. `buildHowToJsonLd({guide, manon, steps})`
8. `buildSpeakableSpec({cssSelectorsArray})` — testé v1.9 avec Playwright
9. `buildCitationArray({sources})` — pour Perplexity citations
10. `buildIndexNowPayload({urls})` — v1.7 IndexNow

Tests : `src/lib/__tests__/seo.spec.ts` — snapshots JSON-LD pour 9 schemas types.

→ commits successifs (1 par factory) : `feat(seo): build{type}JsonLd factory + test snapshot`

### 17:00 — 18:00 — AGT-F : llms.txt route dynamique

Fichier : `src/app/llms.txt/route.ts`
- Route Next 16 GET retourne llms.txt YAML structuré (spec Anthropic 2026)
- Lit SSOT pricing + manifest pages tier-1 + AuthorProfile Manon
- Cache CF 1h

→ commit : `feat(content-gen): llms.txt dynamic route (Anthropic spec 2026)`

### 🎯 Gate fin Jour 3
- ✅ 6 modules quality fonctionnels + tests
- ✅ 10 factories JSON-LD + 9 snapshots testés
- ✅ llms.txt servi à la racine
- ✅ `pnpm typecheck` PASS
- ✅ Coverage `src/server/content-gen/` ≥ 75 %

## Jour 4 — Image system Unsplash-only + Anti-plagiat live + Doctrine extension

### 09:00 — 12:00 — Système d'images § 8 (Unsplash-only acté Q4 v2.0)

Fichiers (Q4 v2.0 acté Will : **Unsplash uniquement, pas de génération IA d'image**) :
- `src/server/content-gen/images/unsplash-client.ts` (recherche + sélection + attribution photographer)
- `src/server/content-gen/images/image-prompt-builder.ts` (queries Unsplash par type — depuis seed `unsplash-search-queries.json`)
- `src/server/content-gen/images/alt-text-generator.ts` (caption auto + alt accessible)
- `src/server/content-gen/images/image-optimizer.ts` (sharp AVIF/WebP/JPG variants)
- `src/server/content-gen/images/placeholder-fallback.ts` (composant `<IllustrationPlaceholder />` si Unsplash KO)

Tests : 1 recherche Unsplash réelle → vérifier 3 variantes AVIF stockées + attribution photographer dans metadata.

→ commit : `feat(content-gen): image system unsplash + placeholder fallback + sharp AVIF/WebP`

### 12:00 — 13:00 — Pause

### 13:00 — 16:00 — AGT-E : Embeddings + KB Health check

Fichier : `src/server/content-gen/kb-client.ts` (READ-ONLY strict — pas de write)
- `retrieve(opts)` : query → embed → pgvector cosine top-K → rerank
- `rerank()` : heuristic boost canonical (V1) ou cross-encoder (V2)
- `getKbHealth()` : count chunks, canonical ratio, lastIngestAt

Mock KB pour tests (KB_BYPASS = true). Test du hard gate (< 300 chunks → throw `KB_NOT_READY`).

→ commit : `feat(content-gen): kb-client read-only + health gate + bypass mode`

### 16:00 — 18:00 — Doctrine extras + scripts CI

Scripts dans `scripts/content-gen/` :
- `isolation-check.ts` (fail si fichier hors 9 dossiers DÉDIÉS § 4.1bis)
- `html-audit.ts` (60+ items § 9.7 sur URL rendue)
- `hreflang-check.ts` (FR-only)
- `posts-validate.ts` étendu (doctrine + intent alignment)

Ajouter au `package.json` : 8 scripts `content-gen:*` (cf. annexe B master prompt).

→ commit : `feat(content-gen): CI scripts isolation-check + html-audit + hreflang-check + posts-validate`

### 🎯 Gate fin Jour 4
- ✅ Image gen live OpenAI → 1 image AVIF générée OK
- ✅ KB client tests (bypass mode + hard gate)
- ✅ Scripts CI run PASS (`pnpm content-gen:isolation-check` sur diff actuel)

## Jour 5 — Tests integration providers + cost cap + kill switch

### 09:00 — 12:00 — Test cost cap end-to-end

Scénario test :
1. Set `ProviderConfig[openai-text].monthlyCapUsd = $1`
2. Lancer 5 mini-générations
3. À la 3ᵉ, cap atteint → assertion exception `COST_CAP_REACHED`
4. Kill switch auto activé : `Setting.CONTENT_GEN_KILL_SWITCH = true`
5. 6ᵉ tentative → bloquée immédiatement
6. Telegram alert envoyée (mock)

→ commit : `test(content-gen): cost cap + kill switch end-to-end`

### 12:00 — 13:00 — Pause

### 13:00 — 16:00 — Test circuit breaker provider down

Scénario :
1. Mock OpenAI à retourner 503 sur 5 calls consécutifs
2. Vérifier circuit ouvert après 5 erreurs en < 30 s
3. Vérifier fallback Claude actif immédiatement
4. Attendre 60 s → vérifier état half-open
5. Mock OpenAI à retourner 200 → vérifier circuit fermé

→ commit : `test(content-gen): circuit breaker open/half-open/close cycle`

### 16:00 — 18:00 — Tests rate-limit BullMQ

Scénario :
1. Submit 20 jobs en 30 s avec rate-limit 50/min
2. Vérifier au max 25 jobs traités en 30 s (10/30s + buffer)
3. Pas de saturation provider

→ commit : `test(content-gen): bullmq rate-limit respected per provider`

### 🎯 Gate fin Jour 5
- ✅ Tests cost cap PASS
- ✅ Tests circuit breaker PASS
- ✅ Tests rate-limit BullMQ PASS

## Jour 6 — Documentation Sprint 1 + commit final

### 09:00 — 12:00 — Documentation

Fichiers à créer :
- `src/server/content-gen/README.md` (overview architecture)
- `docs/content-gen/provider-interface.md` (IProvider + checklist nouveau provider)
- `docs/content-gen/quality-modules.md` (6 modules décrits)
- `tests/content-gen/TESTING.md` (patterns vitest + mocks + snapshots)

→ commit : `docs(content-gen): README + provider interface + quality + testing patterns`

### 12:00 — 13:00 — Pause

### 13:00 — 16:00 — Run final Sprint 1 gates

Lancer en série :
1. `pnpm prisma migrate deploy` PROD-like
2. `pnpm typecheck`
3. `pnpm test:unit src/server/content-gen/` → coverage ≥ 80 %
4. `pnpm content-gen:isolation-check`
5. `pnpm verify:all`
6. `pnpm build` (Next 16)

Si tous PASS → commit goal Sprint 1.

→ commit : `feat(content-gen): foundations DB + providers + quality core + v1.7 tables (Sprint 1 complete)`

### 16:00 — 18:00 — Push origin/main + Coolify deploy

Workflow `.github/workflows/deploy-coolify.yml` se déclenche automatiquement sur push main.
Vérifier deploy Coolify OK + migrations appliquées en prod.

→ commit : `chore(content-gen): sprint 1 deploy prod` (vide ou notes release)

### 🎯 Gate Sprint 1 final
- ✅ `pnpm verify:all` PASS
- ✅ Migration appliquée prod sans erreur
- ✅ 1 call provider live PROD test OK
- ✅ Coolify deploy auto-réussi
- ✅ Coverage `src/server/content-gen/` ≥ 80 %
- ✅ 30+ commits Conventional sur main
- ✅ Log autopilote mis à jour `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md`

## Jour 7 — Buffer / rattrapage / pré-Sprint 2

Réservé pour :
- Fixes de derniers gaps détectés en fin Sprint 1
- Run final tests régression
- Préparer Sprint 2 (lecture sub-prompt landing-ville.md + setup tests E2E Playwright)
- Documentation manquante

Si Sprint 1 OK en 6 j, libère 1 j d'avance pour S2.

## DAG dépendances inter-agents

```
[Phase 0 reality-check] ───┐
                            ▼
[AGT-A Day 1 — migrations + seeds] ──────────┐
                                              │ (types Prisma générés requis)
                                              ▼
              ┌─────────────────────────────────────────────┐
              │                                             │
[AGT-B Day 1-2 — providers + router]    [AGT-E Day 3 — quality + intent-validator]
              │                                             │
              │                                             │
[AGT-F Day 3 — SEO factories + llms.txt] (besoin enums Prisma de AGT-A)
              │
              ▼
[Day 4 — Images + KB client + scripts CI]  (peuvent démarrer dès Day 3 fin)
              │
              ▼
[Day 5 — Tests integration]  (besoin AGT-B + AGT-E livrés)
              │
              ▼
[Day 6 — Docs + final gate]
              │
              ▼
[Day 7 — Buffer ou pré-S2]
```

## Liste exhaustive commits attendus Sprint 1

1. `chore(content-gen): phase 0 reality-check ok`
2. `feat(content-gen): prisma migration add_content_gen_core v1.7`
3. `feat(content-gen): seeds idempotents content-gen + Manon + RSS + distribution profiles`
4. `chore(content-gen): install SDKs + env.ts validation Zod`
5. `feat(content-gen): provider interface + 5 stubs`
6. `feat(content-gen): OpenAI provider with streaming + retry + cost tracking`
7. `feat(content-gen): Anthropic provider with prompt caching`
8. `feat(content-gen): Perplexity provider + citations extraction`
9. `feat(content-gen): Unsplash provider + rate-limit Redis + srcset`
10. `feat(content-gen): provider router + circuit breaker shared Redis state`
11. `feat(content-gen): quality dedup-guard (4 layers v1.7)`
12. `feat(content-gen): quality plagiarism shingling Jaccard`
13. `feat(content-gen): quality doctrine-check + banned phrases lookup`
14. `feat(content-gen): quality seo-score 13 criteria weighted`
15. `feat(content-gen): quality readability Flesch FR`
16. `feat(content-gen): quality search-intent-validator (v1.7)`
17. `feat(seo): buildPersonManonJsonLd + buildArticleJsonLd + variants`
18. `feat(seo): buildNewsArticleJsonLd v1.7 (dateline + printSection)`
19. `feat(seo): buildQAPageJsonLd v1.7 (Speakable cssSelector)`
20. `feat(seo): buildHowToJsonLd + buildCitationArray + buildIndexNowPayload`
21. `feat(content-gen): llms.txt dynamic route (Anthropic spec 2026)`
22. `feat(content-gen): image system gpt-image-1 + unsplash + sharp variants`
23. `feat(content-gen): kb-client read-only + health gate + bypass mode`
24. `feat(content-gen): CI scripts isolation-check + html-audit + hreflang-check`
25. `test(content-gen): cost cap + kill switch end-to-end`
26. `test(content-gen): circuit breaker open/half-open/close cycle`
27. `test(content-gen): bullmq rate-limit respected per provider`
28. `docs(content-gen): README + provider interface + quality + testing patterns`
29. `feat(content-gen): foundations DB + providers + quality core + v1.7 tables (Sprint 1 complete)`
30. `chore(content-gen): sprint 1 deploy prod`

**Total : 30 commits Sprint 1.**

## Critères STOP durci pendant Sprint 1

Si l'un de ces critères se produit, **STOP immédiat + remontée Will** :

- Migration Prisma destructive détectée (DROP / ALTER avec data loss sur tables existantes)
- 3 commits failed consécutifs sur un même module
- Coût Claude API session > $80 (au-delà budget moyen S1)
- Provider live test échoue 3 fois de suite (probablement clé API invalide)
- KB_BYPASS=false ET aucune KB détectée (oubli config Will)
- Modification SSOT (`pricing.ts`, `regions.ts`, `interventions.ts`) sans STOP & ASK

Hors ces cas, l'autopilote continue selon le plan.
