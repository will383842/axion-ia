# 10 — IA AUGMENTATION — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` (Agent 10 — IA augmentation, ~ligne 314)
> Agent : 10 — IA augmentation
> Date : 2026-05-13
> Statut : DRAFT (Phase A — AUDIT-ONLY, aucun code produit)
> Référence : HEAD `main` (commit `95bba36`), seed reality check `00-REALITY-CHECK.md`
> Doctrine appliquée : skill `claude-api` (**prompt caching obligatoire** sur tout call Anthropic) + `axionia_hosting_hetzner` (CPX32 €6,49/mois — pas de SaaS payant cher) + `axionia_doctrine_code_ssot` + AGENTS.md (Web Vitals stricts, First Load JS ≤ 75 KB gz)

---

> ## ⚠️ SCOPE — V1.5+ EXCLUSIVEMENT
>
> **TOUT ce qui est décrit dans ce document est V1.5+ (post-V1 production).**
>
> En V1 :
>
> - `pgvector` extension **n'est pas** installée (cf. `00-REALITY-CHECK.md` §1.3).
> - Aucun endpoint RAG.
> - Aucun appel embeddings tiers.
> - Aucun bouton "générer brouillon" ou "traduire" en admin.
> - Recherche = **FTS Postgres only** (cf. Agent 5 `05-SEARCH-DISCOVERY.md`).
>
> Ce document définit l'architecture cible **après** GA V1 stable, dans un sprint dédié (proposition : Sprint **KB-21** "AI augmentation V1.5", isolé derrière feature flag `kb.ai.enabled` dans `Setting`). La migration `CREATE EXTENSION vector` est la première étape de KB-21, avec ADR dédié `docs/adr/0022-knowledge-base-pgvector-v1.5.md`.

---

## 0. TL;DR

| Question                        | Recommandation Phase A                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider embeddings             | **Voyage AI `voyage-3-lite`** (1024 dims, $0.02/1M tokens entrants) en primaire — meilleur rapport coût/qualité 2026. Fallback OpenAI `text-embedding-3-small` (1536 dims). Anthropic ne propose pas d'API embeddings native, mais **recommande explicitement Voyage AI** dans la doc officielle Claude Cookbook. |
| Index pgvector                  | **HNSW** (`m=16`, `ef_construction=64`) — meilleur recall sur volumétrie cible (1k → 100k).                                                                                                                                                                                                                       |
| LLM RAG synthèse                | **Claude Haiku 4.5** + prompt caching agressif (system + top-K cached, query non-cachée).                                                                                                                                                                                                                         |
| LLM auto-rédaction / traduction | **Claude Sonnet 4.7** (qualité requise pour FR éditorial cabinet IA) — caching tags/style guide.                                                                                                                                                                                                                  |
| Coût mensuel estimé             | **1k entrées : ~0,01 € — 10k entrées : ~0,10 € — 100k entrées : ~1 €** (embeddings only, 1 réindex/mois). RAG runtime ~5-15 €/mois selon trafic.                                                                                                                                                                  |
| Latence RAG p95 cible           | **< 800 ms** (retrieve hybrid 200 ms + LLM cached 500 ms + marge 100 ms).                                                                                                                                                                                                                                         |
| Anti-pattern critique           | Refus dur si `confidentiality IN ('confidential', 'secret')` — **test bloquant Vitest obligatoire** avant tout call sortant.                                                                                                                                                                                      |

**Verdict Phase A** : architecture validée, à implémenter en Sprint KB-21 derrière feature flag, après audit RGPD-DPO complet (Voyage AI = sous-processeur US, **STOP & ASK Will** sur clause DPA).

---

## 1. EMBEDDINGS — MODÈLE & STORAGE

### 1.1 Provider primaire : Voyage AI

**Modèle retenu Phase A : `voyage-3-lite`**.

| Critère            | `voyage-3-lite`               | `text-embedding-3-small` (OpenAI) | `voyage-3-large`  |
| ------------------ | ----------------------------- | --------------------------------- | ----------------- |
| Dimensions         | 1024                          | 1536                              | 1024              |
| Coût input         | $0.02 / 1M tokens             | $0.02 / 1M tokens                 | $0.18 / 1M tokens |
| MTEB FR            | ~62                           | ~58                               | ~66               |
| Context window     | 32k tokens                    | 8k tokens                         | 32k tokens        |
| Région             | US-only                       | US-multi                          | US-only           |
| Doctrine Anthropic | **Recommandé officiellement** | Compatible                        | Recommandé        |

**Justification** :

- Coût égal à OpenAI mais meilleur recall FR (cible cabinet IA francophone).
- Recommandation officielle Anthropic (skill `claude-api` cohérent).
- Context 32k = OK pour ingérer entrées KB longues sans chunking agressif.

**Fallback** : OpenAI `text-embedding-3-small` si Voyage indisponible (5xx > 1%/h) — bascule via flag `Setting('kb.ai.embeddings.provider', 'voyage'|'openai')`.

