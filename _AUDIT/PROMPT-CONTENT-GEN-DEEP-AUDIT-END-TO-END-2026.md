---
name: PROMPT-CONTENT-GEN-DEEP-AUDIT-END-TO-END-2026
version: 2.0 (auto-révisée — 11 manques V1.0 comblés)
owner: Will (Axion-IA OÜ)
mode: AUTOPILOT AUDIT-ONLY STRICT
created: 2026-05-18
intended_use: À copier-coller tel quel dans une NOUVELLE conversation pour audit profond
---

# 🔬 PROMPT MASTER V2.0 — AUDIT END-TO-END CONTENT-GEN AXION-IA

> Self-contained. La nouvelle conversation n'a aucune mémoire des sessions précédentes. Tout est ici.

---

## 0. RÈGLES ABSOLUES (NE JAMAIS VIOLER)

🚫 **AUDIT-ONLY STRICT** :

- **AUCUNE** modification de code, fichier `.ts`, `.tsx`, `.prisma`, `.json`, `.yml`
- **AUCUN** `git add`, `git commit`, `git push`, `git stash`, `git reset`
- **AUCUNE** exécution de migration Prisma
- **AUCUN** redémarrage de service, worker, Docker
- **AUCUNE** mutation DB
- ✅ **AUTORISÉ** : lecture (Read, Grep, Glob), `git status`, `git log`, `git diff`, `git show`, `pnpm typecheck`, `pnpm vitest run`, `pnpm lint`, écriture **uniquement** dans `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/`

🎯 **Objectif** : Will veut un rapport complet, pédagogique, visuel, factuel, qui couvre TOUT le content-gen + workers + admin UI + monitoring + villes/départements/régions + 11 croisements pour s'assurer qu'il n'y a aucune erreur cachée.

📋 **Sortie attendue** : ≥ 22 fichiers markdown dans `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/` (cf §13 livrables).

---

## 1. CONTEXTE PROJET FIGÉ (à confirmer en début d'audit)

### Stack technique

- Next.js 16 App Router (standalone) + React 19 + TypeScript strict
- Prisma 5.22 + Postgres 16 + Redis 7 + BullMQ
- Hetzner CPX42 (8c/16GB/320GB/fsn1) + Coolify + Caddy 2 + Cloudflare Free
- Bilingue **FR canonique / EN miroir** (EN actuellement disabled via 301 → FR, cf `AGENTS.md` workaround next-intl v4.11 + Next 16.2)
- Hébergement EU (Hetzner Nuremberg), conformité RGPD intégrale

### Working directory

`C:\Users\willi\Documents\Projets\Axion-IA\axionia`

### Branche & HEAD attendu

- Branche : `main`
- HEAD : devrait être ≥ `9c1adaa` (10 commits livrés journée 2026-05-18)
- Si HEAD diverge, lister les commits postérieurs dans le rapport

### Doctrine business à connaître

- **4 verticales canoniques** : `audit`, `interventions`, `implementation`, `un-a-un` (la 4e ajoutée 2026-05-18 Sprint S+2)
- **Naming brand** : "cabinet IA opérationnel" (jamais "agence", "studio", "atelier"). Mot "formation" autorisé en copy mais "intervention" reste canonique (lever ban P1-2 Sprint S+2).
- **Persona éditoriale** : Manon (IA disclosed AI Act art. 50). Page `/équipe/manon` publique, page `/blog/auteur/manon` → 404 doctrine v2.1 (privacy).
- **Anti-doorway HCU 2024** : pages ville sans copy `services.<verticale>` → noindex auto via VilleServicePageTemplate.
- **Soft-404 gate 350 mots** : generator landing-ville force tier_3_noindex_nofollow si wordCount < 350 (ou < 280 si JSON-LD LocalBusiness complet + cas concret local + FAQ ≥ 4).
- **AI Act art. 50** (applicable 2026-08-02) : `Article.aiGenerated:true` + `additionalType: AIGeneratedContent` + `disambiguatingDescription` + Manon `creator` + `usageInfo` → `/équipe/manon`.
- **Review-queue workflow** : tous les articles factory passent par `/admin/[adminPrefix]/content-gen/review-queue`, Will approve manuellement avant publication. Pas d'auto-publish (encore).

### Sprint S+2 City Domination livré 2026-05-18 (référentiel)

- 4e verticale `un-a-un` industrialisée (2150 villes SSG via `VilleServicePageTemplate`)
- Phase C strat ville : `Article.mentionedCities[]` auto-tag villes mentionnées
- Phase D strat ville : `getNearbyVillesExtended` 3 buckets (immediates 30km, sameDepartement, economicArea sameRegion 60km)
- Phase F strat ville : `getNearbyCasesWithFallback` cascade proximity→région→secteur→none

### 10 commits journée 2026-05-18 (référentiel chronologique)

1. `c5d5c20` P0-5 Article.aiGenerated:true JSON-LD
2. `09087f2` P0-12 robots-respect KB ingest (+ coolify ops msg trompeur)
3. `a9d3168` P1 quick wins batch (P1-3/14/27/13/22/30/8)
4. `e4d1128` P1-5 soft-404 + P1-2 Course schema + lever ban formation
5. `34e3c54` P1-6 topicFingerprint + P1-9 audit log SOC2
6. `9ba6945` P1-21 /charte-editoriale + /corrections EEAT
7. `bf02916` Vérification fixes (doctrine-check sync + tests SOC2)
8. `4d9efbf` Sprint S+2 (un-a-un + Phase C/D/F strat ville)
9. `424e9a5` Hotfix mentionedCities publish-worker + footer + mega-menu
10. `9c1adaa` Hotfix hub ville 4e card un-a-un

