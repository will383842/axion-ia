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

### Enums clés

- **`KbType`** (28 types V4) : `article`, `faq`, `case_study`, `help_article`, `glossary`, `template`, `playbook`, `policy`, `decision_record`, `runbook`, `tutorial`, `news_brief`, `interview`, `roadmap_item`, `definition`, `regulation_brief`, + **12 V4 factory** : `automation_recipe`, `tool_review`, `industry_use_case`, `comparison`, `implementation_playbook`, `prompt_pattern`, `roi_calculator_template`, `intervention_module`, `competence_boost`, `secteur_brief`, `dept_brief`, `metier_brief`
- `KbDomain`, `KbAudience` (`team`/`customer`/`public`/`partner`/`system`)
- `KbConfidentiality`, `KbStatus`, `KbPipelineStage`

### Embeddings pgvector

Migration `kb_v4_pgvector_embeddings` ACTIVÉE. Extension pgvector + colonne `embedding` sur `KnowledgeTranslation` + index `ivfflat`/`hnsw` pour cosine retrieve. **NE PAS recréer**.

## Comment le content-generator INTERAGIT avec la KB V4

### A. Lecture (RAG) — `kb-client.ts` retrieve

```ts
// axionia/src/server/content-gen/kb-client.ts (à coder Sprint 1)
export async function retrieve(opts: {
  query: string;
  language: "fr" | "en";
  k?: number;
  filters?: {
    type?: KbType[];
    domain?: KbDomain[];
    audience?: KbAudience[];
    locationTags?: string[];
  };
}): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(opts.query);

  const results = await prisma.$queryRaw`
    SELECT
      ke.id, kt.title, kt.body_markdown, ke.type,
      1 - (kt.embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM knowledge_translations kt
    JOIN knowledge_entries ke ON ke.id = kt.entry_id
    WHERE ke.status = 'published'
      AND kt.locale = ${opts.language}
      AND ke.deleted_at IS NULL
    ORDER BY similarity DESC
    LIMIT ${opts.k ?? 12};
  `;

  return rerank(opts.query, results);
}
```

### B. Écriture (Factory feed) — content-generator ALIMENTE la KB

C'est le pivot V4 majeur : chaque contenu généré tier-1 devient une `KnowledgeEntry`.

```ts
// axionia/src/server/content-gen/kb-feeder.ts (à coder Sprint 5)
export async function publishToKB(job: ContentGenJob, content: GeneratedContent) {
  if (content.indexationTier !== "tier_1_indexable") return;

  await prisma.knowledgeEntry.create({
    data: {
      type: mapContentTypeToKbType(job.contentType),
      domain: inferDomain(content),
      audience: "public",
      confidentiality: "public",
      status: "published",
      pipelineStage: "published",
      slug: content.slug,
      assignedAuthorId: MANON_AUTHOR_ID,
      publishedAt: new Date(),
      // V4 source tracking (immuable, audit trail)
      sourceFactoryId: "content-gen-v1",
      sourcePromptId: job.templateSlug,
      sourceModelUsed: job.primaryProvider,
      sourceCostCents: job.totalCostCents,
      sourceGeneratedAt: job.completedAt,
      translations: {
        create: [{
          locale: "fr",
          title: content.title,
          bodyMarkdown: content.bodyMarkdown,
          metaDescription: content.metaDescription,
          embedding: content.embedding,
        }],
      },
      tags: { create: content.tags.map(slug => ({ tag: { connect: { slug } } })) },
    },
  });
}
```

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

## Forbidden operations from content-gen code

- ❌ **Ne JAMAIS créer/migrer tables `KbDocument` ou `KbChunk`** — elles N'EXISTENT PAS dans la KB V4. Si présentes dans une migration content-gen, c'est un BUG.
- ❌ `prisma.knowledgeEntry.delete()` côté content-gen — RGPD via skill `axionia-connaissances`.
- ❌ Réécrire les modèles `Knowledge*` — ils sont mergés et stables.
- ❌ Bypass `pii-redaction.ts` avant publication tier-1.

## Hard gate avant toute génération

```ts
const health = await getKbHealth();
if (health.publishedEntries < 50 || health.canonicalRatio < 0.6) {
  throw new ContentGenError("KB_NOT_READY", `Only ${health.publishedEntries} entries published`);
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
