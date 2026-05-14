# Knowledge Base contract for content generator (v2.0 — KB V4 Factory)

> ⚠️ **REFONTE TOTALE 2026-05-14** : la KB **N'EST PLUS** `KbDocument` + `KbChunk` (artefact obsolète du master prompt content-gen pré-v4). La KB réelle CODÉE et MERGÉE sur main = `KnowledgeEntry` + relations (cf. `axionia/prisma/schema.prisma:1823+`).

## État réel de la KB (2026-05-14, post merge `bd0f831`)

**KB-1 à KB-20 V4 Knowledge Factory mergés sur main**. Pas un système séparé à recréer — un système existant à consommer ET alimenter.

### Modèles Prisma RÉELS (axionia/prisma/schema.prisma)

| Modèle | Rôle |
|---|---|
| `KnowledgeEntry` | Entrée KB polymorphique (28 types via `KbType`) |
| `KnowledgeTranslation` | Contenu multilingue + embedding pgvector |
| `KnowledgeVersion` | Historique versions immuables |
| `KnowledgeTag` + `KnowledgeTagOnEntry` | Taxonomie tags |
| `KnowledgeRelation` | Liens entre entrées (from/to) |
| `KnowledgeFeedback` | Helpful up/down + commentaires |
| `KnowledgeBookmark` | Favoris user |
| `KnowledgeAnnotation` + `KnowledgeCollectionItem` | Sprint KB-18 annotations |
| `KnowledgeReviewerAssignment` | Assignations review |
| `KnowledgeSlugHistory` | Sprint KB-12 redirects |
| `KnowledgeAsset` | Images cover + assets uploadés |

### Enums RÉELS (CORRIGÉS Sprint S0ter — lus depuis schema.prisma:480-610)

- **`KbType`** (28 types) :
  - 16 legacy : `article`, `case_study`, `help_article`, `faq`, `glossary_term`, `guide`, `methodology`, `doctrine`, `adr`, `prompt_template`, `sop`, `post_mortem`, `tool_card`, `competitor_card`, `commercial_doc`, `onboarding_step`
  - 12 V4 factory : `automation_recipe`, `tool_review`, `industry_use_case`, `comparison`, `implementation_playbook`, `prompt_pattern`, `roi_calculator_template`, `intervention_module`, `competence_boost`, `secteur_brief`, `dept_brief`, `metier_brief`
- **`KbDomain`** (10) : `commercial`, `technical`, `legal`, `hr`, `product`, `client`, `watch`, `internal`, `editorial`, `methodology`
- **`KbAudience`** (4) : `public`, `client`, `team`, `will_only`
- **`KbConfidentiality`** (4) : `public`, `internal`, `confidential`, `secret`
- **`KbStatus`** (7) : `draft`, `review`, `approved`, `scheduled`, `published`, `archived`, `deprecated`
- **`KbPipelineStage`** (9) : `idea`, `brief`, `draft`, `review`, `approved`, `scheduled`, `published`, `archived`, `deprecated`
- **`KbRelationKind`** (7) : `replaces`, `cites`, `depends_on`, `related_to`, `supersedes`, `contradicts`, `extends`
- **`KbFeedbackVote`** (2) : `up`, `down`
- **`KbImportSource`** (6) : `audit_md`, `markdown_git`, `notion`, `csv`, `legacy_db`, `legacy_source`
- **`KbImportStatus`** (5) : `pending`, `running`, `succeeded`, `failed`, `partial`
- **`KbReviewerAssignmentStatus`** (4) : statuts assignation reviewer

→ **Mes hypothèses initiales étaient fausses** sur `KbAudience` (j'avais mis `partner/system`) et `KbConfidentiality` (j'avais mis `partner_nda/public_after_review`). **Toujours se référer au schema.prisma:480+ source de vérité.**

### Embeddings — Voyage AI dim 1024 (CORRIGÉ Sprint S0ter)