---

## 2. TYPES DE CONTENU À AUDITER (12 types — V2.0 élargi)

Pour CHAQUE type, produire :

- **Description simple** ≤ 5 lignes, langage non-technique (compréhensible par Will)
- **Flow visuel Mermaid** (briefing → generator → quality → publish → indexation → rendu)
- **Inputs / Outputs** (admin briefing, RSS source, KB data, fields DB, sitemap, IndexNow, etc.)
- **Quality gates** appliqués + leur ordre
- **Tests existants** (count + couverture)
- **Tests manquants** identifiés
- **Erreurs/edge cases** potentielles à vérifier
- **Status global** : 🟢 production-ready / 🟡 V1 partiel / 🔴 stubbed / ⚪ V2 planifié
- **Fichier:ligne** pour chaque assertion

### Type 1 — Articles blog factory (generator standard)

**Generators** : `blog-article.ts`, `blog-from-keywords.ts`, `blog-from-title.ts`, `guide-pilier.ts`, `qa-derived.ts`, `faq-standalone.ts` (6 generators)
**Inputs admin** : briefing via `/admin/[adminPrefix]/content-gen/orchestrator` → choix template + keyword + intent + audience size
**Output cible** : `Article` row DB + `ArticleTranslation` FR + sitemap-blog inclusion + IndexNow ping

### Type 2 — Actualités RSS factory

**Generator** : `blog-from-rss.ts` (génère depuis RSS feed externe → article `isNews=true`)
**Inputs** : sources RSS configurées dans admin `/content-gen/rss` (table `RssSource`)
**Workers** : `content-rss-fetch-worker.ts` (fetch périodique) + `content-gen-worker.ts` (génération)
**Output cible** : `Article.isNews=true` + sitemap-news.xml (fenêtre 48h glissante max 1000 URLs) + Google News namespace `xmlns:news`
**Lifecycle worker** : `content-news-lifecycle-worker.ts` (tombstone après 48h, retire sitemap-news)

### Type 3 — Landing pages ville × service (4 verticales)

**Generator** : `landing-ville.ts` + `landing-ville-templates.ts` (4 variants : default, focus_audit, focus_interventions, focus_implementation + opportunité focus_dirigeants pour `un-a-un` Sprint S+3)
**Routes générées** :

- `/audit/par-ville/[ville]` (~2150)
- `/interventions/par-ville/[ville]` (~2150)
- `/implementation/par-ville/[ville]` (~2150)
- `/un-a-un/par-ville/[ville]` (~2150) ← Sprint S+2
  **Indexation** : Tier-1 indexable uniquement si `copy.services.<verticale>` substantielle. Sinon stub noindex.
  **Soft-404 gate** : 350 mots min (cf P1-5)

### Type 4 — KB entries (Knowledge Base V4)

**Pipeline** : KB feeder (`kb-feeder.ts`) + KB ingest (`kb-ingest/*.ts`) + KB client lookup (`kb-client.ts`)
**Sources** : sitemap parsing externe + URL extraction + manual upload admin + Voyage AI embeddings (stubbed V1)
**Output** : `KnowledgeEntry` rows DB → consommés par RAG retrieve dans content-gen generators
**Page publique** : `/connaissances` (KB V4 livrée selon mémoire Will)

### Type 5 — Cas concrets

**Source** : data file `src/content/case-studies.ts` (manuel)
**Output** : pages `/cas-concrets`, `/cas-concrets/[slug]` + sitemap
**Liaison ville** : via champ `geo: { lat, lon }` + `getNearbyCases` + `getNearbyCasesWithFallback` (Phase F)

### Type 6 — FAQ items

**Generator** : `faq-standalone.ts` + `qa-derived.ts` (post-process auto extraction Q/R depuis Article body)
**Output** : `FAQ` rows DB + pages `/faq`, `/faq/[slug]` + sitemap-faq.xml + JSON-LD `FAQPage` + `Speakable`

### Type 7 — Comparaisons & Guides piliers

**Generators** : `comparison.ts` (ChatGPT vs Claude vs Mistral type) + `guide-pilier.ts` (pillar pages 3000-5000 mots)
**Output** : Articles `Article` rows avec `templateVariant` = "comparison" ou "guide-pilier"
**Pages** : `/comparaisons`, `/blog/[slug]` selon orientation

### Type 8 — Pages presse (newsroom)

**Pages** : `/presse`, `/presse/[slug]`, `PressImageBank.tsx` embed banque images
**Output** : pages structurelles éditoriales (kit médias + communiqués + interviews)
**Vérifier** : JSON-LD `NewsArticle` ? `PressRelease` schema ? Sitemap inclusion ?

### Type 9 — Stack IA outils (pages produit Claude/ChatGPT/Mistral/etc.)

**Pages** : `/stack-ia` + `/stack-ia/[tool]` (11 outils en 5 fonctions doctrine v3)
**Output** : pages structurelles avec JSON-LD `Product` + comparatifs internes
**Vérifier** : data source (data file ou DB), JSON-LD Product, breadcrumb, mesh interne vers comparaisons

### Type 10 — Pages par-fonction (catalogue par fonction d'entreprise)

**Routes** : `/implementation/par-fonction/[slug]` (8 catégories : RH, ventes, marketing, support, compta, juridique, IT, ops) + `/audit/par-fonction/[slug]` (si présent)
**Vérifier** : data source, status indexation, JSON-LD Service avec sous-spécialisation, lien vers cas concrets par fonction