**Pas retenu** :

- Embeddings auto-hébergés (BGE-M3, etc.) → RAM CPX32 8 GB partagée avec Coolify, Next, Postgres, Redis = trop juste. Latence GPU-less = > 2s sur lot 100. Doctrine `axionia_hosting_hetzner` respectée (€0 supplémentaire CPU = OK, mais perf-killer).
- Anthropic API embeddings → **n'existe pas** au 2026-05 (vérifié : aucune route `/v1/embeddings` documentée chez Anthropic ; ils délèguent à Voyage).

### 1.2 Storage Postgres — pgvector HNSW

Migration V1.5 (Sprint KB-21) :

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_translations
  ADD COLUMN embedding vector(1024),
  ADD COLUMN embedding_model varchar(64),
  ADD COLUMN embedding_at timestamptz;

CREATE INDEX knowledge_translations_embedding_hnsw
  ON knowledge_translations
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Pourquoi HNSW et pas IVFFlat** :

- HNSW : meilleur recall (~95-98%) sans tuning de `nlist`/`nprobe`, idéal volumétries 1k-100k.
- IVFFlat : moins de mémoire mais nécessite réindex `REINDEX` à chaque ×10 de volume. Sur CPX32 RAM contrainte, le risque de réindex pendant un pic trafic = écarté.
- Sources : pgvector README 2025 + benchmark Supabase 2024 (HNSW gagne dès 10k vecteurs).

**Coût RAM HNSW** :

- 1k entrées × 1024 dims × 4 octets × ~1.5 overhead HNSW ≈ **6 MB**
- 10k entrées ≈ **60 MB**
- 100k entrées ≈ **600 MB** ← cible long-terme, encore OK sur CPX32 8 GB (Postgres allouera ≤ 2 GB total).

Recall optionnel à query-time : `SET hnsw.ef_search = 100;` (default 40, monter à 100 pour top-K=8 sans coût significatif).

### 1.3 Chunking strategy

**1 entrée KB = 1 embedding** (pas de chunking V1.5).

Justification :

- `voyage-3-lite` accepte 32k tokens = couvre 99 % des entrées (un guide long = 8-10k tokens max).
- Chunking introduit duplication, problème de re-ranking par entrée, et complexité de citation (quel chunk citer ?).
- V2+ : chunking activable si entrées > 32k tokens (très rare). Schema prêt via `KnowledgeChunk` table additive (ne pas créer V1.5).

Stockage : `knowledge_translations.embedding` (1 row par locale).

### 1.4 Refus dur confidentialité

**Test bloquant Vitest** (`tests/embeddings/refusal-confidential.test.ts`) :

```ts
describe("embeddings provider", () => {
  it("throws if entry has confidentiality IN (confidential, secret)", async () => {
    const entry = { confidentiality: "confidential", body: "..." };
    await expect(embedEntry(entry)).rejects.toThrow(/confidential|secret/i);
    // jamais d'appel réseau émis
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

Implémentation dans `src/server/ai/embeddings.ts` (à créer KB-21) :

```ts
const FORBIDDEN_CONFIDENTIALITY = ["confidential", "secret"] as const;

export async function embedEntry(entry: KnowledgeEntry) {
  if (FORBIDDEN_CONFIDENTIALITY.includes(entry.confidentiality as any)) {
    throw new ConfidentialityViolationError(
      `Cannot embed entry ${entry.id}: confidentiality=${entry.confidentiality}`,
    );
  }
  // ... appel Voyage
}
```

**Garde-fou secondaire** : check côté `kb-reindex.worker.ts` (BullMQ) avant enqueue. Double check = défense en profondeur.

### 1.5 Batch size & throttling

- **Batch size** : **100 entrées / batch** (Voyage AI limite payload ~4 MB, 100 entrées × ~40 KB texte = OK).
- **Throttle full reindex** : **1 req/sec** (= 100 entrées/sec = 360 000 entrées/h théorique, largement au-dessus du besoin).
- **Rate limit Voyage AI** : 2000 req/min plan free, on reste très en-dessous.
- **Pattern** : BullMQ job `kb-reindex-embeddings` avec `limiter: { max: 1, duration: 1000 }`.

### 1.6 Coût mensuel chiffré

**Hypothèses** :

- Texte moyen par entrée : 5 KB = ~1250 tokens (FR + EN doublé = 2500 tokens/entrée).
- 1 réindex complet/mois (sur edit publish).
- Edits incrémentaux : ~10 % du corpus/mois additionnel.
- Voyage `voyage-3-lite` : $0.02 / 1M tokens = ~0.018 € / 1M tokens (USD→EUR 2026).

| Volumétrie          | Tokens/réindex | Réindex incrémental (10%) | Total tokens/mois | Coût mensuel (€) |
| ------------------- | -------------- | ------------------------- | ----------------- | ---------------- |
| **1 000 entrées**   | 2.5 M          | 0.25 M                    | 2.75 M            | **~0,05 €**      |
| **10 000 entrées**  | 25 M           | 2.5 M                     | 27.5 M            | **~0,50 €**      |
| **100 000 entrées** | 250 M          | 25 M                      | 275 M             | **~5 €**         |

**Verdict coût** : négligeable, **largement sous le seuil de SaaS payant** (doctrine `axionia_hosting_hetzner`).

**Plafond mensuel** : `Setting('kb.ai.embeddings.budget_eur_month', 20)` — alerte Sentry + arrêt worker si dépassement.

---

## 2. RAG ENDPOINT — `/api/internal/kb/rag`

### 2.1 Signature

```ts
POST /api/internal/kb/rag

