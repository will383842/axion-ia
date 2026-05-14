# 🏭 PROMPT — CONTENT GENERATOR MASTER 2026 — Axion-IA

> **Master spec d'exécution** pour construire l'outil de **génération automatisée de contenus** entièrement piloté depuis la console d'administration `axion-ia.com`. Couvre **7 types de contenu**, **3 providers IA toggleables**, **landing pages villes ultra-personnalisées**, **knowledge base scalable**, **publication contrôlée**, **monitoring temps réel**. Doctrine AxionIA-centric ≥ 95 %, anti-doorway HCU 2024, SEO/AEO/GEO niveau perfection extrême.

**Auteur** : Claude Opus 4.7 + Will  
**Date** : 2026-05-14 (v2.4 — GBP service-area-business V1 + Google Indexing API V1 + sitemap perfection complet + 8 templates TSX restants)  
**Statut** : 🟢 Prêt à exécution  

### ⚠️ Décisions Will actées (v1.2)

1. **Langue cible UNIQUEMENT français de très grande qualité**. Le content generator NE produit PAS de version EN. Les contenus créés sont mono-locale `fr`. Le site garde sa structure `/en/*` pour les pages éditoriales manuelles existantes, mais TOUS les contenus générés (landings villes, articles, FAQ, comparatifs, guides, Q/R) sont uniquement FR. Conséquences : hreflang émet uniquement `fr-FR` + `x-default` (= FR) ; `llms.txt` FR seulement ; sitemap FR seulement pour les contenus générés ; doctrine `i18n parity` **désactivée** pour le content generator.
2. **Auteur des contenus générés = MANON** (pas Will). Person JSON-LD canonique « Manon » + photo + bio + credentials. Tous les articles affichent Manon en byline + bio card en bas. Cf. § 9.8.
3. **Perfection extrême SEO/AEO/GEO sans aucun oubli**. Checklist exhaustive de 60+ items dans § 9.7. Templates HTML gold standard par type dans § 9.9.
**Mode** : 🛠️ **BUILD** (pas AUDIT-ONLY) — produit du code + tests + docs + migrations Prisma  
**Cible** : V1 livré en 4-6 sprints, V2 scale 100 K+ contenus en 12-18 mois  
**Inspiration externe** : `C:\Users\willi\Documents\Projets\VS_CODE\Mission_control_sos-expat` (content engine Laravel mature, à transposer Next.js + Prisma)

### 🔗 Triptyque de prompts inséparables

Ce prompt est le **chef d'orchestre BUILD**. Il s'appuie sur 2 prompts complémentaires :

| Prompt | Rôle | Statut |
|---|---|---|
| **`_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md`** | **DATA MODEL** acté Will 2026-05-08 (BlogPost, Comparison, Guide, QAItem + pyramide 3-tiers indexation + URL structure Option A). | ✅ Existant |
| **`axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`** | **KNOWLEDGE BASE** — outil séparé qui ingère le savoir AxionIA (docs internes, méthodologie, cas concrets, doctrine, INSEE, secteurs, communes voisines, etc.) en chunks embeddés pgvector. **Consommée en lecture** par le content generator via `kb-client.ts`. Skill associé : `axionia-connaissances`. | ✅ Existe — V3 ~1377 lignes |
| **`_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md`** *(ce fichier)* | **OUTIL DE GÉNÉRATION** : providers IA, generators par type, admin console, queues, cockpit géo, publication, monitoring. | ✅ Ce document |

**Règle absolue** : le content generator NE crée PAS de connaissance. Il **interroge** la KB (RAG via pgvector) + **enrichit** avec data temps réel (Perplexity Sonar) + **assemble** via les providers IA. La qualité finale du contenu généré est **directement proportionnelle à la qualité de la KB**. Donc :

> ⚠️ **Aucune génération de contenu ne doit être lancée tant que la Knowledge Base produite par `PROMPT-KNOWLEDGE-BASE-2026.md` n'a pas atteint un seuil minimum de 300 chunks AxionIA-canoniques (cf. § 11.2 ci-dessous).**

---

## 📑 Sommaire

