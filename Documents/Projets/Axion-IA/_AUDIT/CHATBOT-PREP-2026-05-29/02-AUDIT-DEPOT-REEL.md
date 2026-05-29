# 02 — Audit du dépôt réel Axion-IA (Phase 2)

> **Objet :** confirmer/infirmer les hypothèses des cahiers v3.0 + addendum v3.1 sur le code réel.
> **Méthode :** 7 sous-agents d'exploration en parallèle. Chaque affirmation est reliée à `fichier:ligne`.
> **Racine :** `C:\Users\willi\Documents\Projets\Axion-IA` — code applicatif dans `axionia/`.
> **Date :** 2026-05-29.

---

## 0. Verdict d'audit en une page

| # | Hypothèse des cahiers | Réalité vérifiée | Référence |
|---|---|---|---|
| H1 | Site/back en **Laravel 12 / Filament** | ❌ **FAUX** — Next.js **16.2.6** App Router, React **19.2.4**, Prisma **5.22**, TypeScript, pnpm | `axionia/package.json:138,146,101` |
| H2 | **pgvector à activer** | ✅ **DÉJÀ ACTIF** — extension `vector`, `KnowledgeEmbedding vector(1024)`, index HNSW cosine | `prisma/migrations/20260514020000_kb_v4_pgvector_embeddings/migration.sql:5,33` |
| H3 | **Couche provider LLM à créer** | ✅ **DÉJÀ LÀ** — `IProvider` + `provider-router` (circuit breaker + fallback) + retry + cost-cap + prompt caching | `src/server/content-gen/providers/IProvider.ts:101`, `provider-router.ts:119` |
| H4 | **Axion CRM Pro** = app Laravel externe | ❌ **N'EXISTE PAS** — CRM interne = `Submission` + `SubmissionReply` + `CalendlyEvent` | `prisma/schema.prisma:621,708,4181` |
| H5 | RDV via **cal.com** | ❌ — **Calendly Embed JS** + modèle `Booking` interne | `src/app/api/calendly/client-event/route.ts:1` |
| H6 | Analytics **GA4 / GTM** | ❌ — **Plausible self-hosted + Clarity** (privacy-first, sans bandeau cookie) | `src/components/analytics/Plausible.tsx`, `src/lib/tracking.ts` |
| H7 | Embeddings + reranking **auto-hébergés** sur Hetzner | ⚠️ **IRRÉALISTE** — VPS = CPX32 (4 vCPU / **8 GB** partagés). API managée recommandée | ADR 0009 |
| H8 | Console **Filament** | ❌ — Admin Next maison mature (RBAC 4 niveaux, 2FA, SSOT nav) | `src/lib/admin-nav.ts:62` |
| H9 | Streaming SSE à concevoir | ✅ **PATTERN EXISTANT** — `ReadableStream` + `text/event-stream` | `src/app/api/content-gen/jobs/[id]/stream/route.ts:60` |
| H10 | FTS hybride à construire | ✅ **FTS FR fonctionnel** (`fr_unaccent`, `websearch_to_tsquery`) — fusion vectorielle prévue mais non câblée | `src/lib/knowledge/search-fts.ts:59` |

**Conséquence directe :** la stack Laravel du v3.0 est entièrement à réconcilier (voir `04-CAHIER-CHATBOT-v4.0.md`). La majeure partie de l'infra exigée par le cahier (provider-agnostic, cost-cap, pgvector, FTS, workers, RGPD, AI Act, anti-abus) **existe déjà** et doit être **réutilisée, pas réinventée**.

---

## 1. Stack, build & déploiement