Migration `kb_v4_pgvector_embeddings` ACTIVÉE. Schema réel :
- **Table dédiée** `KnowledgeEmbedding` (pas inline dans `KnowledgeTranslation` comme initialement supposé)
- **Modèle** : Voyage AI `voyage-3-lite` (PAS OpenAI text-embedding-3-small)
- **Dimension** : 1024 (PAS 512)
- **Index** : HNSW pgvector créé via SQL raw migration
- Helper exposé : `generateEmbedding()` dans `@/lib/knowledge/embeddings`
- Constants : `EMBEDDING_MODEL_NAME = "voyage-3-lite"`, `EMBEDDING_DIMENSION = 1024`

**NE PAS recréer**. Le content-gen utilise `generateEmbedding(text)` pour embed ses queries.

## Comment le content-generator INTERAGIT avec la KB V4

### A. Lecture (RAG) — `kb-client.ts` retrieve

2 modes : helper direct (recommandé même process) ou endpoint REST.

**Mode 1 : helper direct (même process server)** — recommandé pour Sprint 1 :

```ts
// axionia/src/server/content-gen/kb-client.ts (Sprint 1 Day 2)
import { searchKnowledge } from "@/lib/knowledge/search-fts";
import { generateEmbedding } from "@/lib/knowledge/embeddings";
import { prisma } from "@/lib/prisma";
import type { KbType, KbDomain, KbAudience } from "@/prisma/generated/client";

export type KbRetrieveOptions = {
  query: string;
  locale: "fr" | "en";       // V1 = "fr" only
  k?: number;                 // default 8
  filters?: {
    types?: KbType[];
    domains?: KbDomain[];
    audiences?: KbAudience[]; // default ['public']
    tagSlugs?: string[];
  };
  mode?: "fts" | "vector" | "hybrid"; // default "hybrid"
};

export async function retrieve(opts: KbRetrieveOptions) {
  if (opts.mode === "fts") {
    return searchKnowledge({
      query: opts.query,
      locale: opts.locale,
      types: opts.filters?.types,
      audiences: opts.filters?.audiences ?? ["public"],
      limit: opts.k ?? 8,
      offset: 0,
    });
  }
  // mode "vector" ou "hybrid" : embed query Voyage AI dim 1024 + cosine pgvector
  const queryEmbedding = await generateEmbedding(opts.query);
  // RAW SQL pgvector cosine join KnowledgeEmbedding (dim 1024)
  // Implémentation finale Sprint 1 Day 2 (cf. § 11 master prompt v2.5)
  return [];
}
```

**Mode 2 : endpoint REST** — pour cross-process / debug :

```http
GET /api/internal/kb/search?q=audit+IA+Lyon&locale=fr&type=industry_use_case&limit=12
```
audience filtrée à `["public"]` côté endpoint par défaut.

### B. Écriture (Factory feed) — content-generator ALIMENTE la KB via API HMAC

**Pattern obligatoire (Sprint KB-13 V4 codé)** : `POST /api/internal/kb/ingest` avec HMAC + idempotency-key. **PAS `prisma.knowledgeEntry.create()` direct** — la KB applique 4 gates autoritaires (PII, banned, quality, dedup ≥ 0.92).