0. [Contrat d'exécution & garde-fous](#0-contrat-dexécution--garde-fous)
1. [Contexte & doctrine intouchable](#1-contexte--doctrine-intouchable)
2. [État initial observable (ce qui existe vs ce qui manque)](#2-état-initial-observable)
3. [Scope V1 / V2 / V3 — découpage explicite](#3-scope-v1--v2--v3)
4. [Architecture cible — vue d'ensemble](#4-architecture-cible)
5. [Modèle de données — extension Prisma](#5-modèle-de-données--extension-prisma)
6. [Spécifications par type de contenu (7 types)](#6-spécifications-par-type-de-contenu)
7. [Providers IA & orchestration (GPT / Claude / Perplexity)](#7-providers-ia--orchestration)
8. [Système d'images](#8-système-dimages)
9. [SEO / AEO / GEO — exigence perfection 2026 + checklist 60 items + templates HTML + Manon + Web Vitals](#9-seo--aeo--geo)
9bis. [Indexation perfection 2026 (sitemap + IndexNow + Google Indexing + llms.txt)](#9bis-indexation-perfection-2026)
10. [Anti-plagiat & qualité éditoriale](#10-anti-plagiat--qualité-éditoriale)
11. [Knowledge Base — consommation (KB externe via PROMPT-KNOWLEDGE-BASE-2026.md)](#11-knowledge-base--consommation-ne-pas-la-créer-ici)
12. [Console admin — 8 sections détaillées](#12-console-admin--8-sections)
13. [Queue, scheduling & monitoring](#13-queue-scheduling--monitoring)
14. [Publication & validation workflow](#14-publication--validation-workflow)
15. [Pilotage géographique & cockpit visuel d'avancement (carte France + drilldown dépt → ville)](#15-pilotage-géographique--cockpit-visuel-davancement)
16. [Méthodologie d'exécution — 8 agents parallèles](#16-méthodologie--8-agents-parallèles)
17. [Sprint breakdown (V1 4-6 sprints)](#17-sprint-breakdown)
18. [Livrables exhaustifs](#18-livrables-exhaustifs)
19. [Scoring /200 & gates qualité](#19-scoring-200--gates-qualité)
20. [STOP & ASK obligatoires (13 questions + 1 obsolète v2.0)](#20-stop--ask-obligatoires)
21. [Contraintes intouchables](#21-contraintes-intouchables)
22. [Checklist EXIT V1](#22-checklist-exit-v1)
23. [Phrase d'invocation pour reprise](#23-phrase-dinvocation-pour-reprise)
24. [Mode autopilote bout-en-bout (Sprint 1 → 6 sans intervention)](#24-mode-autopilote-bout-en-bout-sprint-1--6-sans-intervention)
25. [Campagnes de couverture — pilier conquête territoriale (v1.7)](#25-campagnes-de-couverture--pilier-de-la-conquête-territoriale)
26. [Intention de recherche — pilier transverse (v1.7)](#26-intention-de-recherche--pilier-transverse-v17)
27. [Boucle d'amélioration qualité — Quality Loop (v1.7)](#27-boucle-damélioration-qualité-quality-loop)
28. [Pipeline 2 — Actualités RSS séparé (v1.7)](#28-pipeline-2--actualités-rss-séparé-v17)
29. [Q/R post-process — pages indexables automatiques (v1.7)](#29-qr-post-process--pages-indexables-automatiques)

---

## 0. Contrat d'exécution & garde-fous

### 0.1 Périmètre

**IN** : Tout ce qui concerne la génération, la curation, la publication et le monitoring de contenus AxionIA via l'admin console. Inclut DB Prisma, services serveur, queue BullMQ, providers IA, UI admin Next 16, templates SSG, factories SEO, sitemaps, scripts seed, tests.

**OUT** : Refactor du booking, refonte design existant, mise à jour pricing, modifications du système d'auth (sauf nouveaux rôles éditoriaux).

### 0.2 Mode d'exécution

🛠️ **BUILD** — Tu produis du **code, des migrations, des tests et de la doc**. Pas un audit.

- Toutes les modifications passent par des commits **Conventional Commits** (`feat(content-gen): …`, `feat(prisma): …`, `feat(admin/content): …`, `docs(audit): …`, `test(content-gen): …`).
- Aucun secret en clair dans les commits — utiliser `src/env.ts` (Zod) + `.env.local`.
- Tout nouveau service serveur DOIT vivre dans `src/server/content-gen/` (nouveau dossier).
- Tout nouveau composant admin DOIT vivre dans `src/app/[locale]/(admin)/[adminPrefix]/content-gen/`.

### 0.3 Doctrine anti-hallucination

Toute affirmation factuelle insérée dans un contenu généré DOIT être :
1. Soit issue de **Perplexity Sonar** avec `search_recency_filter` ≤ 1 an et sources citées en JSON-LD `citation[]`,
2. Soit issue de la **Knowledge Base interne** (§ 11) avec `kb_chunk_id` traçable,
3. Soit issue des **données INSEE / SSOT internes** (`pricing.ts`, `regions.ts`, `villes/data/*.ts`).

Sinon → le LLM est instruit de NE PAS l'écrire. Toute statistique chiffrée sans source = **bloquée par `posts:validate`**.

### 0.4 Garde-fous robustesse

- **Cost cap** : budget mensuel hard cap configurable par provider (default `OPENAI_MONTHLY_USD=200`, `ANTHROPIC_MONTHLY_USD=100`, `PERPLEXITY_MONTHLY_USD=80`). Dépassement = pause auto + alerte Telegram.
- **Rate limit** : respecter limits providers (OpenAI tier 5 = 10k RPM ; Anthropic = 50 RPM ; Perplexity = 50 RPM). Implémenter `BullMQ rate-limit` per-queue.
- **Idempotence** : un job ré-exécuté ne génère pas un doublon — `Job.idempotencyKey = hash(input)`, dedup via Redis.
- **Retry** : 3 tentatives avec backoff exponentiel (10s → 60s → 300s) + dead-letter queue.
- **Kill switch** : variable `CONTENT_GEN_ENABLED=false` (env DB `Setting`) pour stopper tout en < 5 s.

### 0.5 Sécurité

- Toutes les API routes content-gen → auth admin (`super_admin` ou `admin` ou nouveau rôle `editor_ai`).
- CSP nonce respecté (pas d'inline script généré).
- Sanitisation HTML obligatoire avant insertion DB (`DOMPurify` server-side `isomorphic-dompurify`).
- Aucune donnée client (booking, submission) ne fuit dans un prompt IA. Si besoin de cas concret = anonymiser au format `{secteur}` `{taille}` `{ville}`.

---

## 1. Contexte & doctrine intouchable

### 1.1 Brand & ton

- **Naming** : `Axion-IA` partout (jamais « Axion IA », « AxionIA », « Axion » seul). Identifiers JS conservent camelCase (`axionIA`). Cf. mémoire `[[axionia_naming_brand_vs_project]]`.
- **Positionnement** : **cabinet IA opérationnel** (FR) / **operational AI consultancy** (EN). Jamais « agence », « studio », « atelier ».
- **Personne morale** : OÜ estonienne — `pnpm anti-siren:check` interdit SIREN/SIRET/RCS.
- **Ton** : sobre, technique-pragmatique, focus ROI mesurable, jamais marketing-hype. Pas de « révolutionnaire », « unique », « le meilleur » (cf. spec § 5.3).
- **Voix** : 1ʳᵉ pers du pluriel discrète (« nous accompagnons », pas « je »).

### 1.1bis Doctrine langage — accessible aux cibles non-tech (v2.1)

> Tes cibles dominantes (dirigeants TPE/PME, écoles, mairies, comptables, avocats, RH, marketing) **ne sont pas technologues**. Un jargon non expliqué (LLM, RAG, embedding, fine-tuning, MCP, vector DB, agent multi-step) est **interdit** sauf si l'audience cible est explicitement tech (CTO, DSI, AI engineer).

**Règle pragmatique appliquée dans tous les generators** :

1. **Détection audience** : `ContentGenJob.targetAudienceOrganisation` + `targetSearchIntent` permettent au generator de détecter si la cible est tech ou non.

2. **Si audience non-tech (cas majoritaire)** :
   - Premier paragraphe = définition en français accessible (« nous appelons "assistant intelligent" tout système IA capable de comprendre vos documents et de rédiger pour vous »)
   - Ensuite le terme technique peut être utilisé ponctuellement avec rappel
   - **Pas plus de 3 termes techniques par 1 000 mots** sans glossaire intégré
   - Métaphores du quotidien business privilégiées (« comme un employé qui aurait lu vos 10 000 documents en 1 minute »)

3. **Si audience tech (CTO, dev, DSI)** :
   - Jargon attendu, contexte précis OK
   - Mais éviter le jargon gratuit / oratoire

**Glossaire de traduction obligatoire dans le system prompt** :

| Terme technique | Traduction accessible |
|---|---|
| LLM / Large Language Model | assistant intelligent · système IA conversationnel |
| RAG | recherche intelligente dans vos documents |
| Embedding · Vector database | indexation sémantique · moteur de recherche par sens |
| Fine-tuning | personnalisation de l'IA sur votre métier |
| Agent IA autonome multi-step | assistant qui enchaîne plusieurs tâches sans intervention |
| Prompt engineering | rédaction d'instructions claires pour l'IA |
| Token · Inference · Latency | requête · vitesse de réponse · coût unitaire |
| MCP / Model Context Protocol | (ne pas mentionner si cible non-tech) |
| Transformer · Attention mechanism | (ne pas mentionner sauf cible tech) |
| Hallucination | réponse erronée de l'IA |
| Multimodal | qui traite texte, image, audio simultanément |
| Knowledge graph | carte structurée des connaissances |

**Validation `posts:validate` étendue v2.1** : compte les termes techniques sans définition préalable. Si > 3/1 000 mots et audience = non-tech → `qualityScore -10 pts` (warning).

**Test E2E** : un dirigeant de PME de 50 personnes doit comprendre 100 % du contenu généré sans Google ni dictionnaire technique.

### 1.2 Doctrine éditoriale AxionIA-centric ≥ 95 %

Référence intouchable : mémoire `[[axionia_pseo_villes_livre_2026-05-08]]` + ADR 0004.

- Une page (ville, article, comparatif, FAQ) contient **≥ 95 % de contenu Axion-IA centric** : méthodologie, cas concrets, livrables, prix SSOT, paliers INSEE.
- **≤ 5 % de données INSEE** (population, PIB, secteurs dominants, communes voisines).
- Anti-doorway HCU 2024 : aucune page éditoriale clonée. Chaque ville/article a une **angle unique** (FAQ géolocalisée, secteur dominant, cas concret anonymisé).

### 1.3 SSOT à respecter

Avant tout prompt IA, le builder DOIT lire en SSOT :

| Domaine | SSOT | Helper |
|---|---|---|
| Tarifs & paliers | `src/content/pricing.ts` | `formatAmount()`, `getEntryLabel()` |
| Interventions taxonomy | `src/content/interventions-taxonomy.ts` + `interventions.ts` | `getInterventionFormat()` |
| Audit pyramide | `src/content/audit-taxonomy.ts` | `getAuditDetailConfig()` |
| Implementation | `src/content/implementation.ts` | — |
| Régions | `src/content/regions.ts` | `getRegionBySlug()` |
| Villes INSEE | `src/content/villes/data/<region>.ts` | `getVilleBySlug()` |
| Villes éditoriales | `src/content/villes/copy/<slug>.ts` | `getIndexableVilles()` |
| FAQ canoniques | DB `FAQ` table (admin CRUD) | `prisma.faq.findMany()` |
| Pricing notes & phrases interdites | `INTERVENTION_FEES_NOTE` dans `pricing.ts` | — |

**Toute valeur monétaire dans un contenu généré DOIT être dérivée via helper `formatAmount()`**. Aucun hardcode chiffré.

### 1.4 Performance budget (hérité d'AGENTS.md)

- LCP ≤ 1 800 ms p75, INP ≤ 100 ms p75, CLS = 0, First Load JS ≤ 75 KB gz/route.
- **Exception** : pages `/blog/<slug>` et `/implantations/<region>/<ville>` cachées CF agressivement → exclues du budget interactif.
- **Lighthouse CI** gate sur PRs touchant `src/app/**`.
- Toute image générée DOIT passer par `next/image` + AVIF + sizes responsive + `priority` only on LCP.

---

## 2. État initial observable

### 2.1 Ce qui existe déjà (re-utilisable)

| Brique | Localisation | État |
|---|---|---|
| Console admin 18 sections | `src/app/[locale]/(admin)/[adminPrefix]/` | ✅ Mature, patterns BlogForm/FAQForm/HelpForm établis |
| Données INSEE 2 157 villes ≥ 5 K hab | `src/content/villes/data/*.ts` (18 régions) | ✅ Auto-générées via `scripts/import-insee-villes.ts` |
| 13 régions métropole | `src/content/regions.ts` (315 lignes) | ✅ Pitchs FR/EN, PIB, secteurs dominants |
| Templates pages villes | `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (+ audit/par-ville, interventions/par-ville, implementation/par-ville) | ✅ SSG ~17 500 routes |
| Anti-doorway HCU | `getIndexableVilles()` + noindex meta robots dynamique | ✅ En place |
| Composants images | `Illustration.tsx`, `IllustrationPlaceholder.tsx`, `DetailHeroSchema.tsx` | ✅ AVIF/WebP, slots terracotta |
| Factories JSON-LD | `src/lib/seo.ts` (buildProductMetadata, buildFaqSpeakableJsonLd, buildPlaceJsonLd, buildLocalBusinessJsonLd, buildItemListJsonLd) | ✅ Production |
| Queue BullMQ + Redis | `src/server/queue/` + workers email/option/retention | ✅ Pattern établi |
| Prisma 5.22 | `prisma/schema.prisma` (1661 lignes, 18+ modèles) | ✅ Article / FAQ / CaseStudy / HelpArticle / Setting / Admin |
| i18n FR/EN | `src/i18n/routing.ts` + `next-intl` | ✅ Pathnames mapping exhaustif |
| Doctrine éditoriale | `_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md` (data model + tiers actés Will 2026-05-08) | ✅ Référence |

### 2.2 Ce qui n'existe PAS (à créer)

| Gap | Impact | Sprint |
|---|---|---|
| **Aucun SDK provider IA** (OpenAI, Anthropic, Perplexity) | 0 capacité génération | S1 |
| ~~Tables `KbDocument` / `KbChunk`~~ → **OBSOLÈTE v2.5** : KB réelle V4 mergée (`KnowledgeEntry` + 6 modèles `Knowledge*`). content-gen lit/alimente cet existant. | KB déjà codée KB-1→KB-20 | S1 (consommation) + S5 (KB feeder) |
| Aucune table `ContentGenJob` (job traceable DB) | Pas de tracking unifié | S1 |
| Aucune table `RssSource` / `RssItem` | Pas de pipeline RSS | S2 |
| Aucune table `ContentTemplate` (prompts versionnés) | Prompts hardcodés impossibles à itérer | S1 |
| Aucun helper `posts:validate` étendu | Pas de QA auto | S1 |
| Aucune route admin `/content-gen/*` | Pas d'UI pilotage | S2-S3 |
| Aucun système de toggle providers (DB-managed) | Will ne peut pas désactiver à chaud | S1 |
| Aucun système de coût tracking par job | Pas de cost cap effectif | S1 |
| Aucune table `GenerationLog` / `ContentMetric` | Pas de dashboard | S3 |
| Aucun mécanisme anti-plagiat (shingling/embeddings) | Risque HCU | S2 |
| Aucun cron retention/promotion tier | Lifecycle absent | S4 |
| Aucun fallback Unsplash + GPT-image | Pages sans images visuelles différenciées | S2 |
| Aucune file de validation Will (`pending_review`) | Tout passe direct en prod | S3 |

### 2.3 Inspiration SOS-Expat — patterns à transposer

D'après cartographie de `Mission_control_sos-expat/laravel-api/`, à transposer en TS/Prisma/BullMQ :

| Pattern SOS-Expat (Laravel) | Équivalent Axion-IA (Next 16 + Prisma) |
|---|---|
| `ContentOrchestratorService` (config DB, daily_target, distribution %, auto-pilot) | `src/server/content-gen/orchestrator.ts` + table `ContentGenConfig` |
| `ArticleGenerationService`, `LandingGenerationService`, etc. (services par type) | `src/server/content-gen/generators/{article,landing,comparison,guide,qa,rss}.ts` |
| `OpenAiService`, `ClaudeService`, `PerplexityService`, `UnsplashService` | `src/server/content-gen/providers/{openai,anthropic,perplexity,unsplash}.ts` |
| Jobs Laravel (`GenerateArticleJob`, etc.) avec `$tries=3` + backoff | BullMQ workers `src/server/queue/workers/content-gen-*.ts` |
| `PlagiarismService` (shingling Jaccard 5-gram) | `src/server/content-gen/quality/plagiarism.ts` |
| `GenerationGuardService` (dedup pré-IA) | `src/server/content-gen/quality/dedup-guard.ts` |
| `JsonLdService`, `HreflangService`, `GeoMetaService`, `SeoAnalysisService` | Étendre `src/lib/seo.ts` (déjà existant) |
| `ContentTemplate` Eloquent (title_template, variables, expansion_mode) | Table Prisma `ContentTemplate` |
| Dashboard React `ContentOrchestrator.tsx` (daily_target, alerts) | Page Next admin `/[adminPrefix]/content-gen/dashboard` |
| `PublishingEndpoint` (Firestore / WP / custom_api) | Pas de besoin — Axion-IA publie en DB Prisma + SSG/ISR direct |

---

## 3. Scope V1 / V2 / V3

### 3.1 V1 — MVP solide (4-6 sprints, 30-40j dev)

**Cible** : Will peut générer **manuellement depuis l'admin** chacun des 7 types, en choisissant provider IA + ville/secteur, avec validation 1 clic et publication contrôlée. Volume cible V1 = ≤ 5 K contenus / 6 mois.

**Inclus V1** :
- ✅ 7 types : landing ville, blog (4 sources), comparatif, guide pilier, Q/R dérivée, FAQ standalone, RSS-derived
- ✅ 3 providers : OpenAI (GPT-4o, GPT-4o-mini, GPT-image-1) primaire, Anthropic (Claude Opus 4.7 / Sonnet 4.6) fallback, Perplexity (Sonar) pour data
- ✅ Toggle providers depuis `/admin/content-gen/settings` (DB-managed)
- ✅ Pipeline RSS (ingest → dedup → reformulation → publication tier-2 default)
- ✅ Images Unsplash + GPT-image-1 + Placeholder fallback
- ✅ Anti-plagiat shingling 5-gram (Jaccard) + dedup-guard pré-IA
- ✅ Knowledge Base lite (markdown ingest → chunks + embeddings stockés Postgres + pgvector)
- ✅ Console admin : dashboard, templates, queue, jobs, kb, sources RSS, settings, costs
- ✅ Tracking coûts par provider par jour + cost cap
- ✅ Tier-2 default + 1-clic promotion tier-1 par Will

**Exclus V1 (V2/V3)** :
- ❌ Auto-pilot 24/7 (daily target auto-généré)
- ❌ Multi-auteurs IA (1 voix unique « Will » V1)
- ❌ A/B testing automatique des titres
- ❌ Synchronisation Indexing API Google
- ❌ Multi-langues > FR/EN
- ❌ Génération vidéo / podcast
- ❌ ML scoring qualité avancé (V1 = règles déterministes)
- ❌ Re-écriture intelligente sur changement SSOT (V2)

### 3.2 V2 — Industrialisation (Sprint 7-12, 25-35j dev)

- Auto-pilot configurable (daily_target = 5-50 articles/jour par type)
- Migration `src/content/blog/posts/<slug>.ts` → table Prisma `Article` (V2 = DB-driven)
- ISR Next 16 pour `/blog/<slug>` (au lieu de SSG complet)
- Indexing API Google + IndexNow (Bing/Yandex) — auto sur tier-1
- Search Console + Plausible integration : auto-promotion tier-2 → tier-1 si CTR > 5 %
- Multi-modèles parallèles (GPT-4o + Claude Sonnet en compétition, garder le meilleur)
- Knowledge Base avancée : ingest PDF + URLs + sitemaps externes
- **KeywordTracker** (parité SOS-Expat `KeywordTracker.tsx`) : table `KeywordTracking` (keyword, type, language, country, articlesUsingCount, searchVolumeEstimate, difficultyEstimate, trend), seed Google Search Console API + SerpAPI polling, page admin `/content-gen/keyword-tracking` avec filtres + sortie trending icons + gaps/cannibalization.
- **QualityDashboard avancé** : page `/admin/content-gen/quality` avec graphes par score (qualityScore, seoScore, readabilityScore, factCheckScore, editorialScore) × jour glissant, filtres tier/type/auteur, ranking top-10 worst & best.
- Fact-checking V2 : appel Perplexity de validation des claims chiffrés post-génération (`factCheckScore` rempli).
- Embeddings-based dedup (cosine < 0.85 = doublon global, plus précis que shingling).

### 3.3 V3 — Scale 100 K+ (Sprint 13+, ouvert)

- Sharding par région (worker par région)
- Cache Cloudflare Workers + edge SSG
- Embeddings dedup global (pgvector cosine < 0.85 = doublon)
- Score qualité ML (modèle propre fine-tuné sur articles Will validés)
- A/B testing titres + CTAs automatique
- Multi-langues (DE, IT, ES, NL) pour expansion EU

---

## 4. Architecture cible

### 4.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CONSOLE ADMIN (Next 16 RSC + Server Actions)                           │
│  /admin/content-gen/{dashboard,templates,queue,jobs,kb,rss,            │
│                      settings,costs,review-queue,publications}          │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ Server Actions + tRPC-style API routes (RPC pattern)
               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SERVICES SERVEUR (src/server/content-gen/)                             │
│  ├── orchestrator.ts          ← config DB, daily plan, kill-switch     │
│  ├── generators/              ← 1 service par type de contenu          │
│  │   ├── landing-ville.ts                                              │
│  │   ├── blog-article.ts                                               │
│  │   ├── blog-from-rss.ts                                              │
│  │   ├── blog-from-keywords.ts                                         │
│  │   ├── blog-from-title.ts                                            │
│  │   ├── comparison.ts                                                 │
│  │   ├── guide-pilier.ts                                               │
│  │   └── qa-derived.ts                                                 │
│  ├── providers/                                                        │
│  │   ├── openai.ts            ← GPT-4o + GPT-image-1                   │
│  │   ├── anthropic.ts         ← Claude Opus/Sonnet/Haiku (fallback)    │
│  │   ├── perplexity.ts        ← Sonar (data real-time + citations)     │
│  │   ├── unsplash.ts          ← images stock libres droits             │
│  │   └── provider-router.ts   ← primary + fallback + health-check      │
│  ├── prompts/                                                          │
│  │   ├── system-prompts/      ← rôles + doctrine + ton (par type)      │
│  │   ├── user-prompts/        ← templates input (paramétrés)           │
│  │   └── output-schemas/      ← Zod schemas validation sortie LLM      │
│  ├── kb/                                                                │
│  │   ├── ingest.ts            ← chunk + embed + store                  │
│  │   ├── retrieve.ts          ← semantic search via pgvector           │
│  │   └── rerank.ts            ← rerank par pertinence                  │
│  ├── quality/                                                          │
│  │   ├── plagiarism.ts        ← shingling + Jaccard                    │
│  │   ├── dedup-guard.ts       ← check pré-génération                   │
│  │   ├── seo-score.ts         ← scoring déterministe 0-100             │
│  │   ├── readability.ts       ← Flesch-Kincaid FR + EN                 │
│  │   └── doctrine-check.ts    ← anti-SIREN, anti-spammy, naming        │
│  ├── seo/                                                              │
│  │   ├── jsonld-builder.ts    ← extend src/lib/seo.ts                  │
│  │   ├── meta-builder.ts                                               │
│  │   └── sitemap-emitter.ts                                            │
│  ├── publish/                                                          │
│  │   ├── publish-blog.ts                                               │
│  │   ├── publish-ville-copy.ts ← écrit src/content/villes/copy/<slug>.ts │
│  │   ├── promote-tier.ts                                               │
│  │   └── revalidate.ts        ← Next revalidatePath/revalidateTag      │
│  └── cost/                                                              │
│      ├── tracker.ts                                                    │
│      └── cap.ts                                                        │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ Enqueue / dequeue
               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  QUEUE BullMQ + Redis                                                   │
│  Queues : content-gen, content-publish, kb-ingest, rss-fetch            │
│  Workers (pnpm worker) : 1 par queue, concurrency configurable          │
└──────────────┬──────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PROVIDERS EXTERNES                                                     │
│  OpenAI · Anthropic · Perplexity · Unsplash                             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  STOCKAGE                                                                │
│  Postgres (Prisma) — ContentGenJob, GenerationLog, ContentMetric,       │
│                       ContentTemplate, KbDocument, KbChunk (pgvector),  │
│                       RssSource, RssItem, ProviderConfig,               │
│                       CostLedger, ReviewQueue, etc.                     │
│  + tables existantes étendues : Article, FAQ, CaseStudy, HelpArticle    │
│  + fichiers TS (V1 transitoire) : src/content/blog/posts/<slug>.ts,     │
│                                    src/content/villes/copy/<slug>.ts    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.1bis Cloisonnement strict — règles de structure

> ⚠️ **Tout ce qui appartient au content generator vit dans des dossiers DÉDIÉS, préfixés `content-gen-` ou `/content-gen/`. RIEN ne se mélange avec le code existant (booking, admin existant, blog actuel).** Cette règle est testée par script `pnpm content-gen:isolation-check`.

```
Axion-IA/
├── prisma/
│   ├── schema.prisma                              ← schema principal (étendu, pas séparé)
│   ├── migrations/
│   │   ├── 20260601000000_add_content_gen_core/   ← migration DÉDIÉE, dossier nommé clairement
│   │   ├── 20260615000000_add_rss_pipeline/       ← idem
│   │   └── ...
│   └── seeds/
│       ├── booking.ts                              ← existing, intact
│       └── content-gen/                            ← 📁 nouveau dossier dédié
│           ├── index.ts                            ← orchestrateur seeds content-gen
│           ├── provider-config.ts
│           ├── content-templates.ts
│           ├── rss-sources.ts
│           └── aeo-prompts.ts                      (V2)
│
├── src/
│   ├── app/
│   │   └── [locale]/
│   │       ├── (admin)/[adminPrefix]/
│   │       │   ├── (sections existantes intactes)
│   │       │   └── content-gen/                    ← 📁 TOUT l'admin content-gen ici
│   │       │       ├── layout.tsx                  ← sous-nav dédiée content-gen
│   │       │       ├── page.tsx                    ← dashboard
│   │       │       ├── settings/
│   │       │       │   ├── page.tsx                ← providers + caps + toggles
│   │       │       │   └── kill-switch/page.tsx
│   │       │       ├── templates/{page.tsx, new/page.tsx, [id]/page.tsx}
│   │       │       ├── jobs/{page.tsx, [id]/page.tsx}
│   │       │       ├── queue/page.tsx
│   │       │       ├── review-queue/{page.tsx, [id]/page.tsx}
│   │       │       ├── geo/                        ← cockpit géographique (§15)
│   │       │       │   ├── page.tsx
│   │       │       │   ├── history/page.tsx
│   │       │       │   └── batches/[id]/page.tsx
│   │       │       ├── rss/{page.tsx, new/page.tsx, [id]/page.tsx}
│   │       │       ├── kb-readonly/                ← VIEW-ONLY STRICT (cf. §11 doctrine)
│   │       │       │   ├── page.tsx                ← liste KbDocument (lecture seule)
│   │       │       │   └── [id]/page.tsx           ← inspecter chunks (lecture seule)
│   │       │       │   ⚠️ AUCUN new/, AUCUN upload, AUCUN edit, AUCUN delete
│   │       │       │   ⚠️ Pour ingérer/modifier la KB : utiliser l'outil dédié de PROMPT-KNOWLEDGE-BASE-2026.md
│   │       │       ├── costs/page.tsx
│   │       │       ├── aeo-tests/page.tsx          (V2)
│   │       │       └── publications/page.tsx
│   │       └── (autres routes publiques intactes)
│   │
│   ├── server/
│   │   ├── (existing : queue/, mail/, auth/, etc. — INTACTS)
│   │   └── content-gen/                            ← 📁 TOUS les services serveur ici
│   │       ├── README.md                           ← overview + decision tree
│   │       ├── index.ts                            ← exports publics
│   │       ├── orchestrator.ts                     ← config, daily plan, kill-switch
│   │       ├── errors.ts                           ← ContentGenError + codes
│   │       ├── types.ts                            ← types partagés
│   │       │
│   │       ├── providers/                          ← 1 fichier par provider
│   │       │   ├── openai.ts
│   │       │   ├── openai-image.ts
│   │       │   ├── anthropic.ts
│   │       │   ├── perplexity.ts
│   │       │   ├── unsplash.ts
│   │       │   ├── provider-router.ts              ← primary + fallback + health
│   │       │   ├── health-check.ts
│   │       │   └── __tests__/
│   │       │
│   │       ├── generators/                         ← 1 fichier par ContentType
│   │       │   ├── landing-ville.ts
│   │       │   ├── blog-from-title.ts
│   │       │   ├── blog-from-keywords.ts
│   │       │   ├── blog-from-rss.ts
│   │       │   ├── blog-from-pillar.ts
│   │       │   ├── comparison.ts
│   │       │   ├── guide-pilier.ts
│   │       │   ├── qa-derived.ts
│   │       │   ├── faq-standalone.ts
│   │       │   └── __tests__/
│   │       │
│   │       ├── prompts/                            ← prompts versionnés (TS, pas DB seule)
│   │       │   ├── system/
│   │       │   │   ├── landing-ville.system.ts
│   │       │   │   ├── blog.system.ts
│   │       │   │   └── ...
│   │       │   ├── user/
│   │       │   │   ├── landing-ville.user.ts       ← mustache-like template
│   │       │   │   └── ...
│   │       │   ├── output-schemas/                 ← Zod schemas validation sortie LLM
│   │       │   │   ├── landing-ville.schema.ts
│   │       │   │   └── ...
│   │       │   └── shared/
│   │       │       ├── doctrine-axionia.ts         ← extrait doctrine intouchable
│   │       │       └── ton-de-marque.ts
│   │       │
│   │       ├── kb-client.ts                        ← READ-ONLY wrapper KB (§11.1)
│   │       │                                          ⚠️ aucun write path
│   │       │
│   │       ├── quality/
│   │       │   ├── plagiarism.ts                   ← shingling + Jaccard
│   │       │   ├── dedup-guard.ts                  ← check pré-IA
│   │       │   ├── seo-score.ts                    ← scoring 0-100
│   │       │   ├── readability.ts                  ← Flesch-Kincaid FR + EN
│   │       │   ├── doctrine-check.ts               ← naming, anti-SIREN, mots bannis
│   │       │   ├── ai-content-signals.ts           ← 6 signaux humains §9.6.6
│   │       │   └── __tests__/
│   │       │
│   │       ├── seo/                                ← extensions à src/lib/seo.ts
│   │       │   ├── jsonld-article.ts
│   │       │   ├── jsonld-landing-ville.ts
│   │       │   ├── jsonld-faq-speakable.ts
│   │       │   ├── jsonld-howto.ts
│   │       │   ├── jsonld-service.ts
│   │       │   ├── meta-builder.ts
│   │       │   ├── sitemap-emitter.ts
│   │       │   ├── llms-txt-emitter.ts             ← §9.6.2
│   │       │   ├── indexnow-client.ts              ← §9bis.1
│   │       │   ├── google-indexing-api.ts          (V2)
│   │       │   └── internal-linking.ts             ← §9bis.5
│   │       │
│   │       ├── images/
│   │       │   ├── gpt-image-client.ts
│   │       │   ├── unsplash-client.ts
│   │       │   ├── image-prompt-builder.ts
│   │       │   ├── alt-text-generator.ts
│   │       │   ├── image-optimizer.ts              ← sharp AVIF/WebP/JPG
│   │       │   └── __tests__/
│   │       │
│   │       ├── publish/
│   │       │   ├── publish-blog-ts-file.ts         ← V1 écrit src/content/blog/posts/<slug>.ts
│   │       │   ├── publish-blog-db.ts              ← V2 écrit table Article
│   │       │   ├── publish-ville-copy.ts           ← écrit src/content/villes/copy/<slug>.ts
│   │       │   ├── promote-tier.ts
│   │       │   ├── rollback.ts
│   │       │   └── revalidate.ts                   ← Next revalidatePath/revalidateTag
│   │       │
│   │       ├── geo/                                ← logique pilotage géographique §15
│   │       │   ├── villes-ranking.ts               ← 4 modes d'ordre
│   │       │   ├── batch-builder.ts
│   │       │   ├── progress-tracker.ts             ← état temps réel par ville/dépt/région
│   │       │   ├── geo-events.ts                   ← SSE/WebSocket events
│   │       │   └── geojson-loader.ts               ← lazy-load GeoJSON France
│   │       │
│   │       ├── rss/
│   │       │   ├── fetcher.ts                      ← parse RSS/Atom
│   │       │   ├── dedup.ts                        ← guid-based + content fingerprint
│   │       │   ├── reformulator.ts                 ← appel LLM pour reformulation profonde
│   │       │   └── source-config.ts
│   │       │
│   │       ├── cost/
│   │       │   ├── tracker.ts                      ← log dans CostLedger
│   │       │   ├── cap.ts                          ← assert under cap + kill switch
│   │       │   └── pricing-table.ts                ← USD par token/image par modèle
│   │       │
│   │       └── monitoring/
│   │           ├── metrics-writer.ts               ← ContentMetric daily aggregator
│   │           ├── alerts.ts                       ← Telegram + Sentry
│   │           └── slo.ts                          ← SLOs définis (latence, error rate)
│   │       │
│   │       │   ┌── 🆕 v2.3 — 4 sous-dossiers centralisation
│   │       │   ▼
│   │       ├── shared/                          ← utilitaires partagés
│   │       │   ├── slug-builder.ts                     ← kebab-case + diacritiques + max 80 chars
│   │       │   ├── date-formatter.ts                   ← ISO8601 + format FR
│   │       │   ├── text-utils.ts                       ← wordCount, readingTime, language detect
│   │       │   ├── html-sanitizer.ts                   ← wrapper DOMPurify
│   │       │   ├── geo-utils.ts                        ← Haversine, GeoCircle
│   │       │   └── retry-policy.ts                     ← backoff exponentiel partagé
│   │       │
│   │       ├── types/                           ← types TypeScript partagés
│   │       │   ├── generation.ts                       ← GenerationRequest, GenerationResult
│   │       │   ├── content.ts                          ← ContentMeta, FaqItem, KeyFact
│   │       │   ├── seo.ts                              ← SeoMeta, JsonLdBlock
│   │       │   ├── kb.ts                               ← KbChunkResult, KbRetrieveOptions
│   │       │   └── index.ts                            ← re-exports
│   │       │
│   │       ├── constants/                       ← constantes globales
│   │       │   ├── kb.ts                               ← KB_MIN_CHUNKS=300, CANONICAL_RATIO_MIN=0.6
│   │       │   ├── cost.ts                             ← COST_CAP_DEFAULTS, RATE_LIMITS
│   │       │   ├── quality.ts                          ← SCORE_THRESHOLDS, JACCARD_THRESHOLDS
│   │       │   ├── timeouts.ts                         ← TIMEOUT_LLM, TIMEOUT_IMAGE
│   │       │   ├── crawl.ts                            ← SITEMAP_CHUNK_SIZE, PRIORITY_BY_TIER
│   │       │   └── doctrine.ts                         ← AXIONIA_CENTRIC_MIN, FORBIDDEN_PATTERNS
│   │       │
│   │       └── logger.ts                        ← logger centralisé content-gen
│   │                                                  Format : { ts, level, module, jobId,
│   │                                                              campaignId, context }
│   │                                                  Sorties : console (dev) + Sentry (prod) +
│   │                                                            Redis pub/sub pour SSE admin
│   │
│   ├── server/queue/
│   │   ├── (workers existants : email, options — INTACTS)
│   │   └── workers/                                ← workers content-gen DANS le dossier existant
│   │       ├── content-gen-worker.ts               ← consume queue content-gen
│   │       ├── content-publish-worker.ts
│   │       ├── content-rss-fetch-worker.ts
│   │       └── content-geo-batch-worker.ts         ← repeat daily quota villes
│   │
│   ├── components/
│   │   └── admin/
│   │       └── content-gen/                        ← 📁 composants UI dédiés content-gen
│   │           ├── FranceMap.tsx                   ← react-simple-maps wrapper
│   │           ├── GeoStats.tsx
│   │           ├── ProgressByRegion.tsx
│   │           ├── BatchBuilder.tsx
│   │           ├── ProviderToggle.tsx
│   │           ├── CostChart.tsx
│   │           ├── JobStatusBadge.tsx
│   │           ├── JobLogStream.tsx                ← SSE log viewer
│   │           ├── ReviewPreview.tsx               ← iframe preview tier-1
│   │           ├── TemplateEditor.tsx
│   │           ├── KbChunkInspector.tsx            ← read-only
│   │           └── KillSwitchPanel.tsx
│   │
│   ├── lib/
│   │   └── seo.ts                                  ← étendu (pas séparé) — factories partagées
│   │
│   ├── content/
│   │   ├── (existing : pricing.ts, regions.ts, etc. — INTACTS)
│   │   ├── blog/
│   │   │   ├── posts/<slug>.ts                     ← écrits par publish-blog-ts-file.ts
│   │   │   └── (types.ts, index.ts existants intacts)
│   │   └── villes/
│   │       └── copy/<slug>.ts                      ← écrits par publish-ville-copy.ts
│   │
│   └── i18n/
│       └── messages/
│           ├── fr/content-gen.json                 ← 📁 i18n keys dédiées admin content-gen
│           └── en/content-gen.json
│
├── scripts/
│   ├── (existing intacts)
│   └── content-gen/                                ← 📁 scripts CLI dédiés
│       ├── seed.ts                                 ← `pnpm content-gen:seed`
│       ├── dryrun.ts                               ← `pnpm content-gen:dryrun`
│       ├── isolation-check.ts                     ← `pnpm content-gen:isolation-check`
│       ├── rss-fetch-once.ts
│       ├── posts-validate.ts                      ← étend existing
│       └── anti-plagiarism-check.ts
│
├── tests/
│   ├── (existing intacts)
│   └── content-gen/                                ← 📁 tests dédiés
│       ├── e2e/
│       │   ├── generate-landing-ville.spec.ts
│       │   ├── generate-blog-from-rss.spec.ts
│       │   └── review-and-publish.spec.ts
│       └── snapshots/
│           └── jsonld/                             ← 9 schémas snapshot tests
│
├── docs/
│   ├── (existing intacts)
│   └── content-gen/                                ← 📁 docs dédiés
│       ├── README.md
│       ├── decision-tree-providers.md
│       ├── prompt-engineering.md
│       ├── kb-integration.md
│       └── runbook.md                              ← ops cheatsheet
│
├── _AUDIT/
│   ├── PROMPT-CONTENT-FACTORY-SPEC.md              ← data model (existant)
│   ├── PROMPT-CONTENT-GENERATOR-MASTER-2026.md     ← ce fichier
│   ├── PROMPT-KNOWLEDGE-BASE-2026.md               ← outil KB (à créer par Will)
│   └── CONTENT-GEN-V1-CHANGELOG.md                 ← récap sprints
│
├── public/
│   ├── (existing intacts)
│   ├── llms.txt                                    ← émis dynamiquement (route)
│   └── illustrations/
│       └── generated/                              ← 📁 images générées dédiées
│           └── content-gen/<jobId>/<slot>.{avif,webp,jpg}
│
└── package.json                                    ← scripts npm `content-gen:*` ajoutés
```

#### Règles de cloisonnement (testées par `content-gen:isolation-check`)

1. **Aucun fichier hors des 7 dossiers/préfixes autorisés** :
   - `src/server/content-gen/**`
   - `src/app/[locale]/(admin)/[adminPrefix]/content-gen/**`
   - `src/components/admin/content-gen/**`
   - `src/server/queue/workers/content-*-worker.ts`
   - `prisma/seeds/content-gen/**` + `prisma/migrations/*_content_gen_*`
   - `scripts/content-gen/**`
   - `tests/content-gen/**` + `docs/content-gen/**`
   - `public/illustrations/generated/content-gen/**`

2. **Aucun import depuis booking/email/admin existant vers content-gen** : le content-gen est consommateur, jamais consommé.

3. **Aucun import depuis content-gen vers booking/email/auth existant** sauf : `src/server/db.ts` (Prisma client), `src/env.ts`, `src/i18n/*`, `src/lib/seo.ts` (étendu), helpers SSOT `src/content/*.ts` (read-only).

4. **Naming convention** : fichiers `content-gen-*` ou dossiers `content-gen/`. Tables Prisma préfixées implicitement (ContentGenJob, ContentTemplate, etc.).

5. **Migration unique de bootstrap** : 1 seule migration `add_content_gen_core` pour tout le bootstrap V1. Pas 12 micro-migrations.

6. **Tests d'isolation** : `pnpm content-gen:isolation-check` parcourt le diff et fail si un fichier hors zone est modifié sans whitelist explicite.

### 4.2 Stack technique cible

| Couche | Choix | Justification |
|---|---|---|
| Runtime | Node 22 LTS (déjà en place) | Aligné avec Next 16 |
| Web framework | Next.js 16 (App Router + RSC + Server Actions) | Déjà en place |
| ORM | Prisma 5.22 | Déjà en place + pgvector via `prisma-extension-pgvector` |
| Queue | BullMQ 5.76+ + Redis 7 (Coolify) | Déjà en place |
| LLM SDKs | `openai` ^4.80+, `@anthropic-ai/sdk` ^0.40+ (compat Opus 4.7 + Sonnet 4.6 + prompt caching), `axios`/`undici` pour Perplexity | À installer — versions à figer au moment du Sprint 1 selon dernières releases |
| Embeddings | OpenAI `text-embedding-3-large` (1536 dim) ou `text-embedding-3-small` (512 dim) selon coût | Compromis qualité/coût |
| Vector store | Postgres + extension `pgvector` (déjà disponible Coolify) | Évite Pinecone/Weaviate ext |
| Image generation | OpenAI `gpt-image-1` (modèle texte→image natif lancé 2025, successeur fonctionnel de DALL·E 3) + Unsplash fallback | Si `gpt-image-1` non disponible au moment du Sprint 2, fallback `dall-e-3` jusqu'à dispo |
| HTML sanitize | `isomorphic-dompurify` | Server-safe |
| Validation | Zod (déjà en place) | Schémas I/O LLM stricts |
| Sanitization sorties LLM | Zod + custom `parseOrRetry()` | Force JSON valide |
| Markdown rendu | `unified` + `remark` + `rehype` (déjà en place pour blog) | Aligné |
| Tests | Vitest + Playwright (déjà en place) | Tests unit + e2e |
| Observability | Sentry (déjà en place) + Plausible (déjà en place) + Telegram alerts (déjà en place) | Aligné |

---

## 5. Modèle de données — extension Prisma

### 5.1 Nouvelles tables (Prisma)

> **Naming** : snake_case en DB, camelCase en TS (Prisma maps).

```prisma
// ============ CONFIG GLOBAL ============

model ContentGenConfig {
  id                    String   @id @default(cuid())
  key                   String   @unique // "openai_enabled" | "anthropic_enabled" | "perplexity_enabled" | "daily_target_blog" | etc.
  value                 Json
  description           String?
  updatedAt             DateTime @updatedAt
  updatedBy             String?
}

model ProviderConfig {
  id                    String   @id @default(cuid())
  provider              ProviderKey @unique // openai | anthropic | perplexity | unsplash
  enabled               Boolean  @default(true)
  primary               Boolean  @default(false) // 1 seul primary par "role"
  role                  ProviderRole // text | image | data | stock_image
  model                 String   // "gpt-4o", "claude-sonnet-4-6", "sonar", ...
  fallbackProviderId    String?
  monthlyCapUsd         Decimal  @db.Decimal(10, 2)
  currentMonthSpentUsd  Decimal  @db.Decimal(10, 2) @default(0)
  rateLimitRpm          Int?
  rateLimitTpm          Int?
  apiKeyEnvVar          String   // "OPENAI_API_KEY"
  extraConfig           Json?    // headers, params, etc.
  updatedAt             DateTime @updatedAt
}

enum ProviderKey { openai anthropic perplexity unsplash gpt_image }
enum ProviderRole { text image data stock_image rerank }

// ============ TEMPLATES PROMPTS ============

model ContentTemplate {
  id                    String   @id @default(cuid())
  slug                  String   @unique // "landing-ville-v2", "blog-from-rss-v1"
  contentType           ContentType
  variant               String?  // "default" | "secteur-comptable" | "secteur-industrie" | "taille-tpe" | ... (cf. § 6.1bis multi-variants SOS-Expat-parity)
  version               Int      @default(1)
  isActive              Boolean  @default(true)
  name                  String
  description           String?
  systemPrompt          String   @db.Text
  userPromptTemplate    String   @db.Text // mustache-like {{var}}
  outputSchemaZod       String   @db.Text // Zod schema serialisé
  variables             Json     // schema des variables d'entrée

  // Expansion modes (parité SOS-Expat ContentTemplate.expansion_mode)
  expansionMode         ExpansionMode @default(manual)
  expansionValues       Json?    // array de slugs/ids selon mode (ex: villeSlugs[], keywords[], questionIds[])
  totalItems            Int      @default(0)
  generatedItems        Int      @default(0)
  publishedItems        Int      @default(0)
  failedItems           Int      @default(0)

  defaultModel          String?  // override le primary provider
  defaultTemperature    Decimal? @db.Decimal(3, 2)
  defaultMaxTokens      Int?
  estimatedCostUsd      Decimal? @db.Decimal(10, 4)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  createdBy             String?
  jobs                  ContentGenJob[]
}

enum ExpansionMode {
  manual            // user fournit la liste d'items à chaque appel
  all_villes        // itère sur toutes les villes >5K hab indexables (~2 157)
  all_regions       // itère sur les 13 régions
  custom_villes     // sous-ensemble de villeSlugs (drag&drop admin)
  from_keywords     // liste de keywords (1 article par keyword)
  from_questions    // depuis ContentQuestion table (V2)
  from_rss_items    // depuis RssItem non processés
  from_csv          // upload CSV de variables
}

enum ContentType {
  landing_ville
  blog_article
  blog_from_rss
  blog_from_keywords
  blog_from_title
  comparison
  guide_pilier
  qa_derived
  faq_standalone
}

// ============ JOBS & TRACKING ============

model ContentGenJob {
  id                    String   @id @default(cuid())
  idempotencyKey        String   @unique // hash(type + input + templateId)
  contentType           ContentType
  status                ContentGenJobStatus @default(queued)
  priority              Int      @default(5) // 1=high, 10=low
  templateId            String?
  template              ContentTemplate? @relation(fields: [templateId], references: [id])

  // Inputs
  inputPayload          Json     // ville slug, keyword, RSS item id, etc.
  targetLocale          Locale   @default(fr)  // V1 FR-only (cf. décision v1.2). Type scalaire pas array — Prisma 5.x ne supporte pas enum[] natif.

  // Provider routing
  primaryProvider       ProviderKey
  fallbackProvider      ProviderKey?
  modelUsed             String?

  // Execution
  startedAt             DateTime?
  completedAt           DateTime?
  durationMs            Int?
  retryCount            Int      @default(0)
  errorMessage          String?  @db.Text

  // Outputs
  outputBlogPostId      String?  // ref vers Article
  outputVilleCopyPath   String?  // chemin TS file pour villes
  outputFaqIds          String[] @default([])
  outputQaIds           String[] @default([])
  outputJsonRaw         Json?    // sortie LLM brute (audit trail)

  // Quality
  qualityScore          Int?     // 0-100
  plagiarismScore       Decimal? @db.Decimal(5, 2)
  readabilityScore      Decimal? @db.Decimal(5, 2)
  doctrineCheckPassed   Boolean?
  seoScore              Int?

  // Cost
  tokensInput           Int?
  tokensOutput          Int?
  imageCount            Int?
  costUsd               Decimal? @db.Decimal(10, 4)
  costBreakdown         Json?    // { openai: 0.04, perplexity: 0.01, unsplash: 0, gpt_image: 0.08 }

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  createdBy             String?
  logs                  GenerationLog[]
  reviewQueue           ReviewQueue?
}

enum ContentGenJobStatus {
  queued
  running
  generating_text
  generating_image
  running_qa
  quality_improving // v1.7 — passage boucle qualité auto si score 40-74 (cf. § 27)
  needs_review
  approved
  publishing
  published
  failed
  cancelled
}

model GenerationLog {
  id                    String   @id @default(cuid())
  jobId                 String
  job                   ContentGenJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  level                 LogLevel @default(info)
  step                  String   // "kb_retrieve", "llm_call", "image_gen", "validation", ...
  message               String   @db.Text
  metadata              Json?
  timestamp             DateTime @default(now())
}

enum LogLevel { debug info warn error }

model ContentMetric {
  id                    String   @id @default(cuid())
  date                  DateTime @db.Date
  contentType           ContentType
  provider              ProviderKey?
  generated             Int      @default(0)
  published             Int      @default(0)
  failed                Int      @default(0)
  needsReview           Int      @default(0)
  duplicatesBlocked     Int      @default(0)
  totalCostUsd          Decimal  @default(0) @db.Decimal(10, 4)
  totalTokensInput      BigInt   @default(0)
  totalTokensOutput     BigInt   @default(0)
  avgQualityScore       Decimal? @db.Decimal(5, 2)

  @@unique([date, contentType, provider])
}

model CostLedger {
  id                    String   @id @default(cuid())
  jobId                 String?
  provider              ProviderKey
  model                 String
  tokensInput           Int      @default(0)
  tokensOutput          Int      @default(0)
  costUsd               Decimal  @db.Decimal(10, 4)
  timestamp             DateTime @default(now())
  @@index([provider, timestamp])
}

// ============ REVIEW QUEUE ============

model ReviewQueue {
  id                    String   @id @default(cuid())
  jobId                 String   @unique
  job                   ContentGenJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  status                ReviewStatus @default(pending)
  reviewedBy            String?
  reviewNotes           String?  @db.Text
  reviewedAt            DateTime?
  promotedToTier1At     DateTime?
  createdAt             DateTime @default(now())
}

enum ReviewStatus { pending approved rejected needs_edits promoted_t1 }

// ============ KNOWLEDGE BASE (RAG) ============
//
// ⚠️ ⚠️ PATCH v2.5 (Sprint S0bis 2026-05-14) — LES 2 MODÈLES CI-DESSOUS SONT OBSOLÈTES
// La KB réelle (KB V4 Knowledge Factory) est CODÉE et MERGÉE sur main depuis 2026-05-14
// (commit `bd0f831`). Modèles réels = `KnowledgeEntry` + 6 relations `Knowledge*`
// dans `axionia/prisma/schema.prisma:1823+`. Voir références skill content-gen :
//   - references/kb-doctrine.md v2.0 (contrat consommation + alimentation)
//   - references/skill-orchestration.md (frontière content-gen / KB sibling)
//
// NE PAS implémenter `KbDocument` ni `KbChunk` ci-dessous. Le kb-client doit utiliser
// `prisma.knowledgeEntry` + `KnowledgeTranslation.embedding` (pgvector déjà migré
// par migration `kb_v4_pgvector_embeddings`).
//
// Conservé ci-dessous pour archive uniquement — ne PAS migrer.

model KbDocument {
  id                    String   @id @default(cuid())
  slug                  String   @unique
  title                 String
  source                KbSource
  sourceUrl             String?
  sourceFilePath        String?
  contentMd             String   @db.Text
  language              Locale   @default(fr)
  tags                  String[] @default([])
  sectors               String[] @default([])
  companySizes          String[] @default([])
  serviceTypes          String[] @default([])
  isAxionIaCanonical    Boolean  @default(false) // priorité retrieval
  publishedAt           DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  chunks                KbChunk[]
}

enum KbSource { manual_md crawl_url pdf_upload generated_internal rss_curated }

model KbChunk {
  id                    String   @id @default(cuid())
  documentId            String
  document              KbDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  chunkIndex            Int
  contentMd             String   @db.Text
  tokens                Int
  embedding             Unsupported("vector(1536)") // pgvector
  language              Locale
  createdAt             DateTime @default(now())
  @@index([documentId])
}

// ============ RSS PIPELINE ============

model RssSource {
  id                    String   @id @default(cuid())
  url                   String   @unique
  name                  String
  language              Locale   @default(fr)
  enabled               Boolean  @default(true)
  category              String?
  defaultTags           String[] @default([])
  pollIntervalMin       Int      @default(60)
  lastFetchedAt         DateTime?
  lastErrorAt           DateTime?
  lastErrorMessage      String?
  createdAt             DateTime @default(now())
  items                 RssItem[]
}

model RssItem {
  id                    String   @id @default(cuid())
  sourceId              String
  source                RssSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  guid                  String
  title                 String
  link                  String
  publishedAt           DateTime?
  summary               String?  @db.Text
  content               String?  @db.Text
  processed             Boolean  @default(false)
  processedAt           DateTime?
  contentGenJobId       String?
  createdAt             DateTime @default(now())
  @@unique([sourceId, guid])
  @@index([processed, publishedAt])
}

// ============ EXTENSIONS TABLES EXISTANTES ============

// Article (existant) — ajouter (parité SOS-Expat ContentMetric par article) :
// indexationTier      IndexationTier  @default(tier_2_noindex_follow)
// qualityScore        Int?            // score global 0-100 (cf. § 10.2)
// seoScore            Int?            // sous-score SEO 0-100
// readabilityScore    Decimal?        // Flesch-Kincaid FR (0-100)
// factCheckScore      Int?            // 0-100 — V2 quand fact-checking activé
// editorialScore      Int?            // 0-100 — relecture Will / Manon
// plagiarismScore     Decimal?        // Jaccard max vs corpus (0-1)
// promotedAt          DateTime?       // date promotion tier-1
// generatedByJobId    String?         // FK ContentGenJob
// directAnswer        String?         @db.Text
// faqJson             Json?
// kbChunkIds          String[] @default([])  // audit trail KB sources utilisées
// templateVariant     String?         // variant du ContentTemplate qui a généré

enum IndexationTier {
  tier_1_indexable
  tier_2_noindex_follow
  tier_3_noindex_nofollow
}

// Enum Locale — déclaré explicitement (Prisma exige déclaration, même si tu réutilises l'existante)
// Si déjà présent dans schema.prisma actuel : NE PAS le redéclarer, juste s'assurer qu'il vaut bien { fr, en }.
enum Locale {
  fr
  en
}

// Migration Article — colonnes à ajouter sur la table Article existante (sous-migration au sein de add_content_gen_core) :
// ALTER TABLE "Article"
//   ADD COLUMN "indexationTier" "IndexationTier" NOT NULL DEFAULT 'tier_2_noindex_follow',
//   ADD COLUMN "qualityScore" INTEGER,
//   ADD COLUMN "promotedAt" TIMESTAMP(3),
//   ADD COLUMN "generatedByJobId" TEXT,
//   ADD COLUMN "directAnswer" TEXT,
//   ADD COLUMN "faqJson" JSONB,
//   ADD CONSTRAINT "Article_generatedByJobId_fkey" FOREIGN KEY ("generatedByJobId") REFERENCES "ContentGenJob"("id") ON DELETE SET NULL;
// + index : CREATE INDEX "Article_indexationTier_idx" ON "Article"("indexationTier");
```

### 5.1bis Inventaire complet des tables & enums (cross-reference v2.4 + v2.5 KB réelle + Web Vitals)

> Cette sous-section centralise les modèles et enums qui ne sont pas déclarés dans la liste « nouvelles tables » § 5.1 ci-dessus mais qui sont **partie intégrante de la migration `add_content_gen_core` Sprint 1**. Cross-ref ajouté 2026-05-14 suite audit pré-implémentation (cf. AGT-VC2 + Sprint S0bis 2026-05-14).
>
> ⚠️ **PATCH v2.5 majeur (Sprint S0bis 2026-05-14)** : la KB N'EST PLUS `KbDocument` + `KbChunk` (artefacts obsolètes pré-V4). La KB réelle V4 mergée sur main = `KnowledgeEntry` + 6 modèles `Knowledge*` (cf. `axionia/prisma/schema.prisma:1823+`). Le content-gen **consomme ET alimente** ces tables existantes — il ne crée PAS un système parallèle. Toute migration content-gen qui crée `KbDocument` ou `KbChunk` = BUG. Voir `.claude/skills/.../references/kb-doctrine.md` pour le contrat complet.

**Web Vitals tables (Sprint S0bis 2026-05-14)** :

| Table | Section | Sprint |
|---|---|---|
| `WebVitalSample` (URL, metric, value, rating, sessionId, pageType, knowledgeEntryId, idx composites) | `references/web-vitals-integration.md` | Sprint 1 |

Enums associés :
- `WebVitalMetric` : `LCP`, `INP`, `CLS`, `FCP`, `TTFB`, `TBT`
- `WebVitalRating` : `good`, `needs_improvement`, `poor`

**Tables additionnelles à inclure dans `add_content_gen_core` (Sprint 1)** :

| Table | Définie en | Sprint |
|---|---|---|
| `CoverageCampaign` | § 25.3 (v1.7) | Sprint 1 |
| `CoverageDistributionProfile` | § 25.3 (v1.7) | Sprint 1 |
| `AudienceMixProfile` | § 25 (v1.7) | Sprint 1 |
| `AuthorProfile` (avec `isPersona`, `personaDisclaimer`, **`aiGenerated`**, **`photoAlt`** v2.1) | § 12.1bis + § 12.1 doctrine Manon | Sprint 1 |
| `BannedPhrase` | § 25 + § 21 doctrine | Sprint 1 |
| `ExternalReference` (avec `trustTier`) | § 9bis.5bis (v2.2) | Sprint 1 |
| `ContentCitation` | § 9bis.5bis (v2.2) | Sprint 1 |
| Extension `FAQ` (slug, parentArticleId, ...) | § 29.2 (v1.7) | Sprint 1 |
| Extension `Article` (isNews v1.7) | § 28.2 | Sprint 1 |

**Enums additionnels (16 au total V1)** :

| Enum | Valeurs | Définie en |
|---|---|---|
| `SearchIntent` | informational, commercial_investigation, transactional, navigational, local | § 26.1 |
| `TrustTier` | official, high, standard, low, excluded | § 9bis.5bis |
| `CoverageStatus` | draft, queued, running, paused, completed, failed, cancelled | § 25.3 |
| `CoverageScope` | ville, departement, region, multi | § 25.3 |
| `CompanySize` | tpe, pme, eti, grande_entreprise (INSEE strict) | § 25 |
| `OrganisationType` | 12 valeurs (entreprise_privee, ecole, universite, …) | § 25 |

→ `ContentGenJob` doit inclure colonne `targetSearchIntent SearchIntent` (NOT NULL) cf. § 26.3.
→ `Article` doit inclure colonne `searchIntent SearchIntent?` (cohérence post-publication).

### 5.2 Migrations

- **Sprint 1** : 1 migration unique `add_content_gen_core` regroupant : (a) tables § 5.1 (ContentGenConfig, ProviderConfig, ContentTemplate, ContentGenJob, GenerationLog, ContentMetric, CostLedger, ReviewQueue, KbDocument, KbChunk), (b) tables § 5.1bis (CoverageCampaign, CoverageDistributionProfile, AudienceMixProfile, AuthorProfile, BannedPhrase, ExternalReference, ContentCitation), (c) 16 enums dont SearchIntent + TrustTier + CompanySize + OrganisationType, (d) extension pgvector, (e) colonnes ajoutées sur Article + FAQ.
- **Sprint 2** : 1 migration `add_rss_pipeline` (RssSource, RssItem).
- Migrations Prisma + `migrate deploy` Coolify post-push.
- Backfill : aucune donnée existante à migrer (V1 part de zéro côté tables nouvelles).

### 5.3 Seeds nécessaires

- `prisma/seeds/provider-config.ts` : 5 rows (openai-text, openai-image, anthropic-text, perplexity-data, unsplash-stock) avec defaults.
- `prisma/seeds/content-templates.ts` : 9 rows (1 par ContentType) avec system prompt + user template + Zod schema sérialisé.
- ~~`prisma/seeds/kb-axionia-canonical.ts`~~ → **retiré**. La KB est ingérée exclusivement par l'outil dédié de `PROMPT-KNOWLEDGE-BASE-2026.md`. Le seed du content-generator NE touche PAS aux tables `KbDocument` / `KbChunk`. Le hard gate § 11.2 (≥ 300 chunks AxionIA-canoniques) garantit qu'on ne lance pas de génération tant que la KB externe n'a pas atteint le seuil.
- Idempotent : `upsert` partout.

---

## 6. Spécifications par type de contenu

> Chaque type a : (a) trigger d'invocation, (b) inputs requis, (c) pipeline interne, (d) sortie cible, (e) gates qualité.

### 6.1 Landings villes — 4 templates dédiés par ville (v2.1)

> **Doctrine v2.1 acté Will 2026-05-14** : pour chaque ville lancée, le content-gen produit **4 landings villes dédiées** (pas 1 seule). Égalité absolue : Grenoble et Saint-Marcellin reçoivent les 4 templates identiquement.

| # | Template | URL pattern | Focus | Volume V1 |
|---|---|---|---|---|
| 1 | **Landing générale** | `/fr/implantations/[region]/[ville]` | Vue d'ensemble tous services + écosystème local + parcours bout-en-bout | 1 par ville |
| 2 | **Landing audit** | `/fr/audit/par-ville/[ville]` | 3 niveaux audit (Flash 490 € / Ciblé / Stratégique PME / Stratégique ETI) + parcours suite (interventions, implémentation) | 1 par ville |
| 3 | **Landing interventions** | `/fr/interventions/par-ville/[ville]` | Module 1 — 14 formats détaillés (Démarrage Express / Atelier ciblé / Essentielle / Approfondie / Dirigeants 1-to-1 / Conférence / Keynote / Coaching individuel) + parcours amont (audit) et aval (impl) | 1 par ville |
| 4 | **Landing implémentation** | `/fr/implementation/par-ville/[ville]` | Module 3 — POC 990-4 900 € / Mission PME 8-25 K€ / Mission ETI 25-80 K€ / Grand programme / IA Custom 8-50 K€ + parcours amont (audit, interventions formation équipes) | 1 par ville |

→ **Pipeline 1 V1 = 4 × 2 280 = ~9 120 landings villes** + post-process Q/R auto (8 par landing) = **~82 080 surfaces SEO bout-en-bout**.

### 6.1.A Parcours client bout-en-bout — section obligatoire dans les 4 templates (v2.1)

Chaque landing ville (les 4 templates) DOIT inclure une section H2 obligatoire :

```
H2 : « Audit → Formation → Implémentation : votre parcours à [Ville] »

Contenu : explication accessible (langage non-technique) du parcours en 3 étapes :

  Étape 1 — AUDIT (point de départ recommandé)
    Comprendre où l'IA peut faire gagner du temps dans votre entreprise.
    3 niveaux selon votre ambition :
    - Audit Flash 490 € (à distance) ou 890 € (sur site) — 1 journée
    - Audit Ciblé 1 900-3 900 € — 1 département en profondeur
    - Audit Stratégique 4 900-12 000 € — multi-services ou multi-sites

  Étape 2 — FORMATION DE VOS ÉQUIPES (en parallèle ou après l'audit)
    Vos collaborateurs apprennent à utiliser l'IA dans leur métier réel.
    14 formats au choix selon votre cible :
    - Pour démarrer : Démarrage Express (4h) ou Atelier ciblé (4h)
    - Pour aller plus loin : Essentielle (1 jour) ou Approfondie (2 jours)
    - Pour les dirigeants : Productivité dirigeant (1-to-1) ou Vision IA stratégique
    - Pour mobiliser toute l'entreprise : Conférence plénière ou Keynote
    - Pour des trajectoires individuelles : Coaching Découverte ou Avancé

  Étape 3 — IMPLÉMENTATION (passage à la production)
    L'IA installée dans vos outils, votre quotidien, avec votre équipe formée.
    4 niveaux selon votre envergure :
    - POC 990-4 900 € — preuve sur 1 cas
    - Mission PME 8-25 K€ — déploiement multi-cas
    - Mission ETI 25-80 K€ — multi-BU
    - Grand programme — sur devis transformation profonde
    - IA Custom 8-50 K€ — solution sur-mesure 4-12 semaines

  → Beaucoup d'entreprises font le parcours complet en 6-12 mois.
     D'autres s'arrêtent à l'audit Flash si elles ont les compétences en interne.
     C'est à vous de choisir.

+ Schéma visuel SVG des 3 étapes (composant <ParcoursBoutEnBout />)

+ CTA contextuel selon focus de la landing :
  - Landing générale → « Discutons de votre situation » → /fr/reserver
  - Landing audit → « Réserver un audit Flash à [Ville] » → /fr/reserver?type=audit-flash&source=ville-[slug]
  - Landing interventions → « Voir nos 14 formats d'intervention » → /fr/interventions
  - Landing implémentation → « Démarrer un POC à [Ville] » → /fr/reserver?type=poc&source=ville-[slug]
```

Cette section est **non négociable** : valideur `posts:validate` bloque la publication tier-1 si elle est manquante ou tronquée.

### 6.1.B Keywords services × villes — templates dynamiques (v2.1 égalité absolue)

> **Doctrine v2.1 acté Will 2026-05-14** : aucune discrimination keywords entre grandes villes (Grenoble, Lyon) et petites villes ≥ 5 K hab (Saint-Marcellin, Voiron, etc.). **Toutes les villes lancées reçoivent les mêmes 12 keywords services primary**, dérivés dynamiquement au runtime par le generator.

Le content-gen NE stocke PAS les keywords par ville en DB. À la place, il utilise des **templates × variables** au runtime :

```ts
// Templates 12 services × variable ville
const KEYWORD_TEMPLATES_PER_VILLE = [
  "audit IA {ville}",
  "audit IA Flash {ville}",
  "audit IA Stratégique {ville}",
  "intervention IA {ville}",
  "formation IA {ville}",
  "formation IA dirigeants {ville}",
  "atelier IA {ville}",
  "conférence IA {ville}",
  "implémentation IA {ville}",
  "IA custom {ville}",
  "chatbot IA entreprise {ville}",
  "automatisation IA {ville}",
  "agent IA autonome {ville}",
  "cabinet IA opérationnel {ville}",
];

// Pour chaque ville lancée → multiplication automatique
// Grenoble → ["audit IA Grenoble", "audit IA Flash Grenoble", ... 14 keywords]
// Saint-Marcellin → ["audit IA Saint-Marcellin", "audit IA Flash Saint-Marcellin", ... 14 keywords IDENTIQUES en structure]
```

**Sélection runtime** : selon le template landing :
- Landing **générale** : 4-5 keywords primary mixés (« audit IA {ville} », « intervention IA {ville} », « implémentation IA {ville} », « cabinet IA opérationnel {ville} »)
- Landing **audit** : 4-5 keywords primary focus audit (« audit IA {ville} », « audit IA Flash {ville} », « audit IA Ciblé {ville} », « audit IA Stratégique {ville} »)
- Landing **interventions** : 4-5 keywords primary focus interventions (« intervention IA {ville} », « formation IA {ville} », « atelier IA {ville} », « conférence IA {ville} »)
- Landing **implémentation** : 4-5 keywords primary focus impl (« implémentation IA {ville} », « IA custom {ville} », « chatbot IA entreprise {ville} », « agent IA autonome {ville} »)

**Conséquences SEO** :
- Chaque ville indexée sur **14 keywords services systématiques** + variations + ville mère du département + région
- Égalité absolue entre Grenoble et Saint-Marcellin sur les 14 services Axion-IA
- Pas de discrimination de volume keywords entre grandes et petites villes
- Différence ranking finale dépendra de : qualité contenu (égalitaire), backlinks (V2), volumes search Google (intrinsèque à chaque ville)

**Seed renommé** : `keywords.csv` → `keyword-templates.csv` (50-80 templates avec placeholders, pas 500 keywords statiques).

### 6.1.C Pipeline génération — 1 ville = 4 jobs `landing_ville` parallèles

Quand Will lance la génération d'une ville (manuellement ou via vague) :

```
1 ville sélectionnée → orchestrator enqueue 4 jobs ContentGenJob :
  - Job 1 : contentType=landing_ville, variant=default
  - Job 2 : contentType=landing_ville, variant=focus_audit
  - Job 3 : contentType=landing_ville, variant=focus_interventions
  - Job 4 : contentType=landing_ville, variant=focus_implementation

Les 4 jobs traitent en parallèle (concurrency BullMQ) :
  → KB retrieve (partagé) ~200 ms
  → Perplexity data (partagé si même ville) ~3-8 s
  → 4 LLM calls en // (streaming + early image gen)
  → 4 × Unsplash image queries (1 hero chacune)
  → Validation Zod + plagiarism (par job)
  → 4 × write file dans templates respectifs

Durée totale : ~120-150 s (vs 90 s pour 1 seul) — économie KB cache + Perplexity cache partagés.
Coût total : ~$1.50-2.00 pour 4 landings d'une même ville (vs $0.50 pour 1).
Sortie : 4 landings + 4 × 8 = 32 pages Q/R indexables = 36 surfaces SEO pour cette ville.
```

### 6.1.D Sub-spec ancienne (à conserver pour référence)

**Trigger** : Admin sélectionne 1 ville (slug) + langue + paramètres avancés (fokus secteur, taille, service). Bouton « Générer copy ville ».

**Inputs requis** :
- `villeSlug` (FR slug INSEE)
- `regionSlug`
- `serviceTypes` (par défaut : audit + interventions + implementation)
- `dominantSectors` (auto-détecté depuis `regions.ts.economicMakeup` + override possible)
- `localCompanyExamples` (optionnel — entreprises connues localement, anonymisées si récentes)
- `caseStudyAngle` (auto-suggéré depuis case-studies existants)

**Pipeline** :
1. **Resolve SSOT** : load `villes/data/<region>.ts` → INSEE pop, surface, codes ; `regions.ts` → PIB, secteurs ; communes voisines via Haversine (`src/lib/geo.ts`).
2. **Retrieve KB** : embed `"audit IA ville {ville} secteur {dominant}"` → top-8 chunks.
3. **Perplexity data run** (si toggle ON) : `query = "Tissu économique entreprises {ville} 2026 secteurs IT comptabilité industrie"`, `search_recency_filter=year`. Récupère 3-5 citations.
4. **GPT-4o text gen** avec system prompt § 6.1.1 + user prompt § 6.1.2 (length ~5000 mots structurés).
5. **Validate Zod** : 10 sections obligatoires (hero, contexte, paliers INSEE, services × ville, cas concret, FAQ géo, communes voisines, CTA, JSON-LD data, meta).
6. **GPT-image-1** : 2 images (hero + section méthodologie) avec prompt « architecture urbaine {ville} + visualisation IA opérationnelle, style éditorial sobre, palette terracotta #C45A3E + crème #FAF7F2 ». Fallback Unsplash si toggle GPT-image OFF.
7. **Plagiarism check** : shingling vs autres villes existantes → si Jaccard > 0.20 → re-générer section diverging.
8. **Doctrine check** : ≥ 95 % AxionIA-centric (heuristic : ratio mots Axion vs mots INSEE), 0 SIREN/SIRET, naming Axion-IA, pas de mots bannis.
9. **SEO build** : meta title 50-60 chars `"Audit IA à {Ville} — Cabinet opérationnel | Axion-IA"`, description 140-160 chars, JSON-LD (LocalBusiness + Place + Service × N + FAQPage Speakable + BreadcrumbList + ItemList communes voisines).
10. **Write file** : `src/content/villes/copy/<slug>.ts` (TS module typé `VilleCopy`) + commit auto OR review queue (selon config).
11. **Trigger build** : `revalidatePath('/fr/implantations/[region]/[ville]')` + `revalidatePath('/en/implantations/[region]/[ville]')`.

**Sortie cible** : Fichier `src/content/villes/copy/<ville-slug>.ts` (gold standard ~5 000 mots cap 95 % AxionIA-centric), indexable dès copy ajouté.

**Gates qualité** :
- Word count ≥ 4 500 mots cumulés
- ≥ 10 sections distinctes
- ≥ 6 FAQ items géolocalisées
- 5 JSON-LD schemas émis
- Plagiarism < 20 % vs corpus existant
- Doctrine check passed
- `qualityScore` ≥ 75 (sinon → review queue)

#### 6.1bis Variantes de template landing ville (parité SOS-Expat)

Le `ContentTemplate.variant` permet d'avoir plusieurs templates landing ville selon **angle stratégique**, comme SOS-Expat (12+ templates `clients-urgence`, `lawyers-premium`, etc.). AxionIA V1 propose **6 variantes** :

| Variant | Angle | Inputs spécifiques | Use case |
|---|---|---|---|
| `default` | Audit + Interventions + Implémentation équilibré | aucun | défaut pour toutes villes |
| `secteur-industrie` | Focus IA industrielle | `dominantSector="industrie"` | Mulhouse, Saint-Étienne, Le Havre |
| `secteur-comptable` | Focus IA cabinet comptable | `dominantSector="comptabilite"` | grandes villes tertiaires |
| `secteur-juridique` | Focus IA cabinet juridique | `dominantSector="juridique"` | Paris, Lyon, Bordeaux |
| `taille-tpe` | Focus TPE/auto-entrepreneurs | `targetSize="tpe"` | villes touristiques, petites communes |
| `taille-grande-entreprise` | Focus grandes entreprises | `targetSize="grande-entreprise"` | métropoles avec sièges |

Sélection variant :
- **Auto par défaut** : `default` si aucun secteur/taille majoritaire détecté
- **Auto par ville** : si `regions.ts.economicMakeup` indique un secteur dominant > 40 % → variant correspondant
- **Override admin** : Will peut forcer un variant depuis `/admin/content-gen/geo/[villeSlug]/generate`

Chaque variant = 1 row `ContentTemplate` avec `slug = "landing-ville-{variant}"`, `contentType = landing_ville`, `variant = "{variant}"`. System prompt + user template peuvent différer subtilement (ex insister sur les use cases comptables vs industriels). KB retrieve filters adaptés au variant (`filters.sectors = ["comptabilite"]` pour variant comptable).

Plus tard (V2) : variants supplémentaires (`tourisme`, `tech-saas`, `sante`, `retail`) selon retours Will.

### 6.2 Article blog (4 sources : titre manuel, mots-clés, RSS, depuis pilier)

#### 6.2.1 Depuis titre manuel (`blog_from_title`)

- Input : `title`, `category`, `tags[]`, `sectors[]`, `companySizes[]`, `serviceTypes[]`, `relatedCities[]?`, `targetWordCount` (800-2500).
- Pipeline : KB retrieve + (optionnel) Perplexity data run + GPT-4o → output `BlogPost` (cf. spec § 1.1 existante).
- Sortie : `src/content/blog/posts/<slug>.ts` (V1) ou `Article` DB (V2).

#### 6.2.2 Depuis mots-clés (`blog_from_keywords`)

- Input : `primaryKeyword` + `secondaryKeywords[]` + dimensions taxonomies.
- Étape 0 : SerpAPI ou Perplexity → analyse SERP top-10 (intent, format, longueur moyenne) → suggère format + word count + outline.
- STOP & ASK Will avant gen (cf. § 20 Q5).

#### 6.2.3 Depuis RSS (`blog_from_rss`)

- Input : `RssItem.id`.
- Pipeline :
  1. Re-lecture full article (puppeteer headless si `summary` court),
  2. Extraction 5 angles propres (LLM ),
  3. Génération article **reformulé profondément** : aucun copier-coller, parephrase + ajouts contextuels AxionIA + critique éditoriale,
  4. Anti-plagiat strict (Jaccard < 0.10 vs source originale),
  5. Citation source obligatoire dans JSON-LD `citation[]` + lien external `rel=external`,
  6. Tier-2 par défaut systématique pour RSS-derived (validation Will requise → tier-1).

#### 6.2.4 Depuis pilier (`qa_derived` indirect)

- Input : `pillarGuideId`.
- Extrait 8-15 Q/R atomiques du guide → injecte chacune dans une page FAQ (`/faq/<slug>`) OU les groupe dans le guide (par défaut, cf. décision Will Q4 § Spec).

### 6.3 Comparatif (`comparison`)

- Input : 2-6 items à comparer (`name`, `vendor`, optional `url`).
- Pipeline : Perplexity pour data récente (pricing, features) → GPT-4o pour synthèse → écrit `Comparison` (cf. spec § 1.2).
- Sortie : `src/content/comparaisons.ts` (extends existant) ou table `Comparison` Prisma (V2).

### 6.4 Guide pilier (`guide_pilier`)

- Input : `topic`, `audience` (debutant/intermediaire/avance), `targetWordCount` 2000-5000.
- Pipeline : outline auto (8-15 sections) avec STOP & ASK Will (cf. § 20 Q6) → 1 LLM call par section → assemblage → FAQ inférée depuis sections.
- Sortie : `Guide` (cf. spec § 1.3).

### 6.5 Q/R dérivée (`qa_derived`)

- Input : `sourceArticleId` ou `sourceGuideId`.
- Pipeline : extract Q/R (system prompt « Tu extrais 8-12 Q/R atomiques, réponses 30-100 mots, questions 8-15 mots »).
- Sortie : `QAItem[]` dans la FAQ embed de l'article OR pages FAQ standalone (selon décision Q4 spec = grouped par défaut).

### 6.6 FAQ standalone (`faq_standalone`)

- Input : `category` (FAQCategory enum existant), `topic`.
- Pipeline : Perplexity data + KB + GPT-4o → output `FAQ[]` Prisma.
- Sortie : rows insérées `FAQ` table → CRUD admin existant.

---

## 7. Providers IA & orchestration

### 7.1 Doctrine de routage

| Rôle | Primary | Fallback | Quand fallback |
|---|---|---|---|
| **Text gen** (articles, FAQ, sections, outline) | OpenAI `gpt-4o` (ou `gpt-4o-mini` si <800 mots) | Anthropic `claude-sonnet-4-6` | OpenAI 5xx, 429, timeout > 30 s, content_filter |
| **Long-form premium** (guide pilier 5000+ mots, landing ville complet) | Anthropic `claude-opus-4-7` (1M context) | OpenAI `gpt-4o` | Anthropic 5xx, 429, timeout > 60 s |
| **Data temps réel** (chiffres, citations, actualité) | Perplexity `sonar` (avec `search_recency_filter`) | Aucun (skip étape — le generator continue sans bloc « données récentes », l'article reste publiable mais marqué `hasRecentData: false` dans `ContentGenJob.metadata` et perd 4 pts SEO score) | Perplexity 5xx, 429, timeout > 30 s, ou toggle OFF (cf. § 7.4bis) |
| **Image gen** | OpenAI `gpt-image-1` | Unsplash stock | gpt-image 5xx, content_filter, ou toggle OFF |
| **Embeddings** | OpenAI `text-embedding-3-large` | Aucun (queue retry) | 5xx |
| **Rerank** (V2) | Cohere ou local cross-encoder | — | — |

### 7.2 Toggles depuis admin

Page `/admin/content-gen/settings` avec **switches** par provider :

```
┌────────────────────────────────────────────────────┐
│  PROVIDERS IA — Activation & Routing               │
├────────────────────────────────────────────────────┤
│  OpenAI (GPT-4o)                                   │
│  [✓] Enabled                                       │
│  [✓] Primary for text generation                   │
│  Model: gpt-4o ▼   Temp: 0.7   MaxTokens: 4000     │
│  Monthly cap: $200 / Spent: $43.12 (21.6%)         │
│  ┌──────────────────────────────────────┐          │
│  │ ████████░░░░░░░░░░░░ 21.6%           │          │
│  └──────────────────────────────────────┘          │
├────────────────────────────────────────────────────┤
│  Anthropic (Claude)                                │
│  [✓] Enabled  [ ] Primary  [✓] Fallback text       │
│  Model: claude-sonnet-4-6 ▼                        │
│  Monthly cap: $100 / Spent: $12.40 (12.4%)         │
├────────────────────────────────────────────────────┤
│  Perplexity (Sonar)                                │
│  [✓] Enabled for data runs                         │
│  search_recency_filter: year ▼                     │
│  Monthly cap: $80 / Spent: $5.20 (6.5%)            │
├────────────────────────────────────────────────────┤
│  OpenAI Images (gpt-image-1)                       │
│  [✓] Enabled  [✓] Primary  [ ] Fallback Unsplash   │
│  Resolution: 1024×1024 ▼  Quality: high ▼          │
│  Monthly cap: $50 / Spent: $8.20 (16.4%)           │
├────────────────────────────────────────────────────┤
│  Unsplash (stock fallback)                         │
│  [✓] Enabled                                       │
│  Rate limit: 40/h (Unsplash free tier)             │
└────────────────────────────────────────────────────┘

[ Save settings ] [ Test all providers ]
```

Toutes les modifications écrites dans `ProviderConfig` table → `revalidateTag('provider-config')`.

### 7.3 Implémentation `provider-router.ts`

```ts
// src/server/content-gen/providers/provider-router.ts

export type GenerationRequest = {
  role: "text" | "long_form" | "data" | "image";
  prompt: string;
  systemPrompt?: string;
  jsonSchema?: ZodSchema;
  maxTokens?: number;
  temperature?: number;
  jobId: string; // pour cost tracking
};

export async function generate(req: GenerationRequest): Promise<GenerationResult> {
  const primary = await resolvePrimary(req.role);
  if (!primary.enabled) throw new Error(`No primary provider for role ${req.role}`);

  // 1. cost cap check
  await assertCostUnderCap(primary.provider);

  // 2. health check (cached 60s)
  if (!(await isHealthy(primary))) {
    return await runFallback(req, primary);
  }

  // 3. call with timeout + retry
  try {
    return await callProvider(primary, req);
  } catch (e) {
    if (isRetryable(e)) {
      return await runFallback(req, primary);
    }
    throw e;
  }
}
```

### 7.4bis Toggle Perplexity granulaire (per-template + per-job)

3 niveaux de contrôle, dans cet ordre de précédence :

1. **Per-job override** : `ContentGenJob.inputPayload.usePerplexity: boolean` (admin peut désactiver pour un job)
2. **Per-template default** : `ContentTemplate.extraConfig.usePerplexity: boolean` (défaut par type de contenu — ex landing ville=true, blog-from-title=false sauf opt-in)
3. **Global toggle** : `ProviderConfig[provider=perplexity].enabled` (kill switch global)

Résolu dans `provider-router.ts` : `shouldUsePerplexity(job, template, providerConfig): boolean`. Si false → le generator skip simplement la phase « Perplexity data run » du pipeline § 6 ; aucune citation `Article.citation[]` n'est émise ; `hasRecentData` marqué `false`.

### 7.4 Tracking coûts

- Chaque appel LLM → row dans `CostLedger` (jobId, provider, tokens_in, tokens_out, cost_usd).
- `ProviderConfig.currentMonthSpentUsd` incrémenté atomiquement (Prisma transaction).
- Cron 1ʳᵉ minute du mois : reset `currentMonthSpentUsd` + archive.
- Dashboard `/admin/content-gen/costs` : graphes 30j par provider + alerte 80 % / 100 % cap.

---

## 8. Système d'images — Unsplash uniquement (v2.0)

> **Doctrine v2.0 (Will 2026-05-14)** : aucune génération d'image par IA (gpt-image-1, DALL·E, Midjourney, etc.). **Unsplash API uniquement** pour toutes les images. Réduit le coût, simplifie le pipeline, garantit la qualité visuelle et le crédit photographe (signal d'authenticité).

### 8.1 Pipeline simplifié

1. **Query build** : `buildUnsplashQuery(type, params)` — templates de queries par type de contenu (cf. seeds `unsplash-search-queries.json`).
   - Ex landing ville : `query = "{ville_name} architecture editorial"` (variantes selon ville/région)
   - Ex blog article cas d'usage : `query = "{sector} business workflow"`
2. **Unsplash Search API** : `GET /search/photos?query={...}&orientation=landscape&order_by=relevant&content_filter=high`
3. **Sélection** : top 5 résultats → pick celui dont `description` ou `alt_description` matche le mieux le contexte (similarity texte simple). Si pas de match clair → page 2.
4. **Validate** : dimensions ≥ 1 024 × 1 024 (sinon page suivante), pas de visage humain identifiable détecté (API Unsplash content_filter `high` + heuristique alt_description).
5. **Download** : URL raw + paramètres responsive : `?w=1280&q=80&auto=format` et `?w=768&q=80`, `?w=320&q=80`.
6. **Optimize local** : `sharp` ré-encode en AVIF + WebP + JPG (3 variantes par format = 9 fichiers).
7. **Store** : `public/illustrations/unsplash/<jobId>/<slot>.{avif,webp,jpg}` + DB `ImageAsset` (path, alt, attribution, unsplashPhotoId, photographerName, photographerUrl, jobId, dimensions).
8. **Tracking download** : déclencher webhook Unsplash `GET {photo.links.download_location}` (exigence API Unsplash).
9. **Inject** : remplace `<IllustrationPlaceholder />` par `<ResponsiveImage src=".../<slot>" alt="..." />` + `<figcaption>` avec attribution photographer.

### 8.2 Doctrine images Unsplash

- **Crédit obligatoire** (exigence Unsplash API + signal authenticité SEO/AEO) : `<figcaption>Photo par {photographer_name} sur Unsplash</figcaption>` avec lien `rel="external noopener"` vers profil photographer.
- **Pas de personnes reconnaissables** par défaut (RGPD + sobriété éditoriale Axion-IA). Privilégier paysages, architecture, objets, scènes professionnelles cadre large (mains, écrans).
- **Pas de logos tiers** dans les images (anti-confusion brand). Filtrer via Unsplash `content_filter=high`.
- **Alt-text** auto-généré par GPT-4o-mini à partir de `unsplash.description + alt_description + contexte page` (3-15 mots significatifs en français).
- **Caption** auto (3-10 mots) — optionnel `<figcaption>` contextuel en plus de l'attribution.
- **EXIF preservé** quand pertinent (photographer original metadata).
- **Pas de palette imposée** sur la photo elle-même (Unsplash = réalisme photographique, pas d'illustration). La palette terracotta reste l'identité **graphique** d'Axion-IA (boutons, headers, accents) — les photos elles servent d'**ouverture vers le réel**.
- **Cohérence éditoriale** : préférer ambiance « éditoriale sobre » (lumière douce, cadrage simple, peu de saturation). Éviter stock photos clichées (« handshake business », « people pointing at screen »).

### 8.3 Fallback hierarchy v2.0

```
Unsplash (query templates) → IllustrationPlaceholder.tsx (SVG terracotta, composant existant)
```

Si Unsplash ne retourne rien de pertinent (rate-limit atteint, query trop spécifique, content_filter rejette tout) → `IllustrationPlaceholder.tsx` (SVG palette terracotta, slot ID visible). Pas de page sans visuel.

### 8.4 Cost / Quota Unsplash

- **Unsplash Free Demo tier** : 50 requests/heure.
- **Unsplash Production tier** (gratuit après validation) : 5 000 requests/heure.
- Demander l'upgrade Production dès Sprint 1 (formulaire Unsplash, gratuit).
- **Cache Redis** : `unsplash:photo:{photoId}` 30 jours TTL → ne pas re-télécharger la même photo si plusieurs jobs.
- **Rate-limit interne** : 40 requests/heure (sécurité 10 marge) en démo, 4 000/heure en production.
- **Cost cap mensuel image** : **$0** (Unsplash gratuit).

### 8.5 Diversité photographique

Pour éviter qu'un même photo apparaisse sur 50 contenus :
- Pagination Unsplash : pour chaque query, tenir un compteur Redis `unsplash:query:{queryHash}:page` qui s'incrémente.
- Blacklist : `unsplash:photo:{photoId}:used_count` — si > 3 utilisations sur 30 jours → exclu des résultats.
- Variation queries : génération de 3-5 variantes de query pour un même contenu (synonymes, contextes différents).

### 8.6 Conséquences sur configuration

- `ProviderConfig[gpt_image].enabled = false` par défaut (et hors V1 — option à activer V2 si Will change d'avis).
- `OPENAI_IMAGE_API_KEY` env var **non requise** V1.
- Budget mensuel images : **$0** (vs $50 prévu en v1.9).
- **Total budget V1 reviewé** : OpenAI text $200 + Anthropic $100 + Perplexity $80 + Unsplash $0 = **$380/mois** (au lieu de $430).

---

## 9. SEO / AEO / GEO

### 9.1 SEO classique

Chaque contenu généré → meta produites par `buildProductMetadata()` étendu :

- **title** : 50-60 chars, primary keyword en début, brand `| Axion-IA` en fin
- **description** : 140-160 chars, primary keyword + secondary, CTA implicite
- **canonical** : `https://axion-ia.com/<locale>/<path>`
- **alternates** : `fr` + `en` + `x-default`
- **OG** : title, description, image 1200×630 (depuis section 8), site_name, locale, type=article
- **Twitter** : card=summary_large_image
- **robots** : selon `indexationTier` (tier-1=index,follow ; tier-2=noindex,follow ; tier-3=noindex,nofollow)
- **breadcrumb** : `BreadcrumbList` JSON-LD obligatoire

### 9.2 AEO (Answer Engine Optimization) — visibilité LLMs

Chaque article DOIT inclure :

- **Direct Answer** (40-80 mots) juste après H1, en `<p data-aeo="answer">` + `FAQPage Speakable` (cssSelector pointant ce sélecteur). Reproduit dans JSON-LD `acceptedAnswer`.
- **FAQ embed** (4-12 Q/R) avec `FAQPage` JSON-LD + `Speakable`.
- **Citations sources** : `citation[]` JSON-LD avec `@type=CreativeWork` quand data Perplexity.
- **Headings structurés** : 1 H1, 3-8 H2, 0-N H3 (jamais H4+).
- **Listes courtes** : `<ul>` 3-7 items, `<ol>` quand séquentiel.
- **Tables structurées** : `<table>` avec `<th scope>` pour pricing / comparaison.
- **TL;DR encadré** en haut (anti-bounce + AEO).

### 9.3 GEO (Generative Engine Optimization) — citations LLMs

Implémentation tests AEO automatisés (Sprint 5+) :

- Liste 50 prompts cibles (« quel cabinet IA opérationnel à Paris ? », « audit IA TPE prix ? », etc.).
- Cron hebdo : interroge Perplexity, ChatGPT (browse), Claude, Gemini, SearchGPT pour chaque prompt.
- Capture si Axion-IA cité (nom, lien). Score AEO/page = nb prompts citant cette page / 50.
- Dashboard `/admin/content-gen/aeo-tests`.

### 9.4 Local SEO

Pour chaque page ville :

- **Place** JSON-LD (avec `geo.latitude` + `geo.longitude` depuis INSEE)
- **LocalBusiness** (Axion-IA avec `areaServed` = ville + `serviceArea` = département)
- **Service × N** (audit, interventions, implementation) avec `availableAtOrFrom` = ville
- **PostalAddress** (ville, code postal, département, région, FR)
- **Speakable** sur FAQ géolocalisée
- **OpeningHoursSpecification** : Lun-Ven 09:00-19:00

### 9.5 Sitemap & robots

- Sitemap index splitté par type : `sitemap-blog.xml`, `sitemap-villes.xml` (déjà splitté), `sitemap-guides.xml`, `sitemap-faq.xml`, `sitemap-comparaisons.xml`.
- Chaque chunked à 1 000 URLs max.
- Inclusion **tier-1 only**. Tier-2/3 absents.
- `lastmod` = `updatedAt`.
- robots.txt à jour : autorise bots utiles, refuse scrapers AI **bloquants** (cf. décision Will mémoire : Bot Fight ON + AI Scrapers OFF).

### 9.6 Doctrine 2026 — moteurs qui répondent directement à l'utilisateur

Les moteurs de recherche 2026 (Google AI Overviews, SearchGPT, Perplexity, ChatGPT browse, Claude.ai, Gemini, You.com) **affichent la réponse avant le clic**. Conséquences pour chaque contenu généré :

#### 9.6.1 Structure de réponse extractible

Chaque article DOIT contenir, dans l'ordre :

1. **H1** précis, optimisé question (« Comment auditer son cabinet comptable IA en 2026 ? »)
2. **TL;DR encadré** (`<aside data-aeo="tldr">`) — 2-4 lignes, factuel, sans CTA
3. **Direct Answer** (`<p data-aeo="answer">`) — 40-80 mots citables, JSON-LD `Speakable`
4. **Key facts list** (`<ul data-aeo="facts">`) — 3-7 bullets atomiques chiffrés
5. **TOC** (table of contents) auto-générée — JSON-LD `WebPage.hasPart[]`
6. **Sections H2** structurées, chacune commençant par une réponse extractible (1-2 phrases) puis détail
7. **FAQ** finale (4-12 Q/R) — JSON-LD `FAQPage` + `Speakable`
8. **Author bio** + credentials — JSON-LD `Person` avec `knowsAbout[]` + `sameAs[]`
9. **Reviewed by** (V2) — `Article.reviewedBy` Person

#### 9.6.2 `llms.txt` (standard Anthropic 2024/2026)

Émettre un fichier `public/llms.txt` à la racine `axion-ia.com/llms.txt` listant **proactivement** ce que les LLMs doivent connaître :

```
# Axion-IA — Cabinet IA opérationnel
> Cabinet IA opérationnel B2B basé en Estonie (OÜ). Audit IA, interventions formation, implémentation custom pour TPE/PME/ETI/grandes entreprises FR.

## Pages canoniques
- [Audit IA](https://axion-ia.com/fr/audit-ia) : 3 paliers (Flash 490€, Ciblé 790€, Stratégique 1190€)
- [Interventions](https://axion-ia.com/fr/interventions) : 14 formats sur 4 familles (collectives, individuelles, dirigeants, conférences)
- [Implémentation](https://axion-ia.com/fr/implementation) : Custom à partir de 8 K€
- [Méthodologie](https://axion-ia.com/fr/methodologie)
- [Cas concrets](https://axion-ia.com/fr/cas-concrets)

## Tarifs SSOT
[Tarifs publiés](https://axion-ia.com/fr/tarifs.md) — version markdown machine-readable

## Sitemap principal
[Sitemap](https://axion-ia.com/sitemap.xml)

## Optional
[Versions EN](https://axion-ia.com/en/llms.txt)
```

→ Générer dynamiquement via route `app/llms.txt/route.ts` à partir de `pricing.ts` SSOT + manifest des pages tier-1.

#### 9.6.3 Variante texte brut machine-readable

Pour chaque article tier-1 → émettre une variante `.md` machine-readable :
- `/blog/<slug>` (HTML web) + `/blog/<slug>.md` (markdown brut)
- Le `.md` est servi avec `Content-Type: text/markdown; charset=utf-8`
- LLMs peuvent fetch en `Accept: text/markdown` → version sans CSS/JS
- Référencé dans `<link rel="alternate" type="text/markdown" href="...md" />`

#### 9.6.4 Citations & provenance (signal Perplexity/SearchGPT)

Chaque article tier-1 DOIT exposer :
- `<meta name="article:author" content="Will (Axion-IA)" />`
- `<meta name="article:published_time" content="ISO8601" />`
- `<meta name="article:modified_time" content="ISO8601" />`
- JSON-LD `Article.citation[]` avec sources Perplexity utilisées (CreativeWork avec `url` + `name` + `datePublished` + `author`)
- JSON-LD `Article.about[]` (entités principales — `Thing` avec `sameAs` Wikidata si possible)
- JSON-LD `Article.mentions[]` (concepts secondaires)
- JSON-LD `Article.isAccessibleForFree: true`

#### 9.6.5 E-E-A-T fort (signal Google 2026)

- `Person` JSON-LD canonique pour « Will » dans `src/lib/seo.ts` : `name`, `jobTitle`, `worksFor`, `knowsAbout[]`, `sameAs[]` (LinkedIn, GitHub, Substack, etc.), `image`, `description`, credentials.
- `Organization` JSON-LD AxionIA renforcée : `foundingDate`, `legalName`, `taxID`, `vatID` (OÜ), `award[]`, `knowsAbout[]`, `sameAs[]`, `contactPoint[]`.
- **Reviewed-by** (V2) : un 2ᵉ expert relit + signe → `Article.reviewedBy`.
- **First-hand experience** : injecter dans chaque article ≥ 1 phrase « D'après notre intervention chez {sectorAnonymized} {sizeAnonymized}… » (issue KB cas concrets anonymisés).

#### 9.6.6 Anti-AI-detection (signaux humains)

Pour éviter classification « AI-generated content » (Google HCU + Originality.ai + GPTZero) :
- Insérer **1 opinion forte** par article (« Nous pensons que… », « À l'inverse de {tendance courante}… »)
- Insérer **1 prédiction datée** (« D'ici fin 2026, nous anticipons… »)
- Insérer **1 chiffre interne** (« sur {N} interventions menées en 2025… ») — issu des cas concrets anonymisés KB
- Insérer **1 paragraphe en première personne du pluriel** discrète
- Varier la longueur des phrases (mix court/long, écart-type ≥ 8 mots)
- Éviter les listes systématiques de 3 ou 5 items (signature LLM) — varier 2-7

Ces 6 signaux sont vérifiés par `doctrine-check.ts` (warning seulement, pas bloquant).

#### 9.6.7 Schema.org 2026 — versions utilisées

| Type | Usage | Note |
|---|---|---|
| `Article`, `BlogPosting`, `NewsArticle`, `TechArticle` | Articles selon format | Préférer `TechArticle` pour les contenus techniques (signal expertise) |
| `WebPage.speakable` | TL;DR + Direct Answer | Critique pour Google Assistant + ElevenLabs/AI vocal |
| `FAQPage` + `QAPage` | FAQ embed + Q/R standalone | `Speakable` sur chaque |
| `HowTo` + `HowToStep` | Guides étape-par-étape | Avec `tool[]`, `supply[]`, `estimatedCost`, `totalTime` |
| `Service` | Audit / Interventions / Implementation | `areaServed`, `serviceArea`, `offers`, `provider` |
| `Place` | Villes | `geo`, `containedInPlace` (Region) |
| `LocalBusiness` | AxionIA + villes desservies | `areaServed`, `serviceArea` |
| `BreadcrumbList` | Toujours | 2-4 niveaux max |
| `ItemList` | Listings, communes voisines | `numberOfItems`, `itemListOrder` |
| `Person` | Will + reviewers V2 | `knowsAbout`, `sameAs`, `credentials` |
| `Organization` | AxionIA | `foundingDate`, `vatID`, `award` |
| `Course` (V2) | Interventions formation | Pour ranking Google Course panel |
| `OccupationalProgram` (V2) | Interventions Qualiopi | Anticipation Qualiopi |
| `CreativeWork.citation[]` | Sources Perplexity | E-E-A-T |
| `WebSite.SearchAction` | Search box sitelinks | `target` + `query-input` |

#### 9.6.1bis Featured Snippet (Position Zero) — optimisation explicite v2.2

Google sélectionne un Featured Snippet (« Position Zero ») dans 3 formats. Le content-gen optimise pour les 3 :

##### Paragraph Snippet (40-50 mots)

Format optimal :
```html
<section>
  <h2>« Question utilisateur reformulée »</h2>
  <p data-snippet="paragraph">
    Réponse directe en 40-50 mots, factuelle, sans préambule ni conclusion.
    Inclut le primary keyword dans les 15 premiers mots.
  </p>
</section>
```

Conditions :
- H2 commence par mot interrogatif (« Comment… ? », « Combien… ? », « Pourquoi… ? », « Quel… ? »)
- Paragraphe immédiatement après le H2, sans intercalation
- 40-50 mots strict (mesure `<p data-snippet="paragraph">` content)
- Primary keyword dans les 15 premiers mots
- Pas de phrase commençant par « Selon… », « D'après… » (réponse directe)

##### List Snippet (5-8 items)

Format optimal :
```html
<section>
  <h2>« Quelles sont les X étapes pour… ? »</h2>
  <p>Phrase d'introduction 15-25 mots.</p>
  <ol data-snippet="list">
    <li><strong>Étape 1 : Titre court (3-6 mots)</strong>. Description 8-15 mots.</li>
    <li><strong>Étape 2 : Titre court</strong>. Description courte.</li>
    <!-- 5-8 items max -->
  </ol>
</section>
```

Conditions :
- H2 question avec « étapes », « façons », « raisons », « types », « critères » + nombre
- `<ol>` (ordonné si séquence) ou `<ul>` (non ordonné si choix)
- 5-8 items max (au-delà Google ne snippe pas)
- Chaque item commence par `<strong>` titre court + description

##### Table Snippet (3-5 colonnes, 3-7 lignes)

Format optimal :
```html
<section>
  <h2>« Combien coûte… ? » ou « Quel est le tarif… ? »</h2>
  <p>Phrase introductive 15-25 mots.</p>
  <table data-snippet="table">
    <caption>Légende explicite</caption>
    <thead>
      <tr>
        <th scope="col">Colonne 1</th>
        <th scope="col">Colonne 2</th>
        <th scope="col">Colonne 3</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>...</td><td>...</td><td>...</td></tr>
      <!-- 3-7 lignes max -->
    </tbody>
  </table>
</section>
```

Conditions :
- 3-5 colonnes max
- 3-7 lignes max
- `<caption>` obligatoire
- `<th scope="col">` strict
- Format adapté à la query (tarifs → comparaison niveaux, durées → vs, etc.)

##### Validation `posts:validate` étendue v2.2

Au moins **1 Featured Snippet block (paragraph OU list OU table)** présent dans le contenu, attribut `data-snippet="..."` détectable. Si absent → `qualityScore -5 pts` (warning, pas block).

#### 9.6.8 Tests AEO/GEO automatisés (V2)

Cron hebdo `aeo-tester` :
1. Liste 50 prompts cibles (`prompts.json` éditable admin)
2. Pour chacun, interroger : Perplexity Sonar, OpenAI gpt-4o (browse), Claude 4.x, Gemini 2.x, SearchGPT (si API)
3. Capture brute : Axion-IA est-il cité ? Lien direct ? Position ? Tonalité ?
4. Score AEO/page = nb_citations / (50 × 5)
5. Dashboard `/admin/content-gen/aeo-tests` avec heatmap prompt × LLM
6. Alerte si score chute > 10 % sur 4 semaines

---

### 9.7 Checklist exhaustive SEO/AEO/GEO — sans faute, sans oubli

> Chaque URL générée DOIT passer cette checklist à 100 %. Validation automatique via `pnpm content-gen:html-audit <url>` qui parse le HTML rendu et vérifie chaque item. Échec = bloque la publication tier-1.

#### 9.7.1 `<head>` — balises obligatoires (32 items)

| # | Item | Format | Validation |
|---|---|---|---|
| 1 | `<meta charset="UTF-8">` | exact | présent ligne 1-3 |
| 2 | `<meta http-equiv="content-type" content="text/html; charset=UTF-8">` | exact | redondance utile vieux crawlers |
| 3 | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` | exact | mobile-first |
| 4 | `<meta name="theme-color" content="#C45A3E" media="(prefers-color-scheme: light)">` | exact | terracotta SSOT |
| 5 | `<meta name="color-scheme" content="light">` | exact | pas de dark mode V1 |
| 6 | `<meta name="format-detection" content="telephone=no">` | exact | anti-iOS auto-link |
| 7 | `<meta name="apple-mobile-web-app-capable" content="yes">` | exact | iOS PWA |
| 8 | `<meta name="apple-mobile-web-app-status-bar-style" content="default">` | exact | iOS |
| 9 | `<meta name="mobile-web-app-capable" content="yes">` | exact | Android |
| 10 | `<meta name="application-name" content="Axion-IA">` | exact | brand |
| 11 | `<title>` 50-60 chars, primary KW début, `| Axion-IA` fin | `^.{50,60}$` | strict |
| 12 | `<meta name="description" content="...">` 140-160 chars, primary + secondary KW, CTA implicite | `^.{140,160}$` | strict |
| 13 | `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">` ou tier-conditional | conditionnel tier | strict |
| 14 | `<meta name="googlebot" content="...">` même contenu que robots | exact | redondance utile |
| 15 | `<meta name="bingbot" content="...">` même contenu | exact | redondance utile |
| 16 | `<meta name="author" content="Manon">` | exact | E-E-A-T |
| 17 | `<meta name="publisher" content="Axion-IA">` | exact | E-E-A-T |
| 18 | `<meta name="generator" content="Axion-IA Content Engine">` | exact | provenance |
| 19 | `<meta name="rating" content="general">` | exact | safety |
| 20 | `<meta name="referrer" content="strict-origin-when-cross-origin">` | exact | privacy |
| 21 | `<link rel="canonical" href="https://axion-ia.com/fr/<path>">` | exact | absolu |
| 22 | `<link rel="alternate" hreflang="fr-FR" href="https://axion-ia.com/fr/<path>">` | exact | FR-only V1 |
| 23 | `<link rel="alternate" hreflang="x-default" href="https://axion-ia.com/fr/<path>">` | exact | pointe FR |
| 24 | `<link rel="alternate" type="application/rss+xml" title="Blog Axion-IA" href="/blog/feed.xml">` | exact | RSS |
| 25 | `<link rel="alternate" type="text/markdown" href="/fr/blog/<slug>.md">` | exact | machine-readable |
| 26 | `<link rel="icon" sizes="any" href="/favicon.ico">` | exact | classic |
| 27 | `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` | exact | modern |
| 28 | `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">` | exact | iOS |
| 29 | `<link rel="manifest" href="/manifest.webmanifest">` | exact | PWA |
| 30 | `<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>` ou self-host preconnect | exact | perf |
| 31 | `<link rel="dns-prefetch" href="//cdn.cloudflare.com">` | exact | perf |
| 32 | `<link rel="preload" as="image" fetchpriority="high" href="<hero_avif>" type="image/avif">` | dynamic | LCP critical |

#### 9.7.2 Open Graph — 14 items obligatoires

| # | Item |
|---|---|
| 1 | `<meta property="og:type" content="article">` (ou `website` pour landings) |
| 2 | `<meta property="og:title" content="...">` (= title sans le ` | Axion-IA`) |
| 3 | `<meta property="og:description" content="...">` (= meta description) |
| 4 | `<meta property="og:url" content="<absolute canonical>">` |
| 5 | `<meta property="og:site_name" content="Axion-IA">` |
| 6 | `<meta property="og:locale" content="fr_FR">` |
| 7 | `<meta property="og:image" content="https://axion-ia.com/api/og?title=...&accent=terracotta">` 1200×630 |
| 8 | `<meta property="og:image:width" content="1200">` |
| 9 | `<meta property="og:image:height" content="630">` |
| 10 | `<meta property="og:image:alt" content="...">` |
| 11 | `<meta property="og:image:type" content="image/png">` |
| 12 | `<meta property="article:published_time" content="<ISO8601>">` |
| 13 | `<meta property="article:modified_time" content="<ISO8601>">` |
| 14 | `<meta property="article:author" content="https://axion-ia.com/fr/equipe/manon">` |
| 14b | `<meta property="article:section" content="<category>">` |
| 14c | `<meta property="article:tag" content="<tag>">` (×N, max 8) |

#### 9.7.3 Twitter Cards — 7 items

| # | Item |
|---|---|
| 1 | `<meta name="twitter:card" content="summary_large_image">` |
| 2 | `<meta name="twitter:title" content="...">` |
| 3 | `<meta name="twitter:description" content="...">` |
| 4 | `<meta name="twitter:image" content="<og:image url>">` |
| 5 | `<meta name="twitter:image:alt" content="...">` |
| 6 | `<meta name="twitter:site" content="@axionia_fr">` (handle officiel à confirmer, sinon omettre la balise) |
| 7 | ~~`<meta name="twitter:creator">`~~ **DOCTRINE v2.1 (Will 2026-05-14) : Manon = persona transparente SANS aucun réseau social. La balise `twitter:creator` est TOUJOURS omise pour les contenus signés Manon.** |

#### 9.7.4 Geo meta (uniquement landings villes)

| # | Item |
|---|---|
| 1 | `<meta name="geo.region" content="FR-<dept_code>">` |
| 2 | `<meta name="geo.placename" content="<Ville>">` |
| 3 | `<meta name="geo.position" content="<lat>;<lng>">` |
| 4 | `<meta name="ICBM" content="<lat>, <lng>">` |

#### 9.7.5 Hiérarchie headings stricte (anti-faute)

- **Exactement 1 `<h1>`** par page — contient le primary keyword en début + nom ville/topic
- **3 à 8 `<h2>`** — chacun commence par mot-clé sémantique différent
- **`<h3>`** uniquement comme enfant d'un `<h2>` immédiat — pas de saut de niveau
- **`<h4>`** rarissime (sous-sous-sections) — éviter
- **0 `<h5>` 0 `<h6>`** (signal qualité Google)
- Validation : parser DOM → vérifier ordre + unicité H1 + cohérence niveaux
- Chaque heading ≤ 70 chars
- Aucun heading vide
- Aucun heading dupliqué dans la même page

#### 9.7.6 Semantic HTML5 obligatoire

| Élément | Usage |
|---|---|
| `<html lang="fr" dir="ltr">` | racine obligatoire |
| `<main id="main">` | 1 seul par page, contient le contenu principal |
| `<article itemscope itemtype="https://schema.org/Article">` | wrap le contenu de l'article |
| `<header>` | hero section + breadcrumb |
| `<nav aria-label="Fil d'Ariane">` | breadcrumb |
| `<aside data-aeo="tldr">` | TL;DR encadré |
| `<section aria-labelledby="<heading-id>">` | chaque grande section |
| `<figure><img …><figcaption>…</figcaption></figure>` | toutes les images contextuelles |
| `<table><caption>…</caption><thead><tr><th scope="col">…` | tableaux strict |
| `<details><summary>` | FAQ items collapsibles (progressive enhancement) |
| `<footer>` | bio auteur Manon + sources |
| `<time datetime="<ISO8601>">` | dates publiées/modifiées visibles |

#### 9.7.7 Accessibility WCAG 2.2 AA (rappel — déjà doctrine)

- Contraste texte/fond ≥ 4.5:1 (AA), 7:1 sur primary actions
- `alt` obligatoire sur **toutes** les images (alt="" pour décoratives)
- `aria-label` ou `aria-labelledby` sur tous les `<nav>` et controls non textuels
- `:focus-visible` style visible (déjà global)
- Skip link `<a href="#main">Aller au contenu</a>` en haut
- `tabindex="0"` jamais utilisé sauf cas justifié
- Pas de `outline: none` sans alternative visible
- Reduced motion respecté (`prefers-reduced-motion`)

#### 9.7.8 JSON-LD — blocs obligatoires par type (étendu v2.2 + v2.3)

**Refonte v2.2** : ajout `Review` + `AggregateRating` (témoignages clients = boost SEO local énorme) + `Course` (interventions formation Module 1).

**Refonte v2.3** : enrichissement champs `Article` Schema.org (`wordCount`, `thumbnailUrl`, `contentLocation`, `audience`, `copyrightHolder`, `copyrightYear`) + nouveaux schemas `ContactPoint` (Organization) + `OfferCatalog` (Service Axion-IA).

##### Champs `Article` obligatoires v2.3

Pour chaque article tier-1 / tier-2, le générateur DOIT émettre ces champs en plus de la spec actuelle :

```jsonld
{
  "@type": "Article",
  "@id": "{canonical}#article",

  // Champs déjà spec'd
  "headline": "{H1 exact, max 110 chars}",
  "description": "{meta description}",
  "author": { "@id": "...#person-manon" },
  "publisher": { "@id": "...#organization" },
  "datePublished": "{ISO8601}",
  "dateModified": "{ISO8601}",
  "mainEntityOfPage": { "@id": "{canonical}" },
  "image": [ { "@id": "...#hero-image" } ],
  "isAccessibleForFree": true,
  "inLanguage": "fr-FR",
  "about": [ ... ],
  "mentions": [ ... ],
  "citation": [ ... ],

  // 🆕 v2.3 — Champs Schema.org ajoutés
  "wordCount": 5234,                          // Calculé runtime sur bodyHtml — Google Discover boost
  "thumbnailUrl": "https://axion-ia.com/illustrations/.../<slot>-768.avif",  // Google Discover preview
  "articleBody": "{plain text body — 200 premiers mots}",  // Extrait Google AI Overviews
  "articleSection": "{category}",
  "keywords": "{primary_kw}, {secondary_kw_1}, {secondary_kw_2}",  // 3-5 keywords pivots
  "copyrightHolder": { "@id": "...#organization" },
  "copyrightYear": 2026,
  "audience": {
    "@type": "Audience",
    "audienceType": "{audience_label déduit de targetAudienceOrganisation + targetAudienceSize}"
  },
  "contentLocation": {                       // 🆕 v2.3 SEO LOCAL CRITIQUE pour landings villes
    "@type": "Place",
    "@id": "...#place-{villeSlug}",
    "name": "{ville.name}",
    "containedInPlace": {
      "@type": "AdministrativeArea",
      "name": "{region.name}"
    }
  },
  "spatialCoverage": {                       // 🆕 v2.3 — alias contentLocation pour redondance + couverture max
    "@id": "...#place-{villeSlug}"
  }
}
```

##### `Organization` enrichi v2.3 — `ContactPoint`

L'`Organization` Axion-IA (sitewide) DOIT inclure :

```jsonld
{
  "@type": "Organization",
  "@id": "https://axion-ia.com/#organization",
  "name": "Axion-IA",
  "legalName": "Axion-IA OÜ",
  "url": "https://axion-ia.com",
  "logo": { "@id": "...#logo" },
  "foundingDate": "...",
  "vatID": "EE...",
  "taxID": "...",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "EE",
    "addressLocality": "Tallinn"
  },

  // 🆕 v2.3 — ContactPoint
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "email": "contact@axion-ia.com",
      "availableLanguage": ["French", "English"],
      "areaServed": "FR",
      "url": "https://axion-ia.com/fr/contact"
    },
    {
      "@type": "ContactPoint",
      "contactType": "sales",
      "email": "ventes@axion-ia.com",
      "availableLanguage": ["French"],
      "areaServed": "FR",
      "url": "https://axion-ia.com/fr/reserver"
    }
  ],

  "areaServed": [
    { "@type": "Country", "name": "France" }
  ],

  // 🆕 v2.3 — OfferCatalog des services Axion-IA
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Services Axion-IA",
    "itemListElement": [
      {
        "@type": "OfferCatalog",
        "name": "Audits IA",
        "itemListElement": [
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Audit IA Flash" }, "price": "490", "priceCurrency": "EUR" },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Audit IA Ciblé" }, "priceRange": "1900-3900", "priceCurrency": "EUR" },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Audit IA Stratégique PME" }, "priceRange": "4900-9900", "priceCurrency": "EUR" },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Audit IA Stratégique ETI" }, "priceRange": "12000+", "priceCurrency": "EUR" }
        ]
      },
      {
        "@type": "OfferCatalog",
        "name": "Interventions Module 1",
        "itemListElement": [
          /* 14 formats — 1 Offer chacun avec price from pricing.ts */
        ]
      },
      {
        "@type": "OfferCatalog",
        "name": "Implémentation IA",
        "itemListElement": [
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "POC" }, "priceRange": "990-4900", "priceCurrency": "EUR" },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Mission PME" }, "priceRange": "8000-25000", "priceCurrency": "EUR" },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Mission ETI" }, "priceRange": "25000-80000", "priceCurrency": "EUR" },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "IA Custom" }, "priceRange": "8000-50000", "priceCurrency": "EUR" }
        ]
      }
    ]
  }
}
```

**Factory** : `buildOrganizationJsonLdEnriched()` dans `src/lib/seo.ts` v2.3 — lit `pricing.ts` SSOT pour générer les prix réels.

##### `Service` enrichi v2.3 pour landings villes

```jsonld
{
  "@type": "Service",
  "@id": "...#service-audit-flash-{villeSlug}",
  "name": "Audit IA Flash à {Ville}",
  "provider": { "@id": "...#organization" },
  "serviceType": "Audit Flash IA",
  "areaServed": {
    "@type": "GeoCircle",
    "geoMidpoint": {
      "@type": "GeoCoordinates",
      "latitude": {ville.lat},
      "longitude": {ville.lng}
    },
    "geoRadius": 50000  // 50 km
  },
  "offers": {
    "@type": "Offer",
    "price": "490",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock",
    "url": "https://axion-ia.com/fr/reserver?type=audit-flash&source=ville-{villeSlug}",
    "availableAtOrFrom": { "@id": "...#place-{villeSlug}" }
  }
}
```

> Tous les schemas dans `<script type="application/ld+json">` séparés (pas un mega-graphe — meilleure lecture pour Google).

| Type de page | JSON-LD requis |
|---|---|
| **Landing ville** | `WebPage` + `Speakable` + `BreadcrumbList` + `Place` + `LocalBusiness` + `Service` × N + `FAQPage` + `ItemList` (communes voisines) + `Organization` (publisher) + `Person` (Manon, author) |
| **Article blog** | `Article` (ou `BlogPosting` / `TechArticle` / `NewsArticle` selon format) + `BreadcrumbList` + `FAQPage` + `Speakable` + `Person` (Manon) + `Organization` (publisher) + `WebPage` |
| **Comparatif** | `Article` + `BreadcrumbList` + items en `Product` ou `Service` × N + `FAQPage` + `Person` + `Organization` |
| **Guide pilier** | `Article` + `HowTo` + `HowToStep` × N + `BreadcrumbList` + `FAQPage` + `Speakable` + `Person` + `Organization` |
| **FAQ standalone** | `QAPage` + `Question` + `Answer` + `BreadcrumbList` + `Person` + `Organization` |
| **Sitewide (layout)** | `WebSite` + `SearchAction` + `Organization` (root) + `Person` (Manon canonical, dans layout `/equipe/manon`) + `AggregateRating` (note moyenne Axion-IA) |
| **Témoignages clients (page `/cas-concrets` + intégration landings)** *(v2.2)* | `Review` × N + `AggregateRating` (note + ratingCount + bestRating + worstRating) + `Person` (témoin si nommé, sinon `Organization` anonymisée) + `itemReviewed` pointe vers `Service` audit/intervention/impl |
| **Landings interventions** *(v2.2)* | + `Course` JSON-LD pour chacun des 14 formats Module 1 : `Course.name`, `Course.description`, `Course.provider` (Organization Axion-IA), `Course.educationalCredentialAwarded`, `Course.timeRequired`, `Course.offers.price` (depuis SSOT pricing.ts), `Course.coursePrerequisites`, `Course.educationalLevel`, `Course.hasCourseInstance` (sessions intra-entreprise sur demande) |
| **Conférences Module 1 (V2)** | + `Event` schema (V2 — pas critique V1) |

#### 9.7.9 Images — règles strictes (anti-CLS + LCP)

| # | Règle |
|---|---|
| 1 | `width` + `height` attributs HTML **obligatoires** (anti-CLS) |
| 2 | `alt` attribut **obligatoire**, jamais vide pour images de contenu |
| 3 | `loading="eager"` + `fetchpriority="high"` sur LCP image (1 seule par page) |
| 4 | `loading="lazy"` + `decoding="async"` sur toutes les autres |
| 5 | `<picture>` element avec sources AVIF → WebP → JPG fallback |
| 6 | `sizes` responsive : `sizes="(min-width: 1024px) 1024px, 100vw"` |
| 7 | `srcset` 3 variantes minimum : 320w, 768w, 1280w |
| 8 | Format AVIF en priorité (-30 % poids vs WebP) |
| 9 | Compression : qualité 70-80 (sweet spot) |
| 10 | Aucun PNG sauf logos transparents |

#### 9.7.10 Liens — règles

- `rel="noopener"` sur tous liens `target="_blank"`
- `rel="noreferrer"` sur liens externes non partenaires
- `rel="ugc"` sur liens utilisateur (FAQ commentaires V2)
- `rel="sponsored"` sur liens affiliés
- `rel="external"` sur liens externes
- Pas de `rel="nofollow"` sur sources Perplexity (signal de confiance)

#### 9.7.11 Scripts & ressources

- Aucun script inline sans `nonce` (CSP en place)
- `<script type="module">` pour ES modules
- `<script async>` ou `<script defer>` jamais bloquant
- Aucune dépendance externe bloquante render
- Inline CSS critical ≤ 14 KB (1 RTT)
- Reste CSS chargé asynchrone

### 9.8 Auteur Manon — Persona éditoriale transparente (v2.0 — Option A acté Will 2026-05-14)

#### 9.8.1 Doctrine v2.0 — transparence totale

Tous les contenus générés (landings villes, articles, FAQ, guides, comparatifs, Q/R) sont signés **Manon**. Manon est la **persona éditoriale d'Axion-IA** — pas une personne réelle. Sous ce nom signe l'équipe éditoriale d'Axion-IA + le processus de production IA supervisé.

**Pourquoi un persona transparent ?**
- Cohérent HCU 2024 « people-first content » : signature + processus transparent > signature vague type « la rédaction »
- Cohérent AI Act 2026 : disclosure honnête de l'usage IA
- Évite tout risque légal (pas d'usurpation, pas de faux profils sociaux)
- Réduit risque SEO (Google sanctionne fortement les profils auteurs frauduleux quand détectés)

**Conséquences v2.0** :
- ❌ Pas de LinkedIn URL (pas de fake profil)
- ❌ Pas de Twitter / X handle (pas de fake compte)
- ❌ Pas de Wikidata Q-id (pas de personne réelle à référencer)
- ❌ Pas de `alumniOf`, `award[]` (rien à inventer)
- ✅ `description` JSON-LD inclut un disclaimer transparent
- ✅ Photo = visuel Unsplash sans visage identifiable OU avatar SVG géométrique stable (cf. seed `manon-profile.md`)
- ✅ `Organization` Axion-IA reste publisher fort de tous les articles

#### 9.8.2 Page canonique auteur

URL : **`/fr/equipe/manon`** — page créée + indexable tier-1.

Contenu minimum :
- Photo Manon (`public/auteurs/manon.avif` + 3 variantes srcset)
- Nom : Manon
- Rôle : Rédactrice & responsable éditoriale — Axion-IA
- Bio 200-400 mots (1ʳᵉ personne)
- Expertises (`knowsAbout[]`) : IA opérationnelle, audit IA, transformation digitale PME/ETI, AEO/SEO 2026, automatisation, etc.
- Articles publiés : liste auto-générée des articles tier-1 signés Manon
- Liens externes : LinkedIn (à fournir Will), Twitter/X (optionnel), Substack (optionnel)

#### 9.8.3 JSON-LD Person canonique

Dans `src/lib/seo.ts` → nouvel export `buildPersonManonJsonLd()` :

```jsonld
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://axion-ia.com/fr/equipe/manon#person",
  "name": "Manon",
  "givenName": "Manon",
  "jobTitle": "Rédactrice & responsable éditoriale",
  "worksFor": {
    "@type": "Organization",
    "@id": "https://axion-ia.com/#organization",
    "name": "Axion-IA",
    "url": "https://axion-ia.com"
  },
  "url": "https://axion-ia.com/fr/equipe/manon",
  "image": {
    "@type": "ImageObject",
    "url": "https://axion-ia.com/auteurs/manon-1024.avif",
    "width": 1024,
    "height": 1024,
    "caption": "Manon, rédactrice Axion-IA"
  },
  "description": "Manon est la plume éditoriale d'Axion-IA — persona éditoriale sous laquelle signe notre équipe de rédaction et notre processus de production IA supervisé. Tous les contenus tier-1 sont validés par notre relecture humaine avant publication.",
  "knowsAbout": [
    "Intelligence artificielle opérationnelle",
    "Audit IA en entreprise",
    "Transformation digitale TPE PME ETI",
    "Implémentation IA custom",
    "AEO et SEO 2026",
    "Automatisation des processus",
    "Méthodologie Axion-IA"
  ],
  "knowsLanguage": ["fr-FR"],
  // ❌ Pas de sameAs[] en v2.0 (persona transparente — pas de fake profils sociaux).
  // ✅ Lien d'autorité via worksFor (vraie Organization Axion-IA estonienne).
  "worksFor": {
    "@id": "https://axion-ia.com/#organization"
  },
  // alumniOf et award : omis si non fournis par Will (Q13). Schema Zod :
  //   alumniOf: z.string().optional()
  //   award: z.array(z.string()).optional()
  // Si Will ne fournit rien → ces champs sont absents du JSON-LD émis (Schema.org tolère).
}
```

**STOP & ASK Will (cf. Q13 § 20) — ✅ RÉSOLU 2026-05-14** : nom = « Manon » (prénom seul, pas de nom de famille). Photo = `/auteurs/manon.png` (portrait IA disclosed, Option 4). Bio = validée OK tel quel. **LinkedIn = `null` (persona sans réseau social). Twitter/X = `null` (idem, balise `twitter:creator` toujours omise).** `alumniOf` + `award` = absents (persona fictive transparente).

#### 9.8.4 Byline en haut de chaque article

```html
<header class="article-byline">
  <a href="/fr/equipe/manon" rel="author" class="byline-link">
    <img src="/auteurs/manon-80.avif" width="40" height="40" alt="Manon" class="byline-avatar" loading="lazy" />
    <span class="byline-name">Par <strong>Manon</strong></span>
  </a>
  <span class="byline-sep">·</span>
  <time datetime="2026-05-13" class="byline-date">13 mai 2026</time>
  <span class="byline-sep">·</span>
  <span class="byline-reading">8 min de lecture</span>
</header>
```

Liens `rel="author"` reconnus Google.

#### 9.8.5 Bio card en bas de chaque article

```html
<aside class="author-card" aria-labelledby="author-card-title">
  <img src="/auteurs/manon-256.avif" width="128" height="128" alt="Manon, rédactrice Axion-IA" loading="lazy" decoding="async" />
  <div>
    <h2 id="author-card-title" class="author-card-name">À propos de Manon</h2>
    <p class="author-card-bio">Manon est rédactrice et responsable éditoriale chez Axion-IA, cabinet IA opérationnel. Elle décrypte chaque semaine les usages concrets de l'IA en entreprise.</p>
    <ul class="author-card-links">
      <li><a href="/fr/equipe/manon">Tous ses articles</a></li>
      <li><a href="https://www.linkedin.com/in/manon-axionia/" rel="external noopener">LinkedIn</a></li>
    </ul>
  </div>
</aside>
```

#### 9.8.6 Tous les schemas `Article.author` pointent vers Manon

```jsonld
"author": {
  "@id": "https://axion-ia.com/fr/equipe/manon#person"
}
```

(référence par `@id`, pas duplication, hygiène JSON-LD).

### 9.9 Templates HTML gold standard — par type de contenu

> Ces templates sont le **modèle référentiel**. Tout HTML rendu pour un contenu généré doit s'y conformer ligne à ligne.

#### 9.9.1 Template Landing ville (skeleton)

```html
<!doctype html>
<html lang="fr" dir="ltr">
<head>
  <!-- 32 balises § 9.7.1 -->
  <!-- 14 OG § 9.7.2 -->
  <!-- 7 Twitter § 9.7.3 -->
  <!-- 4 Geo § 9.7.4 -->
  <!-- 10 JSON-LD scripts § 9.7.8 (1 par schema, séparés) -->
  <!-- Critical CSS inline ≤ 14 KB -->
  <!-- Preload LCP image AVIF -->
</head>
<body>
  <a class="skip-link" href="#main">Aller au contenu</a>
  <header class="site-header">…</header>

  <nav aria-label="Fil d'Ariane">
    <ol>
      <li><a href="/fr/">Accueil</a></li>
      <li><a href="/fr/implantations">Implantations</a></li>
      <li><a href="/fr/implantations/{region}">{Region}</a></li>
      <li><a aria-current="page">{Ville}</a></li>
    </ol>
  </nav>

  <main id="main">
    <article itemscope itemtype="https://schema.org/Article">

      <!-- HERO -->
      <header class="hero">
        <h1>Audit IA à {Ville} — Cabinet IA opérationnel pour {Departement}</h1>
        <p class="hero-lede">{Lede 30-50 mots, mention ville + secteur dominant + prix d'entrée}</p>
        <figure class="hero-figure">
          <picture>
            <source srcset="…-320.avif 320w, …-768.avif 768w, …-1280.avif 1280w" type="image/avif" sizes="(min-width: 1024px) 1024px, 100vw" />
            <source srcset="…-320.webp 320w, …-768.webp 768w, …-1280.webp 1280w" type="image/webp" sizes="(min-width: 1024px) 1024px, 100vw" />
            <img src="…-1280.jpg" width="1024" height="1024" alt="{alt généré}" fetchpriority="high" loading="eager" decoding="async" class="hero-schema" />
          </picture>
        </figure>
        <div class="byline-block"><!-- byline § 9.8.4 --></div>
      </header>

      <!-- TL;DR (AEO Speakable) -->
      <aside data-aeo="tldr" class="tldr">
        <strong>En bref :</strong> {2-4 lignes factuelles}
      </aside>

      <!-- DIRECT ANSWER (AEO Speakable) -->
      <p data-aeo="answer" class="direct-answer">{40-80 mots, réponse à la question principale du titre}</p>

      <!-- KEY FACTS -->
      <ul data-aeo="facts" class="key-facts">
        <li>{Fact 1 chiffré}</li>
        <li>{Fact 2 chiffré}</li>
        <li>{Fact 3 chiffré}</li>
        <li>{Fact 4 chiffré}</li>
      </ul>

      <!-- TOC -->
      <nav aria-label="Sommaire" class="toc">
        <h2>Sommaire</h2>
        <ol>
          <li><a href="#contexte">Contexte économique {Ville}</a></li>
          <li><a href="#paliers">Paliers entreprise et tarifs</a></li>
          <!-- … -->
        </ol>
      </nav>

      <!-- SECTIONS (8-10 H2) -->
      <section aria-labelledby="contexte" id="contexte">
        <h2>Contexte économique de {Ville} ({population} habitants)</h2>
        <p>{200-400 mots — 5 % INSEE max}</p>
        <h3>Secteurs dominants</h3>
        <p>{contenu KB AxionIA-centric}</p>
      </section>

      <section aria-labelledby="paliers" id="paliers">
        <h2>Paliers entreprise et tarifs Axion-IA à {Ville}</h2>
        <table>
          <caption>Tarifs Axion-IA selon taille INSEE — {Ville}</caption>
          <thead>
            <tr><th scope="col">Taille</th><th scope="col">Effectif</th><th scope="col">Audit Flash</th><th scope="col">Audit Ciblé</th><th scope="col">Audit Stratégique</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">TPE</th><td>&lt; 10</td><td>{formatAmount}</td><td>—</td><td>—</td></tr>
            <tr><th scope="row">PME</th><td>10-249</td><td>{formatAmount}</td><td>{formatAmount}</td><td>{formatAmount}</td></tr>
            <!-- … -->
          </tbody>
        </table>
      </section>

      <!-- … 6-8 autres sections H2 -->

      <section aria-labelledby="communes-voisines" id="communes-voisines">
        <h2>Axion-IA accompagne aussi les communes voisines</h2>
        <ul>
          <!-- ItemList JSON-LD-backed -->
          <li><a href="/fr/implantations/{region}/{ville-voisine-1}">{Ville voisine 1}</a></li>
          <!-- … 5-10 villes voisines via Haversine -->
        </ul>
      </section>

      <!-- FAQ -->
      <section aria-labelledby="faq" id="faq" class="faq">
        <h2>Questions fréquentes — Audit IA à {Ville}</h2>
        <details>
          <summary><h3>{Question géolocalisée 1}</h3></summary>
          <p>{Réponse 30-100 mots}</p>
        </details>
        <!-- 6-12 items -->
      </section>

      <!-- CTA -->
      <section class="cta-final" aria-labelledby="cta-final">
        <h2 id="cta-final">Prêt à auditer votre IA à {Ville} ?</h2>
        <a href="/fr/reserver?source=ville-{slug}" class="btn-primary">Réserver un audit Flash</a>
      </section>

      <!-- Bio Manon -->
      <footer class="article-footer">
        <!-- author-card § 9.8.5 -->
      </footer>

    </article>
  </main>

  <footer class="site-footer">…</footer>

  <!-- Web Vitals tracking script -->
</body>
</html>
```

#### 9.9.2 Template Article blog

Skeleton similaire avec :
- 1 `<h1>` = titre article
- 3-7 `<h2>` sections
- TL;DR + Direct Answer + Key Facts + TOC obligatoires
- FAQ embed obligatoire (4-12 items)
- Byline Manon + author-card en bas
- JSON-LD : `Article` (ou variante) + `BreadcrumbList` + `FAQPage` + `Speakable` + `Person` (Manon) + `Organization` + `WebPage`

#### 9.9.3 Template Comparatif

- 1 `<h1>` = "Comparatif : {ItemA} vs {ItemB} vs {ItemC} — Quel choix pour {audience} en 2026 ?"
- 1 `<table>` comparatif avec `<caption>` + `<th scope="col">`
- 1 H2 par item (1 paragraphe Pros / 1 Cons)
- H2 final : "Verdict Axion-IA"
- FAQ + bio Manon
- JSON-LD : `Article` + items en `Product`/`Service`

#### 9.9.4 Template Guide pilier

- 1 `<h1>`
- 1 TOC obligatoire (8-15 ancres)
- 8-15 sections H2 avec étapes
- JSON-LD `HowTo` + `HowToStep[]` + `Article` + FAQ + bio
- 3000-5000 mots
- TL;DR exécutif visible en haut

#### 9.9.5 Template FAQ standalone

- 1 `<h1>` thématique
- 10-25 paires Q/R en `<details>/<summary>`
- JSON-LD `QAPage` + `Question` + `Answer`
- Bio Manon

### 9.10 Mobile-first + Web Vitals 2026

#### 9.10.1 Mobile-first rules

- **Design viewport** : 375×667 minimum (iPhone SE).
- **Touch targets** : ≥ 44×44 px (Apple) / ≥ 48×48 px (Material).
- **Tap delay** : viewport meta `viewport-fit=cover` + 0 fast-click hack nécessaire.
- **Pas de hover-only** : tout doit fonctionner au touch.
- **Pas de modal trap** : back button système doit fermer.
- **Lecture mobile** : largeur de ligne 60-75 caractères, font ≥ 16 px body, line-height ≥ 1.5.
- **Pas de tableau wide-only** : tables `overflow-x: auto` + indicateur de scroll.
- **CSS container queries** privilégiées sur media queries.

#### 9.10.2 Budget Web Vitals (rappel + spécificités content-gen)

| Vital | Cible | Outil |
|---|---|---|
| **LCP** | ≤ 1 800 ms p75 | Lighthouse CI + CrUX RUM |
| **INP** | ≤ 100 ms p75 (200 ms hard cap) | web-vitals lib |
| **CLS** | = 0 strict | Lighthouse + RUM |
| **TBT** | ≤ 150 ms | Lighthouse |
| **FCP** | ≤ 1 000 ms p75 | Lighthouse |
| **TTFB** | ≤ 600 ms p75 | RUM |
| **First Load JS** | ≤ 75 KB gz / route | Size-limit CI |

Pages contenus générés (`/fr/blog/<slug>`, `/fr/implantations/<region>/<ville>`) ont une exception sur INP **uniquement** (jusqu'à 150 ms p75) car cachées CF agressivement et statiques.

#### 9.10.3 Techniques de performance imposées

1. **Critical CSS inline** ≤ 14 KB (1 RTT) — généré par Beasties (déjà en place via Next).
2. **Reste CSS** chargé asynchrone via `<link rel="preload" as="style" onload="this.rel='stylesheet'">`.
3. **Font-display: swap** + preload font subset latin-ext uniquement (pas de glyphes inutilisés).
4. **Self-host fonts** sur même domaine ou CDN proche (Cloudflare CF same-origin).
5. **Aucune Google Fonts CDN** runtime (privacy + perf).
6. **LCP image** : preload + `fetchpriority="high"` + AVIF 320/768/1280 srcset.
7. **Non-LCP images** : `loading="lazy"` + `decoding="async"` + `width`/`height`.
8. **Vidéos** : V1 = pas de vidéo embed. V2 = `<video preload="metadata">` + poster image.
9. **iframes** (embeds externes) : V1 = aucun. V2 = `loading="lazy"` + sandbox.
10. **content-visibility: auto** sur sections below-fold (gain INP énorme).
11. **CSS contain** sur composants isolés (`contain: layout style paint`).
12. **No JS layout shift** : pas d'élément qui apparaît après hydratation et pousse le contenu.
13. **Server-side everything possible** : RSC par défaut, Client Component uniquement si interactivité.
14. **`use client` minimisé** : éviter dans templates de contenu. Préférer islands (mega-menu, search, calendrier).
15. **Pas de polyfill global** : import dynamique seulement si feature manquante.
16. **Tree-shaking strict** : aucun `import *`.
17. **Bundle analyzer** CI gate : warn si +5 KB delta.
18. **HTTP/2 multiplexing** + HTTP/3 (Cloudflare déjà configuré).
19. **Brotli compression** activé Cloudflare (déjà).
20. **Cache CF** agressif : `/fr/blog/<slug>` cache 24h edge, `/fr/implantations/<region>/<ville>` cache 7j edge.

#### 9.10.4 Web Vitals RUM (Real User Monitoring)

- Install `web-vitals` lib (~2 KB gz, sans surcoût notable).
- Capturer LCP, INP, CLS, FCP, TTFB par session → `navigator.sendBeacon('/api/rum', payload)`.
- Stocker dans Plausible (custom props) + table Prisma `WebVitalSample` pour analyse fine.
- Dashboard `/admin/content-gen/web-vitals` (V2) : p50/p75/p95 par type de page.
- Alerte Telegram si p75 LCP > 2 000 ms sur 7 jours glissants.

#### 9.10.5 Audit avant publication tier-1

`pnpm content-gen:lighthouse <url>` lance Lighthouse local headless avec budget `lighthouse-budget.json` :

```json
{
  "resourceSizes": [
    { "resourceType": "script", "budget": 75 },
    { "resourceType": "image", "budget": 200 },
    { "resourceType": "stylesheet", "budget": 30 },
    { "resourceType": "font", "budget": 60 },
    { "resourceType": "total", "budget": 500 }
  ],
  "timings": [
    { "metric": "largest-contentful-paint", "budget": 1800 },
    { "metric": "interactive", "budget": 2500 },
    { "metric": "cumulative-layout-shift", "budget": 0 }
  ]
}
```

Échec budget = **bloque la promotion tier-1**.

### 9.11 Extrême rapidité de génération (production-side)

> Cible : **1 landing ville complète (~5 000 mots + 2 images + JSON-LD complet) générée bout-en-bout en ≤ 90 s p50, ≤ 150 s p95**. 1 article blog 1 500 mots : ≤ 40 s p50. 1 FAQ standalone : ≤ 15 s p50. Mesuré dans `ContentGenJob.durationMs`.

#### 9.11.1 Anti-waterfall — paralléliser ce qui peut l'être

Le pipeline § 6 est réordonnancé en **3 étages parallèles + assemblage** :

```
T0 ─┬─ KB retrieve (cosine pgvector, ~200 ms)           ─┐
    ├─ Perplexity Sonar (data run, ~3-8 s)              ─┤
    ├─ SSOT load (pricing.ts + regions + ville INSEE)   ─┤
    │  (sync, ~5 ms — read fichiers TS déjà en mémoire) │
    └─ Dedup-guard pré-IA (~50 ms)                      ─┘
                                                          │
                                       ┌──────────────────┘
                                       ▼
T1 ─── LLM text gen (gpt-4o streaming, 30-60 s pour 5K mots)
                                       │
                          ┌────────────┴────────────────┐
                          ▼                             ▼
T1.5 ─── Image gen #1 (gpt-image-1 hero)         T1.5 ─── Image gen #2 (gpt-image-1 section)
       (lancée dès que H1 + lede streamés,             (lancée à la moitié du body)
        ~15-25 s pendant que text continue)             ~15-25 s pendant que text continue
                          │                             │
                          └────────────┬────────────────┘
                                       ▼
T2 ─── Validation Zod + plagiarism + doctrine + SEO score (~500 ms)
                                       │
                                       ▼
T3 ─── Write file + revalidate (~200 ms)
```

→ **Économie estimée : 30-50 % de durée totale** vs séquentiel.

Implémenté dans `generators/landing-ville.ts` via `Promise.all()` + early-image-gen déclenché par hook `onStreamChunk` LLM.

#### 9.11.2 Streaming LLM obligatoire

Tous les appels text gen utilisent **streaming** (`stream: true`) :

- OpenAI : `client.chat.completions.create({ stream: true })` → async iterator
- Anthropic : `client.messages.stream({ ... })` → callback `on('text')`

Bénéfices :
- **Time-to-first-token** ≤ 1 s vs ≤ 30 s en mode bloc
- **Hooks early-action** : détecter dans le flux la fin du H1 → lancer image gen #1 ; détecter mi-body → lancer image gen #2 ; détecter FAQ → lancer validation partielle
- **UI admin streamé** : SSE vers `/admin/content-gen/jobs/[id]` → Will voit le texte se construire en temps réel (UX type ChatGPT)
- **Backpressure** : si erreur 5xx en milieu de flux → retry du suffixe seulement (économie tokens)

#### 9.11.3 Prompt caching agressif

- **Anthropic prompt caching** (`cache_control: { type: "ephemeral" }`) : le **system prompt + doctrine + KB top-K chunks AxionIA-canoniques** sont mis en cache 5 min. Pour un batch de 20 villes consécutives, économie estimée **70-90 % des tokens d'entrée** (le contexte « doctrine + KB » est ré-utilisé).
- **OpenAI prompt caching** : automatique pour prompts ≥ 1024 tokens, dédupliqué par hash du prefix. Mettre le contenu stable en tête (doctrine → instructions → context KB → variables ville).
- Structure de prompt obligatoire pour exploiter le cache :
  ```
  [STABLE — cacheable]
    - System prompt doctrine AxionIA (~2 000 tokens)
    - KB top-8 chunks canoniques pour ce type (~3 000 tokens)
  [VARIABLE — non-cacheable]
    - Variables ville/article spécifiques (~500 tokens)
    - Instruction de sortie Zod schema (~500 tokens)
  ```
- Mesuré et logué dans `ContentGenJob.metadata.cacheHitRate`. Cible ≥ 70 % en régime batch.

#### 9.11.4 KB hot path

- pgvector HNSW index `m=16, ef_construction=64, ef_search=40` → query ≤ 50 ms p95 sur 10 K chunks.
- Connection pool Prisma `connection_limit=20` (déjà tuned).
- Statement caching Postgres activé.
- **Pré-fetch optionnel** : pour batch ville-par-ville, pré-charger les chunks canoniques génériques (doctrine, méthodologie, audit-pyramide) dans un cache LRU mémoire process (TTL 5 min) → 0 ms après le 1ᵉʳ retrieve.

#### 9.11.5 Parallélisme worker BullMQ

- `content-gen` queue : **concurrency = 5 workers** (au lieu de 3 — tuner selon CPU CPX32). Chacun consomme 1 job indépendant.
- **Rate limit OpenAI tier 5** : 500 RPM gpt-4o + 5 000 RPM gpt-4o-mini → on est très loin du plafond avec 5 workers.
- **Rate limit Anthropic** : 50 RPM par défaut → fallback potentiel = bottleneck. Demander upgrade tier si bulk batch >100 v/j.
- **Rate limit Perplexity** : 50 RPM standard → idem.
- BullMQ `rateLimiter: { max: 50, duration: 60_000 }` configuré par worker pour ne jamais saturer.
- Si saturation détectée → fallback automatique vers provider secondaire (cf. § 7.1) sans interrompre le job.

#### 9.11.6 Circuit breaker rapide

Lib `opossum` ou implémentation maison légère :
- **Open threshold** : 5 erreurs consécutives sur 30 s → circuit ouvert 60 s
- **Half-open** : 1 essai test après 60 s
- **État partagé Redis** : tous les workers voient le circuit en même temps (évite que chaque worker découvre la panne indépendamment)
- Pendant circuit ouvert → fallback provider immédiat sans attendre timeout 30 s
- Économie estimée en cas de panne provider : ~25 s par job

#### 9.11.7 Image gen async pendant text gen

Le pipeline § 9.11.1 lance les 2 image gens **pendant** que le text gen continue. Implementé via :

```ts
const textStream = openai.chat.completions.create({ stream: true, ... });
let h1Detected = false;
let imageJob1: Promise<ImageAsset> | null = null;

for await (const chunk of textStream) {
  buffer += chunk.choices[0].delta.content;
  if (!h1Detected && /<h1>.*<\/h1>/.test(buffer)) {
    h1Detected = true;
    imageJob1 = imageGenClient.generate(buildImagePrompt('hero', { ville, h1Match }));
  }
  // … idem pour image #2 à mi-body
}
const text = buffer;
const [img1, img2] = await Promise.all([imageJob1, imageJob2]);
```

Pendant que le LLM streame, les images sont déjà en cours → économie 15-25 s par job.

#### 9.11.8 SSE realtime pour UI admin

- Route `app/api/content-gen/jobs/[id]/stream/route.ts` → SSE qui pousse :
  - chaque chunk de texte streamé (preview live)
  - chaque changement de statut (`queued` → `running` → `generating_image` → `validating` → `done`)
  - logs en temps réel
  - métriques tokens / coût en cumul
- Composant React `<JobLogStream jobId={id} />` (déjà cité § 4.1bis) côté admin.
- Realtime cockpit géo § 15 utilise une SSE séparée `/api/content-gen/geo-events` qui pousse uniquement les changements de statut par ville (payload minimal).

#### 9.11.9 Batch token optimization

- Réutilisation max du contexte KB entre villes du même département (cache prompt + KB warm).
- 1 batch = 1 « session » BullMQ avec preload KB ; les workers de ce batch partagent le LRU mémoire process.
- Économie estimée sur batch 280 villes Auvergne-Rhône-Alpes : **35-45 % de coût total** (vs 280 villes traitées indépendamment).

#### 9.11.10 Embeddings batch

- Pour les jobs `kb_health_check` ou similaires : batch les embeddings (jusqu'à 2048 inputs par call OpenAI) → 1 RTT au lieu de N.
- Cache embeddings sur les queries fréquentes (LRU Redis 24h, clé = hash(query+filters)).

#### 9.11.11 Cibles SLO mesurées

| Métrique | p50 | p95 | Mesuré dans |
|---|---|---|---|
| Landing ville bout-en-bout | ≤ 90 s | ≤ 150 s | `ContentGenJob.durationMs` |
| Blog article 1500 mots | ≤ 40 s | ≤ 70 s | idem |
| FAQ standalone (8 items) | ≤ 15 s | ≤ 30 s | idem |
| Comparatif 3-5 items | ≤ 60 s | ≤ 100 s | idem |
| Guide pilier 4000 mots | ≤ 180 s | ≤ 280 s | idem |
| Time-to-first-token streaming | ≤ 1 s | ≤ 2 s | metric custom |
| KB retrieve | ≤ 80 ms | ≤ 200 ms | metric custom |
| Cache hit rate (Anthropic) | ≥ 70 % | — | `metadata.cacheHitRate` |
| Provider fallback détection | ≤ 1 s | ≤ 2 s | circuit breaker |

Dashboard `/admin/content-gen/slo` (V2) affiche ces métriques par jour glissant. Alerte Telegram si p95 dévie +20 % sur 24 h.

#### 9.11.12 Anti-patterns interdits côté rapidité

- ❌ `await` séquentiel quand `Promise.all` possible
- ❌ Mode bloc (non-streaming) pour text gen
- ❌ Image gen lancée APRÈS le text complet (waterfall)
- ❌ Re-embed des mêmes chunks à chaque retrieve (cache absent)
- ❌ Polling DB pour suivre statut job (utiliser SSE)
- ❌ Lecture synchrone fichiers SSOT à chaque appel (charger 1 fois au boot worker)
- ❌ `JSON.parse` de gros payloads dans hot path (utiliser streams)
- ❌ `prisma.findMany` sans pagination sur tables qui peuvent grossir
- ❌ Timeout > 60 s sans circuit breaker
- ❌ Retry sans backoff exponentiel (DDoS le provider)

---

## 9bis. Indexation perfection 2026

### 9bis.1 Triple-canal d'indexation

Pour chaque contenu tier-1 publié, déclencher en parallèle :

| Canal | Trigger | Latence cible | Sprint |
|---|---|---|---|
| **Sitemap XML** | `revalidatePath('/sitemap-*.xml')` automatique | < 24h Google | V1 |
| **IndexNow** (Bing/Yandex/Seznam) | POST `https://api.indexnow.org/IndexNow` avec key | minutes | V1 (sprint 5) |
| **Google Indexing API** (officiellement JobPosting + LiveBroadcastEvent uniquement, mais utilisable en grey area pour tout contenu) | OAuth2 service account → POST `urlNotifications:publish` | minutes | **V1 (Sprint 5)** — révisé v2.4 |
| **Bing Webmaster Tools URL submission** | POST API key + URL | minutes | V1 (sprint 5) |
| **Cloudflare cache purge** | API CF tag-based purge | secondes | V1 (sprint 5) |
| **revalidatePath / revalidateTag Next** | Server Action | secondes | V1 |

### 9bis.2 Sitemap perfection

- **sitemap-index.xml** → 6 sitemaps enfants (blog, villes, guides, faq, comparaisons, pages-statiques)
- Chacun chunké à **1 000 URLs max**
- `lastmod` **précis à la seconde** (ISO 8601 avec fuseau), pas à la journée
- `changefreq` dynamique : tier-1 villes = `monthly`, tier-1 articles = `weekly`, listings = `daily`
- `priority` dynamique : tier-1 ville pilote (Paris) = `1.0`, tier-1 villes secondaires = `0.8`, articles tier-1 = `0.7`, listings = `0.5`
- **Image extension** : `<image:image>` pour chaque hero
- **Video extension** (V2) : si vidéos intégrées
- **News extension** (jamais — Axion-IA pas média)
- Validation `pnpm sitemap:validate` (XSD)

### 9bis.3 Headers HTTP cache-friendly (Cloudflare)

- `ETag` (hash du contenu) + `Last-Modified` (= `updatedAt`)
- `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`
- `Vary: Accept-Encoding, Accept-Language`
- `X-Robots-Tag` conditionnel selon `indexationTier` (au cas où le HTML est servi via API au lieu du body)
- `Link: <https://axion-ia.com/fr/blog/slug>; rel="canonical"` (en plus du `<link>` HTML)
- `Link: <https://axion-ia.com/en/blog/slug>; rel="alternate"; hreflang="en"`

### 9bis.4 Canonical & hreflang stricts (FR-only v1.2)

- **1 seul canonical** par URL, toujours `https://axion-ia.com/fr/<path>`
- `hreflang` minimal : `fr-FR` + `x-default` (= FR). **Aucun `en-US`** sur les contenus générés (FR-only acté).
- Vérification automatique `pnpm content-gen:hreflang-check` : 100 % articles tier-1 ont exactement 2 balises `alternate` (fr-FR + x-default) pointant la même URL.
- Le check legacy `pnpm i18n:check` (parity FR/EN) reste **désactivé** sur les contenus générés. Il continue de tourner sur les pages éditoriales manuelles (`/en/*`) qui ne sont pas touchées.

### 9bis.5 Internal linking automatique (clarifié v2.2 — pas de table dédiée)

> **Doctrine v2.2** : les liens internes NE sont PAS stockés dans une table dédiée. Ils sont **calculés au runtime** par cosine similarity retrieve sur la table `Article` existante. Avantage : toujours à jour automatiquement quand de nouveaux articles tier-1 sont publiés.

Lors de la génération de chaque article tier-1, le generator calcule :
- **3-5 liens internes intra-corpus** : embed le primary keyword + section H2s → cosine top-K sur `Article.embedding` (filtré `indexationTier=tier_1`, `category` même catégorie OU `sectors` overlap). Récupère top 5, garde les 3 plus pertinents.
- **2-3 liens vers pages villes pertinentes** (`relatedCities[]`) : depuis champ `Article.relatedCities[]` ou `ContentGenJob.anchorVilleSlug` + Haversine voisinage.
- **1-2 liens vers pages services** (`serviceTypes[]`) : link toward `/fr/audit-ia`, `/fr/interventions`, `/fr/implementation`.
- **1 lien vers `/fr/methodologie`** (signal autorité) ou `/fr/cas-concrets` (signal preuve).
- **Anchor text = expression sémantique** (jamais « cliquez ici » ou « voir aussi »). Extrait depuis le H2 ou primary keyword de l'article cible.

**Section « Articles similaires » en bas de page (nouveau v2.2 — obligatoire)** :

```html
<aside aria-labelledby="similar-articles-title" class="similar-articles">
  <h2 id="similar-articles-title">Lectures recommandées</h2>
  <ul class="similar-articles-list">
    <li>
      <a href="/fr/blog/<slug>" class="similar-article-link">
        <img src="<heroImage>" alt="..." width="160" height="90" loading="lazy" />
        <div>
          <h3>{Titre article similaire}</h3>
          <p>{Excerpt 80-100 chars}</p>
          <span class="similar-meta">{Catégorie} · {Reading time}</span>
        </div>
      </a>
    </li>
    <!-- 3-5 items max -->
  </ul>
</aside>
```

Algo de sélection :
1. Cosine top-10 sur primary keyword + tags
2. Filtre `tier_1_indexable` + même catégorie OU sectors overlap > 50 %
3. Diversification : pas 5 articles tous du même secteur (équilibrage par catégorie)
4. Top 3-5 finaux

→ Validation `posts:validate` : section « Articles similaires » présente avec ≥ 3 items. Sinon `qualityScore -3 pts`.

### 9bis.5bis Liens externes — table dédiée `ExternalReference` v2.2 (« dossier complet »)

> **Doctrine v2.2** : les sources externes citées (Wikipedia, INSEE officiel, Le Monde Info, etc.) sont centralisées en DB via table `ExternalReference`. Permet : réutilisation centralisée, audit qui cite quoi, détection liens cassés (V2), pondération sources fiables vs douteuses.

```prisma
model ExternalReference {
  id                 String   @id @default(cuid())
  url                String   @unique
  title              String
  publisher          String?              // « INSEE », « Le Monde Informatique », « Wikipedia », « Anthropic »
  publisherDomain    String               // « insee.fr », « lemondeinformatique.fr »
  trustTier          TrustTier @default(standard)  // official | high | standard | low | excluded
  language           Locale   @default(fr)
  description        String?   @db.Text
  publishedAt        DateTime?
  lastVerifiedAt     DateTime?            // V2 — link-checker cron
  isAlive            Boolean  @default(true)
  citationCount      Int      @default(0)  // nb articles qui citent cette source
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  citations          ContentCitation[]
}

enum TrustTier {
  official     // INSEE, gouv.fr, banques centrales, ONU — citation prioritaire
  high         // Le Monde, Les Echos, Reuters, Bloomberg, Nature — fiable
  standard     // sites tech/business B2B reconnus (LMI, ZDNet, JDN, etc.)
  low          // blogs, contenu non vérifié
  excluded     // sources blacklistées
}

model ContentCitation {
  id                 String   @id @default(cuid())
  articleId          String?               // FK Article (si publié)
  jobId              String?               // FK ContentGenJob (si pas encore publié)
  externalReferenceId String
  externalReference  ExternalReference @relation(fields: [externalReferenceId], references: [id])
  citationContext    String   @db.Text    // phrase de l'article où la citation est insérée
  anchorText         String                // texte du lien
  createdAt          DateTime @default(now())
  @@index([articleId])
  @@index([externalReferenceId])
}
```

**Pipeline générateur v2.2** :
1. Generator demande à Perplexity Sonar → reçoit sources avec URL + title + date
2. Pour chaque source, le module `citation-manager.ts` :
   - Hash URL → lookup `ExternalReference` existante
   - Si trouvée → `citationCount++` + crée `ContentCitation`
   - Si pas trouvée → crée nouvelle `ExternalReference` avec `trustTier` auto (heuristic domaine : `insee.fr` → official, `lemonde.fr` → high, etc.)
3. Le contenu généré insère liens `rel="external noopener"` + JSON-LD `Article.citation[]`
4. Si `trustTier = low` → warning (mais publication autorisée). Si `excluded` → rejet automatique.

**Page admin `/[adminPrefix]/content-gen/external-references`** :
- Tableau CRUD sources curées
- Bulk-edit `trustTier` (Will peut promouvoir/démouvoir sources)
- Vue « top sources citées » par count
- V2 : link-checker cron quotidien qui passe `isAlive=false` sur 404/410

**Seed `external-references.json`** (~50 sources curées de référence) — à créer v2.2.

### 9bis.6 Soft-404 & broken links auto-detect

Cron quotidien `link-checker` :
- Crawl tous liens internes des articles tier-1
- 404/410 détecté → notification admin + lien désactivé temporairement
- Search Console API (V2) : récup « soft-404 » + « crawled - currently not indexed » → action plan auto

### 9bis.7 Pagination & filters

- `/blog?page=2` → `<link rel="prev" href="...?page=1" />` + `<link rel="next" href="...?page=3" />`
- `/blog?service=audit&taille=eti` → canonical = `/blog` (pas duplicate)
- `noindex` sur combinaisons filtres > 1 actif (anti-thin-content)

### 9bis.8 Dynamic OG images

- Route `app/api/og/route.ts` (déjà en place ?) qui génère 1200×630 PNG avec titre + accent terracotta + logo
- Cache CF 30j
- Variante par locale (titre traduit)
- Fallback static si génération échoue

### 9bis.9 RSS feeds

- `/blog/feed.xml` (existe déjà) — tier-1 only
- `/comparatifs/feed.xml`, `/guides/feed.xml` (V2)
- WebSub (PubSubHubbub) push (V2) — notif immédiate aux readers

### 9bis.9bis Crawl budget optimization v2.3 (pour scale 82 000+ surfaces)

> Avec 82 000+ pages indexables potentielles, le **crawl budget Google** devient un facteur critique. Sans optimisation, Googlebot peut crawler des pages tier-3 et négliger les tier-1.

**Doctrine v2.3** :

1. **Sitemap tier-1 strict** : seuls les contenus `indexationTier = tier_1_indexable` ET `qualityScore ≥ 75` sont dans `sitemap-blog.xml`, `sitemap-villes.xml`, `sitemap-news.xml`, `sitemap-faq.xml`, `sitemap-guides.xml`, `sitemap-comparaisons.xml`. **Tier-2 et tier-3 absents physiquement.**

2. **`<priority>` dynamique** dans le sitemap :
   - 1.0 : home + 3-5 piliers (méthodologie, audit-ia, interventions, implementation, /equipe/manon)
   - 0.9 : tier-1 landings villes (générale + audit + interventions + impl × ville prioritaire)
   - 0.8 : tier-1 guides piliers + comparatifs
   - 0.7 : tier-1 articles blog + Q/R pages
   - 0.6 : pages catégories / index
   - (sans priority) : listings filtres

3. **`<changefreq>` dynamique** :
   - `daily` : home + actualités RSS tier-1 (lastmod < 7 j)
   - `weekly` : articles blog tier-1, landings villes pilotes (top 100)
   - `monthly` : Q/R pages, comparatifs, landings villes secondaires
   - `yearly` : pages statiques (mentions légales, équipe)

4. **`<lastmod>` précis à la seconde** : recalculé à chaque revalidate. Header HTTP `Last-Modified` cohérent.

5. **Internal linking hub-and-spoke** : les piliers + landings villes hub reçoivent ≥ 30 % des liens internes du corpus (signal d'autorité concentré). Les pages Q/R reçoivent < 5 % (feuilles de l'arbre).

6. **robots.txt 2026** :
   ```
   User-agent: Googlebot
   Allow: /
   Crawl-delay: 0
   
   User-agent: Bingbot
   Allow: /
   Crawl-delay: 0
   
   User-agent: GPTBot
   Allow: /
   Crawl-delay: 2
   
   User-agent: ClaudeBot
   Allow: /
   Crawl-delay: 2
   
   User-agent: PerplexityBot
   Allow: /
   
   # Disallow exemples (à adapter)
   User-agent: *
   Disallow: /api/
   Disallow: /admin/
   Disallow: /*?preview=true
   Disallow: /*?utm_
   
   Sitemap: https://axion-ia.com/sitemap-index.xml
   ```

7. **Canonical strict** : `<link rel="canonical">` + Header `Link: <url>; rel="canonical"` (double signal) — déjà spec'd § 9bis.3.

8. **Pas de chains de redirects** : 301 directs uniquement, jamais 301 → 301 → 200.

9. **Surveillance Search Console** (V2) : suivi `crawled - currently not indexed` + `discovered - currently not indexed` → diagnostic auto si > 10 % des tier-1.

10. **Indexing API Google + IndexNow** ping immédiat sur publication tier-1 (déjà spec'd § 9bis.1).

### 9bis.10 Schema testing automatique

CI gate : pour chaque article tier-1 → tester JSON-LD via :
- `schema-dts` types TypeScript (compile-time)
- Google Rich Results Test API (V2)
- Snapshot tests Vitest sur 9 schémas type

### 9bis.11 Patches SEO 2026 extrêmes (v1.9)

#### A. Google AI Mode 2026 — citations sources de confiance

Pour que Google AI Mode (Gemini-powered) cite Axion-IA comme source d'autorité :
- `Article.author` → `Person` avec `sameAs[]` contenant **Wikidata Q-id** (si dispo) + LinkedIn + Substack
- `Article.about[]` → entités principales avec `Thing.sameAs` Wikidata (ex « audit IA » → Q-id)
- `Article.mentions[]` → concepts secondaires sameAs Wikidata
- `Organization.sameAs[]` → LinkedIn Company + Crunchbase + Wikipedia/Wikidata
- **Test `tests/content-gen/seo/ai-mode-citability.spec.ts`** : vérifie chaque article tier-1 a ≥ 1 entité avec `sameAs` Wikidata

→ Tâche Sprint 6 : peupler `Organization.sameAs` + `Person.sameAs` Wikidata (Q13 Manon).

#### B. Speakable cssSelector — validation Playwright réelle

`Speakable` JSON-LD pointe sur cssSelector. Doit être testé en navigateur réel :

```ts
// tests/content-gen/seo/speakable-validation.spec.ts
import { test, expect } from "@playwright/test";

test("Speakable cssSelector pointe sur Direct Answer 40-80 mots", async ({ page }) => {
  await page.goto("/fr/implantations/auvergne-rhone-alpes/lyon");
  const text = await page.locator('[data-aeo="answer"]').textContent();
  const wordCount = text!.split(/\s+/).length;
  expect(wordCount).toBeGreaterThanOrEqual(40);
  expect(wordCount).toBeLessThanOrEqual(80);

  // Vérifie JSON-LD Speakable contient bien ce sélecteur
  const jsonLd = await page.locator('script[type="application/ld+json"]').allInnerTexts();
  const speakable = jsonLd.map(s => JSON.parse(s)).find(o => o["@type"] === "WebPage")?.speakable;
  expect(speakable.cssSelector).toContain('[data-aeo="answer"]');
});
```

#### C. `llms.txt` conformité spec Anthropic May 2026

Format YAML structuré (pas juste liste markdown) :

```yaml
# llms.txt (Anthropic spec May 2026)
site: Axion-IA
title: Cabinet IA opérationnel — Axion-IA
description: Cabinet IA opérationnel B2B basé en Estonie (OÜ). Audit, interventions, implémentation pour TPE/PME/ETI/grandes entreprises FR.

# Canonical pages
pages:
  - url: https://axion-ia.com/fr/audit-ia
    title: Audit IA (3 paliers Flash/Ciblé/Stratégique)
  - url: https://axion-ia.com/fr/interventions
    title: Interventions (14 formats sur 4 familles)
  - url: https://axion-ia.com/fr/implementation
    title: Implémentation custom IA
  - url: https://axion-ia.com/fr/methodologie
  - url: https://axion-ia.com/fr/cas-concrets
  - url: https://axion-ia.com/fr/equipe/manon

# Machine-readable variants
markdown_variants:
  enabled: true
  pattern: "/fr/blog/<slug>.md"

# Crawl preferences for AI bots
allow_ai_crawlers:
  - GPTBot
  - ClaudeBot
  - PerplexityBot
  - Google-Extended
  - CCBot
disallow_ai_training:
  - imagesiftbot

rate_limit:
  requests_per_minute: 60

contact: dpo@axion-ia.com
last_updated: 2026-05-13T15:00:00Z
```

Test `tests/content-gen/seo/llms-txt-conformance.spec.ts` :
- Parse YAML strict (échec si invalid YAML)
- Vérifie sections : site, title, description, pages, markdown_variants, allow_ai_crawlers, rate_limit, contact, last_updated
- Vérifie `last_updated` mis à jour à chaque revalidate

#### D. NewsArticle — format `dateline` + `printSection` enum strict

`dateline` : format `"Ville, AAAA-MM-JJ"` (ex « Paris, 2026-05-13 »).
`printSection` enum : `Technologie | Marché | Produit | Réglementation | Étude | Tribune`.
`articleSection` enum : `Actualité IA` (catch-all V1).

Validation `posts:validate` étendue pour variant RSS.

#### E. Image SEO 2026 — captions + EXIF + Lighthouse Image Audit

Chaque image générée :
- **`caption`** auto-générée par GPT-4o-mini à partir du contexte (3-10 mots significatifs)
- **EXIF embedded** : `Keywords`, `Subject`, `Copyright` (Axion-IA + Manon)
- Test Lighthouse Image Audit local sur la page rendue (script `pnpm content-gen:lighthouse-images <url>`)
- `<figcaption>` HTML obligatoire si caption présente
- `ImageObject` JSON-LD enrichi : `caption`, `creator: { @id Manon }`, `copyrightHolder: { @id Org }`

Extension de la fonction `image-optimizer.ts` (Sprint 1 Day 4) pour embed EXIF via `sharp` + `piexifjs`.

#### F. HCU « people-first signals » — meta tags + signaux

Ajouter dans `<head>` :
- `<meta name="people-first-content" content="true">` (non-officiel mais signal d'intention)
- `<meta name="content-quality" content="reviewed-by-human">` quand Will valide manuellement
- `<meta name="ai-assisted" content="true">` (transparence honnête — Manon utilise l'IA pour produire)
- Auteur réel humain identifiable (Manon `Person` avec credentials + photo + bio)
- Reviewed-by (V2) — `Article.reviewedBy` Person avec credentials

Toggle admin `/settings/transparency-signals` ON/OFF.

#### G. View Transitions API + Container Queries (V2)

Reporté V2 (non bloquant V1) :
- View Transitions API pour smooth scroll entre sections piliers
- Container Queries CSS pour responsive sans media queries
- Documenter dans `docs/content-gen/enhancements-v2.md`

#### H. Robots.txt 2026 — différenciation IA crawlers

Mettre à jour `public/robots.txt` (ou route dynamique) avec sections explicites :

```
# Bots utiles — autoriser tous
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# AI bots — autoriser citation mais limiter crawl agressif
User-agent: GPTBot
Allow: /
Crawl-delay: 2

User-agent: ClaudeBot
Allow: /
Crawl-delay: 2

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

# AI scrapers indésirables
User-agent: imagesiftbot
Disallow: /

User-agent: Bytespider
Disallow: /

Sitemap: https://axion-ia.com/sitemap-index.xml
```

Test `tests/content-gen/seo/robots-txt.spec.ts` : parse + vérifie sections AI bots présentes.

#### I. Templates HTML 2026 modernisés

- `<dialog>` element pour modals admin (au lieu de `<div class="modal">`)
- `<details open>/<summary>` pour FAQ progressivement améliorée (fonctionne JS off)
- `prefers-reduced-motion: reduce` respecté (CSS global)
- `prefers-color-scheme: dark` (V2)
- `ViewTransition` API (V2)

Cf. `_AUDIT/.claude/skills/axionia-content-generator/templates/landing-ville-template.tsx.md` pour template complet TSX.

---

## 10. Anti-plagiat & qualité éditoriale

### 10.1 Anti-plagiat (3 couches)

**Couche A — pré-génération (`dedup-guard.ts`)** :
- Title-similarity : Levenshtein contre derniers 1 000 titres (seuil ≥ 0.85 → BLOQUE).
- Primary keyword match : si même primary_keyword + même targetCity + < 90 jours → BLOQUE.
- Topic embedding : embed prompt → cosine vs derniers 500 articles (seuil ≥ 0.92 → BLOQUE).

**Couche B — post-génération (`plagiarism.ts`)** :
- Shingling 5-gram + Jaccard similarity contre corpus existant.
- Seuil interne Axion-IA → Axion-IA : ≥ 0.30 → re-write
- Seuil contenu RSS-derived → source originale : ≥ 0.10 → re-write strict
- Top 5 phrases matching loggées.

**Couche C — externe (Sprint V2)** :
- Copyscape API ou similaire (1 call par tier-1 promotion).
- Hard cap 100 calls/mois (budget).

### 10.2 Score qualité déterministe (`seo-score.ts`)

Grille 0-100 (V1) :

| Critère | Poids | Mesure |
|---|---|---|
| Word count | 15 | landing ville: 4500+ = 15pts ; blog: 1200+ = 15pts ; guide: 3000+ = 15pts |
| FAQ items présents | 10 | 4 items = 5pts ; 6+ = 10pts |
| Direct answer 40-80 mots | 8 | match exact = 8pts |
| H1 unique + 3-8 H2 | 8 | full = 8pts ; partial = 4pts |
| Primary keyword dans title + H1 + intro | 8 | tous 3 = 8pts ; 2/3 = 5pts |
| Density primary keyword 0.5-1.5 % | 6 | dans range = 6pts |
| Internal links ≥ 3 | 6 | yes = 6pts |
| External authoritative ≥ 1 | 4 | yes = 4pts |
| Image avec alt | 6 | yes = 6pts |
| JSON-LD complet | 8 | tous schemas type = 8pts |
| Readability Flesch FR ≥ 50 | 6 | yes = 6pts |
| Plagiarism < 30 % corpus interne | 8 | < 20% = 8pts ; 20-30% = 4pts |
| Doctrine check (naming, anti-SIREN, mots bannis) | 7 | full = 7pts |

→ Score 0-100. Bandes strictes :
- **0-39** → tier-3 forcé (`noindex, nofollow`)
- **40-69** → tier-2 forcé (`noindex, follow`)
- **70-74** → tier-2 forcé + flag « borderline » + entrée review-queue priorité haute (Will peut promouvoir à la main)
- **75-100** → review-queue normale (Will valide → tier-1 manuel ou auto si Q7 = OUI sur RSS)

### 10.3 Validation `pnpm posts:validate` étendue

Étend le script existant pour inclure :
- Plagiarism check par item
- Doctrine check (anti-SIREN, naming Axion-IA, anti-spammy words)
- JSON-LD validation (Schema.org structured data testing tool API si disponible, sinon `schema-dts` types)
- ~~i18n parity (FR + EN obligatoires)~~ → **désactivé v1.2 FR-only**. À la place : vérifier que `locale === "fr"` strict pour tous contenus générés ; vérifier `lang="fr"` HTML ; vérifier hreflang `fr-FR` + `x-default` (= FR) uniquement.
- relatedCities slugs exists
- Tier auto-calculé cohérent avec qualityScore

---

## 11. Knowledge Base — consommation ET alimentation (v2.5 — aligné KB V4 réelle)

> ⚠️⚠️ **PATCH v2.5 MAJEUR (Sprint S0bis 2026-05-14)** : tout ce chapitre référençait `KbDocument` + `KbChunk` qui sont **des artefacts obsolètes pré-V4**. La KB réelle, **codée et mergée sur main** (commit `bd0f831`), utilise `KnowledgeEntry` + 6 modèles `Knowledge*` (cf. `axionia/prisma/schema.prisma:1823+`). Toute migration content-gen qui crée `KbDocument`/`KbChunk` = BUG. La doctrine canonique est dans `.claude/skills/axionia-content-generator/references/kb-doctrine.md` (v2.0).
>
> ⚠️ **Le content generator CONSOMME ET ALIMENTE la KB V4** (pivot V4 Knowledge Factory Industrielle, 2026-05-14). Le content-gen génère le contenu, la KB le stocke avec audit trail factory (`sourceFactoryId`, `sourcePromptId`, `sourceModelUsed`, `sourceCostCents`, `sourceGeneratedAt`). L'admin `/connaissances/`, la RGPD, les annotations, le DR massif sont du ressort du skill jumeau `axionia-connaissances` — pas du content-gen.

### 11.0 Mapping ContentType → KbType (V4)

| ContentType (content-gen) | KbType (KnowledgeEntry) |
|---|---|
| `landing_ville` | `industry_use_case` |
| `blog_article` | `article` |
| `blog_from_rss` | `news_brief` |
| `comparison` | `comparison` (V4 factory) |
| `guide_pilier` | `implementation_playbook` (V4 factory) |
| `faq_standalone` | `faq` |
| `qa_derived` | `faq` |

### 11.1 Contrat d'interface (read-only)

> ⚠️ **Helper `kb-client.ts` v2.5** : utilise `KnowledgeEntry` + `KnowledgeTranslation.embedding` (pgvector) au lieu de `KbDocument` + `KbChunk` (obsolètes). Voir kb-doctrine.md skill pour exemple complet.

### 11.1 Contrat d'interface (read-only)

Le content generator interroge la KB via **un seul module unifié** :

```ts
// src/server/content-gen/kb-client.ts (READ-ONLY wrapper)

export type KbRetrieveOptions = {
  query: string;
  language: "fr" | "en";
  k?: number;                     // default 8
  filters?: {
    tags?: string[];
    sectors?: string[];
    companySizes?: ("tpe" | "pme" | "eti" | "grande-entreprise")[];
    serviceTypes?: ("audit" | "interventions" | "implementation")[];
    regionSlug?: string;
    villeSlug?: string;
    isAxionIaCanonical?: boolean; // default true (priorise canonique)
  };
  minSimilarity?: number;          // default 0.72
  boostCanonical?: number;         // default +0.10
};

export type KbChunkResult = {
  id: string;
  documentId: string;
  documentSlug: string;
  contentMd: string;
  similarity: number;
  source: KbSource;
  sourceUrl?: string;
  isAxionIaCanonical: boolean;
  language: "fr" | "en";
  tags: string[];
};

export async function retrieve(opts: KbRetrieveOptions): Promise<KbChunkResult[]>;
export async function rerank(query: string, chunks: KbChunkResult[]): Promise<KbChunkResult[]>;
export async function getKbHealth(): Promise<{ chunksTotal: number; canonicalRatio: number; lastIngestAt: Date; healthy: boolean }>;
```

**Aucune autre méthode** (pas de `ingest`, pas de `upsert`, pas de `delete`) — la KB est immutable depuis le content generator. Pour ingérer / modifier la KB, Will utilise exclusivement l'outil dédié de `PROMPT-KNOWLEDGE-BASE-2026.md`.

### 11.2 Seuil minimum avant gen

**Hard gate** dans `orchestrator.ts` au lancement de tout job :

```ts
const kbHealth = await kbClient.getKbHealth();
if (!kbHealth.healthy || kbHealth.chunksTotal < 300 || kbHealth.canonicalRatio < 0.6) {
  throw new ContentGenError("KB_NOT_READY", `KB insuffisante: ${kbHealth.chunksTotal} chunks / canonical=${(kbHealth.canonicalRatio*100).toFixed(0)}%`);
}
```

- ≥ 300 chunks AxionIA-canoniques
- ≥ 60 % ratio canonical / total
- `lastIngestAt` < 90 jours
- pgvector index présent

Sinon → `ContentGenJob.status = failed` avec message clair dans admin.

### 11.3 Utilisation par les generators

Chaque generator (cf. § 6) **DOIT** appeler `kb.retrieve()` **avant** tout appel LLM, et **DOIT** injecter le top-K en section « Contexte AxionIA » du prompt.

```ts
// Exemple landing-ville.ts
const kbChunks = await kbClient.retrieve({
  query: `audit IA cabinet ${ville.name} secteur ${dominantSector} taille ${size}`,
  language: "fr",
  k: 12,
  filters: { regionSlug: ville.region, serviceTypes: ["audit"], isAxionIaCanonical: true },
  boostCanonical: 0.15,
});
const reranked = await kbClient.rerank(query, kbChunks);
const top8 = reranked.slice(0, 8);
// → injecté dans system prompt sous "## Contexte AxionIA — sources internes prioritaires"
// → chaque chunk traçable via documentSlug pour audit
```

**Traçabilité** : chaque `ContentGenJob` stocke `kbChunkIds: string[]` (audit trail). Si un contenu est sanctionné par Google plus tard, on retrouve la KB source.

### 11.4 Tables Prisma partagées

Les tables `KbDocument` + `KbChunk` (cf. § 5.1) sont **créées et alimentées par l'outil KB**, mais **présentes dans le même schema Prisma** pour que le content generator puisse y accéder en lecture via Prisma client (pas de microservice séparé V1).

Migration `add_content_gen_core` crée ces tables avec des **commentaires explicites** :

```sql
-- KbDocument et KbChunk : créées ici pour faciliter la migration,
-- mais alimentées EXCLUSIVEMENT par l'outil KB (cf. PROMPT-KNOWLEDGE-BASE-2026.md).
-- Le content generator ne fait que SELECT dessus.
```

Le content generator NE jouera JAMAIS de `INSERT`/`UPDATE`/`DELETE` sur ces 2 tables. Tests Vitest vérifient l'absence de write paths.

### 11.5 Si la KB n'est pas prête

V0 transitoire (avant que la KB soit construite) : un mode dégradé `KB_BYPASS=true` est disponible (env var) qui :
- Désactive le hard gate § 11.2
- Force les generators à n'utiliser que les **SSOT TS** directs (`pricing.ts`, `interventions.ts`, `regions.ts`, `villes/*`) en lieu et place de retrieve
- Émet un warning dans les logs et l'admin (banner rouge `KB MODE DEGRADE`)

Ce mode n'est PAS recommandé en prod — il sert uniquement à tester l'orchestration en attendant l'outil KB.

---

## 12. Console admin — 100 % pilotage Will (12 sections V1)

> **Doctrine pilotabilité (v1.5)** : Will ne touche JAMAIS à `.env`, à `pricing.ts`, à un fichier TS de config, ni à la DB directement. **Tout se règle depuis l'admin**. Si une décision technique exige un déploiement code (ex changement de stack), c'est une ADR — pas un réglage admin.

### 12.1 Arborescence (V1 — 12 sections)

```
/[adminPrefix]/content-gen/
├── page.tsx                          ← Dashboard global
├── settings/                          ← 🆕 v1.5 : tout centralisé éditable
│   ├── page.tsx                       ← index settings (4 sous-pages)
│   ├── providers/page.tsx             ← Toggles + cost caps + modèles par provider
│   ├── batches/page.tsx               ← 🆕 batch size jour, concurrency workers, retry policies
│   ├── policies/page.tsx              ← 🆕 skip ville-si-copy-existe, auto-publish RSS ≥ score, plagiat thresholds (Jaccard interne 0.30 / RSS 0.10), retention tier-3 (90j default)
│   ├── banned-phrases/page.tsx        ← 🆕 phrases interdites CRUD (« unique », « le meilleur », etc.)
│   ├── llms-txt/page.tsx              ← 🆕 édition manuelle du llms.txt servi à la racine
│   ├── coverage-distribution/page.tsx ← 🆕 v1.7 — sliders 5 types contenu (somme = 100 %)
│   │                                     + gestion profils nommés (CRUD)
│   ├── audience-mix/page.tsx          ← 🆕 v1.7 — matrice taille INSEE × type organisation
│   │                                     (4 × 12 = 48 cellules pondérées, somme = 100 %)
│   │                                     + profils nommés (industriel, tertiaire, public…)
│   ├── search-intent-distribution/page.tsx ← 🆕 v1.7 — sliders 5 intentions (info / commercial
│   │                                            / local / transac / nav, somme = 100 %)
│   ├── quality-loop/page.tsx          ← 🆕 v1.7 — toggle boucle amélioration + seuils +
│   │                                     max passages auto + cost cap mensuel + stats
│   ├── qa-policies/page.tsx           ← 🆕 v1.7 — toggle auto-create Q/R pages,
│   │                                     seuil mots minimum, CTR seuil promotion tier-1
│   └── kill-switch/page.tsx           ← Stop all gens en 1 clic (`CONTENT_GEN_KILL_SWITCH`)
│
├── author/                            ← 🆕 v1.5 : profil Manon éditable depuis admin
│   └── manon/page.tsx                 ← Édite nom affiché, photo (upload), bio (Tiptap),
│                                         LinkedIn, Twitter handle (ou désactiver), alumniOf,
│                                         award. Stocké table `AuthorProfile`. JSON-LD rebuild
│                                         à chaque save + revalidatePath /fr/equipe/manon.
│
├── templates/
│   ├── page.tsx                       ← Liste 9 ContentType × N variantes
│   ├── new/page.tsx                   ← Create (avec selector contentType + variant)
│   └── [id]/page.tsx                  ← Edit (system prompt Tiptap + user template + Zod
│                                         schema + variant + expansionMode + defaultModel
│                                         override + Perplexity per-template toggle)
│
├── landing-variants/                  ← 🆕 v1.5 : pilotage variantes landing ville
│   ├── page.tsx                       ← Liste 6 variantes V1 (default + 5 sectoriels)
│   │                                     + admin peut activer/désactiver + assigner manuellement
│   │                                     un variant override à un slug ville
│   └── [variant]/page.tsx             ← Détail variant + KB filters + bio rapide
│
├── jobs/
│   ├── page.tsx                       ← Liste jobs (filtres : status/type/template/date/cost/score)
│   └── [id]/page.tsx                  ← Detail job + 🆕 logs SSE temps réel (`/api/content-gen/jobs/[id]/stream`)
│                                         + output preview iframe + rejouer / dupliquer / forcer model
│
├── queue/
│   └── page.tsx                       ← BullMQ inspection (active / waiting / failed / delayed)
│                                         + drain queue + retry-all-failed + clear-delayed
│
├── review-queue/                      ← Filtres complets v1.5
│   ├── page.tsx                       ← Liste avec filtres : tier / type / score range / variant /
│   │                                     auteur / date / KB hit rate
│   └── [id]/page.tsx                  ← Preview iframe (réelle URL `/fr/...?preview=true&token=`)
│                                         + diff vs version précédente + boutons :
│                                         [Approve & Promote tier-1] [Approve as tier-2]
│                                         [Request edits → comment] [Reject] [Re-generate]
│                                         [Promote with confirm dialog + diff preview]
│
├── geo/                               ← Cockpit géographique § 15 (durci v1.5)
│   ├── page.tsx                       ← Carte France + drilldown + stats
│   ├── history/page.tsx               ← Journal actions batch
│   ├── batches/
│   │   ├── page.tsx                   ← Liste batches actifs/passés
│   │   ├── new/page.tsx               ← 🆕 batch builder complet : modes ordre (4) +
│   │   │                                 drag&drop villes (`react-beautiful-dnd` ou
│   │   │                                 `dnd-kit`) + skip filters + variant override
│   │   │                                 par batch + batch size jour configurable +
│   │   │                                 workers concurrency par batch
│   │   └── [id]/page.tsx              ← Suivi batch + 🆕 boutons [Pause] [Resume]
│   │                                     [Cancel running jobs only] [Cancel all]
│   │                                     + burndown chart + retry failed bulk
│   └── [villeSlug]/                   ← 🆕 page par ville pour génération ciblée
│       └── generate/page.tsx          ← Form : variant override + provider override +
│                                         tags + secteurs prio + dry-run + go
│
├── kb-readonly/                       ← VIEW-ONLY STRICT (§ 11)
│   ├── page.tsx                       ← Liste KbDocuments (lecture seule)
│   └── [id]/page.tsx                  ← Detail + chunks (lecture seule)
│   ⚠️ Aucun new/, upload, edit, delete. Outil KB séparé pour modifier.
│
├── rss/
│   ├── page.tsx                       ← Liste sources + last fetch + count items unprocessed
│   ├── new/page.tsx                   ← Add source (URL + nom + langue + tags default +
│   │                                     poll interval + auto-publish toggle)
│   └── [id]/page.tsx                  ← Détail + items récents + bouton « Fetch now »
│
├── costs/
│   └── page.tsx                       ← Graphes 30j par provider + projection fin de mois +
│                                         alertes cap 80/100 + détail par job
│
├── publications/                      ← Historique + rollback
│   └── page.tsx                       ← Snapshots + bouton rollback (avec confirm + diff)
│
├── publications-status/               ← 🆕 v1.7 — Dashboard kanban 5 colonnes
│   └── page.tsx                       ← 5 colonnes : Brouillon (status=draft) /
│                                         En revue (status=needs_review) / Approuvé
│                                         (status=approved, pending publish) / Publié
│                                         (status=published) / Refusé (status=rejected).
│                                         Filtres type/tier/ville/dépt/campagne/audience/
│                                         score/date/intent.
│                                         **Seuils bulk actions (v1.8 explicités)** :
│                                         - Bulk approve : score ≥ 75 (modifiable admin)
│                                         - Bulk reject : score < 50 (modifiable admin)
│                                         - Bulk retry failed : tous failed dernières 24 h
│                                         - Bulk archive drafts : drafts > 30 j
│                                         Drag & drop entre colonnes (change status).
│                                         Export CSV avec filtres actifs.
│                                         KPIs : rate publish/jour, time-to-publish
│                                         moyen, score moyen, % auto vs manuel.
│
├── coverage/                          ← 🆕 v1.7 — Campagnes de couverture
│   ├── page.tsx                       ← Liste campagnes (filtre status + cible)
│   ├── new/page.tsx                   ← Création :
│   │                                     - Sélecteur périmètre (ville/dépt/région/multi)
│   │                                     - Slider volume cible (10-1000)
│   │                                     - Choix profil distribution (preset OU sliders 5 types)
│   │                                     - Choix profil audiences (preset OU matrice taille×orga)
│   │                                     - Choix profil intentions (auto OU sliders 5 intents)
│   │                                     - Preview coût estimé + durée + warnings
│   │                                     - [Sauver brouillon] [Lancer] [Dry-run 5 jobs]
│   └── [id]/page.tsx                  ← Suivi temps réel :
│                                         - Burndown chart contenus restants
│                                         - Stats par type/audience/intent (planifié vs réel)
│                                         - Boutons [Pause] [Reprendre] [Annuler] [+50 slots]
│                                         - Live SSE jobs en cours
│
├── similarity-monitor/                ← 🆕 v1.7 — Anti-doublon couche C
│   └── page.tsx                       ← Tableau top 100 paires les plus similaires :
│                                         - Colonnes : Article A (titre + tier + ville) |
│                                           Article B (titre + tier + ville) | cosine | Jaccard |
│                                           date détection
│                                         - Tri par cosine décroissant
│                                         - Filtres : tier / type / ville / score range / date
│                                         **Bulk actions (v1.8 explicitées)** :
│                                         - [Archiver le moins performant] : compare tier
│                                           + qualityScore + viewCount → archive automatique
│                                           celui qui perd. Le restant continue indexé.
│                                         - [Fusionner avec redirect 301] : merge content
│                                           du meilleur + redirect 301 du moins bon vers
│                                           le restant. Met à jour `Article.replacedById`.
│                                         - [Ignorer la paire] : flag `SimilarityPair.ignored=true`
│                                           — ne reapparaitra plus dans les futurs scans.
│                                         Stats globales : total paires détectées, taux
│                                         résolution (archived+merged)/total, score moyen.
│
└── orchestrator/                      ← 🆕 v1.7 — Vue globale orchestrateur
    └── page.tsx                       ← Vue d'ensemble : campagnes actives, daily plan,
                                          quota par pipeline (1 landings / 2 RSS / 3 campaign),
                                          répartition coût mensuel, alertes orchestrateur.
```

### 12.1bis Table Prisma `AuthorProfile` (v1.5 — pilotage profil Manon)

```prisma
model AuthorProfile {
  id              String   @id @default(cuid())
  slug            String   @unique  // "manon"
  displayName     String              // "Manon" ou "Manon X."
  jobTitle        String              // "Rédactrice & responsable éditoriale"
  bioMd           String   @db.Text   // Markdown, édité via Tiptap admin
  photoUrl80      String              // /auteurs/manon-80.avif
  photoUrl256     String              // /auteurs/manon-256.avif
  photoUrl1024    String              // /auteurs/manon-1024.avif
  linkedinUrl     String?
  twitterHandle   String?             // null systématique pour Manon (doctrine v2.1 — aucun réseau social)
  alumniOf        String?
  awards          String[] @default([])
  knowsAbout      String[] @default([])
  isActive        Boolean  @default(true)
  updatedAt       DateTime @updatedAt
}
```

Seed Sprint 1 : 1 row `slug="manon"` avec valeurs fournies par Will (Q13). Admin peut éditer après. `buildPersonManonJsonLd()` lit cette table au lieu de hardcoder.

### 12.1ter Onboarding wizard 1ʳᵉ visite (v1.9)

**Route** : `/[adminPrefix]/content-gen/onboarding` (auto-redirect depuis dashboard si `Setting.content_gen_onboarded === false`).

Wizard 5 étapes (Radix Dialog + Stepper) :

1. **Bienvenue** — 1 clic
2. **Providers IA** — 4 clés API + test live OK + plafond mensuel global ($430 défaut)
3. **Profil auteur Manon** — nom + photo upload AVIF/JPG ≥ 512×512 (conversion auto 3 variantes) + bio Tiptap + LinkedIn + Twitter
4. **Profil de campagne par défaut** — sélection 4 profils audience (Mixte équilibré recommandé V1)
5. **Test : 1ʳᵉ landing ville** — ville test (défaut Lyon) → génération live avec SSE log ~90 s → preview + promote ou keep tier-2

À la fin : `Setting.content_gen_onboarded = true`, redirect dashboard. Bouton « Aide / Recommencer onboarding » disponible dans menu admin.

### 12.1quater Cockpit géographique détaillé (v1.9 wireframe)

**Lib** : `react-simple-maps` + GeoJSON IGN simplifié (communes ≥ 5 000 hab, ~3 MB lazy-loaded + service worker cache).

#### Layout 4 zones

```
┌─ FILTRES (haut) ─────────────────────────────────────────────────────┐
│ [Mode coloriage ▼] [Région ▼] [Dpt ▼] [Tier 1+2 ▼] [Campagne ▼] [30j▼]│
├─────────────────────────────┬────────────────────────────────────────┤
│                              │ STATS GLOBALES (30 j)                 │
│   🗺️ Carte France            │ • Villes tier-1 : 87 / 2 157 (4 %)    │
│   interactive avec heatmap   │ • Villes tier-2 : 156 (en review)     │
│                              │ • En cours : 23                       │
│   Modes coloriage :          │ • Failed récents : 4                  │
│   ● Status (défaut)          │ • Pas encore lancées : 1 887          │
│   ○ Quality score            │                                       │
│   ○ Coût                     │ Coût mois : $487/$430 plafond (113 %) │
│   ○ Recency                  │ Vélocité 7j : 8.4 v/j                 │
│   ○ Population               │ ETA fin (20 v/j) : ~ 94 j             │
│   ○ Secteur dominant         │ ETA fin (50 v/j) : ~ 38 j             │
│                              │                                       │
│   Zoom : [Région] [Dpt] [V.] │ [Détail coûts par provider →]         │
│                              │ [Top 3 régions performantes →]        │
│   Click ville → drawer       ├────────────────────────────────────────┤
│                              │ PROGRESS BARS RÉGIONS (13)             │
│                              │ Île-de-France   ████░░░░░░ 42 % 🟢     │
│                              │ Auvergne-RA     ░░░░░░░░░░  5 %        │
│                              │ ... (11 autres)                        │
└─────────────────────────────┴────────────────────────────────────────┘
┌─ TABLE DRILLABLE Région → Dpt → Ville (TanStack + filtres) ──────────┐
│ Bulk : sélection 5 villes → [Regen] [Promouvoir tier-1] [Archive]    │
└──────────────────────────────────────────────────────────────────────┘
┌─ ACTIONS RAPIDES ─────────────────────────────────────────────────────┐
│ [Nouvelle campagne →]  [Batch dpt courant]  [Export CSV total]       │
└──────────────────────────────────────────────────────────────────────┘
```

#### Side-panel click ville (Radix Drawer)

```
Lyon · dpt 69 · 522 250 hab.
Statut : 🟢 Tier-1 indexable · Score 82/100 · Variant default
Coût gen : $0.42 · Date : 2026-05-13 14:23
─────────────
Articles publiés (12) :
  3 landing villes (variants) · 5 blog · 2 comparatifs · 1 guide · 1 FAQ
Pages Q/R indexables auto (67)
─────────────
Actions : [Aperçu] [Regen variant autre] [Mini-campagne 20 contenus] [Archive]
```

#### Realtime SSE

SSE `/api/content-gen/geo-events` pousse :
- Ville orange → vert/jaune/rouge à chaque event (recoloriage ≤ 2 s)
- Toast haut « Marseille publié tier-2, score 73 »

### 12.1quinquies Job detail timeline (v1.9)

**Route** : `/[adminPrefix]/content-gen/jobs/[id]`

Layout 3 sections :
- **Timeline status** (queued → running → generating_text → generating_image → quality_improving → needs_review → published) avec timestamps précis
- **Métriques** : tokens in/out, coût, cache hit rate Anthropic, KB chunks utilisés (% canonical)
- **Logs SSE live** : flux temps réel des steps internes (provider calls, validation, etc.)
- **Actions** : [Aperçu en l'état] [Annuler] [Rejouer du début]

### 12.3bis Alertes Telegram explicites avec actions (v1.9 — étend § 13.3)

Format type **avec lien admin direct** pour chaque événement :

| Événement | Message Telegram |
|---|---|
| Cost cap 80 % | `[⚠️ COÛT 80 %] OpenAI mois : $160/$200. 12 jobs queued. Continue auto.` |
| Cost cap 100 % | `[🔴 COÛT 100 %] OpenAI mois : $200/$200. Kill switch auto activé. 18 jobs en attente. → /settings/providers` |
| Provider down 5 min | `[⚠️ PROVIDER DOWN] OpenAI down (5 erreurs/30 s — circuit ouvert). Fallback Claude actif. 8 jobs basculés. ETA 60 s.` |
| Provider down 30 min | `[🔴 PROVIDER LONG DOWN] OpenAI down 30 min. Claude saturé (rate-limit 50/min). Pause batch recommandée. → /coverage/[id]` |
| KB not ready | `[🔴 KB NOT READY] 215/300 chunks min. Canonical 51 %. Gen bloquée. → outil axionia-connaissances.` |
| 5 jobs failed consécutifs | `[🔴 BATCH FAIL] Campagne Lyon : 5 jobs failed sur landing_ville. Pause auto. → /coverage/[id]` |
| Nouveau contenu review | `[ℹ️ REVIEW] 3 contenus tier-2 à valider. → /publications-status` |
| Batch terminé | `[✓ DONE] Campagne Rhône (300 contenus). Coût $124. Score moyen 76. 287 publiés, 13 failed. → /coverage/[id]` |
| LCP dégradé (legacy v1.9) | `[⚠️ PERF] LCP p75 = 2145 ms sur /fr/implantations/* (7 j). Vérifier images AVIF + preload.` |
| **Web Vitals — LCP p75 > 2000 ms** (Sprint S0bis v2.5) | `[⚠️ WEB_VITALS_DEGRADED] LCP p75 = 2145 ms (> 2000ms cible) sur landing-ville (24h). → /content-gen/web-vitals` |
| **Web Vitals — INP p75 > 200 ms** (Sprint S0bis v2.5) | `[⚠️ WEB_VITALS_DEGRADED] INP p75 = 245 ms (> 200ms cible) sur blog (24h). → /content-gen/web-vitals` |
| **Web Vitals — CLS p75 > 0.1** (Sprint S0bis v2.5) | `[🔴 WEB_VITALS_DEGRADED] CLS p75 = 0.12 (> 0.1 cible) sur guide-pilier (24h). → /content-gen/web-vitals` |

**Total : 16 alertes** (13 v1.9 + 3 Web Vitals Sprint S0bis 2026-05-14). Chaque alerte contient un **lien admin direct** pour action immédiate sans recherche.

### 12.2 Dashboard global (`/content-gen`)

**Au-dessus** : KPI cards (last 7 days)
- Jobs run : 142 | Published : 87 | Failed : 4 | Pending review : 12
- Cost spent : $43.20 | Avg quality : 78/100 | Plagiarism blocks : 6
- KB health : 312 chunks · canonical ratio 67 % · last ingest 3j ago

**Au milieu** : 3 widgets
- Active queue (BullMQ) : 5 running, 18 waiting, 2 failed (lien queue)
- Recent jobs (10 dernières lignes table)
- AEO test wins (% prompts citant Axion-IA, 7j rolling — V2)

**En bas** : Quick actions
- [Générer landing ville…] (modal : ville select + variant override + langue + advanced)
- [Générer article…] (4 boutons sub : titre / mots-clés / RSS / pilier)
- [Générer comparatif…] [Générer guide pilier…] [Générer FAQ standalone…]
- [Ingest RSS feed maintenant]
- [Lancer batch villes…] (raccourci vers `/geo/batches/new`)
- [Kill all queued] (confirm) — protégé par double-confirm

### 12.3 Patterns UI

- Composants Radix UI déjà en place
- Forms : `react-hook-form` + Zod validation (idem booking V1)
- Tables : `@tanstack/react-table` (tri + filtres + bulk actions)
- Toasts : sonner ou existing `useToast`
- Modals : Radix Dialog + Drawer pour previews
- Tiptap editor : pour system prompts + bio Manon + comments review
- Drag & drop : `@dnd-kit/core` (léger, ~10 KB gz, accessible WCAG 2.2)
- Server Actions : tout effet de bord via `'use server'` (pas d'appel client→API direct)
- SSE realtime : route `app/api/content-gen/*/stream/route.ts` avec `ReadableStream` Edge runtime

### 12.4 Architecture logs temps réel (SSE)

- Route `app/api/content-gen/jobs/[id]/stream/route.ts` :
  ```ts
  export const runtime = "nodejs"; // pas edge — accès Prisma + Redis pub/sub
  export async function GET(req, { params }) {
    const stream = new ReadableStream({
      async start(controller) {
        const subscription = redisSubscriber.subscribe(`job:${params.id}:events`);
        subscription.on("message", (channel, message) => {
          controller.enqueue(`data: ${message}\n\n`);
        });
        req.signal.addEventListener("abort", () => subscription.unsubscribe());
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }
  ```
- Worker publie via `redisPublisher.publish(\`job:${id}:events\`, JSON.stringify({type, payload}))` à chaque step (KB retrieve started, LLM streaming chunk, image gen done, validation, write file).
- Composant React `<JobLogStream jobId>` utilise `EventSource` natif.
- Cockpit géo idem : `/api/content-gen/geo-events` push minimal { villeSlug, status, score } à chaque changement.

### 12.5 Hard rule pilotage (anti-config-en-code)

Tout réglage qui peut changer dans le temps DOIT être en DB (`Setting`, `ProviderConfig`, `ContentGenConfig`, `AuthorProfile`, `ContentTemplate`) et éditable depuis admin :

| Réglage | Localisation | Éditable admin |
|---|---|---|
| Toggle provider ON/OFF | `ProviderConfig.enabled` | `/settings/providers` |
| Cost cap mensuel par provider | `ProviderConfig.monthlyCapUsd` | `/settings/providers` |
| Modèle text default | `ProviderConfig[role=text].model` | `/settings/providers` |
| Modèle text override par-job | input form `/geo/[villeSlug]/generate` | inline |
| Batch size jour | `Setting.key="content_gen_batch_daily_size"` | `/settings/batches` |
| Workers concurrency | `Setting.key="content_gen_workers_concurrency"` | `/settings/batches` |
| Skip villes copy existante | `Setting.key="content_gen_skip_existing"` | `/settings/policies` |
| Auto-publish RSS si score ≥ X | `Setting.key="content_gen_rss_autopub_threshold"` | `/settings/policies` |
| Plagiat seuils Jaccard | `Setting.key="content_gen_plagiarism_thresholds"` | `/settings/policies` |
| Retention tier-3 jours | `Setting.key="content_gen_tier3_retention_days"` | `/settings/policies` |
| Phrases interdites | table `BannedPhrase` (CRUD) | `/settings/banned-phrases` |
| llms.txt content | `Setting.key="content_gen_llms_txt"` | `/settings/llms-txt` |
| Ordre custom villes | `Setting.key="content_gen_villes_order"` | `/geo/batches/new` drag&drop |
| Variantes landing actives | `Setting.key="content_gen_landing_variants_active"` | `/landing-variants` |
| Variant override par ville | `Setting.key="content_gen_ville_variant_overrides"` JSON map | `/geo/[villeSlug]/generate` |
| Profil Manon (nom, photo, bio…) | table `AuthorProfile[slug=manon]` | `/author/manon` |
| Sources RSS | table `RssSource` (CRUD) | `/rss` |
| System prompt par template | `ContentTemplate.systemPrompt` | `/templates/[id]` |
| Perplexity toggle per-template | `ContentTemplate.extraConfig.usePerplexity` | `/templates/[id]` |
| Kill switch global | `Setting.key="CONTENT_GEN_KILL_SWITCH"` ou env | `/settings/kill-switch` |
| **Distribution couverture (5 types %)** *(v1.7)* | table `CoverageDistributionProfile` (CRUD) | `/settings/coverage-distribution` |
| **Mix audiences (taille × organisation %)** *(v1.7)* | table `AudienceMixProfile` (CRUD) | `/settings/audience-mix` |
| **Distribution intention recherche %** *(v1.7)* | `Setting.key="content_gen_search_intent_distribution"` | `/settings/search-intent-distribution` |
| **Création / suivi campagnes de couverture** *(v1.7)* | table `CoverageCampaign` (CRUD) | `/coverage/new`, `/coverage/[id]` |
| **Boucle d'amélioration qualité (toggle + seuils)** *(v1.7)* | `Setting.key="content_gen_quality_loop_*"` | `/settings/quality-loop` |
| **Toggle Q/R post-process auto** *(v1.7)* | `Setting.key="content_gen_qa_auto_create_pages"` | `/settings/qa-policies` |
| **Surveillance similarité (anti-doublon)** *(v1.7)* | calculs cron quotidien + table `SimilarityPair` | `/similarity-monitor` |
| **Dashboard kanban publication** *(v1.7)* | vue agrégée sur `ContentGenJob` + `Article` | `/publications-status` |

→ **30 réglages éditables admin** (18 v1.5 + 12 v1.7) — aucun hardcoded. Tout est queryable depuis admin via Server Actions. **Le code lit la DB à chaque request, pas un fichier TS** (sauf pour les SSOT structurels : pricing/regions/interventions qui ne changent qu'avec un commit code).

### 12.2 Dashboard global (`/content-gen`)

**Au-dessus** : KPI cards (last 7 days)
- Jobs run : 142 | Published : 87 | Failed : 4 | Pending review : 12
- Cost spent : $43.20 | Avg quality : 78/100 | Plagiarism blocks : 6

**Au milieu** : 3 widgets
- Active queue (BullMQ) : 5 running, 18 waiting, 2 failed (avec lien queue)
- Recent jobs (10 dernières lignes table)
- AEO test wins (% prompts citant Axion-IA, 7j rolling)

**En bas** : Quick actions
- [Générer landing ville…] (open modal : ville select + lang + advanced)
- [Générer article…] (4 boutons sub : titre / mots-clés / RSS / pilier)
- [Générer comparatif…]
- [Générer guide pilier…]
- [Ingest RSS feed maintenant]
- [Kill all queued] (avec confirm)

### 12.3 Pattern UI

- Composants Radix UI déjà en place (cf. mémoire `[[axionia_session_2026-05-09_sprints_15-23_audits]]`)
- Forms : `react-hook-form` + Zod validation
- Tables : `tanstack/react-table` (déjà en place pour bookings)
- Toasts : sonner ou existing `useToast`
- Modals : Radix Dialog
- Server Actions : tout effet de bord via `'use server'` actions (pas d'appel client→API direct)

---

## 13. Queue, scheduling & monitoring

### 13.1 Queues BullMQ

| Queue | Concurrency | Rate-limit | Worker file |
|---|---|---|---|
| `content-gen` | 3 | 10/min (alignée OpenAI) | `src/server/queue/workers/content-gen-worker.ts` |
| `content-publish` | 5 | aucun | `src/server/queue/workers/content-publish-worker.ts` |
| `kb-ingest` | 2 | aucun | `src/server/queue/workers/kb-ingest-worker.ts` |
| `rss-fetch` | 5 | aucun | `src/server/queue/workers/rss-fetch-worker.ts` |

Worker concurrency configurable via `Setting` table (admin).

### 13.2 Scheduling — liste exhaustive cron jobs

| Cron | Fréquence | Heure UTC | Module | Sprint |
|---|---|---|---|---|
| RSS fetch | par `RssSource.pollIntervalMin` | continu | `content-rss-fetch-worker` | S5 |
| Batch villes daily quota | quotidien | 06:00 | `content-geo-batch-worker` | S4 |
| Link checker (soft-404) | quotidien | 02:00 | `link-checker-worker` | V2 |
| Retention purge tier-3 (90j+) | quotidien | 03:00 | `content-retention-worker` | V1 |
| Search Console sync (CTR, position) | quotidien | 04:00 | `search-console-worker` | V2 |
| Sitemap regen | hebdo | dim 23:00 | `sitemap-worker` | V1 |
| KB health check (parité ≥ 300 chunks) | hebdo | dim 03:00 | hooks → alert si dégradé | V1 |
| AEO tests (50 prompts × 5 LLMs) | hebdo | lun 04:00 | `aeo-tester-worker` | V2 |
| Cost reset mensuel | mensuel | 1ᵉʳ 00:01 | hook BullMQ | V1 |
| Internal linking auto re-evaluate | mensuel | 1ᵉʳ 05:00 | `internal-linking-worker` | V2 |
| Tier-1 CTR auto-promotion/demotion | mensuel | 15 du mois 06:00 | `tier-lifecycle-worker` | V2 |
| **Surveillance similarité (top 100 paires)** *(v1.7)* | quotidien | 04:30 | `similarity-monitor-worker` | V1 |
| **Boucle qualité — passage automatique** *(v1.7)* | event-driven (post-gen) | — | `content-quality-improver-worker` | V1 |
| **Cycle de vie actualités RSS (tier-1 → tier-2 si CTR faible)** *(v1.7)* | quotidien | 05:00 | `news-lifecycle-worker` | V1 |
| **Promotion auto Q/R tier-1 si CTR > seuil** *(v1.7)* | hebdo | mer 03:00 | `qa-promotion-worker` | V2 (besoin Search Console) |

### 13.3 Monitoring

- **Sentry** : capture errors workers (déjà en place).
- **Plausible** : events `content_gen_started`, `content_gen_completed`, `content_gen_failed`, `content_gen_review_approved`, `content_gen_promoted_tier_1`, `content_gen_batch_started`, `content_gen_batch_completed`.
- **Telegram alerts** (déjà en place) — liste exhaustive :

| Événement | Niveau | Trigger |
|---|---|---|
| Cost cap 80 % atteint | ⚠️ warning | par provider, vérif horaire |
| Cost cap 100 % atteint | 🔴 critical | kill switch auto activé |
| 5 jobs failed consécutifs | 🔴 critical | même type de contenu |
| Provider down > 5 min | ⚠️ warning | circuit breaker ouvert |
| Provider down > 30 min | 🔴 critical | escalade |
| Queue stuck (waiting > 30 min) | ⚠️ warning | BullMQ inspection |
| KB health failed (< 300 chunks ou ratio < 60%) | 🔴 critical | hard gate § 11.2 |
| LCP p75 > 2 000 ms sur 7 j | ⚠️ warning | RUM CrUX § 9.10.4 |
| Soft-404 détecté sur tier-1 | ⚠️ warning | link-checker quotidien |
| Indexation tier-1 stagnante (CTR < 1 % après 90 j) | ℹ️ info | Search Console § 7 spec |
| Tier-3 stagnant 90 j | ℹ️ info | auto-suppression queue |
| Batch terminé | ℹ️ info | volume + coût total |
| Nouveau contenu en review | ℹ️ info | notif Will |

- **Dashboard real-time** : SSE ou polling 5s sur `/admin/content-gen` (utiliser `revalidatePath` côté server actions pour pousser updates).

---

## 14. Publication & validation workflow

### 14.1 Workflow par défaut (tier-2 → tier-1)

```
1. Job COMPLETED → ContentGenJob.status = needs_review
   → ReviewQueue.status = pending
   → Article créé en DB avec indexationTier = tier_2_noindex_follow
   → Telegram notif Will « 1 nouveau contenu en review »

2. Will ouvre /admin/content-gen/review-queue/<id>
   → Preview iframe (rendu réel /blog/<slug>?preview=true&token=...)
   → Diff vs version précédente si update
   → Boutons : [Approve & Promote tier-1] [Approve as tier-2] [Request edits] [Reject]

3. Will [Approve & Promote tier-1]
   → Article.indexationTier = tier_1_indexable
   → Article.promotedAt = now()
   → revalidatePath('/blog/<slug>')
   → revalidatePath('/sitemap-blog.xml')
   → (V2) Indexing API ping
```

### 14.2 Auto-publish tier-2

Pour les contenus RSS-derived (cf. § 6.2.3), si `qualityScore ≥ 60` ET `doctrineCheck=passed` :
- Auto-publish tier-2 (noindex,follow) sans review.
- Reste en review-queue mais publication immédiate.
- Will peut promouvoir tier-1 plus tard.

### 14.3 Rollback

- Chaque publication crée un snapshot dans `ContentPublication` (id, articleId, contentSnapshot json, publishedAt, publishedBy).
- Admin `/admin/content-gen/publications/<id>` : bouton « Rollback » → restore + revalidate.

---

## 15. Pilotage géographique & cockpit visuel d'avancement

### 15.1 Cockpit géographique — page dédiée `/admin/content-gen/geo`

**C'est l'écran phare de l'outil pour Will.** Permet de voir d'un coup d'œil l'état d'avancement des 2 157 villes ≥ 5 K hab + 96 départements + 13 régions.

#### 15.1.1 Layout 3 zones

```
┌────────────────────────────────────────────────────────────────────────────┐
│  COCKPIT GÉOGRAPHIQUE — 2 157 villes · 96 dépts · 13 régions               │
├────────────────────────────────────────────────────────────────────────────┤
│  ╔═══════════════════════════════╗  ┌──────────────────────────────────┐   │
│  ║                                ║  │ STATS GLOBALES                   │   │
│  ║   🗺️  CARTE FRANCE INTERACTIVE  ║  │ Tier-1 publiées :    47 / 2 157  │   │
│  ║   (react-simple-maps, GeoJSON  ║  │ Tier-2 en review :   18          │   │
│  ║    INSEE communes + régions)   ║  │ En cours gen :        5          │   │
│  ║                                ║  │ Échec récents :       2          │   │
│  ║   Couleurs par état :          ║  │ Pas encore lancées : 2 085       │   │
│  ║   🟢 vert   = tier-1 publiée   ║  │                                  │   │
│  ║   🟡 jaune  = tier-2 review    ║  │ Coût mois courant :  $87.40      │   │
│  ║   🟠 orange = gen en cours     ║  │ Vélocité 7j :         8.7 v/j   │   │
│  ║   🔴 rouge  = échec récent     ║  │ ETA fin (à 20 v/j) : ~ 96 jours │   │
│  ║   ⚪ gris   = pas lancée       ║  │ ETA fin (à 50 v/j) : ~ 38 jours │   │
│  ║                                ║  └──────────────────────────────────┘   │
│  ║   Zoom niveau :                ║  ┌──────────────────────────────────┐   │
│  ║   [Région] [Département] [Ville] │ AVANCEMENT PAR RÉGION (13)       │   │
│  ║                                ║  │ ────────────────────────────────  │   │
│  ║   Tooltip ville :              ║  │ Île-de-France       42% ████░░░░ │   │
│  ║   - Nom + INSEE                ║  │ Auvergne-RA          5% ░░░░░░░░ │   │
│  ║   - Population                 ║  │ PACA                 8% ░░░░░░░░ │   │
│  ║   - Statut + Tier              ║  │ Occitanie            3% ░░░░░░░░ │   │
│  ║   - Quality score              ║  │ Nouvelle-Aquitaine   2% ░░░░░░░░ │   │
│  ║   - Last gen date              ║  │ … (8 autres)                     │   │
│  ║   - Boutons : [Voir] [Re-gen]  ║  │ [Détail par département ▼]       │   │
│  ╚═══════════════════════════════╝  └──────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────────────────┤
│  TABLEAU DRILLABLE — Région → Département → Ville                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Région ▾   │ Dépt │ Villes │ Tier-1 │ Tier-2 │ Failed │ % couvert │   │
│  │ ───────────┼──────┼────────┼────────┼────────┼────────┼───────────│   │
│  │ ▾ Î-de-F   │  75  │   1    │   1    │   0    │   0    │  100% 🟢  │   │
│  │            │  77  │   25   │   8    │   2    │   0    │   40% 🟡  │   │
│  │            │  78  │   30   │   12   │   1    │   1    │   43% 🟡  │   │
│  │            │ ...                                                     │   │
│  │   [⬇ Drilldown villes 78]                                            │   │
│  │     Versailles      🟢 tier-1  score 82  $0.42  2026-05-13 14:23     │   │
│  │     Saint-Germain   🟡 tier-2  score 71  $0.39  2026-05-13 14:18     │   │
│  │     Mantes-la-Jolie 🔴 failed  —     $0.05  2026-05-13 14:12 [Retry] │   │
│  │     …                                                                │   │
│  └──────────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│  ACTIONS BATCH                                                              │
│  Mode :  [ Par région ▼ ] [ Top population ] [ Top PIB ] [ Drag&drop ]     │
│  Cible : [✓ tier-1 only]  [✓ skip si copy existe]  [ ] retry failed        │
│  Secteurs prio : [✓ industrie] [✓ services] [ ] tourisme [ ] retail        │
│  Région : [ Auvergne-Rhône-Alpes ▼ ]  (280 villes restantes)               │
│  Batch :  [ 20 villes/jour ▼ ]  Workers // : [ 3 ▼ ]                       │
│  ETA :    14 jours · Coût estimé : $117 · Risque CF/INSEE : faible        │
│  [Schedule daily batch] [Run now (one-shot)] [Dry run] [Cancel queue]      │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 15.1.2 Carte interactive

- **Lib** : `react-simple-maps` (~50 KB gz) + GeoJSON IGN-simplifié communes ≥ 5 K hab (~3 MB → lazy-load + service worker cache).
- **Modes de coloriage** :
  - `status` (par défaut) : 🟢 tier-1 / 🟡 tier-2 / 🟠 running / 🔴 failed / ⚪ pending
  - `quality` : gradient score 0→100 (rouge → vert)
  - `cost` : gradient coût cumulé (vert → rouge si > $X)
  - `recency` : dernière génération (récente vert → ancienne gris)
  - `population` : taille de la commune (filtre + heat)
  - `sectors` : secteur dominant overlay (couleur par NAF)
- **Zoom** : régions → départements → communes (cluster en pin si zoom faible).
- **Click ville** : ouvre side-panel détail + bouton « Générer / Re-générer / Voir le contenu publié ».
- **Realtime** : WebSocket ou SSE sur `/api/content-gen/geo-events` → re-coloriage live quand un job change de statut (≤ 2 s).

#### 15.1.3 Stats globales (right panel)

KPIs calculés via `GET /api/content-gen/geo-stats` (SWR refresh 30 s) :
- Tier-1 publiées vs total cible (avec % + barre progression)
- Tier-2 en review (avec lien vers `/admin/content-gen/review-queue`)
- Running / Failed / Pending
- Vélocité 7j glissants (villes/jour) + ETA à 20 et 50 v/j
- Coût mois courant + projection fin de mois
- Top 3 régions les plus avancées + top 3 retardataires

#### 15.1.4 Avancement par région (progress bars)

- 13 régions × 1 progress bar `% couvertures = tier1Count / totalVilles`
- Click bar → drilldown départemental (96 dépts FR métro)
- Click département → drilldown villes (table § 15.1.5)

#### 15.1.5 Table drillable (Région → Dépt → Ville)

`@tanstack/react-table` (déjà en place pour bookings) :
- Tri par n'importe quelle colonne
- Filtres : statut, tier, score range, cost range, dépt
- Pagination 50/page
- Export CSV (toute la France) — bouton dans toolbar
- Bulk actions : sélection ligne → [Re-generate] [Promote tier-1] [Delete]

### 15.2 Stratégies d'ordre (le batch builder)

D'après mémoire `[[axionia_pseo_industrialisation_decision]]` (Will 2026-05-08) : toutes villes > 5 K hab, région par région, Auvergne-Rhône-Alpes en premier après validation Paris pilote.

L'outil propose 4 modes :

| Mode | Ordre | Cas d'usage |
|---|---|---|
| **Par région (admin défini)** | ordre `Region.publicationPhase` puis pop décroissante | Stratégie défaut Will |
| **Top population** | pop décroissante toutes régions confondues | Si on veut couvrir vite les grandes villes |
| **Top PIB** | `Region.pibBillionsEur` décroissant | Si on veut maximiser revenu potentiel |
| **Drag & drop custom** | ordre persisté en DB via clé dédiée `Setting.key = "content_gen_villes_order"`, `value: { villeSlugs: string[] }` (JSON). Namespace `content_gen_*` réservé au content-generator dans la table `Setting` existante. | Stratégie sur-mesure Will |

Filtres communs :
- `[✓] skip si copy existe`
- `[ ] retry failed only`
- `[✓] tier-1 only target`
- secteurs dominants prioritaires (intersection avec `Region.economicMakeup`)
- `companySize prioritaire` (TPE / PME / ETI / grande)

Le bouton « **Dry run** » simule 1 ville (gén courte 500 mots + 0 image) → estime coût × N réel + durée.

### 15.3 Suivi temps réel par batch

Quand Will lance « Schedule daily batch (20 v/j) » :

- Crée `ContentGenBatch` (nouvelle table) avec `targetVilles: string[]`, `dailyQuota: 20`, `startedAt`, `etaEndDate`.
- BullMQ repeat job chaque jour 06:00 UTC → enqueue 20 jobs `landing_ville`.
- Section dédiée `/admin/content-gen/batches/[id]` :
  - Burndown chart (villes restantes par jour)
  - Échec → bouton bulk retry (1 clic)
  - Coût réel cumulé vs estimé
  - Bouton « Pause batch » / « Resume » / « Cancel batch »

### 15.4 Départements & régions

- **Régions** (13) : pas de génération massive. Pages déjà manuelles. La table § 15.1 montre quand même leur statut comme parent.
- **Départements** (96 FR métro) : V2 — page `/[locale]/implantations/par-departement/[code]` à créer + génération copy départemental possible. Pour V1 = simple agrégation pour le drilldown.

### 15.5 Mémoire historique des actions

Page `/admin/content-gen/geo/history` : journal de toutes les actions batch (qui, quand, quoi, résultat). Trace + replay possible.

---

## 16. Méthodologie — 8 agents parallèles

> Tu es l'agent principal. Tu orchestres **8 agents parallèles** pour livrer V1 en 4-6 sprints.

### Agents

| ID | Rôle | Périmètre | Livrable |
|---|---|---|---|
| **AGT-A** | DB & Migrations | `prisma/schema.prisma` extensions + migrations + seeds | 1 migration + seeds idempotents |
| **AGT-B** | Providers IA | `src/server/content-gen/providers/*` + router | 5 modules + tests unit |
| **AGT-C** | Generators | `src/server/content-gen/generators/*` (1 par type, 9 au total) | 9 services + tests |
| **AGT-D** | KB & RAG | `src/server/content-gen/kb/*` + seeds + pgvector setup | 3 modules + seed 160 chunks |
| **AGT-E** | Quality | `src/server/content-gen/quality/*` + extension `posts:validate` | 5 modules + tests |
| **AGT-F** | SEO/AEO/GEO | extension `src/lib/seo.ts` + JSON-LD per type | 1 module étendu + tests JSON-LD |
| **AGT-G** | Admin UI | 8 sections admin + Server Actions | ~30 pages + composants |
| **AGT-H** | Queue + Publish | BullMQ workers + publish/revalidate + review-queue | 4 workers + 1 module publish |

### Coordination

- Agents lancés en parallèle MAX 4 à la fois (limite contexte).
- Chaque agent retourne un rapport `< 1 500 mots` + diff résumé.
- Agent principal merge les diffs, lance `pnpm verify:all` (typecheck + lint + tests), résoud conflits, commit.

### STOP & ASK obligatoires en cours (cf. § 20)

L'agent principal interrompt et pose la question à Will **avant** de continuer si :
1. Schema Prisma touche une table existante (Article extension OK, mais autre table = STOP).
2. Nouveau package npm > 1 MB (dist) → STOP.
3. Nouveau provider IA non listé § 7 → STOP.
4. Nouvelle route admin hors `/content-gen/*` → STOP.
5. Modification SSOT (`pricing.ts`, `regions.ts`, `interventions.ts`) → STOP.
6. Toute écriture dans `src/content/villes/copy/*.ts` qui écrase un fichier existant → STOP.
7. Toute suppression de fichier _AUDIT/ ou docs → STOP.

---

## 17. Sprint breakdown

> **Méthode** : 1 sprint = 5-7 jours dev solo (Will). Pas de WIP entre sprints.

### Sprint 1 — Foundations DB + Providers + Quality core (~7 j)

- **AGT-A** : Migration Prisma `add_content_gen_core` complète v1.8 :
  - Tables : `ContentGenConfig`, `ProviderConfig`, `ContentTemplate`, `ContentGenJob`, `GenerationLog`, `ContentMetric`, `CostLedger`, `ReviewQueue` + **v1.7** `CoverageCampaign`, `CoverageDistributionProfile`, `AudienceMixProfile`, `AuthorProfile`, `BannedPhrase`, extension `FAQ` (slug, parentArticleId, etc.) + extension `Article` (isNews, indexationTier, qualityScore, seoScore, readabilityScore, etc.)
  - Enums : `ContentType`, `ContentGenJobStatus`, `IndexationTier`, `Locale`, `ExpansionMode`, `ProviderKey`, `ProviderRole`, `ReviewStatus`, `KbSource`, **v1.7** `CoverageStatus`, `CoverageScope`, `CompanySize` (INSEE strict 4), `OrganisationType` (12), `SearchIntent` (5)
  - Seeds providers (5 rows) + 9 templates content + **v1.7** : 3 profils distribution couverture (« Mix premium 2026 », « Mix industrie », « Mix tertiaire ») + 4 profils audience mix (« Mixte équilibré » défaut, « Tertiaire urbain », « Industriel régional », « Public et parapublic »)
- **AGT-B** : Installs SDK (`openai` ^4.80+, `@anthropic-ai/sdk` ^0.40+, `axios`) + 5 modules providers + router + circuit breaker + tests unit
- **AGT-E** : Modules quality `dedup-guard.ts` (4 couches v1.7), `plagiarism.ts`, `doctrine-check.ts`, `seo-score.ts`, `readability.ts`, **v1.7** `search-intent-validator.ts` (vérifie alignement slug/meta/CTA/JSON-LD par intent)
- **AGT-F** : Extension `src/lib/seo.ts` avec 9+ factories JSON-LD par type + **v1.7** factory `NewsArticle` + factory `QAPage` enrichi + factory `Speakable` étendu pour Q/R pages
- Commit goal : `feat(content-gen): foundations DB + providers + quality core + v1.7 tables`

### Sprint 2 — Generators + KB consumer + Q/R post-process auto (~8 j)

- **AGT-C** : 9 generators (1 par ContentType) — chacun ~150-300 LOC + 1 test happy path. **Chaque generator consomme `searchIntent` requis** + adapte slug/meta/structure/CTA selon § 26.
- **AGT-D** : `kb-client.ts` READ-ONLY + tests health-gate + tests retrieve cosine (mock data). Ingest KB hors scope (cf. `PROMPT-KNOWLEDGE-BASE-2026.md`).
- **AGT-H** : Worker `content-gen-worker.ts` + **v1.7** hook post-process `qa_extract_and_publish` (§ 29) : à chaque job complete sur landing/blog/comparatif/guide/faq-standalone → enqueue 8 micro-jobs création pages `/fr/faq/[slug]` enrichies.
- **Test end-to-end** : `KB_BYPASS=true` (mode dégradé § 11.5) → génération 1 landing Lyon + 1 article via Vitest, avec **searchIntent classifié** + **8 Q/R post-process auto vérifiées**.
- Commit goal : `feat(content-gen): 9 generators + kb-client + qa post-process auto + searchIntent`

### Sprint 3 — Admin UI partie 1 + Coverage & Settings v1.7 (~7 j)

- **AGT-G** : Sections admin Dashboard + Settings (avec sous-pages **v1.7** `coverage-distribution`, `audience-mix`, `search-intent-distribution`, `quality-loop`, `qa-policies`) + Templates + KB-readonly + Costs + **v1.7** `/coverage` (création + suivi campagnes) + `/author/manon` (édition profil)
- Server Actions pour CRUD complet (profils distribution, audience-mix, intent, AuthorProfile, BannedPhrase)
- Toggles providers fonctionnels + plafonds modifiables admin
- Page kanban prévisualisable
- Commit goal : `feat(admin/content-gen): dashboard + 6 settings + templates + kb + costs + coverage + author`

### Sprint 4 — Admin UI partie 2 + Review/Publications/Quality Loop (~7 j)

- **AGT-G** : Jobs + Queue + Review-Queue (filtres complets v1.5) + Publications historique/rollback + **v1.7** Kanban `/publications-status` (5 colonnes : Brouillon / En revue / Approuvé / Publié / Refusé — bulk approve ≥ score 75, reject < 50, retry failed, archive drafts > 30j, export CSV, KPIs) + **v1.7** `/similarity-monitor` (top 100 paires + bulk archive/merge/ignore)
- **AGT-H** : Worker `content-publish-worker.ts` + **v1.7** worker `content-quality-improver-worker.ts` (boucle qualité § 27, concurrency 3, max 2 passages auto, cost cap mensuel dédié) + worker `similarity-monitor-worker.ts` (cron quotidien 04:30)
- Workflow review → approve → publish testé end-to-end + workflow quality-improver testé (1 contenu score 65 → re-prompt section faible → score > 75)
- Commit goal : `feat(admin/content-gen): jobs + queue + review + publications + kanban + quality loop + similarity monitor`

### Sprint 5 — Pipeline 2 RSS Actualités séparé + tests E2E (~6 j)

- Migration `add_rss_pipeline` + seeds 5 sources RSS test (LeMondeInformatique, ZDNet FR, Usine Digitale, JournalDuNet, Frenchweb)
- Worker `rss-fetch-worker.ts` + generator `blog-from-rss.ts` finalisé **avec Schema NewsArticle § 28** (URL `/fr/actualites/[slug]`, sitemap `sitemap-news.xml` dédié, citation source obligatoire `citation[]` + `isBasedOn`)
- Route Next `src/app/[locale]/actualites/[slug]/page.tsx` + sitemap generator news (lastmod précis seconde)
- **v1.7** Worker `news-lifecycle-worker.ts` (cron quotidien 05:00 — rétrogradation auto tier-1 → tier-2 si CTR < 2 % à J+30)
- Section admin `/rss` (CRUD sources + force fetch + toggle auto-publish per source)
- Playwright e2e : génération bout-en-bout 3 types depuis admin (1 landing ville + 1 article RSS NewsArticle + 1 campagne 5 contenus)
- Commit goal : `feat(content-gen): rss pipeline NewsArticle + news lifecycle + e2e tests`

### Sprint 6 — Hardening + docs + Pass B audit final (~5 j)

- Cost cap tests + kill switch tests + boucle qualité cost cap test
- Plausible events wired (incl. nouveaux `content_gen_*` v1.7) + 13 alertes Telegram (§ 13.3) testées
- **v1.7** Worker `qa-promotion-worker.ts` (hebdo — V2 placeholder)
- `pnpm content-gen:isolation-check` + `pnpm content-gen:html-audit` + `pnpm content-gen:lighthouse` + `pnpm content-gen:hreflang-check` + `pnpm content-gen:exit-check` testés en CI
- ADR 0012 « Content Generator architecture v1.8 »
- Update `CLAUDE.md` root section « Content Generator » + admin docs + ADR
- Pass B audit (5 agents parallèles) sur V1 livré, score ≥ 160/200 visé
- Commit goal : `docs(adr): 0012 content-generator v1.8 + hardening + scripts CI + cutover`

### Estimation totale V1 (réévaluée v1.8 pour absorber les ajouts v1.7)

| Sprint | Jours | Cumul | Note |
|---|---|---|---|
| S1 | 7 | 7 | Foundations DB + Providers + Quality |
| S2 | 8 | 15 | 9 generators + KB consumer + Q/R post-process auto + searchIntent |
| S3 | 7 | 22 | Admin UI 1 + Coverage + 6 settings v1.7 + AuthorProfile |
| S4 | 7 | 29 | Admin UI 2 + Kanban + Quality Loop + Similarity Monitor |
| S5 | 6 | 35 | Pipeline 2 RSS NewsArticle + cycle de vie + e2e |
| S6 | 5 | 40 | Hardening + ADR + Pass B audit final |
| **TOTAL** | **40 j** | — | +5 j vs v1.5 pour absorber v1.7 |

Cible : V1 livré ~2026-06-25 (sessions cumulées Will).

---

## 18. Livrables exhaustifs

### 18.1 Code

- ✅ Migrations Prisma (2 fichiers)
- ✅ Seeds (3 fichiers + 1 script `pnpm content-gen:seed`)
- ✅ `src/server/content-gen/` : ~30 modules
- ✅ `src/lib/seo.ts` étendu
- ✅ `src/app/[locale]/(admin)/[adminPrefix]/content-gen/` : ~30 pages + ~15 composants
- ✅ `src/server/queue/workers/content-gen-*.ts` : 4 workers
- ✅ Scripts npm : `pnpm content-gen:seed`, `pnpm content-gen:dryrun`, `pnpm kb:ingest`, `pnpm rss:fetch-once`
- ✅ Extension `pnpm posts:validate`

### 18.2 Tests

- ✅ Unit tests Vitest : ≥ 80 % coverage sur `src/server/content-gen/`
- ✅ E2E Playwright : 3 scenarios bout-en-bout (génération landing ville, génération blog from RSS, validation + publish)
- ✅ Snapshot tests JSON-LD pour 9 schémas

### 18.3 Docs

- ✅ ADR 0012 « Content Generator architecture » (`docs/adr/0012-content-generator.md`)
- ✅ `_AUDIT/CONTENT-GEN-V1-CHANGELOG.md` (récap commits + décisions)
- ✅ Update `CLAUDE.md` root (section « Content Generator »)
- ✅ Update `_AUDIT/02-PLAN.md` (mention Sprint 25-30 = content-gen)
- ✅ Page admin help-text inline (i18n FR/EN)
- ✅ README.md `src/server/content-gen/README.md` (overview + decision tree provider routing)

### 18.4 Configurations

- ✅ `.env.example` étendu : `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `OPENAI_IMAGE_API_KEY`
- ✅ `src/env.ts` Zod schema étendu
- ✅ Coolify env vars : updated (with `gh secret set`/Coolify API)
- ✅ Telegram alerts templates (3 nouveaux : cost cap, gen failed, provider down)

---

## 19. Scoring /200 & gates qualité

### 19.1 Grille de scoring (gate Sprint 6 = ≥ 160/200 = GO PROD) — v1.8

| Catégorie | Poids | Critères |
|---|---|---|
| **Architecture & DB** | 20 | Migration clean (incl. tables v1.7 CoverageCampaign + AuthorProfile + extensions), seeds idempotents (3 profils distribution + 4 profils audience), types Prisma stricts (5 nouveaux enums v1.7), pas de circular deps |
| **Providers & routing** | 18 | 3 providers fonctionnels, fallback testé, cost cap testé, kill switch < 5 s, circuit breaker ≤ 1 s détection |
| **Generators + Intention recherche** *(v1.7)* | 25 | 9 types V1 fonctionnels avec `searchIntent` requis aligné slug/meta/CTA/JSON-LD, sortie Zod-valide, retry sur fail, idempotence OK, NewsArticle pour RSS, Q/R post-process auto |
| **KB / RAG (consumer)** | 12 | kb-client READ-ONLY testé, retrieve cosine < 500 ms p95, hard gate ≥ 300 chunks, mode KB_BYPASS testé |
| **Quality gates + boucle qualité** *(v1.7)* | 20 | Plagiarism 4 couches (Levenshtein + topic fingerprint + cosine 0.85 + time decay), doctrine check 100 %, anti-SIREN OK, scoring déterministe testé, **boucle qualité worker testé (1 contenu 65 → 75+)** |
| **SEO/AEO/GEO + indexation 2026** | 20 | 9+ schemas par type, meta complète, sitemaps split (blog + news + faq + villes + guides + comparaisons + pages-statiques), robots conditionnel, llms.txt + .md machine-readable, IndexNow V1 |
| **Campagnes de couverture** *(v1.7 nouvelle catégorie)* | 15 | CoverageCampaign créées + suivi temps réel SSE, multi-campagnes parallèles testées, distribution % éditable admin, audience mix éditable admin, anti-doublon couche A pré-gen testé |
| **Admin UI complète** | 20 | 27+ réglages éditables, Server Actions, toggles providers, dashboard kanban publications-status 5 colonnes, cockpit géo France map interactif, similarity-monitor, AuthorProfile éditable |
| **Queue & monitoring** | 15 | 7+ workers (content-gen, content-publish, kb-ingest, rss-fetch, geo-batch, quality-improver, similarity-monitor, news-lifecycle), Telegram alerts (13 événements § 13.3), Sentry + Plausible, rate-limit respecté |
| **Tests & verify** | 15 | Unit ≥ 80 % coverage, e2e 5 scenarios (1 landing + 1 blog + 1 RSS news + 1 campagne complète + 1 boucle qualité), `pnpm verify:all` + `pnpm content-gen:isolation-check` + `:exit-check` PASS |
| **Docs & ADR** | 10 | ADR 0012 v1.8, CLAUDE.md updated, CONTENT-GEN-V1-CHANGELOG.md, README content-gen, 23 sections du master prompt en cohérence |
| **Sécurité & RGPD** | 10 | RBAC super_admin, CSP nonce, sanitize HTML (DOMPurify), secrets jamais commités, PII redaction (`pii-redaction.ts` réutilisé) |

→ **Total ≥ 160 / 200 (80 %) = 🟢 GO PROD V1** ; 140-159 = 🟡 NEAR-GO (1 sprint correctif S6.1) ; < 140 = 🔴 NO-GO (diagnostic + plan correctif Sprint complet).

Note v1.8 : grille étendue pour intégrer Campagnes de couverture (nouvelle catégorie 15 pts) et boucle qualité (intégrée dans Quality gates 20 pts au lieu de 15 v1.5). Quelques poids redistribués pour rester /200.

### 19.2 Gates par sprint

| Sprint | Gate |
|---|---|
| S1 | Migration appliquée prod sans erreur, seeds idempotents, 1 provider test 200 OK |
| S2 | 1 landing ville générée bout-en-bout en local (sortie .ts valide, score ≥ 75) |
| S3 | Toggle provider depuis admin fonctionnel, génération depuis UI fonctionnel |
| S4 | Review queue + publish bout-en-bout testé, rollback testé |
| S5 | 1 article RSS-derived publié, plagiarism vs source < 10 % |
| S6 | Score ≥ 160/200, Pass B audit verdict 🟢, ADR 0012 mergé |

---

## 20. STOP & ASK obligatoires (13 questions)

> **Question fermée** + 3-4 options. Will répond `OUI / OPTION X / STOP`.

**Q1. Budgets mensuels providers** : default proposé `$200 OpenAI + $100 Anthropic + $80 Perplexity + $50 Image = $430/mois`. OK ? Ou plus serré ?

**Q2. Modèle text par défaut** :
- (a) `gpt-4o-mini` primaire (cheap, ~$0.15/$0.60 par 1M tokens), `gpt-4o` premium uniquement
- (b) `gpt-4o` primaire, `gpt-4o-mini` pour < 800 mots **(RECOMMANDÉ)**
- (c) `claude-sonnet-4-6` primaire (Anthropic-first)

**Q3. Embeddings dimension** :
- (a) `text-embedding-3-small` 512-dim ($0.02/1M) **(RECOMMANDÉ V1)**
- (b) `text-embedding-3-large` 1536-dim ($0.13/1M)

**Q4. Images V1** *(révisé v2.0 — Will a tranché 2026-05-14)* :
- ✅ **Acté : Unsplash uniquement.** Pas de génération IA d'image (gpt-image-1, DALL·E, etc.). Réduit coût ($50/mois économisés), simplifie pipeline, garantit qualité photographique + crédit photographer (signal authenticité). Cf. § 8 refondu v2.0.

**Q5. STOP avant génération depuis mots-clés ?** Outline + format + word count proposés → Will valide avant lancement gen ? **(RECOMMANDÉ : OUI)**

**Q6. STOP avant génération pilier ?** Outline 8-15 sections → Will valide ? **(RECOMMANDÉ : OUI)**

**Q7. Auto-publish RSS-derived tier-2** ? **(RECOMMANDÉ : OUI si score ≥ 60)**. Sinon tout passe en review-queue.

**Q8. Rôle admin nouveau** :
- (a) Créer `editor_ai` (peut generate + review, pas settings)
- (b) Tout sous `super_admin` V1 (simpler) **(RECOMMANDÉ V1)**

**Q9. Cron daily-target auto-pilot V1** ?
- (a) Activé default off, Will activera plus tard **(RECOMMANDÉ V1)**
- (b) Activé default on (1 landing ville/jour)

**Q10. Pages Q/R individuelles `/fr/faq/<slug>`** *(révisé v1.7 — Will a tranché)* :
- **Décision actée** : modèle **hybride**. Q/R groupées en FAQ embed dans l'article parent (Speakable JSON-LD) ET **chaque Q/R devient automatiquement une page indexable `/fr/faq/<slug>`** avec enrichissement contextuel (≥ 300 mots anti-thin) via post-process auto. URL plate sémantique. Cf. § 29 du master prompt.

**Q11. RSS sources V1** : combien et lesquelles ?
- Proposition : 5 sources start (LeMondeInformatique, ZDNet FR, Usine Digitale, JournalDuNet, Frenchweb).
- Will valide la liste ? Ou propose les siennes ?

**Q12. Indexing API Google V1 ou V2** *(révisé v2.4 — Will a tranché 2026-05-14)* :
- ✅ **Acté : (a) V1.** Module `src/server/content-gen/seo/google-indexing-api.ts` produit Sprint 5. Configuration : OAuth2 service account Google Cloud + propriétaire Search Console. Cron post-publish tier-1 ping immédiat. Cf. § 9bis.1 v2.4 mis à jour.

**Q12bis. Clé OpenAI images** *(obsolète v2.0)* :
- ⚠️ **Question obsolète depuis v2.0** (Unsplash uniquement, pas de génération IA d'image). `OPENAI_IMAGE_API_KEY` non requise V1. Si Will change d'avis V2 → réactiver Q12bis.

**Q13. Profil canonique Manon — confirmer les valeurs avant seed Person JSON-LD** :
- Nom à afficher : ✅ « Manon » seul (validé 2026-05-14, pas de nom de famille)
- Photo : ✅ `/auteurs/manon.png` (portrait IA disclosed Option 4, fournie 2026-05-14)
- Bio 200-400 mots : ✅ validée OK tel quel (cf. seed `manon-profile.md` § 3)
- LinkedIn URL : ✅ `null` — **doctrine v2.1 Manon n'a AUCUN réseau social** (acté Will 2026-05-14)
- Twitter/X handle : ✅ `null` — idem, balise `twitter:creator` TOUJOURS omise pour contenus Manon
- `alumniOf`, `award`, `credentials` : ✅ absents (persona fictive transparente)
- Page `/fr/equipe/manon` : à créer Sprint 3 (intervention page auteur canonique avec disclaimer IA explicite)

---

## 21. Contraintes intouchables

- 🚫 **Naming** : `Axion-IA` partout, jamais variantes
- 🚫 **OÜ estonienne** : 0 SIREN/SIRET/RCS dans contenus générés
- 🚫 **Cabinet IA opérationnel** (FR) / **operational AI consultancy** (EN)
- 🚫 **Doctrine ≥ 95 % AxionIA-centric** : test heuristic dans `doctrine-check.ts`
- 🚫 **Palette intouchable** : terracotta `#C45A3E`, cream `#FAF7F2`, ink `#1F1B16`. Tokens uniquement, anti-hex.
- 🚫 **Hero schema carré 576×576 lg+** : doctrine v3.2/v3.3 hero-schema
- 🚫 **Hardcode pricing** : interdit, toujours `formatAmount()` SSOT
- 🚫 **Phrases interdites** : « unique », « le meilleur », « révolutionnaire », « pas de plan sur-mesure », « ½ journée », « basé en UE »
- 🚫 **Performance budget** : pas de regression LCP/INP/CLS pages existantes
- 🚫 **WCAG 2.2 AA** : contraste 4.5:1, focus-visible, ARIA
- 🚫 **Anti-doorway HCU** : `noindex` tier-2/3, sitemap tier-1 only
- 🚫 **FR-only V1 pour les contenus générés** (décision Will v1.2) : aucun article généré en EN. Hreflang `fr-FR` + `x-default` (= FR). Le site garde son `/en/*` pour les pages éditoriales manuelles existantes, intactes.
- 🚫 **Auteur affiché = Manon** sur tous les contenus générés. Person JSON-LD canonique sous `/fr/equipe/manon#person`. Byline + author-card obligatoires. Photo Manon AVIF 3 variantes (80, 256, 1024).
- 🚫 **Admin FR uniquement** : redirect EN admin → FR (déjà en place)
- 🚫 **Pas de modification de** : `pricing.ts`, `regions.ts`, `interventions.ts`, `audit-taxonomy.ts`, `implementation.ts` sans STOP & ASK
- 🚫 **Pas d'écriture dans** : `src/content/villes/copy/*.ts` existants sans confirm explicite

---

## 22. Checklist EXIT V1

> Tout doit être ✅ avant déclarer V1 livré.

**DB & infra**
- [ ] Migration `add_content_gen_core` appliquée prod sans erreur
- [ ] Migration `add_rss_pipeline` appliquée prod sans erreur
- [ ] Extension `pgvector` activée Postgres prod
- [ ] Seeds prod idempotents (run 2× = même résultat)
- [ ] `.env.local` + Coolify env vars synchronisés (5 nouvelles vars)

**Providers**
- [ ] OpenAI text fonctionnel (test prompt → réponse)
- [ ] OpenAI image fonctionnel (test prompt → URL image)
- [ ] Anthropic fallback testé (simuler OpenAI 503 → Claude répond)
- [ ] Perplexity Sonar fonctionnel (test query → citations)
- [ ] Unsplash fonctionnel (test query → image + attribution)
- [ ] Toggle ON/OFF par provider depuis admin OK
- [ ] Cost cap hit → kill switch auto activé (test simulé)

**Generators (9 types V1)**
- [ ] landing_ville : 1 ville test (ex Lyon) → copy.ts généré + JSON-LD valide
- [ ] blog_article (from_title, from_keywords, from_rss, from_pillar) : 1 chacun généré
- [ ] comparison : 1 généré
- [ ] guide_pilier : 1 généré (avec STOP & ASK outline)
- [ ] qa_derived : 1 généré depuis article existant
- [ ] faq_standalone : 1 généré + insertion DB FAQ table

**Qualité**
- [ ] Plagiarism Jaccard fonctionnel (test paire similaire → blocked)
- [ ] Dedup-guard pré-IA fonctionnel
- [ ] Doctrine check : anti-SIREN, naming, mots bannis (test 3 cas)
- [ ] SEO score déterministe : test 3 articles, scores cohérents
- [ ] Readability FR/EN calculé

**KB / RAG**
- [ ] 160+ chunks seedés
- [ ] Retrieve cosine top-K fonctionnel
- [ ] Latence p95 < 500ms
- [ ] Boost AxionIA-canonical effectif

**SEO/AEO/GEO** (perfection extrême)
- [ ] Checklist § 9.7 passée à 100 % sur 3 contenus pilotes (1 landing ville + 1 article + 1 guide)
- [ ] 32 balises `<head>` § 9.7.1 toutes présentes (validateur HTML automatisé)
- [ ] 14 Open Graph § 9.7.2 toutes présentes
- [ ] 7 Twitter Cards § 9.7.3 toutes présentes
- [ ] 4 Geo meta § 9.7.4 sur landings villes
- [ ] Hiérarchie headings stricte § 9.7.5 (1×H1, 3-8×H2, H3 enfants, 0×H5+)
- [ ] Semantic HTML5 § 9.7.6 conforme
- [ ] WCAG 2.2 AA § 9.7.7 conforme (contraste + alt + focus)
- [ ] JSON-LD blocs par type § 9.7.8 implémentés et validés (Rich Results Test)
- [ ] Direct answer 40-80 mots + TL;DR + Key Facts + TOC toujours présents
- [ ] FAQ Speakable JSON-LD OK
- [ ] Sitemap split par type (blog, villes, guides, faq, comparaisons), tier-1 only, FR-only
- [ ] llms.txt émis dynamiquement à la racine + variantes `.md` machine-readable pour tier-1
- [ ] hreflang FR-only + x-default conforme
- [ ] robots conditionnel par tier OK

**Auteur Manon**
- [ ] Page `/fr/equipe/manon` créée, indexable tier-1
- [ ] Photo Manon en 3 variantes AVIF (80, 256, 1024) dans `public/auteurs/`
- [ ] `buildPersonManonJsonLd()` dans `src/lib/seo.ts`
- [ ] Tous les `Article.author` pointent par `@id` vers `/fr/equipe/manon#person`
- [ ] Byline en haut + author-card en bas sur chaque contenu généré
- [ ] Liens `rel="author"` pointant `/fr/equipe/manon`

**Mobile-first & Web Vitals**
- [ ] Lighthouse local PASS budget § 9.10.5 sur 5 pages pilotes
- [ ] LCP ≤ 1 800 ms p75 mesuré
- [ ] INP ≤ 100 ms p75 mesuré (150 ms exception contenus générés)
- [ ] CLS = 0 strict
- [ ] First Load JS ≤ 75 KB gz / route
- [ ] AVIF + WebP + JPG fallback + srcset 3 variantes sur toutes images
- [ ] `width`/`height` HTML obligatoires (anti-CLS)
- [ ] LCP image `fetchpriority="high"` + preload
- [ ] `content-visibility: auto` below-fold
- [ ] web-vitals RUM wired vers Plausible + `/api/rum`
- [ ] Touch targets ≥ 44×44 px
- [ ] Lecture mobile 60-75 chars/ligne, font ≥ 16 px body

**Admin UI (8 sections)**
- [ ] Dashboard live KPIs
- [ ] Settings toggle providers
- [ ] Templates CRUD
- [ ] Jobs liste + détail + logs
- [ ] Queue BullMQ inspection
- [ ] Review-queue : approve/reject/promote tier-1 fonctionnels
- [ ] KB upload + chunks visibles
- [ ] RSS sources CRUD + force-fetch
- [ ] Costs graphes 30j par provider
- [ ] Publications historique + rollback

**Queue & monitoring**
- [ ] 4 workers running (`pnpm worker`)
- [ ] BullMQ rate-limit respecté
- [ ] Sentry capture errors
- [ ] Plausible events fired
- [ ] Telegram alerts wired (3 cas testés)
- [ ] Cron retention tier-3 90j running

**Tests**
- [ ] `pnpm verify:all` PASS
- [ ] Unit tests ≥ 80 % coverage `src/server/content-gen/`
- [ ] E2E Playwright 3 scenarios PASS
- [ ] JSON-LD snapshots PASS

**Docs**
- [ ] ADR 0012 mergé
- [ ] CLAUDE.md root section « Content Generator » ajoutée
- [ ] `_AUDIT/CONTENT-GEN-V1-CHANGELOG.md` rédigé
- [ ] `src/server/content-gen/README.md` (overview + decision tree)
- [ ] `_AUDIT/02-PLAN.md` updated (Sprint 25-30)

**Sécurité**
- [ ] Rôle admin éditorial (ou super_admin V1) restreint
- [ ] CSP nonce respecté (pas d'inline générée)
- [ ] HTML sanitize avant insertion DB (DOMPurify)
- [ ] Aucune fuite PII client dans prompts
- [ ] Aucun secret en clair commité
- [ ] RGPD : prompts loggés mais PII anonymisée (helper `pii-redaction.ts` réutilisé)

**Pass B audit final**
- [ ] Audit 5 agents parallèles sur V1 livré
- [ ] Score ≥ 160/200
- [ ] Verdict 🟢 GO ou 🟡 NEAR-GO (avec sprint correctif fixé)

---

## 23. Phrase d'invocation pour reprise

> Pour relancer une nouvelle session Claude sans relire 3 000 lignes, Will colle exactement :

```
Lis _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md en intégralité. Puis lis 
_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md (data model acté Will 2026-05-08) qui 
complète le master. Avant tout code, fais le reality-check § 2.1 (vérifier 
que les briques listées existent toujours : prisma, BullMQ, regions.ts, 
villes/data/*.ts, admin layout, src/lib/seo.ts). Pose-moi les 13 STOP & ASK 
du § 20 et attends mes réponses avant d'exécuter le Sprint 1.

Mode : 🛠️ BUILD (pas AUDIT-ONLY).
Sprint en cours : [S1 — Foundations DB + Providers]
Agents à lancer en parallèle : AGT-A (DB), AGT-B (Providers), AGT-E (Quality), AGT-F (SEO).

Contraintes intouchables : cf. § 21. Phrases interdites : cf. § 21.
Naming : Axion-IA. OÜ. Pas de SIREN. Doctrine AxionIA-centric ≥ 95 %.
SSOT : pricing.ts, regions.ts, interventions.ts.

Livrables Sprint 1 attendus : 1 migration `add_content_gen_core` + seeds + 
5 modules providers + router + 5 modules quality + extension src/lib/seo.ts 
+ tests unit + commit conventional « feat(content-gen): foundations… ».
```

---

## 25. Campagnes de couverture — pilier de la conquête territoriale

> Concept central V1 acté Will 2026-05-13. Permet de **saturer 1 ville ou 1 département** avec un nombre N de contenus diversifiés selon une distribution % par type et un mix d'audiences (taille INSEE × type d'organisation).

### 25.1 Doctrine

- **Pipeline 1 — Pages d'atterrissage villes** : indépendant. 1 ville = 1 contenu landing déclenché depuis le cockpit géographique. Hors campagnes.
- **Pipeline 2 — Actualités RSS** : indépendant. Cron RSS quotidien → contenus `NewsArticle` Schema.org. Hors campagnes. Cf. § 28.
- **Pipeline 3 — Campagnes de couverture** : c'est ICI que vit la mécanique de saturation territoriale. 5 types de contenus pilotables par distribution % éditable depuis l'admin.

### 25.2 Modèle de données

```prisma
model CoverageCampaign {
  id                       String   @id @default(cuid())
  name                     String   // "Couverture Lyon premium V1"
  status                   CoverageStatus @default(draft) // draft | queued | running | paused | completed | failed | cancelled
  scope                    CoverageScope                  // ville | departement | region | multi
  anchorVilleSlugs         String[] @default([])
  anchorDepartementCodes   String[] @default([])
  anchorRegionSlugs        String[] @default([])
  totalTargetCount         Int       // ex 200 contenus à produire
  typeDistribution         Json      // référence à un CoverageDistributionProfile ou inline
  audienceMix              Json      // référence à un AudienceMixProfile ou inline
  searchIntentMix          Json?     // optionnel : { informational: 50, commercial: 30, local: 20 } — défaut auto
  estimatedCostUsd         Decimal? @db.Decimal(10, 2)
  estimatedDurationMinutes Int?
  generatedCount           Int @default(0)
  publishedCount           Int @default(0)
  failedCount              Int @default(0)
  qualityImprovedCount     Int @default(0)
  startedAt                DateTime?
  pausedAt                 DateTime?
  completedAt              DateTime?
  createdAt                DateTime @default(now())
  createdBy                String?
  jobs                     ContentGenJob[]
}

enum CoverageStatus { draft queued running paused completed failed cancelled }
enum CoverageScope  { ville departement region multi }

model CoverageDistributionProfile {
  id            String   @id @default(cuid())
  slug          String   @unique  // "mix-premium-2026", "mix-industrie", "mix-tertiaire"
  name          String              // "Mix premium 2026"
  description   String?
  distribution  Json                // { blog_from_title: 30, blog_from_keywords: 25, comparison: 20, faq_standalone: 15, guide_pilier: 10 }
                                    // ⚠️ somme = 100 % validé Zod
  isDefault     Boolean @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model AudienceMixProfile {
  id            String   @id @default(cuid())
  slug          String   @unique  // "tertiaire-urbain", "industriel-regional", "public-parapublic", "mixte-equilibre"
  name          String
  description   String?
  mix           Json                // { "pme:entreprise_privee": 40, "tpe:entreprise_privee": 20, ... }
                                    // somme = 100 % validé Zod
  isDefault     Boolean @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum CompanySize {
  tpe                  // < 10 salariés (INSEE)
  pme                  // 10 - 249 (INSEE)
  eti                  // 250 - 4 999 (INSEE)
  grande_entreprise    // ≥ 5 000 (INSEE)
}

enum OrganisationType {
  entreprise_privee     // défaut commercial
  ecole                 // école privée, groupe scolaire
  universite            // université + grandes écoles publiques
  mairie                // mairie + intercommunalité
  collectivite          // département, région, métropole
  hopital               // hôpital public + clinique privée
  association           // loi 1901
  comite_entreprise     // CSE / CE
  opco                  // OPCO formation
  carsat                // CARSAT / CPAM / URSSAF
  etablissement_public  // EPA / EPIC catch-all
  autre                 // fallback
}

// ContentGenJob — extensions Coverage Campaign + Search Intent
model ContentGenJob {
  // ... champs existants
  campaignId                  String?
  campaign                    CoverageCampaign? @relation(fields: [campaignId], references: [id])
  anchorVilleSlug             String?           // requis si pas campagne RSS
  anchorDepartementCode       String?
  anchorRegionSlug            String?
  targetAudienceSize          CompanySize?
  targetAudienceOrganisation  OrganisationType?
  targetSearchIntent          SearchIntent      // requis — pilier doctrine v1.7
  qualityImprovementAttempts  Int @default(0)
}

enum SearchIntent {
  informational             // « qu'est-ce que l'IA opérationnelle ? »
  commercial_investigation  // « meilleur cabinet IA Lyon »
  transactional             // « réserver audit IA Paris »
  navigational              // « axion-ia tarifs » — réservé pages manuelles (pages /tarifs, /equipe, /contact, etc.). Auto-exclu des campagnes de couverture.
  local                     // « cabinet IA près de chez moi »
}
```

> **Note v1.8** : l'intent `navigational` est dans l'enum pour exhaustivité, mais **auto-exclu** des campagnes de couverture (distribution par défaut = 0 %). Réservé aux pages manuelles déjà existantes (`/fr/tarifs`, `/fr/equipe/manon`, `/fr/contact`, etc.). Le content-generator ne le génère jamais auto.

### 25.3 Mécanique de génération d'une campagne

À la création d'une campagne via `/admin/content-gen/coverage/new` :

```
1. Will choisit :
   - Périmètre (ville / dépt / région / multi)
   - Volume cible (ex 200 contenus)
   - Profil de distribution (preset OU inline)
   - Profil d'audiences (preset OU inline)
   - Profil d'intentions (auto par défaut OU inline)

2. Le système calcule le plan détaillé :
   - 200 × distribution[type] = N contenus par type
     Ex : 60 blog_from_title + 50 blog_from_keywords + 40 comparison + 30 faq_standalone + 20 guide_pilier
   - Pour chaque slot, croise (audience, intent) selon les mix
   - Vérifie anti-doublon (cf. § 25.5)
   - Estime coût et durée

3. Will valide → Status = queued
   Le orchestrateur enqueue les N jobs dans BullMQ avec rate-limit global
   anchorVilleSlug ou anchorDepartementCode rempli pour chaque job

4. Exécution en parallèle (concurrency = 5 workers par défaut)
   Chaque contenu :
   - Suit son sub-prompt (cf. .claude/skills/axionia-content-generator/prompts/*.md)
   - Génère sa FAQ embed (8 Q/R) → post-process auto crée 8 pages /fr/faq/<slug> (cf. § 29)
   - Validation qualité → boucle d'amélioration si score 40-74 (cf. § 27)
   - Publication tier-2 par défaut, review-queue manuel pour tier-1
```

### 25.4 Multi-campagnes en parallèle

Will peut lancer plusieurs campagnes simultanées :

- Campagne A : Lyon (200 contenus)
- Campagne B : département Rhône (300 contenus)
- Campagne C : Marseille (150 contenus)

→ BullMQ orchestre, rate-limits providers respectés, cost cap global commun, kill-switch unique. Le cockpit géographique affiche les 3 campagnes superposées avec coloration distincte par campagne.

### 25.5 Anti-redondance / anti-doublon — 4 couches durcies v1.7

**Couche A — pré-génération** (avant tout appel LLM) :
- Similarité titre Levenshtein ≥ 0.85 contre les 5 000 derniers titres → BLOQUE
- Primary keyword + ville + fenêtre 90 j → BLOQUE
- Topic fingerprint (hash des 8-12 keywords principaux) match exact ou overlap ≥ 90 % → BLOQUE
- **Embedding cosine** du topic vs corpus existant, seuil bloquant abaissé à **0.85** (v1.7)
- Exception multi-audiences : même primary keyword autorisé SI couple `(taille × organisation)` différent (ex « audit IA PME école » OK même si « audit IA PME entreprise privée » existe)

**Couche B — post-génération**
- Shingling 5-gram + Jaccard ≥ 0.30 vs corpus interne → re-write section divergente
- RSS-derived vs source originale ≥ 0.10 → re-write strict obligatoire

**Couche C — Surveillance continue (nouvelle v1.7)**
- Cron quotidien `similarity-monitor-worker`
- Calcule top 100 paires les plus similaires du corpus (cosine + Jaccard combinés)
- Page admin `/admin/content-gen/similarity-monitor` (cf. § 12.1)
- Bulk actions : archiver le moins performant, fusionner les 2, ignorer la paire

**Couche D — Time decay**
- Même topic re-traitable après **12 mois** uniquement (pour update freshness). Avant : BLOQUE.

---

## 26. Intention de recherche — pilier transverse v1.7

> Doctrine durcie : tout contenu généré DOIT avoir une **intention de recherche** classifiée et alignée structurellement avec slug + meta title + meta description + structure H1/H2 + CTA + JSON-LD. C'est le pilier qui sépare un contenu professionnel d'un contenu générique.

### 26.1 Les 5 intentions reconnues

| Intent | Exemple requête | Structure imposée | CTA |
|---|---|---|---|
| `informational` | « qu'est-ce que l'IA opérationnelle ? » | Guide / article long, FAQ riche, sources citées | Pas de CTA agressif — newsletter ou article connexe |
| `commercial_investigation` | « meilleur cabinet IA Lyon » | Comparatif, tableau, pros/cons, verdict argumenté | CTA fort « Réserver audit » en bas + intra-page |
| `transactional` | « réserver audit IA Paris » | Landing courte 800-1 200 mots, hero + bénéfices + signaux trust | CTA hero hautement visible (`<a class="btn-primary">`) |
| `navigational` | « axion-ia tarifs » | Page directe (manuel) — pas auto-générée | CTA contextuel |
| `local` | « cabinet IA près de chez moi » | Landing ville complète (Pipeline 1) + LocalBusiness JSON-LD + meta geo | CTA réservation localisée |

### 26.2 Influence sur les artefacts

| Artefact | Influence intent |
|---|---|
| **Slug** | `audit-ia-paris` (local) vs `comparatif-mistral-claude-pme` (commercial) vs `comment-auditer-ia-cabinet-comptable` (informational) |
| **Meta title** | inclut un déclencheur d'intent (« Comment… » info, « vs… » commercial, « Réservez… » transactional) |
| **Meta description** | reflète l'intent dans le verbe principal + CTA implicite |
| **H1** | aligné sémantiquement avec intent |
| **Structure body** | sections différentes selon intent (cf. § 26.1) |
| **CTA** | type + emplacement varient |
| **JSON-LD** | `Article` (info) / `Article` + `Product`/`Service` items (commercial) / `Service` + `LocalBusiness` (transactional/local) |

### 26.3 Implémentation

- `ContentGenJob.targetSearchIntent` requis (NOT NULL) — passé par le générateur au LLM dans le system prompt
- Sub-prompts (cf. skill) conditionnent leur output JSON selon `searchIntent`
- Validation `posts:validate` étendue :
  - Si intent = `transactional` → vérifie présence d'un `<a class="btn-primary">` dans la 1ʳᵉ moitié du body
  - Si intent = `local` → vérifie présence LocalBusiness JSON-LD + meta geo
  - Si intent = `informational` → vérifie ≥ 3 sources citées dans `Article.citation[]`
  - Si intent = `commercial_investigation` → vérifie table comparatif présente
  - Score pénalisé si désalignement détecté

### 26.4 Distribution par défaut (v1.7 — éditable admin)

Profil distribution d'intent par défaut sur une campagne ville :

```
informational              45 %  ← matière SEO long-tail
commercial_investigation   30 %  ← capture trafic « vs »
local                      15 %  ← capture trafic local (combiné avec Pipeline 1)
transactional              10 %  ← capture trafic transactionnel chaud
navigational                0 %  ← non auto-généré (pages manuelles)
```

Éditable dans `/admin/content-gen/settings/search-intent-distribution`.

---

## 27. Boucle d'amélioration qualité (Quality Loop)

> Doctrine v1.7 : si un contenu généré a un score qualité **< 75 mais ≥ 40**, ne pas publier tel quel. Lancer un **passage d'amélioration ciblé** pour tenter de remonter au tier-1.

### 27.1 Pipeline

```
Contenu généré → score 78 → review-queue (tier-1 possible) ✅
Contenu généré → score 65 → quality-improver
                            ├── analyse score breakdown
                            ├── identifie sections faibles :
                            │   - word count manque (15 pts)
                            │   - FAQ < 4 items (10 pts)
                            │   - plagiat trop élevé (8 pts)
                            ├── plan d'amélioration ciblé
                            ├── 2ᵉ appel LLM CIBLÉ (re-prompt sections faibles uniquement)
                            ├── recompute score
                            │   → si > 75 → review-queue tier-1 candidat
                            │   → si 60-75 → review-queue tier-2 + flag « amélioré 1× »
                            │   → si < 60 après amélioration → marqué needs_manual_review
                            └── max 2 passages auto (cost-cap)
Contenu généré → score 35 → tier-3 direct (pas de boucle, trop faible)
```

### 27.2 Worker `content-quality-improver-worker`

- Nouveau worker BullMQ dédié
- Concurrency = 3 (moins agressif que générateur principal)
- Statut intermédiaire `ContentGenJob.status = "quality_improving"`
- Compteur `qualityImprovementAttempts` incrémenté à chaque passage
- Cost cap dédié : `Setting.key="content_gen_quality_loop_monthly_cap_usd"` (default $50/mois)

### 27.3 Sections re-promptées ciblées

Le worker re-prompt **uniquement** la section faible (économie tokens majeure vs re-gen complète) :

| Faiblesse détectée | Re-prompt ciblé |
|---|---|
| Word count manque | « Ajoute 300 mots sur les sections H2 #X et #Y en restant AxionIA-centric » |
| FAQ < 4 items | « Génère 4 Q/R supplémentaires sur les axes manquants » |
| Plagiat trop élevé sur section X | « Réécris la section X en évitant ces 5 phrases matching : [...] » |
| Direct answer 40-80 mots manque | « Re-rédige le Direct Answer en exactement 40-80 mots » |
| Headings mal structurés | « Re-structure les H2/H3 selon ce plan : [...] » |

Coût estimé +30-40 % de tokens sur les contenus qui passent en boucle (vs +100-150 % pour re-gen complète).

### 27.4 Pilotage admin

`/admin/content-gen/settings/quality-loop`

- Toggle ON/OFF
- Seuil de déclenchement (default 75)
- Score minimum éligible (default 40 — en dessous, tier-3 direct)
- Max passages auto (default 2)
- Cost cap mensuel
- Stats : taux d'amélioration tier-2→tier-1, gain moyen de score, coût moyen par contenu amélioré

---

## 28. Pipeline 2 — Actualités RSS (séparé v1.7)

> Les contenus dérivés du RSS suivent un pipeline propre, **séparé du blog standard**, avec Schema `NewsArticle`, URL `/fr/actualites/<slug>`, sitemap dédié, cycle de vie spécifique.

### 28.1 Différences vs blog standard

| Aspect | Blog standard | Actualités RSS |
|---|---|---|
| URL | `/fr/blog/<slug>` | `/fr/actualites/<slug>` |
| JSON-LD principal | `Article` ou `BlogPosting` ou `TechArticle` | **`NewsArticle`** avec `dateline` + `articleSection` + `printSection` |
| Sitemap | `sitemap-blog.xml` | `sitemap-news.xml` séparé (compatible Google News) |
| Taxonomie | Catégories standard | Catégorie « Actualité IA » dédiée |
| Tier par défaut | tier-2 puis review | **tier-2 auto-publié si score ≥ 60** (cf. Q7 § 20 confirmé OUI) |
| Cycle de vie | Promotion manuelle tier-1 → permanent | Tier-1 si CTR > 2 % à J+7, sinon **rétrogradation auto tier-2 à J+30** |
| Citations | Sources Perplexity optionnelles | Source originale obligatoire : `citation[]` + `isBasedOn` + `wasDerivedFrom` |
| Anti-plagiat | Jaccard < 30 % | Jaccard < **10 %** strict vs source |
| Freshness sitemap | hebdo | **lastmod précis à la seconde**, max 48 h pour Google News |

### 28.2 Modèle de données

L'`Article` existant suffit, mais ajouter :

```prisma
// Article existante — extension v1.7
model Article {
  // ... champs existants
  isNews              Boolean @default(false)
  newsSourceUrl       String?
  newsSourceName      String?
  newsCategory        String?  // "actualite-ia", "actualite-marche", ...
  publishedAtDateline String?  // ville/lieu source (« Paris, 2026-05-13 »)
}
```

### 28.3 Sub-prompt RSS — adapté v1.7

Cf. `.claude/skills/axionia-content-generator/prompts/blog-article.md` variant `blog_from_rss` — déjà spec, à enrichir avec output JSON-LD `NewsArticle` au lieu de `Article` standard.

---

## 29. Q/R post-process — pages indexables automatiques

> Doctrine v1.7 acté Will : chaque contenu (sauf Q/R-only) génère ses 8 Q/R en FAQ embed + **chaque Q/R est aussi une page individuelle indexable `/fr/faq/<slug>`** avec enrichissement contextuel automatique pour échapper au thin-content HCU.

### 29.1 Trigger automatique

À chaque fois qu'un `ContentGenJob` complete sur un type ∈ { `landing_ville`, `blog_*`, `comparison`, `guide_pilier`, `faq_standalone` } → **hook post-process** déclenche 8 micro-jobs `qa_extract_and_publish` :

```
1. Parse la FAQ embed (déjà générée dans la sortie LLM principale — pas de nouvel appel)
2. Pour chaque Q/R :
   - Génère un slug stable : kebab-case(question), tronqué à 80 chars
   - Enrichit le contexte :
     - 3 phrases contextuelles auto (article parent + secteur + audience)
     - 4-6 Q/R similaires (recherche cosine embedding dans la table FAQ existante)
     - Lien fort CTA vers article parent
   - Construit le contenu final (≥ 300 mots — anti-HCU thin)
   - Insère row table FAQ étendue avec slug + parentArticleId + indexationTier
   - Émet JSON-LD QAPage + Question + Answer + Speakable + BreadcrumbList + Person Manon
3. revalidatePath('/fr/faq/<slug>') + sitemap-faq.xml update
```

**Coût LLM quasi-nul** : l'extraction Q/R utilise la sortie LLM déjà existante. Seul l'enrichissement contextuel passe par un mini-call rapide.

### 29.2 Extension de la table `FAQ` existante

```prisma
// FAQ — extension v1.7
model FAQ {
  // ... champs existants (question_fr, answer_fr, category, status, ...)
  slug                String?  @unique
  parentArticleId     String?
  parentArticle       Article? @relation(fields: [parentArticleId], references: [id])
  enrichmentContext   Json?    // { topic, ville, audience, similarQaIds[], parentTitle, parentSlug }
  indexationTier      IndexationTier @default(tier_2_noindex_follow)
  qualityScore        Int?
  generatedByJobId    String?
  searchConsoleCtr    Decimal? // V2 — sync hebdo
  viewCount           Int @default(0)
  publishedAt         DateTime?
  isAutoGenerated     Boolean @default(false)
}
```

### 29.3 Route Next 16 nouvelle

- `src/app/[locale]/faq/[slug]/page.tsx` (SSG / ISR avec revalidate 1 jour)
- Layout : header Manon + breadcrumb + question + answer + bloc contexte + 4-6 Q/R similaires + lien article parent + footer Manon
- ≥ 300 mots total garanti par le générateur
- JSON-LD complet : `QAPage` + `Question` + `Answer` + `Speakable` (cssSelector sur l'answer) + `BreadcrumbList` + `Person` Manon + `WebPage.lastReviewed`

### 29.4 Sitemap dédié

- Fichier `sitemap-faq.xml` (chunked à 1 000 URLs si > 1 000 Q/R tier-1)
- Inclus dans `sitemap-index.xml`
- `lastmod` = `FAQ.publishedAt` ou `updatedAt`
- `changefreq` = monthly
- `priority` = 0.5 (tier-1) ou absent (tier-2)

### 29.5 Promotion tier-1 Q/R

- Auto : si `searchConsoleCtr > 1 %` après 90 jours → propose promotion tier-1 dans review-queue
- Manuel : Will peut promouvoir depuis admin `/faq/<id>` → bouton « Promouvoir tier-1 »

### 29.6 Toggle admin

`/admin/content-gen/settings/qa-policies` :
- Toggle « auto-create Q/R pages » ON/OFF (default ON)
- Seuil mots minimum (default 300)
- Auto-promotion tier-1 CTR seuil (default 1 %)
- Délai analyse CTR (default 90 j)

---

## 24. Mode autopilote bout-en-bout (Sprint 1 → 6 sans intervention)

> ℹ️ **Note d'ordre physique (2026-05-14)** : la section § 24 (autopilote) suit physiquement § 23 (phrase invocation) et précède § 25 (campagnes couverture v1.7). Sa numérotation logique reste 24 (autopilote = pipeline d'exécution global qui orchestre les chapitres 25-29 v1.7+ ajoutés ensuite). Les chapitres 25-29 doivent être lus comme des **modules pilotés par l'autopilote § 24**, pas comme des étapes séquentielles après lui.

> Pour exécuter V1 dans une nouvelle session Claude Code **sans s'arrêter aux 13 STOP & ASK**, ce chapitre fournit les **défauts d'autorité** + le **pipeline d'exécution** + les **gates obligatoires**. Will lance, Claude finit en ~35 jours dev cumulés (lui-même cumulant des sessions multiples — pas en continu une session).

### 24.1 Pré-requis (Will doit fournir AVANT autopilote)

| Item | Pourquoi | Comment fournir |
|---|---|---|
| 5 clés API actives | Sinon génération impossible | `.env.local` + Coolify env vars : `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `OPENAI_IMAGE_API_KEY` (ou réutiliser `OPENAI_API_KEY`). |
| Profil Manon (Q13) | Person JSON-LD canonical, byline, photo | Réponse écrite : nom à afficher, chemin photo source, bio 200-400 mots, LinkedIn URL, handle Twitter (ou « pas de Twitter »). Sans ça → Claude génère bio par défaut + omet sameAs LinkedIn + omet twitter:creator. |
| Confirmation que la KB est prête | Hard gate § 11.2 ≥ 300 chunks | Will exécute `PROMPT-KNOWLEDGE-BASE-2026.md` en parallèle. Si pas prêt → autopilote tourne en `KB_BYPASS=true` (mode dégradé § 11.5, banner rouge admin). |
| Accès git push origin/main | Commits Sprint après Sprint | déjà OK |
| Token Coolify API valide | Auto-deploy via `.github/workflows/deploy-coolify.yml` | déjà OK (cf. mémoire `[[axionia_cicd_github_actions_coolify]]`) |

### 24.2 Défauts d'autorité — 13 STOP & ASK auto-résolus

| Q# | Question | Réponse autopilote |
|---|---|---|
| Q1 | Budgets mensuels providers | **$200 OpenAI + $100 Anthropic + $80 Perplexity + $0 Unsplash = $380/mois** (révisé v2.0, modifiable admin) |
| Q2 | Modèle text par défaut | **(b) `gpt-4o` primaire, `gpt-4o-mini` pour < 800 mots** |
| Q3 | Embeddings dimension | **(a) `text-embedding-3-small` 512-dim** ($0.02/1M) |
| Q4 | Images V1 | **Unsplash uniquement** (v2.0 — refonte § 8) |
| Q5 | STOP avant gen depuis mots-clés ? | **OUI** — outline + format + word count proposés → l'autopilote ne lance la gen finale qu'après confirmation Will OU après 24h sans réponse (auto-approve outline) |
| Q6 | STOP avant gen pilier ? | **OUI** — outline 8-15 sections → idem Q5 |
| Q7 | Auto-publish RSS-derived tier-2 si score ≥ 60 | **OUI** (publication tier-2 sans review pour RSS uniquement) |
| Q8 | Rôle admin nouveau | **(b) super_admin V1** (pas de nouveau rôle, simpler) |
| Q9 | Cron daily-target auto-pilot V1 | **(a) Activé default off, Will activera plus tard** |
| Q10 | Q/R groupées dans articles (FAQ embed) | **OUI confirmé** (Will avait déjà acté) |
| Q11 | RSS sources V1 (5 sources start) | **LeMondeInformatique, ZDNet FR, Usine Digitale, JournalDuNet, Frenchweb** (modifiable depuis admin) |
| Q12 | Indexing API Google V1 ou V2 | **(a) V1** (révisé v2.4 — Will demande activation immédiate) |
| Q12bis | Clé OpenAI images séparée | **OBSOLÈTE v2.0** (Unsplash uniquement) |
| Q13 | Profil Manon | **REQUIERT INPUT WILL** — pas de défaut acceptable. Si manquant : Claude pose la question et ATTEND la réponse. C'est le SEUL gate humain bloquant. |

Toutes ces valeurs sont **persistées en DB seed** au démarrage Sprint 1 dans `ContentGenConfig` + `ProviderConfig` (cf. § 5.3).

### 24.3 Pipeline d'exécution autopilote

```
┌──────────────────────────────────────────────────────────────────┐
│  PHASE 0 — Reality-check § 2.1                                   │
│  - prisma, BullMQ, regions.ts, villes/data, admin layout ✓        │
│  - 5 clés API présentes ✓                                         │
│  - Manon profile fourni (Q13) ✓                                   │
│  - KB ready OR KB_BYPASS=true ✓                                   │
│  → Si KO sur 1 item → STOP & ASK ciblé (autres en attente)        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  SPRINT 1 — Foundations DB + Providers + Quality + SEO            │
│  Agents en // : AGT-A, AGT-B, AGT-E, AGT-F                        │
│  - Migration add_content_gen_core + seeds                         │
│  - 5 modules providers + router + circuit breaker                 │
│  - 5 modules quality (plagiarism, dedup, seo-score, readability,  │
│    doctrine-check)                                                │
│  - Extension src/lib/seo.ts (9 schemas par type)                  │
│  GATE S1 :                                                         │
│  ✓ pnpm prisma migrate deploy (prod-like)                         │
│  ✓ pnpm typecheck                                                 │
│  ✓ pnpm test:unit src/server/content-gen/                         │
│  ✓ pnpm verify:all                                                │
│  ✓ Test 1 provider en live (1 call OpenAI → 200 OK)               │
│  ✓ Commit : feat(content-gen): foundations DB + providers + ...   │
│  ✓ Push → CI Coolify deploy automatique                           │
│  → Si GATE FAIL → STOP & ASK (montrer erreur, demander Will)      │
│  → Si GATE OK → continue Sprint 2                                 │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  [SPRINTS 2 → 6 idem pattern]
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  SPRINT 6 — Hardening + docs + Pass B audit                       │
│  - 5 agents parallèles audit V1                                   │
│  - Score /200                                                      │
│  GATE FINAL :                                                      │
│  ✓ Score ≥ 160/200                                                │
│  ✓ Toutes les 80+ items checklist EXIT V1 § 22 cochées            │
│  → Si OK → Verdict 🟢 GO PROD                                     │
│  → Si 140-159 → 🟡 NEAR-GO + sprint correctif S6.1                │
│  → Si < 140 → 🔴 NO-GO + diagnostic STOP & ASK                    │
└──────────────────────────────────────────────────────────────────┘
```

### 24.4 Critères d'interruption durci (autopilote STOP)

L'autopilote NE doit JAMAIS continuer si l'un de ces critères se produit :

1. **Gate sprint FAIL** : un sprint ne valide pas tous les checks de § 24.3 → STOP + résumé erreur + question fermée à Will.
2. **Coût mensuel > 80 % cap** pendant l'exécution → STOP + question (continuer / pause / upgrade cap).
3. **3 commits consécutifs failed** sur le même module (hook pre-commit) → STOP.
4. **Provider down depuis > 30 min** → STOP (peut-être incident provider sérieux).
5. **Migration Prisma destructive** détectée (DROP, ALTER avec data loss) → STOP confirm Will.
6. **Modification SSOT** (`pricing.ts`, `regions.ts`, etc.) → STOP confirm Will.
7. **Suppression > 100 LOC** dans un fichier hors content-gen (régression risque) → STOP.
8. **Q13 Manon manquant** au démarrage → STOP unique question Will.

Tout autre événement = continuer en consignant en log `_AUDIT/CONTENT-GEN-V1-CHANGELOG.md`.

### 24.5 Logs et reprise

L'autopilote maintient un fichier de journal : `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` avec :

```markdown
## Sprint 1 — 2026-05-15 09:00 → 2026-05-15 18:42
- AGT-A (DB) : ✅ migration add_content_gen_core appliquée. Hash 7a3f9e2.
- AGT-B (Providers) : ✅ 5 modules + router. Tests : 12 passed.
- AGT-E (Quality) : ✅ 5 modules. Tests : 18 passed.
- AGT-F (SEO) : ✅ src/lib/seo.ts +320 LOC. 9 schemas testés.
- GATE S1 : ✅ PASS. Commit 9c2a1d7 push origin/main. Deploy Coolify ✅.

## Sprint 2 — 2026-05-16 10:00 → ...
```

Si la session Claude est interrompue (timeout, crash, etc.), la prochaine session lit ce log + utilise la phrase d'invocation autopilote § 24.6 → reprend au sprint courant sans re-faire.

### 24.6 Phrase d'invocation autopilote (à coller dans nouvelle session)

```
Skill: content-generator (mode AUTOPILOTE)

Tu es en mode autopilote bout-en-bout. Lis :
1. .claude/skills/content-generator/SKILL.md
2. .claude/skills/content-generator/auto-pilot.md
3. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md (master spec ~30 000 mots)
4. _AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md (data model)
5. _AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md (journal — créer si absent)

Applique les défauts § 24.2 pour les 13 STOP & ASK. Si Q13 Manon manquant
en mémoire utilisateur ou en DB `ContentGenConfig` → STOP unique et demande
à Will (1 message court, attendre 1 message réponse, continuer).

Phase 0 reality-check § 2.1 obligatoire. Si KO sur 1 item → STOP ciblé.

Si autopilote-log montre sprint 1 déjà passé → reprend au sprint suivant.
Sinon démarre Sprint 1.

À chaque sprint :
1. Lance les agents AGT en parallèle selon § 16
2. Aggregate leurs sorties, résous conflits
3. pnpm verify:all + tests + typecheck + lint
4. Si GATE OK : commit Conventional + push origin/main
5. Coolify auto-deploy via .github/workflows/deploy-coolify.yml
6. Met à jour CONTENT-GEN-V1-AUTOPILOT-LOG.md
7. Passe au sprint suivant immédiatement (pas d'attente)

Critères STOP durci § 24.4. Hors ces 8 cas, continuer.

Cible : Sprint 6 verdict 🟢 GO PROD. Score ≥ 160/200.

Doctrine : AxionIA-centric ≥ 95 %, FR-only, auteur = Manon, anti-doorway
HCU, checklist SEO/AEO 60+ items § 9.7, Web Vitals § 9.10, rapidité
génération § 9.11 SLO p50 landing ville ≤ 90 s.

Mode : 🛠️ BUILD + AUTOPILOTE. Pas de demande inutile. Avance.
```

### 24.7 Garde-fous coûts autopilote

Pendant l'autopilote, Claude consomme des tokens (OpenAI + Anthropic) pour générer le code. Budget estimé V1 complet (35 j dev × ~10 sessions session de 2-3 h × ~50 K tokens out) ≈ **$50-150 de coût Claude API** (côté Will, pour cette session-ci). Acceptable.

**Aucune génération de contenu n'est lancée pendant l'autopilote** — l'autopilote BUILD l'outil, il ne le RUN pas. La première vraie génération (1 landing ville test) intervient au Sprint 2 Gate (Lyon ou autre ville confirmée Will). Coût gen = ~$0.50 par contenu test, négligeable.

### 24.8 Réversibilité

À tout moment Will peut :

- Arrêter l'autopilote en envoyant `STOP AUTOPILOTE` dans la conversation → Claude résume état + commit current WIP + log.
- Demander un audit intermédiaire → Claude exécute Pass B mid-stream.
- Modifier les défauts § 24.2 → Claude reprend avec nouvelles valeurs.
- Demander rollback Sprint N → `git revert <commit>` + reprise depuis Sprint N-1.

Le code livré reste **toujours** déployable manuellement même sans le reste de l'outil — chaque commit est complet par lui-même (pas de WIP cassé en main).

---

## 📌 Annexes

### A. Variables d'environnement à ajouter (`src/env.ts`)

```ts
OPENAI_API_KEY: z.string().min(1),
OPENAI_IMAGE_API_KEY: z.string().optional(), // si différent
OPENAI_ORG_ID: z.string().optional(),
ANTHROPIC_API_KEY: z.string().min(1),
PERPLEXITY_API_KEY: z.string().min(1),
UNSPLASH_ACCESS_KEY: z.string().min(1),
UNSPLASH_SECRET_KEY: z.string().optional(),
CONTENT_GEN_ENABLED: z.coerce.boolean().default(true),
CONTENT_GEN_KILL_SWITCH: z.coerce.boolean().default(false),
KB_EMBEDDING_MODEL: z.enum(["text-embedding-3-small","text-embedding-3-large"]).default("text-embedding-3-small"),
KB_PGVECTOR_INDEX_M: z.coerce.number().default(16),
```

### B. Scripts npm à ajouter (`package.json`)

```json
{
  "content-gen:seed":             "tsx prisma/seeds/content-gen/index.ts",
  "content-gen:dryrun":           "tsx scripts/content-gen/dryrun.ts",
  "content-gen:isolation-check":  "tsx scripts/content-gen/isolation-check.ts",
  "content-gen:html-audit":       "tsx scripts/content-gen/html-audit.ts",
  "content-gen:lighthouse":       "tsx scripts/content-gen/lighthouse-budget.ts",
  "content-gen:hreflang-check":   "tsx scripts/content-gen/hreflang-check.ts",
  "content-gen:exit-check":       "tsx scripts/content-gen/exit-check.ts",
  "content-gen:indexnow":         "tsx scripts/content-gen/indexnow-ping.ts",
  "rss:fetch-once":               "tsx scripts/content-gen/rss-fetch-once.ts",
  "posts:validate":               "tsx scripts/content-gen/posts-validate.ts",
  "anti-plagiarism:check":        "tsx scripts/content-gen/anti-plagiarism-check.ts",
  "anti-siren:check":             "existing — réutilisé"
}
```

Description courte de chaque script :

| Script | Rôle | Bloquant ? |
|---|---|---|
| `content-gen:seed` | Seed providers + templates + AuthorProfile Manon + RSS sources + banned phrases | Sprint 1 |
| `content-gen:dryrun` | Génère 1 contenu test sans publier (estime coût + durée) | Sprint 2 |
| `content-gen:isolation-check` | Fail si fichier hors zones autorisées (cf. § 4.1bis 9 dossiers DÉDIÉS) | CI gate |
| `content-gen:html-audit <url>` | Parse HTML rendu et valide la checklist 60+ items § 9.7 | Avant promote tier-1 |
| `content-gen:lighthouse <url>` | Lighthouse local headless + budget gate § 9.10.5 | Avant promote tier-1 |
| `content-gen:hreflang-check` | Vérifie hreflang FR-only + x-default = FR sur 100 % tier-1 | CI gate |
| `content-gen:exit-check` | Parcours automatique de la checklist EXIT V1 § 22, retourne score / 80 items | Sprint 6 GATE FINAL |
| `content-gen:indexnow` | POST IndexNow API pour tier-1 récents (V1 inclus, cf. § 9bis.1) | Cron post-publish |
| `rss:fetch-once <sourceId>` | Force fetch immédiat d'une source RSS (debug) | Manuel |
| `posts:validate` | Validation contenu généré (plagiarism, doctrine, JSON-LD, hreflang FR) | CI gate |
| `anti-plagiarism:check` | Lance shingling Jaccard sur tous tier-1 vs corpus | Cron hebdo |

### C. Decision tree provider routing (text gen)

```
Request: gen text article 1500 mots
│
├── role=text → primary=ProviderConfig where role=text & primary=true
│   → openai_gpt-4o
│
├── openai_gpt-4o.enabled && currentMonthSpent < cap?
│   ├── NO → check fallback claude-sonnet-4-6 → same checks → use it
│   └── YES → continue
│
├── isHealthy(openai_gpt-4o) (cached 60s, /models endpoint ping)
│   ├── NO → fallback claude-sonnet-4-6
│   └── YES → call
│
├── try call (timeout 30s, retry × 3 backoff 10/30/60)
│   ├── success → log cost, return
│   ├── 429 → wait backoff, retry
│   ├── 5xx → fallback claude-sonnet-4-6
│   ├── timeout → fallback claude-sonnet-4-6
│   └── content_filter → re-prompt with system note "rephrase neutrally" → retry
```

### D. Mémoires reliées (auto-memory)

- `[[axionia_project]]` — contexte projet
- `[[axionia_progress]]` — roadmap state
- `[[axionia_pseo_villes_livre_2026-05-08]]` — pSEO villes foundation
- `[[axionia_pseo_industrialisation_decision]]` — décision industrialisation
- `[[axionia_pricing_centralization]]` + `[[axionia_pricing_zero_hardcode_2026-05-08]]` — SSOT pricing
- `[[axionia_typography_v3_2]]` + `[[axionia_hero_schema_v3_2]]` — doctrine visuelle
- `[[axionia_naming_brand_vs_project]]` + `[[axionia_naming_cabinet]]` — naming
- `[[axionia_doctrine_code_ssot]]` — code = SSOT
- `[[axionia_session_2026-05-13_seo_email_stack]]` — email stack récent

### E. Référence externe

Toute la cartographie du content engine SOS-Expat (Laravel) est dans le rapport d'agent du 2026-05-13 (cf. message Claude). À transposer en TS/Prisma/BullMQ pour AxionIA. Les services Laravel `ContentOrchestratorService`, `ArticleGenerationService`, `LandingGenerationService`, `PlagiarismService`, `GenerationGuardService`, `ClaudeService`, `OpenAiService`, `PerplexityService`, `UnsplashService`, `JsonLdService`, `FirestorePublisher` ont des équivalents directs proposés au § 4.1.

---

**FIN — PROMPT-CONTENT-GENERATOR-MASTER-2026.md**

Statut : 🟢 Prêt à exécution. Étape immédiate = répondre aux 12 STOP & ASK du § 20.