### Type 11 — Glossaire IA

**Page** : `/glossaire`
**Output** : pages termes IA opérationnelle (RAG, fine-tuning, agents, etc.)
**Vérifier** : data source (data file `src/content/glossary.ts` probable), JSON-LD `DefinedTerm`, FAQ link, mesh blog

### Type 12 — Centre d'aide

**Pages** : `/centre-aide`, `/centre-aide/[slug]`
**Output** : articles support classés par catégorie (HelpArticle factory)
**Vérifier** : différence vs FAQ, JSON-LD `Article` ou `TechArticle`, audience visée (clients vs prospects)

---

## 3. WORKERS BULLMQ À AUDITER (NOUVELLE SECTION V2.0 — 8 workers)

Pour CHAQUE worker BullMQ sous `src/server/queue/workers/` :

- **Rôle métier** en 1 phrase
- **Trigger** (cron, queue push, manual)
- **Kill-switch** présent et effectif ?
- **Rate-limit / circuit breaker** ?
- **Observabilité** : GenerationLog steps écrits ? Sentry instrumented ? Telegram alerts ?
- **Status** 🟢/🟡/🔴

Workers à auditer (liste exhaustive attendue) :

| Worker                                 | Rôle                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `content-gen-worker.ts`                | Délégation au generator approprié selon ContentType                                         |
| `content-rss-fetch-worker.ts`          | Fetch périodique RSS sources + push job génération                                          |
| `content-publish-worker.ts`            | Publish article approved → DB + IndexNow + revalidate (cf hotfix mentionedCities `424e9a5`) |
| `content-quality-improver-worker.ts`   | Re-run quality loop sur articles tier-3 candidats promotion                                 |
| `content-news-lifecycle-worker.ts`     | Tombstone articles news > 48h, retire sitemap-news                                          |
| `content-web-vitals-monitor-worker.ts` | Calcul p75 CrUX field + alertes Telegram seuil dégradation                                  |
| `content-psi-monitor-worker.ts`        | PageSpeed Insights cron + monitoring tier-1 URLs                                            |
| `retention-purge-worker.ts`            | Purge auto GenerationLog 12 mois + cost_ledger 24 mois + web_vital_samples 6 mois           |

**Livrable dédié** : `08-WORKERS-BULLMQ-AUDIT.md`

---

## 4. ADMIN UI CONTENT-GEN — 30+ SOUS-PAGES (NOUVELLE SECTION V2.0)

Auditer le workflow admin que Will utilise quotidiennement.