```ts
// axionia/src/server/content-gen/kb-feeder.ts (Sprint 5)
import { sign } from "@/lib/knowledge/hmac";
import { randomUUID } from "node:crypto";
import { env } from "@/env";

export async function publishToKB(job: ContentGenJob, content: GeneratedContent) {
  if (content.indexationTier !== "tier_1_indexable") return { accepted: false, status: "skipped" };

  const payload = {
    type: mapContentTypeToKbType(job.contentType),   // ex: "industry_use_case"
    title: content.title,                            // 10-200 chars
    body: content.bodyHtml,                          // Tiptap HTML
    bodyJson: content.bodyTiptapJson,                // Tiptap JSON
    bodyText: content.bodyPlainText,                 // plain text
    excerpt: content.metaDescription?.slice(0, 280), // 40-300 chars
    tags: content.tagSlugs.slice(0, 10),             // max 10
    domain: inferDomain(content),                    // KbDomain
    audience: "public",
    confidentiality: "public",
    language: "fr",
    source: {
      factoryId: "content-gen-v1",
      promptId: job.templateSlug,
      modelUsed: job.primaryProvider,                // ex: "openai-gpt-4o"
      cost: Math.round(job.totalCostUsd * 100),      // USD cents
      generatedAt: job.completedAt.toISOString(),
    },
  };

  const rawBody = JSON.stringify(payload);
  const signature = sign(rawBody, env.KB_INGEST_SECRET);
  const idempotencyKey = randomUUID();

  const res = await fetch(`${env.NEXT_PUBLIC_SITE_URL}/api/internal/kb/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-KB-Signature": signature,
      "X-Idempotency-Key": idempotencyKey,
    },
    body: rawBody,
  });

  if (res.status === 202) {
    const data = await res.json();
    return { accepted: true, entryId: data.entryId, status: data.status };
  }
  // 422 = quality/PII/banned/dedup gate failed (KB autoritaire)
  return { accepted: false, status: (await res.json()).status };
}
```

**Gates appliqués côté KB (le content-gen ne duplique pas)** :
1. PII scan bloquant — `detectPii()`
2. Banned words bloquant — `checkTranslationBannedWords()`
3. Heuristic quality gates bloquant — `runHeuristicGates()`
4. Dedup pgvector cosine ≥ 0.92 bloquant (warning 0.85-0.92)

**`KB_AUTO_PUBLISH=true`** (env var) requis pour publication immédiate sans review. Default OFF V1 → `audience='team'` (review manuel admin).

### C. Mapping `ContentType` → `KbType`

| ContentType (content-gen) | KbType (KB) |
|---|---|
| `landing_ville` | `industry_use_case` |
| `blog_article` | `article` |
| `blog_from_rss` | `news_brief` |
| `comparison` | `comparison` (V4) |
| `guide_pilier` | `implementation_playbook` (V4) |
| `faq_standalone` | `faq` |
| `qa_derived` | `faq` |

## Forbidden operations from content-gen code (CORRIGÉ Sprint S0ter)

- ❌ **Ne JAMAIS créer/migrer tables `KbDocument` ou `KbChunk`** — elles N'EXISTENT PAS dans la KB V4. Si présentes dans une migration content-gen, c'est un BUG.
- ❌ **`prisma.knowledgeEntry.create/update/delete()` direct** depuis content-gen → utiliser API HMAC `POST /api/internal/kb/ingest` (Sprint KB-13)
- ❌ Réécrire les modèles `Knowledge*` — ils sont mergés et stables (KB-1→KB-20).
- ❌ Bypass HMAC ou idempotency-key sur ingest API
- ❌ Embedding via OpenAI/Cohere/autre → la KB utilise **Voyage AI `voyage-3-lite` dim 1024** exclusivement
- ❌ Duplication PII/banned/quality/dedup gates côté content-gen → **la KB est autoritaire** (réponse 422 = rejet définitif)

## Hard gate avant toute génération

```ts
// axionia/src/server/content-gen/kb-health.ts (Sprint 1 Day 1)
import { prisma } from "@/lib/prisma";

export async function getKbHealth() {
  const publishedTotal = await prisma.knowledgeEntry.count({
    where: { status: "published", deletedAt: null },
  });
  const publicPublished = await prisma.knowledgeEntry.count({
    where: { status: "published", audience: "public", deletedAt: null },
  });
  const canonicalRatio = publishedTotal > 0 ? publicPublished / publishedTotal : 0;
  return {
    publishedTotal,
    publicPublished,
    canonicalRatio,
    healthy: publishedTotal >= 50 && canonicalRatio >= 0.6,
  };
}