// Request
{
  query: string;            // requis, 3-500 chars
  locale: 'fr' | 'en';      // requis
  top_k?: number;           // default 8, max 20
  filters?: {
    type?: KnowledgeType[];           // ex: ['article', 'faq']
    domain?: KnowledgeDomain[];       // ex: ['ia-ops']
    audience?: 'public' | 'client';   // default 'public'
                                       // 'team' interdit via endpoint externe
  };
  hmac: string;             // signature HMAC obligatoire (cf. §2.6)
}

// Response 200
{
  answer: string;                    // synthèse LLM 200-500 mots
  citations: Array<{
    entryId: string;
    slug: string;
    title: string;
    score: number;                   // RRF combiné FTS+cosine, normalisé 0-1
    excerpt: string;                 // 200 chars autour du match
    url: string;                     // URL publique canonique
  }>;
  latencyMs: number;
  cacheHit: 'full' | 'partial' | 'miss';
  tokensUsed: { prompt: number; completion: number; cached: number };
}

// Response 4xx / 5xx
{ error: { code: string; message: string; correlationId: string } }
```

**Garde-fous au niveau handler** :

- `audience='team'` ou `audience='internal'` → **400 Bad Request** (jamais leak).
- `confidentiality IN ('confidential', 'secret')` filtré côté retrieve (WHERE NOT IN).
- `query` passé via `pii-redaction.ts` (mémoire `axionia_session_2026-05-09_sprint_24_1`) — log redacté Sentry.
- Rate limit `src/lib/rate-limit.ts` : 60 req/min/IP via Redis bucket.

### 2.2 Pipeline (3 hops)

```
[1] retrieve hybrid           ~150-200 ms
    ├─ FTS Postgres (k1=60)   ts_rank_cd(search_vector, query)
    └─ cosine pgvector (k2=60) embedding <=> query_embedding
    → RRF fusion (constant=60, formule Cormack 2009)
    → top-K=8 final

[2] context build              ~10 ms
    ├─ fetch full bodyText des 8 entrées
    └─ build prompt cached system + cached corpus + user query

[3] LLM synthèse                ~400-600 ms (cached)
    Claude Haiku 4.5 + prompt caching
    → answer + injecter citations [^1]..[^8]

Total p95 cible : < 800 ms
```

### 2.3 Hybrid search RRF

**Formule RRF** (Reciprocal Rank Fusion) :

```
score_rrf(doc) = Σ_retriever  1 / (k + rank_retriever(doc))