Path racine : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/`

Sous-pages attendues à auditer (existence + UX cohérence + sécurité) :

```
/orchestrator          # briefing création article
/orchestrator/new
/coverage              # campagnes coverage par secteur
/coverage/new
/coverage/[id]
/geo                   # cockpit villes/batches
/geo/batches
/geo/batches/new
/geo/batches/[id]
/geo/history
/geo/[villeSlug]/generate
/jobs                  # state queues BullMQ
/jobs/[id]
/kb-readonly           # KB browser
/kb-readonly/[id]
/keyword-tracking      # GSC shadow V1 (cron pending)
/landing-variants      # 4 variants generator
/landing-variants/[variant]
/onboarding            # quickstart admin
/publications          # Articles DB browser
/publications/[id]/edit
/publications-status
/quality               # gates config
/queue                 # BullMQ visualisation
/review-queue          # APPROVAL Will workflow critique
/review-queue/[id]
/rss                   # RSS sources
/rss/new
/rss/[id]
/similarity-monitor    # dedup MinHash
/templates             # variants
/templates/new
/templates/[id]
/costs                 # cost ledger LLM providers
/author/manon          # Manon profile
/settings              # index
/settings/audience-mix
/settings/banned-phrases
/settings/batches
/settings/coverage-distribution
/settings/kb-ingest
/settings/kill-switch
/settings/llms-txt
/settings/policies
/settings/providers
/settings/qa-policies
/settings/quality-loop
/settings/search-intent-distribution
```

Pour chaque sous-page : existe (✅/❌/\_v2 only), fonctionnelle (oui/non/bug suspect), sécurité (auth admin, rate-limit P1-30, audit-log P1-9 cf `bf02916`).

**Livrable dédié** : `09-ADMIN-UI-CONTENT-GEN.md`

---

## 5. MONITORING & OBSERVABILITÉ (NOUVELLE SECTION V2.0)

Auditer toute la chaîne de **suivi opérationnel** du content-gen.

### 5.1 GenerationLog (audit trail technique)

- Table `generation_logs` Prisma — 27 steps possibles ?
- Helper `logStep(jobId, step, message, metadata)` utilisé partout ?
- Helper `redactGenerationMetadata` PII filter (audit B5 P1-1) actif ?
- Volume actuel : count rows DB (commande SQL ou STOP & ASK)
- Retention purge : 12 mois via `retention-purge-worker.ts`

### 5.2 ContentGenAuditLog SOC2 (P1-9 livré Sprint S+2)

- Table `content_gen_audit_log` Prisma — append-only diff oldValue → newValue
- Helper `writeAuditLog` câblé `writeContentGenConfig` ?
- Indexes 3 colonnes (settingKey, actorUserId, action) × created_at DESC
- Volume actuel : count rows

### 5.3 Telegram alerts

- Helper `alertIncident` utilisé sur fail streak ≥ 5 ?
- Bot config (token + chat_id) en env ?
- Coverage : quels workers déclenchent ?

### 5.4 Sentry instrumentation

- `instrumentation.ts` + `instrumentation-client.ts` + `sentry.{server,edge}.config.ts` câblés ?
- Lazy-load post-FID (P0-4 livré Sprint P0 morning) ?
- piiScrubBeforeSend filter ?
- Release tracking via `NEXT_PUBLIC_SENTRY_RELEASE` ?

### 5.5 WebVitalSample DB (P0-7 livré matin)

- `vitals-store.ts:appendVitalsRecord` câblé `/api/vitals/route.ts` ?
- Insert Prisma `webVitalSample.create` ligne 103 vitals-store.ts ?
- Cron `content-web-vitals-monitor-worker` calcul p75 quotidien ?

### 5.6 Cost ledger LLM providers (€/article)

- Table `cost_ledger` Prisma : 1 row par appel provider
- `cost-tracker.ts` câblé `provider-router.ts` ?
- Monthly cap USD par provider via `ProviderConfig.monthlyCapUsd` ?
- `currentMonthSpentUsd` mis à jour atomically ?
- Coût moyen / article (calcul + reco budget mensuel)

### 5.7 Quality loop seuils

- `qualityScore` threshold 75 enforced ?
- Max attempts 2 ?
- Réjections → log step `error` + Telegram alert ?

**Livrable dédié** : `10-MONITORING-OBSERVABILITE.md`

---

## 6. INDEXATION DISCOVERY DÉTAILLÉE (NOUVELLE SECTION V2.0)

Auditer **toute la chaîne discovery** que Google/Bing/Yandex/AI bots utilisent.

### 6.1 robots.txt (`src/app/robots.ts`)

- User-Agent `*` allow `/` + COMMON_ALLOW (`/api/og`) + COMMON_DISALLOW
- AI_BOTS_ALLOWED (13 + YandexBot ajouté P1-3 Sprint quick wins)
- AI_BOTS_DISALLOWED (CCBot, Bytespider, omgili, Diffbot)
- Bingbot crawl-delay: 1s (P1-16 audit indexation)
- `Sitemap: /sitemap-index.xml` directive
- EN locale 301 → FR : `/en/*` disallow si EN_LOCALE_DISABLED=true

### 6.2 Sitemap-index (`/sitemap-index.xml`)

- Route Handler custom car Next 16 réserve `/sitemap.xml` pour metadata convention
- Lit `generateSitemaps()` + sub-sitemaps custom (`/sitemap-news.xml`, `/sitemaps/images-{fr,en}.xml`)
- lastmod différencié (audit indexation 2026-05-18 P0-2 fix : BUILD_TIME env vs new Date())

### 6.3 Sub-sitemaps (15+)

Compter tous les sub-sitemaps déclarés dans StaticSitemapId + dynamic IDs (`villes-<region>-<chunk>`, `knowledge-<n>`) :

- `pages`, `blog`, `faq`, `help`, `cas-concrets`, `comparaisons`, `implementation`, `implantations`
- `services-villes-audit`, `services-villes-interventions`, `services-villes-implementation`, `services-villes-un-a-un` (S+2)
- `villes-<region>-*` (13 régions × chunks)
- `knowledge-*` (KB chunks)
- `images-fr`, `images-en` (image-bank V1)
- `news.xml` (custom Google News namespace)

### 6.4 llms.txt v0.2 (`src/app/llms.txt/route.ts`)

- Sections `# Site`, `## Important pages`, `## Optional`, `## Excluded` (P1-27 ajout S+1)
- Cache-Control 1h + SWR 24h
- Lecture par Claude.ai / Perplexity / ChatGPT Search

### 6.5 ai.txt Spawning.ai draft (`src/app/ai.txt/route.ts`)

- `ai-training: allow` global
- 6 bots nominalisés `ai-citation: allow`
- 4 scrapers `ai-training: disallow`
- Doctrine commentée FR

### 6.6 security.txt RFC 9116 (`src/app/.well-known/security.txt/route.ts`)

- Contact + Expires + Languages + Canonical + Policy
- Expiration 2027-05-16 (renouvellement S7)

### 6.7 IndexNow flow

- Key file public servi sur `/${INDEXNOW_KEY}.txt`
- Helper `buildIndexNowPayload` + worker ping sur publish
- HMAC secret `INDEXNOW_INTERNAL_HMAC_SECRET`
- Rate-limit 30 req/min

### 6.8 GSC API + Bing Webmaster + Yandex Webmaster

- Sitemap soumis GSC ? (STOP & ASK Will pour confirmation visuelle)
- Bing Webmaster IndexNow history 7j ?
- Yandex Webmaster sitemap soumis ? (YandexBot allow ajouté P1-3)

**Livrable dédié** : `11-INDEXATION-DISCOVERY.md`

---

## 7. VILLES, DÉPARTEMENTS & RÉGIONS — INVENTAIRE COMPLET (V2.0 élargi)

### 7.1 État indexation villes

- **Total villes** dans `VILLES` array (`src/content/villes/`) : compter exact (~2150 cible >5K hab)
- **Villes Tier-1 indexable** (avec `copy.services.<verticale>` substantielle) : lister exhaustivement
  - Par verticale : audit, interventions, implementation, un-a-un
- **Villes Tier-2** (copy minimaliste) : count
- **Villes Tier-3** (stub noindex, anti-doorway) : count

### 7.2 Tableau villes faites / à faire (Top 50 Tier-1 cible)

Tableau Markdown :

```
| Rang INSEE pop | Ville | Région | Département | audit | interventions | implementation | un-a-un | Articles blog (mentionedCities) | Cas concrets nearby |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Paris | Île-de-France | 75 | ✅ gold | ✅ gold | ✅ gold | ❌ stub | X articles | Y cas |
... 50 villes
```

Source de vérité : grep `copy.services` dans `src/content/villes/copy/*.ts`.

### 7.3 Couverture par département (95 métropole)

Mapping : `VILLES.filter(v => v.departement === "XX")` → count + count Tier-1.

Tableau Markdown 95 départements métropole + 4 DOM :

```
| Code dépt | Nom | Région | Total villes | Tier-1 | Tier-2 | Tier-3 | Couverture % |
|---|---|---|---|---|---|---|---|
| 75 | Paris | Île-de-France | 1 | 1 | 0 | 0 | 100% |
...
```

### 7.4 Couverture par région (13 métropole — NOUVELLE V2.0)

Mapping : `VILLES.filter(v => v.region === "XX")` → count + count Tier-1.

Tableau Markdown 13 régions :

```
| Région | Total villes >5K | Tier-1 | Tier-2 | Tier-3 | Page /implantations/[region] existe | Pop INSEE |
|---|---|---|---|---|---|---|
| Île-de-France | XX | 1 (Paris) | 0 | XX | ✅ | 12.2M |
| Auvergne-Rhône-Alpes | XX | 0 | 0 | XX | ? | 8.0M |
...
```

### 7.5 Pages département dédiées ?

Vérifier `src/app/[locale]/implantations/[region]/[departement]/page.tsx` ou équivalent. **Si N'EXISTE PAS**, signaler comme gap (best practice 2026 : page agrégation département pour ranking "audit IA Hauts-de-Seine" type).

### 7.6 Pages région dédiées ? (NOUVELLE V2.0)

Vérifier `src/app/[locale]/implantations/[region]/page.tsx`. Confirmé existant selon mémoire Will. Mais auditer :

- Liste villes par région affichée ?
- Mesh interne vers villes Tier-1 ?
- JSON-LD `AdministrativeArea` ?

### 7.7 Mécanisme liens indirects ville ↔ département ↔ région

Vérifier que `Ville.departement` + `Ville.region` fields existent + exposés partout (hub ville breadcrumb, sitemap region, etc.).

### 7.8 Roadmap couverture

- Tier-1 cible : 50 villes × 4 verticales × 2 locales = **400 pages gold** (effort copy humain Will)
- Tier-2 cible : 300 villes × 4 verticales × 2 locales = **2 400 pages medium** (auto-gen + review spot)
- Tier-3 long-tail : ~1 800 villes × 4 verticales × 2 locales = **~14 400 pages thin/auto** (gate soft-404 350 mots)

**Livrable dédié** : `05-VILLES-DEPARTEMENTS-REGIONS.md`

---

## 8. CROISEMENTS À VÉRIFIER (12 cross-checks — V2.0 +4)

Pour CHAQUE : commande grep/find + résultat + verdict ✅/⚠️/❌.

### 8.1 Generator output → publish-worker → Article.create() cohérence

Vérifier que CHAQUE field de `GeneratorOutput` est consommé par `content-publish-worker.ts`. Particulièrement `mentionedCities` (hotfix `424e9a5`).

### 8.2 Article.mentionedCities → hub ville filter

Vérifier `getBlogArticlesByVille()` lit le bon champ Prisma. Vérifier que hub ville `/implantations/[region]/[ville]/page.tsx` consomme ce helper.

### 8.3 4 verticales × ville : routes filesystem ↔ sitemap ↔ routing ↔ navigation

Pour chaque verticale (audit, interventions, implementation, un-a-un) :

- `src/app/[locale]/<verticale>/par-ville/[ville]/page.tsx` existe ?
- Sitemap StaticSitemapId déclare `services-villes-<verticale>` ?
- Routing pathnames déclare `/<verticale>/par-ville/[ville]` ?
- Footer + mega-menu inclut `/<verticale>` ?

### 8.4 RSS → Article.isNews → sitemap-news.xml fenêtre 48h

Vérifier `blog-from-rss.ts` génère `isNews=true`. Vérifier `sitemap-news.xml/route.ts` filtre par 48h glissante + max 1000 URLs.

### 8.5 KB entries → /connaissances rendu public

Vérifier `KnowledgeEntry.status="published"` + `audience="public"` → rendus dans `/connaissances`. Vérifier index GIN + RAG retrieve.

### 8.6 JSON-LD declared ↔ HTML rendered (Speakable cssSelector)

Pour chaque page émettant `Speakable: { cssSelector: [".tldr-answer", '[data-aeo="tldr"]'] }`, vérifier que le HTML rendu contient bien la classe + data-attr correspondants.

### 8.7 i18n routing FR ↔ EN ↔ filesystem ↔ en-to-fr-redirect map

Pour chaque pathname déclaré dans `i18n/routing.ts:pathnames`, vérifier :

- Filesystem `src/app/[locale]/<path>` existe
- Si EN miroir distinct (ex `/audit/par-ville` → `/audit/by-city`), `en-to-fr-redirect.ts` map présent

### 8.8 Footer hrefs ↔ Header mega-menu hrefs ↔ Routes existantes ↔ Sitemap

Tous les hrefs dans Footer.tsx + Header.tsx + HeaderMegaMenu\*.tsx pointent vers des routes filesystem RÉELLES + déclarées dans sitemap.

### 8.9 (NOUVELLE) Rate-limit Server Actions writes (P1-30)

Vérifier `requireAdminWriteRateLimited` câblé `writeContentGenConfig` + `_settings.ts`. Aucun bypass `prisma.contentGenConfig.upsert` détecté.

### 8.10 (NOUVELLE) Kill-switch admin

Table `ContentGenConfig` key `kill_switch` lue par `content-gen-worker` ? Worker stop immediate si actif ?
UI admin `/settings/kill-switch` permet toggle ?

### 8.11 (NOUVELLE) Review-queue workflow Will → publish

Article généré → status `pending_review` → admin Will click "approve" → `content-publish-worker` enqueue ?
Si rejected → tier downgrade ? Re-generation ?

### 8.12 (NOUVELLE) Tombstone 410 Gone + Slug-history 301

Article supprimé/dépublié → table `Tombstone` row créée → route `/blog/[slug]` retourne `<Tombstone>` component avec `<meta robots noindex>` ?
Article renommé → `ArticleSlugHistory` row → redirect 301 ancien slug → nouveau ?
IndexNow URL_DELETED ping envoyé ?

**Livrable dédié** : `06-CROISEMENTS-CROSS-CHECKS.md`

---

## 9. TESTS NÉCESSAIRES (V2.0 enrichi)

### 9.1 Tests unitaires existants

Lister tous les `*.test.ts*` + `*.spec.ts*` sous `src/`. Count par module. Identifier modules sans tests.

### 9.2 Tests d'intégration content-publish-worker (NOUVELLE V2.0)

Tests E2E pipeline `generator → publish-worker → DB → frontend` :

- Article créé avec `mentionedCities` populés (hotfix `424e9a5`)
- ArticleTranslation FR créée
- Sitemap updated post-publish
- IndexNow ping fired (mock)

### 9.3 Tests d'intégration Soft-404 gate (NOUVELLE V2.0)

Tests anti-régression P1-5 livré matin :

- `evaluateSoft404` retourne `tier_3_noindex_nofollow` si wordCount < 350
- Tolerance 280 si `hasFullLocalBusinessJsonLd + hasLocalCase + faqCount ≥ 4`

### 9.4 Tests d'intégration dedup pipeline (NOUVELLE V2.0)

Tests `topicFingerprint` + `similarity-monitor` :

- 2 articles topic-similar → block ou warn ?
- Hamming distance ≤ 8 = block, 9-12 = warn (P1-6 livré matin)

### 9.5 Tests E2E (Playwright ou Cypress)

Vérifier `playwright.config.ts` ou équivalent. Tests E2E sur les routes critiques :

- /, /audit, /interventions, /implementation, /un-a-un
- /implantations/[region]/[ville] (Paris)
- /audit/par-ville/paris
- /blog, /blog/[slug]
- /charte-editoriale, /corrections, /transparence

### 9.6 Tests performance

Lighthouse CI config `lighthouserc.json` : URLs testées + cibles Web Vitals.
Identifier si `/un-a-un` + `/un-a-un/par-ville/paris` sont inclus dans la liste LHCI.

### 9.7 Tests Web Vitals CrUX

Identifier si données field CrUX sont collectées via `vitals-store.ts` (cf P0-7 Sprint P0). Vérifier `WebVitalSample` table populée.

### 9.8 Tests seeds DB (NOUVELLE V2.0)

- BannedPhrase 54+ patterns seed actif ?
- AudienceMixProfiles 4 profils seeded ?
- CoverageDistributionProfiles 6 profils ?
- Editorial-mix-rules 13 tests verts ?

**Livrable dédié** : `07-TESTS-INVENTORY-GAPS.md`

---

## 10. PRODUCTION-READY MATRIX (V2.0 élargi 12 types)

Tableau récapitulatif des 12 types de contenu :

```
| Type | Generator | Quality gates | Tests | Pipeline publish | Sitemap | IndexNow | Hub ville | mentionedCities | Statut |
|---|---|---|---|---|---|---|---|---|---|
| 1. Article blog | ✅ | ✅ | X tests | ✅ | ✅ | ✅ | ✅ post-hotfix | ✅ | 🟢 prod |
| 2. Actualités RSS | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| 3. Landing villes × 4 verticales | ✅ | ✅ | X tests | ✅ | ✅ | ✅ | ✅ | ✅ | 🟢 prod |
| 4. KB entries | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| 5. Cas concrets | ? | N/A | ? | ? | ? | ? | ? | ? | ? |
| 6. FAQ items | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| 7. Comparaisons & Guides | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| 8. Presse | ? | N/A | ? | ? | ? | ? | ? | ? | ? |
| 9. Stack IA | ? | N/A | ? | ? | ? | ? | ? | ? | ? |
| 10. Par-fonction | ? | N/A | ? | ? | ? | ? | ? | ? | ? |
| 11. Glossaire | ? | N/A | ? | ? | ? | ? | ? | ? | ? |
| 12. Centre d'aide | ? | ? | ? | ? | ? | ? | ? | ? | ? |
```

Pour chaque ? : grep + fichier:ligne + verdict.

---

## 11. AUTRES POINTS À VÉRIFIER (best practices 2026 transverses)

- Centralisation factories SEO/AEO/GEO/JSON-LD (cf `src/lib/seo.ts` 1500+ lignes)
- Centralisation metadata via `buildProductMetadata`
- Web Vitals gates CI (Lighthouse + size-limit + use-client:check)
- Anti-doorway HCU 2024 enforcement
- AI Act art. 50 disclosure systématique
- Hreflang réciproque FR/EN + x-default `/fr/`
- robots.txt : 13 + YandexBot allowed + 4 scrapers disallowed
- llms.txt v0.2 (Sections # Site, ## Important pages, ## Optional, ## Excluded)
- ai.txt Spawning.ai draft
- security.txt RFC 9116
- IndexNow key + ping HMAC secret
- EN locale disabled workaround cohérent partout (mapEnToFr)
- DPA sous-processeurs 6 providers IA (Anthropic, OpenAI, Mistral, Perplexity, Voyage, Unsplash)

---

## 12. STRATÉGIE D'EXÉCUTION (autopilote V2.0 enrichi)

### T0 — Setup (5 min)

- Confirmer working dir + HEAD git
- Créer `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/` + `00-MANIFEST.md`
- Vérifier `pnpm typecheck && pnpm vitest run` baseline (devrait être 1084/1084 verts si HEAD = `9c1adaa`)

### T1 — Inventaire (45 min)

- Lister tous les generators (`src/server/content-gen/generators/*.ts`)
- Lister tous les workers BullMQ (`src/server/queue/workers/*.ts`)
- Lister tous les models Prisma content-related (`grep "^model" prisma/schema.prisma`)
- Lister toutes les routes pages auto-générées (`find src/app/[locale] -name "page.tsx"`)
- Lister toutes les sous-pages admin content-gen

### T2 — Audit par type (12 × 25 min = 5h)

Pour chaque type 1-12, produire 1 fichier MD dédié.

### T3 — Workers BullMQ (45 min)

Produire `08-WORKERS-BULLMQ-AUDIT.md` (§3).

### T4 — Admin UI content-gen (45 min)

Produire `09-ADMIN-UI-CONTENT-GEN.md` (§4).

### T5 — Monitoring & observabilité (45 min)

Produire `10-MONITORING-OBSERVABILITE.md` (§5).

### T6 — Indexation discovery (30 min)

Produire `11-INDEXATION-DISCOVERY.md` (§6).

### T7 — Villes, départements & régions (1h30)

Produire `05-VILLES-DEPARTEMENTS-REGIONS.md` (§7).

### T8 — Croisements (1h30)

Produire `06-CROISEMENTS-CROSS-CHECKS.md` (§8) — 12 cross-checks.

### T9 — Tests inventory (1h)

Produire `07-TESTS-INVENTORY-GAPS.md` (§9).

### T10 — Synthèse (45 min)

Produire `01-EXEC-SUMMARY-WILL.md` ≤ 2 pages + `02-VERDICT-GLOBAL.md` + `03-STOP-AND-ASK-WILL.md` + `04-FLOW-MASTER-MERMAID.md`.

### T11 — Roadmap (45 min)

Produire `99-ROADMAP-COMPLETION.md` avec actions priorisées P0/P1/P2/P3 + effort + ROI estimé.

**Durée totale estimée** : 13-15h autopilote.

---

## 13. LIVRABLES OBLIGATOIRES (≥ 22 fichiers — V2.0 élargi)

Tous sous `C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\CONTENT-GEN-DEEP-AUDIT-2026-05-18\` :

```
00-MANIFEST.md                                       # Index + status agents
01-EXEC-SUMMARY-WILL.md                              # ≤ 2 pages, langage simple
02-VERDICT-GLOBAL.md                                 # Score /1200 (12 types × 100)
03-STOP-AND-ASK-WILL.md                              # Décisions ouvertes
04-FLOW-MASTER-MERMAID.md                            # Diagrammes flow par type
05-VILLES-DEPARTEMENTS-REGIONS.md                    # Tableaux complets §7
06-CROISEMENTS-CROSS-CHECKS.md                       # 12 cross-checks §8
07-TESTS-INVENTORY-GAPS.md                           # §9
08-WORKERS-BULLMQ-AUDIT.md                           # §3 (8 workers)
09-ADMIN-UI-CONTENT-GEN.md                           # §4 (30+ sous-pages)
10-MONITORING-OBSERVABILITE.md                       # §5
11-INDEXATION-DISCOVERY.md                           # §6
12-TYPE-1-ARTICLES-BLOG.md                           # Audit type 1
13-TYPE-2-ACTUALITES-RSS.md                          # Audit type 2
14-TYPE-3-LANDING-PAGES-VILLE-4-VERTICALES.md        # Audit type 3
15-TYPE-4-KB-ENTRIES.md                              # Audit type 4
16-TYPE-5-CAS-CONCRETS.md                            # Audit type 5
17-TYPE-6-FAQ-ITEMS.md                               # Audit type 6
18-TYPE-7-COMPARAISONS-GUIDES.md                     # Audit type 7
19-TYPE-8-PRESSE.md                                  # Audit type 8 (NEW)
20-TYPE-9-STACK-IA.md                                # Audit type 9 (NEW)
21-TYPE-10-PAR-FONCTION.md                           # Audit type 10 (NEW)
22-TYPE-11-GLOSSAIRE.md                              # Audit type 11 (NEW)
23-TYPE-12-CENTRE-AIDE.md                            # Audit type 12 (NEW)
99-ROADMAP-COMPLETION.md                             # Priorisée P0-P3
```

Soit **25 fichiers** au final (≥ 22 minimum).

---

## 14. STYLE & QUALITÉ DES LIVRABLES

### Langage

- **Pédagogique** : Will n'est pas développeur senior. Éviter le jargon (RAG, GIN, HMAC, SimHash, etc.) ou l'expliquer en 1 ligne dans une note inline.
- **Phrases courtes** : ≤ 25 mots par phrase. Pas de paragraphes denses.
- **Concret** : préférer "le worker écrit l'article en DB et envoie un ping Bing" plutôt que "le pipeline persiste l'entité via Prisma + déclenche un IndexNow webhook".
- **Aucune flatterie** : pas de "Excellent !", "Parfait !", "Génial !"

### Visuel

- **Mermaid systématique** : chaque type de contenu doit avoir son diagramme flow.
- **Tableaux Markdown** : tableaux propres avec en-têtes clairs.
- **Emojis utiles uniquement** : 🟢🟡🟠🔴 pour scores/status. ✅⚠️❌ pour assertions. ZÉRO emoji décoratif.

### Fact-based

- **Chaque affirmation** = `fichier.ts:ligne` + extrait code OU commande reproductible.
- **Si donnée inconnue** : écrire explicitement "**UNKNOWN — requires fact-check**" + commande pour résoudre.
- **Pas d'extrapolation**.

### Croisements

- À chaque assertion sensible, faire le contre-check : ex "le generator écrit `mentionedCities` (cf landing-ville.ts:188), et le worker le persiste (cf content-publish-worker.ts:115), et le hub ville le lit (cf get-articles-by-ville.ts:55)". Trois liens minimum par croisement critique.

---

## 15. ANTI-PATTERNS À ÉVITER

- ❌ "Tout est parfait" sans citer fichier:ligne → INTERDIT
- ❌ Glisser un commit malgré le mode AUDIT-ONLY → INTERDIT
- ❌ Modifier un fichier de code → INTERDIT
- ❌ Inventer un fichier qui n'existe pas → INTERDIT
- ❌ Style trop technique inaccessible Will → REPRENDRE
- ❌ Jargon non expliqué → REPRENDRE
- ❌ Tableaux sans données chiffrées exactes → REPRENDRE
- ❌ Mermaid trop simple sans étapes pipeline → REPRENDRE
- ❌ Oublier l'inventaire villes/départements/régions (point critique pour Will)
- ❌ Oublier les 12 croisements (point critique pour qualité audit)
- ❌ Oublier les 8 workers BullMQ
- ❌ Oublier les 30+ sous-pages admin content-gen
- ❌ Oublier monitoring/observabilité + cost ledger
- ❌ Oublier indexation discovery (robots/llms/ai/security/IndexNow)
- ❌ Conclure sans STOP & ASK Will si décisions ouvertes

---

## 16. CRITÈRES D'ACCEPTATION FINAL

L'audit est considéré OK si :

- ✅ ≥ 22 fichiers livrés dans `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/`
- ✅ Chaque type de contenu (12) a son diagramme Mermaid + score /100 + status
- ✅ Inventaire villes complet (au moins Top 50 Tier-1 listées + status par verticale)
- ✅ Couverture départements 95 + régions 13 (métropole) listées
- ✅ 8 workers BullMQ audités
- ✅ 30+ sous-pages admin content-gen audités
- ✅ Monitoring & observabilité complet (GenerationLog + Sentry + Telegram + cost ledger)
- ✅ Indexation discovery détaillée (8 sous-systèmes)
- ✅ 12 croisements faits avec fact-based fichier:ligne
- ✅ Tests inventory + gaps identifiés
- ✅ Roadmap P0-P3 chiffrée (effort + ROI estimé)
- ✅ Exec Summary ≤ 2 pages langage simple
- ✅ STOP & ASK Will consolidé
- ✅ ZÉRO modification code, ZÉRO commit, ZÉRO push
- ✅ Anti-régression CI baseline confirmée (typecheck + vitest 1084/1084 verts attendus)

---

## 17. PHRASE DE CLÔTURE OBLIGATOIRE

À la fin de l'audit, terminer par :

> **AUDIT CONTENT-GEN DEEP V2.0 TERMINÉ — Verdict {🔴🟠🟡🟢} {score}/1200.
> {N} livrables dans `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/`.
> {K} STOP & ASK Will (voir `03-STOP-AND-ASK-WILL.md`).
> Aucune ligne de code modifiée. Aucun commit créé. Aucun push.
> Prêt pour revue Will → décisions → puis Sprint S+3 EXECUTION (prompt séparé si validation).**

---

## 18. SI BLOCAGE

- Si une donnée critique manque (ex : pas accès DB pour count articles), écrire "**UNKNOWN — requires fact-check**" + commande/URL/SQL pour résoudre → continue l'audit sur ce qui peut être audité.
- Si HEAD git diverge du `9c1adaa` attendu, lister les nouveaux commits + adapter l'audit.
- Si 1+ test vitest fail après baseline, signaler en P0 dans `02-VERDICT-GLOBAL.md` mais NE PAS tenter de fixer.
- Si conflit de scope (ex : Will demande quelque chose hors content-gen), répondre dans le rapport "hors scope audit content-gen, à traiter dans audit séparé".

---

## 19. INSTRUCTION ULTIME

Tu es **Auditeur Senior Content Platform + Engineer Lead pSEO Villes + Ops Reliability**, mandaté par Will pour produire un rapport exhaustif, factuel, pédagogique et visuel sur l'état complet de la chaîne content-gen d'Axion-IA — couvrant les 12 types de contenu, les 8 workers BullMQ, les 30+ sous-pages admin, l'observabilité, l'indexation discovery, l'inventaire villes/départements/régions, 12 croisements critiques et tests gaps.

**Tu fais l'audit, tu ne push rien, tu ne modifies rien, tu rends des fichiers MD dans `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/`.**

C'est parti.

---

**FIN DU PROMPT V2.0 — Self-contained, AUDIT-ONLY strict, livrables ≥ 22 fichiers MD, durée 13-15h autopilote.**