// Hard gate :
const health = await getKbHealth();
if (!health.healthy) {
  throw new ContentGenError("KB_NOT_READY", `${health.publishedTotal} entries / canonical ${(health.canonicalRatio*100).toFixed(0)}%`);
}
```

V4 cible 100 entrées/jour publiées. Au démarrage Sprint 1, KB-1→KB-20 ont seedé un corpus initial.

## Bypass mode pour développement

`KB_BYPASS=true` désactive le hard gate. Fallback SSOT TS (`pricing.ts`, `regions.ts`, `interventions.ts`, `villes/*`). Banner rouge admin `KB MODE DEGRADE`. **Jamais en prod.**

## Sub-folders content-gen côté KB (Sprint 1)

- `axionia/src/server/content-gen/kb-client.ts` — RETRIEVE only
- `axionia/src/server/content-gen/kb-feeder.ts` — WRITE only (Sprint 5)
- `axionia/src/server/content-gen/kb-health.ts` — monitoring
- `tests/content-gen/kb-client.spec.ts` — assert no mutation methods
- `tests/content-gen/kb-feeder.spec.ts` — assert respect Manon authorId + sourceFactoryId

## Traceability

`ContentGenJob.targetKnowledgeEntryId: string?` après publication. Si Google pénalise un contenu, on remonte à `KnowledgeEntry.sourceFactoryId` + `sourcePromptId` pour audit immuable.

## Modules KB exposés (helpers utilisables par content-gen)

| Helper | Module | Usage content-gen |
|---|---|---|
| `searchKnowledge()` | `@/lib/knowledge/search-fts` | Retrieve FTS Postgres tsvector + trigram |
| `generateEmbedding()` | `@/lib/knowledge/embeddings` | Embed query Voyage AI dim 1024 |
| `EMBEDDING_MODEL_NAME` / `EMBEDDING_DIMENSION` | `@/lib/knowledge/embeddings` | Constants `voyage-3-lite` / 1024 |
| `sign()` / `verifyKbSignature()` | `@/lib/knowledge/hmac` | HMAC-SHA256 pour ingest API |
| `assertKillSwitchInactive()` | `@/lib/knowledge/kill-switch` | Kill switch global KB V4 |
| `detectPii()` | `@/lib/knowledge/pii-scan` | (optional pre-check côté content-gen) |
| `KB_TYPES` / `KB_DOMAINS` / `KB_AUDIENCES` / `KB_CONFIDENTIALITIES` | `@/content/knowledge/*` | Constantes runtime (Zod enum sources) |

Server actions exposées (29 actions dans `@/server/actions/knowledge/`) — **réservées au skill `axionia-connaissances`**, ne PAS appeler depuis content-gen sauf cas exceptionnel.

API endpoints :
- `POST /api/internal/kb/ingest` — HMAC + idempotency (Sprint KB-13)
- `GET /api/internal/kb/search` — public audience-filtered

## Coordination skill jumeau `axionia-connaissances`

| Domaine | `axionia-connaissances` (KB) | `axionia-content-generator` (CE skill) |
|---|---|---|
| Admin `/connaissances/` UI | ✅ | ❌ |
| Ingestion API HMAC | ✅ | consomme |
| Auto-SEO/AEO LLM cached | ✅ (post-publish) | génère le contenu source |
| Annotations + collections | ✅ | ❌ |
| RGPD export + retention | ✅ | ❌ |
| Modèles `Knowledge*` | ✅ propriétaire | lecteur + feeder |
| Pipelines génération | ❌ | ✅ |
| Cockpit géo France | ❌ | ✅ |
| Anti-doublon 4 couches | ❌ | ✅ |
| Manon persona | ❌ | ✅ |
| Web Vitals gate | ❌ | ✅ |

**Frontière nette** : content-gen produit, KB stocke. Pas de logique métier KB dans content-gen.