avec k = 60 (constante standard Cormack 2009).
```

Implémentation SQL one-shot :

```sql
WITH fts AS (
  SELECT id, ts_rank_cd(search_vector, q) AS s, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(search_vector, q) DESC) AS r
  FROM knowledge_translations, plainto_tsquery('fr_unaccent', $1) q
  WHERE search_vector @@ q
    AND audience IN ($2)
    AND confidentiality NOT IN ('confidential', 'secret')
  LIMIT 60
),
vec AS (
  SELECT id, 1 - (embedding <=> $3) AS s, ROW_NUMBER() OVER (ORDER BY embedding <=> $3 ASC) AS r
  FROM knowledge_translations
  WHERE embedding IS NOT NULL
    AND audience IN ($2)
    AND confidentiality NOT IN ('confidential', 'secret')
  LIMIT 60
),
fusion AS (
  SELECT COALESCE(fts.id, vec.id) AS id,
         COALESCE(1.0/(60 + fts.r), 0) + COALESCE(1.0/(60 + vec.r), 0) AS rrf_score
  FROM fts FULL OUTER JOIN vec USING (id)
)
SELECT id, rrf_score
FROM fusion
ORDER BY rrf_score DESC
LIMIT 8;
```

**Pourquoi RRF et pas weighted-sum** :

- Pas de tuning de poids `α/β` (FTS et cosine sur des échelles différentes).
- Robuste : si un retriever échoue (vector index froid post-restart), l'autre prend le relais.

### 2.4 Reranking optionnel V2

Voyage AI propose un reranker (`rerank-2`, $0.05 / 1M tokens). Améliore nDCG@5 ~+8-12 %.

**Décision Phase A : V2+** (pas V1.5). Coût additionnel (~+5 €/mois @ 100k requests), gain marginal sur cabinet IA (audience expert, requêtes précises).

Si activé V2 : feature flag `Setting('kb.ai.rerank.enabled', false)`.

### 2.5 LLM synthèse — Claude Haiku 4.5 + prompt caching agressif

**Doctrine skill `claude-api`** : prompt caching **OBLIGATOIRE**.

Structure du prompt Anthropic (SDK `@anthropic-ai/sdk` ≥ 0.30) :

```ts
const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20260301",
  max_tokens: 800,
  system: [
    {
      type: "text",
      text: SYSTEM_PROMPT_RAG_FR, // ~2000 tokens, statique
      cache_control: { type: "ephemeral" }, // ← CACHED
    },
  ],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: buildCorpusContext(topK), // ~4000 tokens, change peu (top-K stable sur même query)
          cache_control: { type: "ephemeral" }, // ← CACHED
        },
        {
          type: "text",
          text: `Question utilisateur : ${query}`, // ~50 tokens, jamais cached
        },
      ],
    },
  ],
});
```

**Économie attendue** :

- Sans caching : ~6050 tokens × $0.80/1M input = $0.005 / requête
- Avec caching (90% hit ratio sur system + corpus) : ~5450 tokens cached @ $0.08/1M (cache read) + ~600 tokens fresh @ $0.80/1M = **$0.0009 / requête**
- **Économie ~80 %**.

**Cache TTL Anthropic** : 5 minutes par défaut (ephemeral). Acceptable : sessions courtes, system reload toutes les 5 min.

**Citations** : le prompt système impose un format JSON intermédiaire `{ answer: "...", cited_ids: [1, 2, 5] }` validé Zod côté server avant render. Anti-pattern hallucination ID empêché par validation `cited_ids ⊆ retrievedTopK.map(e => e.shortId)`.

### 2.6 HMAC auth

Endpoint **internal-only** :

```ts
// .env (Coolify)
KB_RAG_HMAC_SECRET=<random 32 bytes hex, rotation tri-annuelle>

// Côté client interne (server-to-server)
const ts = Date.now();
const payload = `${ts}:${JSON.stringify(body)}`;
const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
fetch('/api/internal/kb/rag', {
  headers: {
    'X-Timestamp': ts,
    'X-Signature': sig
  },
  body: JSON.stringify(body)
});

// Côté handler
const verify = (req) => {
  const ts = req.headers['x-timestamp'];
  if (Date.now() - ts > 60_000) throw 401; // replay > 60s
  const expected = crypto.createHmac('sha256', secret)
    .update(`${ts}:${await req.text()}`)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers['x-signature']))) throw 401;
};
```

**Pas accessible depuis le navigateur** : c'est un endpoint pour widgets internes (sidebar admin, chat support team-only, futur SDK MCP).

**Une variante publique `/api/kb/search` (sans LLM, FTS+vector only)** peut exister en V1 déjà — pas couvert ici (Agent 5).

### 2.7 Cache layer applicatif

Redis cache sur (query_hash + locale + filters_hash) :

```ts
const key = `kb:rag:${sha256(query + locale + JSON.stringify(filters))}`;
const cached = await redis.get(key);
if (cached) return JSON.parse(cached); // < 5 ms
// ... pipeline
await redis.setex(key, 3600, JSON.stringify(result)); // TTL 1h
```

TTL 1h = compromis fraîcheur (publish revalidate paths n'invalide pas le cache RAG → acceptable, KB n'est pas du news).

Cache invalidation explicite sur `kb.published`, `kb.archived` : `redis.del(keys matching kb:rag:*)` (script Lua) — coûteux mais rare.

---

## 3. AUTO-SUGGESTIONS ADMIN

### 3.1 « Entrées similaires »

Dans l'éditeur, **après save draft autosave**, calcul async :

```ts
// Action: getSimilarEntriesAction({ entryId })
const target = await prisma.knowledgeTranslation.findUnique({
  where: { entryId_locale: { entryId, locale: "fr" } },
  select: { embedding: true },
});
if (!target?.embedding) return [];

const similar = await prisma.$queryRaw`
  SELECT entry_id, title, slug, 1 - (embedding <=> ${target.embedding}::vector) AS score
  FROM knowledge_translations
  WHERE entry_id != ${entryId}
    AND embedding IS NOT NULL
    AND audience IN ('public', 'client', 'team')
  ORDER BY embedding <=> ${target.embedding}::vector ASC
  LIMIT 3
`;
```

UI : panneau latéral droit, 3 cards "Entrées similaires", lien vers édition, bouton "ajouter en relation" → crée `KnowledgeRelation(type='similar')`.

**Opt-out** : `Setting('kb.ai.suggestions.similar.enabled', true)` + per-entry checkbox `excludeFromSuggestions`.

### 3.2 « Relations probables »

Embeddings + heuristiques :

- Embedding cosine top-5 (= candidats).
- Filtre : même `domain` boosté ×1.2, même `type` ×0.8, `confidentiality` compatible.
- UI : liste avec relations suggérées (`type=related|prerequisite|see-also`).

Calcul **on-demand** (bouton "suggérer relations"), pas auto (sinon spam DB).

### 3.3 « Tags suggérés »

LLM Claude Haiku 4.5 + caching :

```ts
// system prompt CACHED (statique avec règles tagging)
const SYSTEM_TAG = `Tu suggères 3-7 tags pour une entrée de base de connaissances...
Format de sortie OBLIGATOIRE: { "tags": ["tag1", "tag2", ...] }
Tags autorisés (liste close) : ${ALLOWED_TAGS.join(", ")}
Tags interdits : tags marketing, tags trop génériques (...).`;