### 1.1 Versions (`axionia/package.json`)
- Next.js `16.2.6` (`:138`), React `19.2.4` (`:146-147`), `@prisma/client ^5.22.0` (`:101`).
- `@anthropic-ai/sdk ^0.40.1` (`:93`), `openai ^4.104.0` (`:142`).
- `bullmq ^5.76.5` (`:128`), `ioredis ^5.10.1` (`:135`), `next-intl ^4.11.0` (`:140`).
- Node `>=20.18.0` (`:6`), pnpm pinné `10.33.4` (`:10`).
- **Absent :** Vercel AI SDK (`ai`, `@ai-sdk/*`), Hono/Fastify/Express, lib pgvector npm (l'accès vecteur passe par `$queryRaw`).
- Build : `next build --webpack` obligatoire (note `_build_note`, `package.json:31` — bug Turbopack `middleware.nft.json` ENOENT en Next 16).

### 1.2 Contrat `stub.invalid` (ADR 0026)
Build externalisé GitHub Actions → GHCR → Coolify `pull`. Au build, DB/Redis stubés :
- Injecté : `DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub`, `REDIS_URL=redis://stub.invalid:6379`, `SKIP_ENV_VALIDATION=true`, `BULLMQ_DISABLED=true` (`.github/workflows/deploy-coolify.yml:204-213`, `axionia/Dockerfile:87-95`).
- `src/lib/prisma.ts:79` : si `DATABASE_URL` contient `stub.invalid` → Proxy : lectures → `[]/null/0`, mutations → **throw**.
- `src/lib/redis.ts:66` : Proxy no-op pour toutes commandes.
- **Règle pour le chatbot :** toute page/route SSG faisant un appel DB au build doit gérer le stub (early-exit ou fallback). Les API du chatbot étant des route handlers `runtime="nodejs"` dynamiques (pas SSG), elles ne sont **pas** prerendues → impact stub nul à l'exécution. À vérifier uniquement si une page widget est statiquement prerendue.

### 1.3 Pipeline CI/CD (`.github/workflows/deploy-coolify.yml`)
- Job `build` ~25 min : free disk 75 GB → `docker build` → push GHCR (`latest`, `sha-XXX`, `main`).
- Job `deploy` : POST Coolify `/api/v1/deploy` + poll 25 min + entrypoint `prisma migrate deploy`.
- Job `purge` : Cloudflare `purge_everything`.
- Job `lhci` : Lighthouse CI gate **5 URLs prod** (`/fr`, `/fr/interventions`, `/fr/audit`, `/fr/reserver`, `/fr/implantations/ile-de-france/paris`) — `:464-469`.
- `dockerfile_location` Coolify = `/Dockerfile.coolify-pull` (un-liner `FROM ghcr.io/will383842/axion-ia:latest`).

### 1.4 Web Vitals gates
- `lighthouserc.json` : LCP ≤ **1800 ms** ERROR (`:31`), INP ≤ **80 ms** WARN (`:32`), CLS ≤ **0.05** ERROR (`:33`), TBT ≤ **150 ms** (`:34`), FCP ≤ 1500 ms, perf score ≥ 0.9 (`:26`).
- `size-limit` (`package.json:206-251`) : shell partagé 100 KB gz, routes standard **75 KB gz**, `/reserver` 110 KB, `/galerie` 75 KB, `/implantations` 72 KB. Bloque PR à > +5 KB gz vs `main` (`pnpm bundle:check`).
- **Conséquence widget chatbot :** il ne doit **pas** entrer dans le First Load JS des routes. Chargement async/idle, chunk séparé, CLS = 0 (positionnement fixe, jamais de reflow).

### 1.5 Hébergement (ADR 0009)
- **Hetzner Cloud CPX32 : 4 vCPU / 8 GB RAM / 80 GB NVMe** (~6,49 €/mois). (Le CPX42 cité dans les notes était la machine qui saturait au build ; le runtime tourne sur CPX32.)
- Co-locataires RAM runtime : Coolify ~512 MB, Caddy ~50 MB, Next ~1–2 GB, Postgres ~1–2 GB, Redis ~256 MB, workers ~512 MB → **~3–4 GB au repos, 5–6 GB sous charge**.
- Cloudflare Free (CDN, Turnstile, WAF base). Backups Coolify → Backblaze B2.
- **Verdict embeddings/reranking auto-hébergés :** un cross-encoder bge-reranker + un modèle e5/bge-m3 demanderaient plusieurs GB de RAM + CPU soutenu ; **incompatible** avec les 8 GB déjà partagés. → **API managée** (voir ADR doc 03).

### 1.6 Streaming SSE (existant, réutilisable)
`src/app/api/content-gen/jobs/[id]/stream/route.ts` :
- `export const runtime = "nodejs"` (`:18`).
- `new ReadableStream` (`:60`) + headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`.
- Polling DB toutes les 3 s, auto-close à 5 min, `req.signal` abort handler. → **gabarit direct** pour le stream token-par-token du chatbot (en remplaçant le polling par le flux LLM).

---

## 2. Données : Prisma, pgvector, FTS

### 2.1 pgvector — DÉJÀ ACTIF
- `CREATE EXTENSION IF NOT EXISTS vector;` (`migrations/20260514020000_kb_v4_pgvector_embeddings/migration.sql:5`).
- Table `knowledge_embeddings`, colonne `embedding vector(1024)` (1:1 avec `KnowledgeTranslation`), `model VARCHAR(80)` + `model_version` (`:8-18`).
- Index HNSW : `USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)` (`:33-36`).
- Modèle Prisma `KnowledgeEmbedding` (`schema.prisma:2550`), type `Unsupported("vector(1024)")`.
- `Article.embedding Unsupported("vector(1536)")` (OpenAI text-embedding-3-large) (`schema.prisma:1030`).
- **Conséquence :** pas de migration d'activation pgvector à faire. Pattern HNSW + `Unsupported(...)` + accès `$queryRaw` est établi.

### 2.2 FTS FR — fonctionnel
- Config `fr_unaccent` (`migrations_fts/0002_fts_setup.sql:11`), extension `unaccent` au init container.
- Colonnes `search_vector tsvector GENERATED ALWAYS` + index GIN sur `article_translations`, `help_article_translations`, `case_study_translations`, `knowledge_translations`.
- `searchKnowledge()` (`src/lib/knowledge/search-fts.ts:59`) : `websearch_to_tsquery($1::regconfig, $2)`, `ts_rank_cd`, boosts pinned/featured/freshness, filtre `audience`.
- **Recherche hybride (FTS + vecteur) prévue mais NON câblée** (« V1.5 KB-21 RRF »). → c'est exactement ce que le retrieval du chatbot doit implémenter (réutiliser `searchKnowledge` + ajouter le volet cosine).

### 2.3 Inventaire Prisma
- **63 modèles** (`schema.prisma`). Datasource `postgresql`, extensions `citext, pg_trgm, unaccent, uuid-ossp` (`:29-34`). `DATABASE_URL` (pooled) + `DIRECT_URL`.
- Convention : **snake_case via `@@map()`** et `@map()` par champ. Pas de préfixe global, **pas de multi-schema** (single `public`). Index `@@index`, enums étendus par `ALTER TYPE ADD VALUE`.
- Modèles **réutilisables** pour le chatbot :
  - `KnowledgeEntry` / `KnowledgeTranslation` / `KnowledgeEmbedding` / `KnowledgeVersion` (`:2098,2203,2550,2252`) — KB versionnée + embeddings.
  - `Submission` + `SubmissionReply` (`:621,708`) — capture lead + escalade/réponse.
  - `Article` / `ArticleTranslation` (`:954,1108`) — sources RAG secondaires.
  - `ProviderConfig` (`:2894`) + `CostLedger` (`:3341`) — cost-cap réutilisable.
- **À créer :** pas de `Conversation`/`Message`/`Tenant`/`SemanticCache`/`Escalation` chatbot. (Voir schéma proposé en doc 03/05.)
- **Migrations FTS** appliquées manuellement post-`migrate deploy` (`prisma/migrations_fts/*.sql`). Rollback = SQL manuel (cf. `migrations/README-ROLLBACK-IMAGE-BANK.md`). **Zéro drift connu** (dernière migration `20260527000000_add_calendly_location`).

### 2.4 Knowledge existant à amorcer (RAG seed)
- Facts sectoriels en TS (`readonly KbFact[]`) sous `src/server/content-gen/kb/` : `audits.ts`, `un-a-un.ts`, `sites-web-augmentes.ts`, `interventions-formations.ts`, `implementations.ts`, `villes-facts.ts` (~100 villes).
- Schéma `KbFact` : `{ id, text, source, sourceUrl, verifiedAt, verticales[], confidence }`.
- Seedés en DB via `prisma/seeds/content-gen/seed-kb-facts.ts` → `KnowledgeEntry` + `KnowledgeTranslation`.
- Pages services canoniques : `/audit` (+ `/audit/flash`, `/audit/cible`), `/interventions`, `/implementation`, `/un-a-un`, `/sites-web-augmentes` sous `src/app/[locale]/`.
- **Conséquence :** le RAG s'amorce depuis ces actifs (KB facts + KnowledgeEntry + pages services), pas du site entier.

---

## 3. Couche LLM (déjà provider-agnostic)

### 3.1 Abstraction provider
- Interface `IProvider` (`providers/IProvider.ts:101`) : `generate(req): Promise<GenerationResponse>` + `healthCheck()`. `GenerationRequest` (`:16`) porte `role, model?, systemPrompt, userPrompt, stream?, maxTokens?, temperature?, preferredProvider?`. `GenerationResponse` (`:53`) porte `tokensInput/Output, costUsd, durationMs, cacheReadInputTokens?, citations?`.
- `ProviderKey` enum (`schema.prisma:2689`) : `openai, anthropic, perplexity, unsplash, gpt_image`. `ProviderRole` : `text, image, data, stock_image, rerank`.
- `provider-router.ts:119` : dispatch par rôle + `preferredProvider`, **circuit breaker per-provider** (`:34-96`, 5 échecs/30 s → open 60 s), **fallback automatique** sur erreurs retryable (`:156-166`).
- **Le rôle `rerank` existe dans l'enum mais est désactivé (V2)** — placeholder déjà prévu.

### 3.2 Anthropic + prompt caching + cost
- `providers/anthropic.ts` : modèles `claude-sonnet-4-6 / opus-4-7 / haiku-4-5` (`:50-67`), pricing hardcodé/token (`:42-68`), `cache_control: { type: "ephemeral" }` sur le system prompt (`:172-178`), `stream:true`, retry ×3 (`:205`), timeout 60 s.
- `providers/openai.ts` : `gpt-4o / gpt-4o-mini`, streaming + `include_usage`, rôle `text`+`rerank`.
- `providers/perplexity.ts` : `sonar-pro/...`, **citations** extraites (`:188`) — modèle pour le fact-grounding.

### 3.3 Cost-cap & tracking (réutilisable tel quel)
- `lib/cost-tracker.ts` : `assertCostCapAvailable()` (`:182`) — vérifie `currentMonthSpentUsd + estimated ≤ monthlyCapUsd`, warning 80 %, à 100 % → `ProviderError("cost_cap_reached")` + cascade (désactive provider, alerte Telegram, teste fallback, kill-switch global si tous text en cap). `trackCost()` (`:323`) atomique (`CostLedger` + incrément `ProviderConfig` en transaction).
- Seed `ProviderConfig` : openai text $200/mois, anthropic text $100, perplexity $80 (`prisma/seeds/content-gen/provider-config.ts`).
- **Le garde-fou de coût §26 du cahier existe déjà** — à étendre avec un cap dédié au tenant chatbot.

### 3.4 Retry / circuit breaker
- `lib/retry.ts` : `withRetry()` 3 tentatives, délais [10s,30s,60s] + jitter, non-retryable immédiat (`auth/cost_cap/content_filter`).
- Circuit breaker in-memory (V2 = Redis-shared) — pour le multi-instance, prévoir l'état partagé Redis.

### 3.5 Embeddings
- `src/lib/knowledge/embeddings.ts` : `EMBEDDING_MODEL_NAME = "voyage-3-lite"`, dimension **1024** (`:21-23`). **V1 = stub déterministe** (hash SHA-256 → vecteur L2) en attendant la clé Voyage (`:64-78`). Refus dur si `confidentiality ∈ {confidential, secret}` (`:60`). `cosineSimilarity()` (`:93`).
- `src/server/content-gen/dedup/openai-embedder.ts` : `text-embedding-3-large` 1536-dim, gated `OPENAI_EMBEDDINGS_ENABLED`, daily token cap, fail-soft `null`.
- **Pas de reranker câblé** (rôle enum présent, off).

### 3.6 Voix de marque & fact-check (à réutiliser pour le system prompt)
- `src/server/content-gen/brand/brand-voice.ts` : 5 personas (`MANON_CONSULTANTE` défaut, etc.), **mots bannis** (`révolutionner, disruptif, game-changer, magique…`, `:48`), vocabulaire canonique (`IA, RAG…`), helpers `injectBrandVoice()`, `getBrandVoiceForContentType()`.
- `brand-voice-drift-monitor` worker (cosine vs embedding de référence, seuils 0.70/0.80).
- `fact-check/claims-extractor.ts` + `content-fact-check-worker.ts` (Perplexity Sonar, gate quarantine < 50). Orienté articles longs — à adapter pour réponses courtes.

---

## 4. Files BullMQ & workers

- **35 workers** (`src/server/queue/worker.ts:59-108`), **27 queues** (`queues.ts:40-423`).
- Connexion : `getBullConnection()` (`connection.ts:13-40`, ioredis `maxRetriesPerRequest:null, lazyConnect`), distincte du client rate-limit (`src/lib/redis.ts`, `maxRetriesPerRequest:3`).
- Toggle `BULLMQ_DISABLED` (`connection.ts:19`) → tout no-op (build/dev sans Redis).
- defaultJobOptions : `attempts:5, backoff exponential 5000ms, removeOnComplete age 7j, removeOnFail age 30j` (`queues.ts:33-38`).
- **Patron worker** : déclarer queue → `startXxxWorker()` (`new Worker(name, processor, {connection, concurrency, limiter, lockDuration})`) → import+spread dans `worker.ts` → helper `enqueue` (guard `if(!queue) return`) → cron dans `bootRepeatableJobs()` (`queues.ts:516`).
- **Limiter** par worker (ex. image-bank-enrich 10/min aligné quota Claude). → mécanisme token-bucket pour la régulation LLM existe au niveau worker.
- Workers env-gated : spread conditionnel `...(process.env.X === "true" ? [start()] : [])` (`worker.ts:103-107`) — **patron feature-flag d'activation**.

### 4.1 Feature flags & kill-switch (réutilisables)
- KB backend : `src/lib/knowledge/feature-flag.ts` (master `KB_BACKEND_UNIFIED` + per-type). Lecture env `=== "1"|"true"`.
- Config content-gen : table `ContentGenConfig` (key/value JSON), `readContentGenConfig/writeContentGenConfig` (`actions/content-gen/_settings.ts:32`), audit trail append-only.
- Kill-switch content-gen : `actions/content-gen/kill-switch.ts` (DB `ContentGenConfig.kill_switch`), lu par le worker avant chaque job → `throw KillSwitchActiveError` → requeue. Kill-switch KB ingest : env `KB_INGEST_KILL_SWITCH` + `KillSwitchEngagedError(503)` (`src/lib/knowledge/kill-switch.ts`).
- → **Patron exact pour le kill-switch + feature flag du chatbot** (par tenant/par page).

### 4.2 Rate-limiting & anti-abus
- `src/lib/rate-limit.ts` : sliding-window Redis (sorted-set), `checkRateLimit(key, {limit, windowSec})`, **fail-open**.
- `src/server/notifications/rate-limit.ts` : fixed-window horaire.
- `src/lib/turnstile.ts` : `verifyTurnstile(token, ip)` → Cloudflare, fail-soft dev (clés test), fail-closed prod. Utilisé par tous les forms publics.
- → Turnstile + rate-limit du cahier §18 **déjà disponibles**.

---

## 5. Admin existant (à étendre, pas réinventer)

- Structure : `src/app/[locale]/(admin)/[adminPrefix]/` — `[adminPrefix]` validé runtime vs `ADMIN_URL_PREFIX` (`layout.tsx:96-101`), sinon 404. FR-only.
- **36 sections** (Server Actions dans `src/features/admin-*/actions.ts`), navigation SSOT `src/lib/admin-nav.ts:62` (`buildAdminNav(adminPrefix)`, 6 groupes).
- RBAC 4 niveaux : `requireAdminRead / Write / Publish / Delete` (`src/server/actions/knowledge/_guards.ts:20-49`). Enum `AdminRole {super_admin, admin, editor, reader}` (`schema.prisma:243`).
- Auth : `src/auth.ts` (Credentials argon2id + JWT 30j, status cache 60s). **2FA TOTP opt-in par user** (pas d'enforcement rôle, décision Will 2026-05-27, `auth.ts:184-190`).
- Pattern page : Server Component page → Server Action (RBAC + Zod + `activityLog`) → composant client `_v2/`. Scaffolds `AdminPageShell/Header/ListScaffold`.
- noindex : `metadata.robots {index:false}` au layout admin (`layout.tsx:65-67`), propagé à tous les descendants.
- → **La console chatbot = nouvelle section** `(admin)/[adminPrefix]/chatbot/**` + `features/admin-chatbot/` + entrée `admin-nav.ts`. Aucun back-office à réécrire.

---

## 6. Module patron `image-bank`

Gabarit de cloisonnement à imiter (auto-suffisant, 4 couches) :
- **Services** `src/server/image-bank/services/*.service.ts` (logique métier pure), SSOT `constants.ts` / `types.ts` / `taxonomy.ts`.
- **Workers** `src/server/queue/workers/image-bank-*-worker.ts` (enrich, import, translate, crons, auto-convert).
- **Admin** `src/app/[locale]/(admin)/[adminPrefix]/image-bank/**`.
- **Public** `src/app/[locale]/galerie/**`.
- **Composants** `src/components/admin/image-bank/**`.
- **9 tables** Prisma cohérentes, schema raw FTS (`migrations_fts/...image_bank_fts.sql`).
- **Skill** `axionia-image-bank` (conventions documentées).
- → Le module chatbot adoptera **la même découpe** : `src/server/chatbot/**`, workers `chatbot-*-worker.ts`, admin `(admin)/[adminPrefix]/chatbot/**`, widget public, composants, tests, skill.

---

## 7. Intégrations

| Brique | État réel | Référence |
|---|---|---|
| RDV | **Calendly Embed JS** + capture `POST /api/calendly/client-event` (dedup 60s, rate-limit 5/min/IP) → `CalendlyEvent` + Telegram. Page `/appel`. **Pas de cal.com.** | `route.ts:1,40,62`, `schema.prisma:4181` |
| CRM | **Interne** : `Submission` (5 types, 8 statuts, `ipHash`, `turnstileScore`) + `SubmissionReply` (delivery tracking). Will répond via `replyToSubmissionAction`. **Pas de CRM Laravel externe.** | `schema.prisma:621,708`, `features/admin-submissions/reply-actions.ts:55` |
| Email | **Nodemailer SMTP** `localhost:2525` → PowerMTA (prod)/Mailhog (dev), React Email (30+ templates), worker BullMQ `emails` (concurrency 8), RFC 8058. **Pas de Resend.** | `lib/email/client.ts`, `workers/email-worker.ts` |
| Notifications | **Hub typé `notify()`** → Telegram + Sentry breadcrumb. Catégories `CONTACT_FORM_SUBMITTED`, `CALENDLY_INVITEE_CREATED`… | `src/server/notifications/types.ts`, `index.ts` |
| Sentry | **Câblé** (DSN env, traces 2 % prod, PII scrubbing, `captureWorkerError`). | `src/sentry.server.config.ts`, `queue/lib/sentry-worker.ts` |
| Analytics | **Plausible self-hosted + Clarity** — events typés `trackFunnel()`, `detectSearchEngine()` (LLM/SERP buckets), price bucketing. **PAS de GA4/GTM.** | `components/analytics/Plausible.tsx`, `lib/tracking.ts:71,139` |
| Cloudflare/Turnstile | **Turnstile** sur tous forms (`verifyTurnstile`). CDN/WAF côté infra (Caddyfile). | `lib/turnstile.ts:19` |
| RGPD | **Complet** : `/api/gdpr-export` + `/api/gdpr-erase` (token HMAC, rate-limit), `retention-purge-worker` (rétention configurable env), IP SHA-256 salée (`IP_HASH_SALT`). Pages `/mes-donnees`, `/rgpd`. | `api/gdpr-*/route.ts`, `workers/retention-purge-worker.ts`, `lib/security/ip-hash.ts` |
| EU AI Act | **Géré** : `AiContentDisclaimer` (« Contenu IA-assisté… Claude Sonnet 4.6 », art. 50), `provenance-logger` (chaîne SHA-256), hub `/transparence`. | `components/marketing/AiContentDisclaimer.tsx`, `content-gen/provenance/provenance-logger.ts` |

---

## 8. Concurrence & faisabilité « 200 simultanés »

- SSE en Node runtime sur Coolify/Caddy : Node tient des **centaines de connexions ouvertes** (event loop) — la connexion SSE elle-même n'est **pas** le goulot.
- Goulots réels (cf. addendum §2.5) : **limites de débit de l'API LLM**, connexions Postgres, et CPU embedding/retrieval — sur un CPX32 8 GB **partagé** avec Postgres+Redis+Next+workers.
- Mitigations déjà disponibles : cache sémantique (à créer), token-bucket (patron limiter worker), prompt caching (existant), Plausible (léger).
- **Verdict honnête :** 200 *conversations* simultanées avec un fort taux de cache + modèle bon marché + token-bucket est **plausible** ; 200 *générations LLM* réellement concurrentes saturerait le tier LLM et le CPU. À valider par test de charge k6, et possiblement par un **container chatbot dédié** ou un scale vertical. → risque R-CONC (doc 07), STOP & ASK budget scaling (doc 07).

---

## 9. Ce que l'audit n'a pas pu trancher (à vérifier en implémentation)
- Granularité de chunk de `KnowledgeEmbedding` (document-level vs chunk-level) — **à vérifier** : il est 1:1 avec `KnowledgeTranslation`, donc probablement document-level. Le RAG chatbot a besoin de chunks 300–600 tokens → table chunk dédiée recommandée (doc 03).
- Clé API Voyage réelle (le code est en stub) — à fournir.
- Capacité exacte CPU/RAM disponible en pointe sur le CPX32 sous trafic réel — à mesurer.
- Tier LLM payant retenu et ses rate limits — décision business (doc 07).

*Fin de l'audit du dépôt réel.*