const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20260301",
  max_tokens: 200,
  system: [{ type: "text", text: SYSTEM_TAG, cache_control: { type: "ephemeral" } }],
  messages: [
    {
      role: "user",
      content: `Title: ${title}\nExcerpt: ${excerpt}\n\nProposed tags (JSON only):`,
    },
  ],
});

// Validation Zod stricte
const TagsSchema = z.object({
  tags: z
    .array(z.string())
    .min(1)
    .max(10)
    .refine((tags) => tags.every((t) => ALLOWED_TAGS.includes(t)), "Tag hors liste autorisée"),
});
const { tags } = TagsSchema.parse(JSON.parse(response.content[0].text));
```

**Anti-hallucination** :

- Liste close `ALLOWED_TAGS` injectée dans le system (cached).
- Validation Zod refuse silencieusement tag hors liste → re-prompt 1 fois max → sinon vide.
- Pas d'auto-application : suggestion UI uniquement, l'éditeur coche.

**Coût** : ~300 tokens input + 50 output, cached ~250 tokens, ~$0.00005 / suggestion. Négligeable.

---

## 4. AUTO-RÉDACTION ASSISTÉE (BOUTON « GÉNÉRER BROUILLON »)

### 4.1 Périmètre

Bouton dans l'éditeur de création d'entrée vide : _"Brouillon à partir d'un prompt"_.

**Strictement assistance** :

- Sortie = brouillon Tiptap JSON inséré dans l'éditeur, `status='draft'` forcé en DB.
- **JAMAIS** d'auto-publish. Workflow normal `draft → review → published` respecté (Agent 8).
- Bandeau visible _"Brouillon généré par IA — révision humaine obligatoire avant publication"_ affiché tant que `aiGenerated=true && !humanReviewedAt`.

### 4.2 Modèle & prompt

**Claude Sonnet 4.7** (qualité éditoriale > Haiku pour FR long-form cabinet IA).

```ts
const SYSTEM_DRAFT = `Tu rédiges un brouillon pour la base de connaissances d'Axion-IA, cabinet IA opérationnel.

CONTRAINTES NON-NÉGOCIABLES :
- Ton : expert, sobre, factuel. Jamais agence/studio/atelier (sauf concurrent en comparatif).
- Pas de promesse de résultat absolue ("vous gagnerez X% ROI" interdit).
- FR seulement (EN = traduction séparée).
- Citations obligatoires si chiffres / faits externes (format Markdown footnote).
- Pas de SIREN/SIRET inventé. Pas d'hex codes (hors palette doctrine).
- Format de sortie : Tiptap JSON conforme au schema fourni.

STYLE GUIDE AXION-IA :
- Modular scale 2026 typo (h1-h6 hiérarchie).
- Pas de superlatif marketing ("révolutionnaire", "magique", "incroyable").
- Voix Manon (auteur SSOT) : factuelle, didactique, structurée.

[exemples de structure 3-5 entrées de référence, CACHED]`;

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-7-20260301",
  max_tokens: 4000,
  system: [{ type: "text", text: SYSTEM_DRAFT, cache_control: { type: "ephemeral" } }],
  messages: [
    {
      role: "user",
      content: `Type: ${type}\nDomaine: ${domain}\nBrief: ${userPrompt}\n\nBrouillon (Tiptap JSON only):`,
    },
  ],
});
```

**Coût indicatif** : ~5000 tokens input (dont 4500 cached) + 2000 output = ~$0.03 / brouillon. Acceptable.

### 4.3 Garde-fous

- `pii-redaction.ts` post-génération : si PII détectée dans output, **blocage** + log Sentry + notification reviewer.
- `confidentiality` ne peut pas être `secret`/`confidential` sur entrée IA-générée (forcé `internal` par défaut, l'éditeur peut élever après review).
- Audit log : `ActivityLog(action='kb.ai_draft_generated', changes={ prompt, modelVersion, tokensUsed })`.
- Quality score Agent 14 appliqué : un brouillon IA sans seuil minimum reste `draft` jusqu'à amélioration humaine.

### 4.4 Anti-pattern critique

**INTERDIT** : workflow auto-publish + IA. Tout brouillon IA doit transiter par `status='review'` puis `status='published'` par un humain (Editor ou Reviewer rôle Agent 9).

Test E2E (`tests/e2e/kb-ai-draft.spec.ts`) :

```ts
test("AI draft never auto-publishes", async ({ page }) => {
  await loginAsEditor(page);
  await page.click('[data-testid="generate-draft-btn"]');
  await page.fill('[name="aiPrompt"]', "Audit IA pour PME industrielle");
  await page.click('[data-testid="generate-submit"]');
  await page.waitForResponse(/\/api\/.*\/ai-draft/);

  const status = await page.locator('[data-testid="entry-status"]').textContent();
  expect(status).toBe("draft");

  const banner = page.locator('[data-testid="ai-generated-banner"]');
  await expect(banner).toBeVisible();
});
```

---

## 5. AUTO-TRADUCTION FR → EN

### 5.1 Périmètre

Bouton dans l'éditeur EN d'une entrée existante FR : _"Traduire depuis le FR"_.

- Source : `knowledge_translations(entryId, locale='fr', status='published')` (jamais traduire un draft → garbage in/out).
- Target : `knowledge_translations(entryId, locale='en', status='draft')`.
- **JAMAIS** d'auto-publish EN.

### 5.2 Modèle & prompt

**Claude Haiku 4.5** (suffisant pour traduction technique).

```ts
const SYSTEM_TRANSLATE_FR_EN = `Tu traduis du contenu FR → EN pour le site d'Axion-IA, operational AI consultancy.

CONTRAINTES :
- Préserve la structure Tiptap JSON à l'identique (h1/h2/p/lists/blockquote/etc).
- Préserve les liens internes (href inchangé, anchor text traduit).
- Vocabulaire EN doctrine : "operational AI consultancy" (jamais "agency/studio").
- Pas de localisation FR → US (garde l'esprit, ne traduis pas les exemples FR en exemples US sauf demande explicite).
- Citations / footnotes / code blocks / dates ISO : non touchés.
- Slugs / URLs : non touchés.

GLOSSAIRE OBLIGATOIRE :
- "cabinet IA" → "AI consultancy"
- "intervention" → "engagement"
- "audit IA" → "AI audit"
- "Manon" → "Manon" (nom propre, pas de traduction)
- "France métropolitaine" → "Metropolitan France"

[glossaire complet 50 termes, CACHED]`;

const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20260301",
  max_tokens: 4000,
  system: [{ type: "text", text: SYSTEM_TRANSLATE_FR_EN, cache_control: { type: "ephemeral" } }],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: JSON.stringify(frBodyJson), // payload Tiptap
        },
      ],
    },
  ],
});
```

**Coût** : entrée moyenne 5KB = ~2500 tokens input × 2 (input+output) = ~$0.005 / traduction (avec system cached). Volumétrie cible : 100 trad/mois max V1.5 → ~0,50 €/mois.

### 5.3 Garde-fous

- Output validé Zod (Tiptap schema) avant insertion en base. Si invalide → re-prompt 1 fois → sinon erreur user-friendly.
- Diff visible côté admin (`@tiptap/extension-diff` ou jsondiffpatch) : l'éditeur EN voit le FR à gauche + EN traduit à droite, peut éditer avant save.
- Audit log : `ActivityLog(action='kb.ai_translated', changes={ sourceLocale: 'fr', targetLocale: 'en', sourceVersionId, tokensUsed })`.
- `aiTranslated=true` + `aiTranslatedFromVersionId` stockés → si FR est mis à jour, badge "Traduction obsolète" affiché tant que pas re-traduit ou validé.

### 5.4 Anti-pattern

**INTERDIT** : publication EN automatique après traduction IA. Test E2E miroir de §4.4.

---

## 6. STOCKAGE DES MÉTADONNÉES IA

Modèle Prisma additif (Sprint KB-21 migration `expand`) :

```prisma
model KnowledgeAiMetadata {
  id              String   @id @default(cuid())
  entryId         String   @unique
  entry           KnowledgeEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  // Embeddings
  embeddingModel  String?  // ex: 'voyage-3-lite'
  embeddingAt     DateTime?

  // Génération
  aiGenerated     Boolean  @default(false)
  aiPrompt        String?  @db.Text
  aiModelVersion  String?
  humanReviewedAt DateTime?
  humanReviewerId String?

  // Traduction
  aiTranslated    Boolean  @default(false)
  aiTranslatedFromVersionId String?
  aiTranslatedAt  DateTime?

  // Tracking budget
  tokensInputTotal  Int @default(0)
  tokensOutputTotal Int @default(0)
  tokensCachedTotal Int @default(0)
  costEurEstimated  Decimal @default(0) @db.Decimal(10, 6)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([aiGenerated])
  @@index([aiTranslated])
  @@map("knowledge_ai_metadata")
}
```

Permet :

- Filtrer en admin "Toutes les entrées IA-générées non encore reviewées".
- Dashboard coût mensuel cumulé `/admin/connaissances/ai-cost`.
- Audit RGPD : qui a généré, quand, quels tokens chez quel sous-processeur.

---

## 7. OBSERVABILITÉ & MONITORING

| Métrique                    | Outil                                                       | Seuil alerte                                      |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| RAG latency p95             | Sentry Performance + custom span                            | > 1000 ms                                         |
| RAG error rate              | Sentry                                                      | > 1 % sur 5 min                                   |
| Embeddings provider success | Custom log + alerte Telegram redactée                       | < 99 % sur 1h                                     |
| Coût mensuel cumulé         | Cron `kb-ai-cost-monitor` daily                             | > 80 % budget `Setting('kb.ai.budget_eur_month')` |
| Cache hit ratio Anthropic   | Header response `anthropic-cache-control`                   | < 70 % (= mauvaise structure prompt)              |
| Plausible Goals             | `kb_rag_query`, `kb_ai_draft_generated`, `kb_ai_translated` | dashboards usage                                  |

Telegram alertes : `pii-redaction.ts` appliqué (ADR 0010), pas de payload dans le message.

---

## 8. ANTI-PATTERNS — INTERDITS

| #   | Anti-pattern                                                                   | Pourquoi                                                                               | Garde-fou                                                                              |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | RAG renvoie un `answer` sans `citations[]`                                     | Hallucination invérifiable + RGPD (source obligatoire) + AEO (citation = trust signal) | Zod refuse response sans `citations.length > 0` ; re-prompt 1 fois ; sinon 502         |
| 2   | Auto-publish d'un draft IA-généré                                              | Réputation cabinet + RGPD + anti-spam + responsabilité éditoriale                      | Forcé `status='draft'` côté server action ; test E2E bloquant CI                       |
| 3   | Envoi de `confidentiality IN ('confidential', 'secret')` vers Voyage/Anthropic | Fuite RGPD + DPA non couvert                                                           | Refus dur + test Vitest bloquant ; double check worker BullMQ                          |
| 4   | Embedding sans `embeddingModel` stocké                                         | Impossible de réindex sur changement de modèle (drift)                                 | Schema Prisma `embeddingModel String?` required-after-write                            |
| 5   | Pas de prompt caching sur calls Anthropic                                      | Coût ×5 + latence ×2 + non-respect skill `claude-api`                                  | Linter custom `tests/no-uncached-anthropic-call.test.ts` qui scan `src/server/ai/*.ts` |
| 6   | Cache RAG sans invalidation sur publish                                        | Réponses obsolètes (entrée archivée toujours citée)                                    | Hook `kb.published` / `kb.archived` invalide pattern Redis `kb:rag:*`                  |
| 7   | Bouton traduction sans review                                                  | Erreurs sémantiques en prod (cabinet IA → AI agency)                                   | UI force `status='draft'` + diff visible + glossaire validé                            |
| 8   | Reindex full sans throttle                                                     | Saturation Voyage rate limit + RAM CPX32 spike                                         | BullMQ `limiter: { max: 1, duration: 1000 }` + monitoring                              |
| 9   | Tags suggérés en liste ouverte                                                 | Pollution taxonomie + impossible filtre admin                                          | Liste close `ALLOWED_TAGS` + Zod `.refine(...)`                                        |
| 10  | Embedding stocké sans dimension matching                                       | `vector(1024)` schema crash si modèle 1536 sans migration                              | Type Prisma `Unsupported("vector(1024)")` + check pré-write                            |
| 11  | LLM final hors prompt-caching skill `claude-api`                               | Coût + non-doctrine                                                                    | system + corpus toujours `cache_control: 'ephemeral'`                                  |
| 12  | HMAC sans timestamp = replay attack                                            | Vol de signature + abuse                                                               | Window 60s + `crypto.timingSafeEqual`                                                  |

---

## 9. ALIGNEMENT DOCTRINE

| Doctrine                                                      | Statut | Implémentation §refs                                                          |
| ------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Skill `claude-api` — prompt caching obligatoire               | ✅     | §2.5, §3.3, §4.2, §5.2 (toutes les calls Anthropic)                           |
| `axionia_hosting_hetzner` — CPX32 + CF Free, pas de SaaS cher | ✅     | Coût total < 20 €/mois budget (cf §1.6 + §7), pas d'hébergement vector cloud  |
| Code = SSOT (`axionia_doctrine_code_ssot`)                    | ✅     | Modèles Prisma source de vérité, helpers `src/server/ai/*`                    |
| `axionia_naming_cabinet` "cabinet IA opérationnel"            | ✅     | Glossaire FR/EN imposé §4.2, §5.2                                             |
| `axionia_naming_brand_vs_project` Axion-IA                    | ✅     | Identifiers JS camelCase, brand `Axion-IA` dans prompts                       |
| ADR 0010 Telegram PII                                         | ✅     | §7 alertes PII redactées                                                      |
| `axionia_session_2026-05-09_sprint_24_1` `pii-redaction.ts`   | ✅     | §2.1 input scan, §4.3 output scan                                             |
| AGENTS.md First Load JS ≤ 75 KB gz                            | ✅     | Aucun code IA client-side (toutes les calls server-side), pas d'impact bundle |
| AGENTS.md Web Vitals (LCP/INP/CLS)                            | ✅     | RAG p95 < 800 ms backend ; UI éditeur lazy-load le bouton "générer brouillon" |
| `axionia_design_pivot` typo terracotta                        | N/A    | Pas d'impact UI doctrine ici (composants admin)                               |

---

## 10. STOP & ASK — DÉCISIONS OUVERTES

> **Aucune action sans réponse Will sur ces 11 points avant Sprint KB-21.**

| #   | Question                                                                                               | Recommandation Phase A                                           | Impact si refus     |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------- |
| 1   | Provider embeddings final : Voyage AI / OpenAI / self-hosted ?                                         | **Voyage `voyage-3-lite`**                                       | Re-bench provider   |
| 2   | Sous-processeur : ajouter Voyage AI à `legal.ts` + page sous-processeurs ?                             | OUI, requis RGPD                                                 | Bloquant DPO        |
| 3   | DPA Voyage AI : Will accepte les CGV standard (US, Standard Contractual Clauses) ou exige DPA papier ? | CGV suffisantes V1.5 si pas de PII envoyée                       | Bloquant compliance |
| 4   | Budget mensuel cap embeddings : 20 €/mois suggéré, OK ?                                                | OUI (§1.6 chiffrage)                                             | Ajustement seul     |
| 5   | Budget RAG runtime : 50 €/mois suggéré, OK ?                                                           | OUI                                                              | Ajustement seul     |
| 6   | Feature flag global `kb.ai.enabled` : par défaut OFF V1.5 GA, ramp-up manuel ?                         | OUI, OFF par défaut                                              | Risque rollout      |
| 7   | Opt-in/out par entry : champ `excludeFromAi` (bool, default false) sur `KnowledgeEntry` ?              | OUI                                                              | UX éditeur          |
| 8   | Opt-in/out global RGPD : entrée client publique = embedding auto OK ? Ou consent par auteur ?          | OK auto sur `audience='public'` + `confidentiality NOT IN (...)` | Bloquant DPO        |
| 9   | Reranking V2+ : valider que c'est V2 et pas V1.5 ?                                                     | OUI V2+ (coût marginal)                                          | Scope shift         |
| 10  | Endpoint RAG public en V2 ? (`/api/kb/search` sans HMAC)                                               | OUI V2+, V1.5 internal only                                      | Scope shift         |
| 11  | MCP server (Anthropic Model Context Protocol) pour exposer RAG en V2.5 ?                               | À évaluer V2+ après usage V1.5                                   | Roadmap             |

---

## 11. CHECKLIST D'IMPLÉMENTATION — Sprint KB-21 (V1.5)

> Phase A AUDIT-ONLY : aucune ligne de code à écrire. Cette checklist est le brief Phase B Sprint KB-21.

- [ ] ADR `docs/adr/0022-knowledge-base-pgvector-v1.5.md` (Voyage AI + HNSW + caching).
- [ ] Migration `expand` : `CREATE EXTENSION vector` + colonnes `embedding/embedding_model/embedding_at` + index HNSW + table `KnowledgeAiMetadata`.
- [ ] Helper `src/server/ai/embeddings.ts` (Voyage SDK + refus dur + batch + throttle).
- [ ] Helper `src/server/ai/anthropic-client.ts` (wrapper Anthropic SDK + cache_control auto + token tracking).
- [ ] Endpoint `src/app/api/internal/kb/rag/route.ts` (HMAC + RRF + caching Redis + citations).
- [ ] Server actions `src/server/actions/knowledge/ai-*.ts` : `getSimilarEntriesAction`, `suggestTagsAction`, `generateDraftAction`, `translateAction`.
- [ ] UI admin : panneau "similaires" + bouton "tags suggérés" + bouton "générer brouillon" + bouton "traduire".
- [ ] Worker BullMQ `src/server/queue/jobs/kb-reindex-embeddings.ts`.
- [ ] Cron `kb-ai-cost-monitor` daily.
- [ ] Tests Vitest : refus confidentialité (×3 cas) + RRF (×5 cas) + budget cap.
- [ ] Tests E2E : AI draft never auto-publishes + AI translation never auto-publishes.
- [ ] Linter custom `tests/no-uncached-anthropic-call.test.ts`.
- [ ] Page admin `/fr/<prefix>/connaissances/ai-cost` (dashboard tokens/coût).
- [ ] Feature flag `Setting('kb.ai.enabled', false)` par défaut.
- [ ] Update `legal.ts` + page sous-processeurs (Voyage AI sous-processeur US).
- [ ] Update `_AUDIT/AUDIT-WEB-VITALS-2026-*.md` : confirmer aucune régression bundle public.
- [ ] Doc sync : `AGENTS.md` mention skill `claude-api` enforcement.

---

**Fin — Agent 10 — IA augmentation (V1.5+).** Phase A AUDIT-ONLY livrée, aucun code modifié.
