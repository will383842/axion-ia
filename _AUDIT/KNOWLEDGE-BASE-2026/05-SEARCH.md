# 05 — SEARCH — FTS + sémantique — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`
> Agent : 5 — Recherche FTS + sémantique (parallèle Phase A)
> Date : 2026-05-13
> Statut : DRAFT (Phase A AUDIT-ONLY — pas d'écriture SQL réelle, pas de migration, pas de `pnpm add`)
> Référence : HEAD `main` (commit `95bba36`)
> Doctrine : code = SSOT, Hetzner CPX32 + Cloudflare Free, AGENTS.md Web Vitals (LCP ≤ 1800 / INP ≤ 100 / CLS = 0)

---

## 0. TL;DR

- **V1 = FTS-only**, pas de pgvector (extension absente sur la base Coolify, confirmé par `00-REALITY-CHECK.md` §1.3). C'est suffisant pour 1k–10k entrées avec p95 < 200 ms.
- **Cible V1** : 1 colonne `knowledge_translations.search_vector` `tsvector GENERATED ALWAYS STORED`, **2 configs** (`fr_unaccent` existante + nouvelle `english_stem` à créer), pondération **A=title / B=excerpt / C=body_text / D=tags concat**, index GIN.
- **Bug pré-existant à corriger** : le FTS actuel (`prisma/migrations_fts/0002_fts_setup.sql`) indexe `body` (HTML brut, pollue le vecteur avec les balises). KB V1 doit pointer sur `body_text` (plain text déjà persisté Sprint 24 C4, mémoire `axionia_session_2026-05-09_sprint_24`).
- **FAQ FTS** = créé en KB-5 quand la FAQ migre sous `KbType='faq'` dans `KnowledgeEntry`/`KnowledgeTranslation` (les FAQ actuelles sont sur colonnes `questionFr`/`answerFr`, pas de translation table, pas de FTS).
- **Endpoint** `/api/internal/kb/search` server-side `unstable_cache` short-ISR (60 s) pour requêtes populaires, sinon SSR pur. Pas de cache côté client (privacy by default).
- **V1.5 = pgvector + RRF hybrid** (Sprint KB-21, ADR séparée). Modèle embedding : **Voyage AI `voyage-3-large` (1024 dim)** recommandé reality check si on s'attache à l'écosystème Anthropic (Anthropic ne fournit pas d'embeddings natifs en 2026-05, doctrine `claude-api`). Fallback : `text-embedding-3-small` (OpenAI, 1536 dim) **avec sous-processeur déclaré**.
- **STOP & ASK** : modèle embedding + dimension vector + RRF k constant + politique fallback hors-ligne. Détails §13.

---

## 1. ÉTAT ACTUEL FTS — INVENTAIRE

### 1.1 Extensions Postgres installées

`axionia/docker/postgres/init.sql` (init container Coolify) :

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**`vector` (pgvector) ABSENT.** Confirmé `00-REALITY-CHECK.md` §1.3 et lecture directe. KB V1 reste FTS-only ; V1.5 ajoutera `CREATE EXTENSION vector` dans un sprint dédié (KB-21).

### 1.2 Config TS française custom — `fr_unaccent`

Bloc DO idempotent dans `init.sql` :

```sql
CREATE TEXT SEARCH CONFIGURATION fr_unaccent (COPY = french);
ALTER TEXT SEARCH CONFIGURATION fr_unaccent
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, french_stem;
```

→ FR sans accents (« évaluation » match « evaluation »), stemming français. **Réutilisable tel quel pour KB V1 FR.**

### 1.3 Tsvectors matérialisés existants

`prisma/migrations_fts/0002_fts_setup.sql` :

| Table                       | Colonne `search_vector`                         | Pondération | Index GIN                              |
| --------------------------- | ----------------------------------------------- | ----------- | -------------------------------------- |
| `article_translations`      | `setweight(title,'A')\|\|excerpt(B)\|\|body(C)` | A/B/C       | `article_translations_search_idx`      |
| `help_article_translations` | idem                                            | A/B/C       | `help_article_translations_search_idx` |
| `case_study_translations`   | `title(A)\|\|problem(B)\|\|solution(C)`         | A/B/C       | `case_study_translations_search_idx`   |

**Et indexes pg_trgm GIN** sur `submissions.contact_email`, `testimonials.company`, `bookings_options.contact_email` (recherche fuzzy admin booking).

### 1.4 Limitations identifiées

1. **`body` = HTML brut** → le vecteur contient `<p>`, `<strong>`, etc. → bruit sur le ranking. À remplacer par `body_text` (plain text Sprint 24 C4 déjà en colonne sur `article_translations.bodyText`, `case_study_translations.problemText/solutionText`, `help_article_translations.bodyText`).
2. **Pas de FTS FR sur `faqs`** → la page `/recherche` ne peut pas requêter les questions/réponses FAQ aujourd'hui.
3. **Pas de FTS EN du tout** → la version `/en/search` (`/en/recherche` ?) n'a aucun index sur le contenu anglais (les rows sont là, juste pas indexées). Config `english_stem` à créer.
4. **Pas de pondération `tags`** → les tags `ArticleTag` ne participent pas au ranking, malgré leur valeur sémantique forte.
5. **Page `/recherche` est un placeholder** (lecture `src/app/[locale]/recherche/page.tsx`) : formulaire + liens statiques vers `/blog`, `/faq`, `/glossaire`, `/centre-aide`. Commentaire ligne 42 `"Sprint 15 wires Postgres FTS"` mais l'endpoint n'a jamais été câblé. Sprint KB-7 termine ce que Sprint 15 a démarré.

---

## 2. MIGRATION FTS CIBLE V1 — knowledge_translations

### 2.1 Stratégie expand-backfill-contract

Pattern Sprint X.4/X.5 booking déjà éprouvé (mémoire `axionia_booking_v1_session_2026-05-13_autopilot`) :

1. **KB-1 (expand)** : crée la table `knowledge_translations` neuve vide avec colonne `search_vector` GENERATED.
2. **KB-2 (backfill)** : copie `article_translations` + `help_article_translations` + `case_study_translations` + (KB-5) `faqs` → `knowledge_translations`. Les tsvectors se calculent automatiquement (GENERATED ALWAYS).
3. **KB-5 (contract — FAQ)** : supprime `faqs.questionFr/answerFr/...` une fois `knowledge_translations` validé en prod.

### 2.2 Migrations SQL prévues (à écrire en Phase B uniquement)

Trois fichiers hors-Prisma (suivent la convention `prisma/migrations_fts/`) :

#### Fichier 1 — `prisma/migrations_fts/0003_kb_unaccent_trgm.sql`

Crée la **config `english_stem`** miroir de `fr_unaccent` (pour cohérence : unaccent + english_stem, traite proprement « café » et « naïve » côté EN — rare mais blindé), et ajoute pg_trgm GIN indexes sur `knowledge_entries.slug` + `knowledge_translations.title` pour fuzzy match admin (typo tolerance dans le picker `slug-history`).

```sql
-- À NE PAS EXÉCUTER EN PHASE A — spec uniquement
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'english_stem') THEN
    CREATE TEXT SEARCH CONFIGURATION english_stem (COPY = english);
    ALTER TEXT SEARCH CONFIGURATION english_stem
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, english_stem;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS knowledge_entries_slug_trgm_idx
  ON knowledge_entries USING GIN (slug gin_trgm_ops);

CREATE INDEX IF NOT EXISTS knowledge_translations_title_trgm_idx
  ON knowledge_translations USING GIN (title gin_trgm_ops);
```

#### Fichier 2 — `prisma/migrations_fts/0004_kb_fts_french.sql`

```sql
-- À NE PAS EXÉCUTER EN PHASE A — spec uniquement
-- KB V1 — FTS français sur knowledge_translations (rows WHERE locale='fr')
--
-- Note: une seule colonne search_vector, polyglotte via la config retenue.
-- Stratégie A (retenue): la colonne search_vector se base sur la config locale-spécifique
-- via une expression CASE (1 colonne, 2 configs).

ALTER TABLE knowledge_translations
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    CASE locale
      WHEN 'fr' THEN
        setweight(to_tsvector('fr_unaccent', coalesce(title, '')),     'A') ||
        setweight(to_tsvector('fr_unaccent', coalesce(excerpt, '')),   'B') ||
        setweight(to_tsvector('fr_unaccent', coalesce(body_text, '')), 'C') ||
        setweight(to_tsvector('fr_unaccent', coalesce(tags_concat, '')), 'D')
      WHEN 'en' THEN
        setweight(to_tsvector('english_stem', coalesce(title, '')),     'A') ||
        setweight(to_tsvector('english_stem', coalesce(excerpt, '')),   'B') ||
        setweight(to_tsvector('english_stem', coalesce(body_text, '')), 'C') ||
        setweight(to_tsvector('english_stem', coalesce(tags_concat, '')), 'D')
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS knowledge_translations_search_idx
  ON knowledge_translations USING GIN (search_vector);
```

Alternative envisageable (à débattre §13 STOP&ASK Q3) : 2 colonnes séparées `search_vector_fr` + `search_vector_en` (un seul `NULL`, l'autre rempli). Plus simple mais 2 index GIN au lieu d'1. **Recommandation : 1 colonne CASE locale (lecture immédiate, query side filtre déjà sur locale).**

#### Fichier 3 — `prisma/migrations_fts/0005_kb_fts_faq_legacy.sql`

Optionnel — uniquement si on garde temporairement la table `faqs` en parallèle de la migration KB-5. Si la KB-5 contracte (supprime `faqs`), ce fichier n'est jamais joué. À spécifier en Phase B selon la décision « strangler vs Big Bang » §10 reality check Q16.

### 2.3 Champ `tags_concat`

Le pattern recommandé est de matérialiser `tags_concat = lower(string_agg(tag.name, ' '))` dans la table `knowledge_translations` via :

- Option **(a) colonne dénormalisée maintenue par trigger** (PG 17 supporte STORED computed, mais sur 2 tables → trigger requis). Risque : drift si l'app modifie tags sans repasser par l'action.
- Option **(b) recalcul à chaque save** côté server action `updateEntry` / `addTag` (write-side). Plus simple, déterministe. **Recommandation reality check.**

Schéma cible (rappel pour l'agent 1) :

```prisma
model KnowledgeTranslation {
  id          String  @id @default(cuid())
  entryId     String
  locale      Locale
  title       String
  excerpt     String?
  body        String  // HTML
  bodyJson    Json    // Tiptap canonique
  bodyText    String  @map("body_text") // plain text Sprint 24 C4 pattern
  tagsConcat  String  @default("") @map("tags_concat") // matérialisé
  // search_vector tsvector  ← hors Prisma, créé via migrations_fts/0004_kb_fts_french.sql
  // ...
  @@map("knowledge_translations")
}
```

---

## 3. PATTERNS DE REQUÊTE FTS

### 3.1 Trois opérateurs `tsquery` — quand utiliser quoi ?

| Opérateur                  | Cas d'usage                                                                                 | Exemple input → tsquery                                         |
| -------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **`plainto_tsquery`**      | Mots-clés simples non quotés. Concat AND implicite.                                         | `"audit IA"` → `'audit' & 'ia'`                                 |
| **`phraseto_tsquery`**     | Phrase exacte (séquence ordonnée).                                                          | `"audit IA"` → `'audit' <-> 'ia'`                               |
| **`websearch_to_tsquery`** | Syntaxe Google-style : `+inclusion`, `-exclusion`, `"quotes"`, `OR`. **Recommandation V1.** | `audit "IA" OR ia -openai` → `(audit & 'ia') \| (ia & !openai)` |

**Doctrine V1** : `websearch_to_tsquery` par défaut, c'est celui qui mappe le mieux à l'UX d'un user lambda venant de Google. Plus permissif sur les erreurs de saisie (un quote isolé ne casse pas la requête).

### 3.2 Requête FTS canonique — V1

```sql
-- Pattern d'appel server-side (Prisma $queryRaw ou Prisma SQL template)
WITH q AS (
  SELECT websearch_to_tsquery(
    CASE :locale WHEN 'fr' THEN 'fr_unaccent' ELSE 'english_stem' END,
    :userQuery
  ) AS tsq
)
SELECT
  e.id,
  e.slug,
  e.type,
  e.domain,
  e.audience,
  e.published_at,
  e.pinned,
  e.featured,
  e.helpful_count,
  t.title,
  t.excerpt,
  ts_rank_cd(t.search_vector, q.tsq, 32) AS rank_raw,
  ts_headline(
    CASE :locale WHEN 'fr' THEN 'fr_unaccent' ELSE 'english_stem' END,
    t.body_text,
    q.tsq,
    'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=24, MinWords=10'
  ) AS snippet
FROM knowledge_translations t
JOIN knowledge_entries e ON e.id = t.entry_id, q
WHERE
  t.search_vector @@ q.tsq
  AND t.locale = :locale
  AND e.status = 'published'
  AND e.audience = ANY(:audiences)               -- ['public'] anonyme, ['public','client'] client connecté
  AND (:types::text[] IS NULL OR e.type = ANY(:types))
  AND (:domains::text[] IS NULL OR e.domain = ANY(:domains))
  AND (:tagIds::text[] IS NULL OR EXISTS (
      SELECT 1 FROM knowledge_entry_tags et
      WHERE et.entry_id = e.id AND et.tag_id = ANY(:tagIds)
  ))
  AND (:dateFrom::timestamptz IS NULL OR e.published_at >= :dateFrom)
  AND (:dateTo::timestamptz   IS NULL OR e.published_at <= :dateTo)
ORDER BY
  -- ranking final (cf §4)
  (ts_rank_cd(t.search_vector, q.tsq, 32)
    * freshness_multiplier(e.published_at)
    * pinned_boost(e.pinned, e.featured)
    * helpful_boost(e.helpful_count)
  ) DESC,
  e.published_at DESC
LIMIT :limit OFFSET :offset;
```

Notes :

- `ts_rank_cd(... , 32)` — normalisation **32 = divide by unique words count + 1**. Doctrine : meilleur compromis qualité/longueur pour entrées de longueur variable (FAQ courte vs guide long).
- `ts_headline` génère snippet HTML avec `<mark>` (réutilisé tel quel dans les SearchResult cards). À sanitizer côté SSR pour éviter injection (le `body_text` est plain text donc safe, mais on whitelist `<mark>` seulement).
- Les **fonctions** `freshness_multiplier`, `pinned_boost`, `helpful_boost` sont déclarées en SQL stable functions (cf §4.3) — pas inline, pour réutilisation et test.

### 3.3 Fallback fuzzy (typo tolerance)

Si `total = 0` sur la requête FTS, l'endpoint **retry** en pg_trgm fuzzy :

```sql
SELECT e.id, t.title, similarity(t.title, :userQuery) AS sim
FROM knowledge_translations t
JOIN knowledge_entries e ON e.id = t.entry_id
WHERE t.locale = :locale
  AND e.status = 'published'
  AND e.audience = ANY(:audiences)
  AND t.title % :userQuery   -- pg_trgm threshold (default 0.3)
ORDER BY sim DESC
LIMIT 5;
```

→ « Did you mean… » block dans l'UI. Utile pour fautes de frappe (« copilote » vs « copilot ») et noms propres.

---

## 4. RANKING — pondération finale

### 4.1 Formule

```
finalRank = ts_rank_cd(search_vector, query, 32)
          × freshness_multiplier(published_at)
          × pinned_boost(pinned, featured)
          × helpful_boost(helpful_count)
```

### 4.2 Multiplicateurs détaillés

#### `freshness_multiplier(published_at)`

Modèle **demi-vie 180 jours** (6 mois) — typique pour contenu evergreen B2B (vs 30 j en news, 365 j en doctrine pure).

```sql
CREATE OR REPLACE FUNCTION freshness_multiplier(pub timestamptz)
RETURNS real LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(
    0.5,
    1.0 + 0.5 * EXP(-LN(2) * EXTRACT(EPOCH FROM (now() - pub)) / (180 * 86400))
  )::real;
$$;
```

Plage : 1.5 (publié aujourd'hui) → 1.25 (180 j) → 1.125 (360 j) → asymptote 0.5 plancher (jamais d'écrasement total). Évite que les guides « zombies » de 2 ans tombent à 0.

#### `pinned_boost(pinned, featured)`

```sql
CREATE OR REPLACE FUNCTION pinned_boost(pinned bool, featured bool)
RETURNS real LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN pinned   THEN 3.0    -- forcé en tête (admin)
    WHEN featured THEN 1.5    -- mis en avant (editorial)
    ELSE 1.0
  END::real;
$$;
```

`pinned = TRUE` est réservé à 1-5 entrées max (page hub `/ressources` les épingle aussi). `featured` est utilisé librement par les éditeurs.

#### `helpful_boost(helpful_count)`

```sql
CREATE OR REPLACE FUNCTION helpful_boost(hc int)
RETURNS real LANGUAGE sql IMMUTABLE AS $$
  SELECT (1.0 + 0.1 * LN(1 + GREATEST(0, hc)))::real;
$$;
```

Log-scaling : 100 helpful → ×1.46, 1000 → ×1.69. Évite qu'une entrée à 10k votes écrase tout, tout en récompensant la qualité perçue.

### 4.3 Pourquoi des fonctions SQL et pas du code applicatif ?

- 1 round-trip Postgres au lieu de 2 (rank applicatif = `SELECT * ORDER BY published_at LIMIT 200; rerank en JS`).
- Index GIN exploitable par le planner (le `ORDER BY (expression)` reste sargable car les boosters sont `IMMUTABLE`).
- Testable en isolation (`SELECT freshness_multiplier(now() - interval '90 days')` → fixture vitest indirecte via raw SQL).

### 4.4 Tie-breaker

En cas d'égalité de `finalRank` (rare mais possible sur les courtes requêtes) : `ORDER BY e.published_at DESC`. Pas de tri alphabétique (biais imprévisible UX).

---

## 5. FACETTES — agrégations

### 5.1 Facettes V1 retenues

| Facette     | Champ schéma                                  | Multi | Source                                |
| ----------- | --------------------------------------------- | ----- | ------------------------------------- |
| `type`      | `KnowledgeEntry.type` (enum `KbType`)         | multi | enum statique SSOT                    |
| `domain`    | `KnowledgeEntry.domain` (enum `KbDomain`)     | multi | enum statique SSOT                    |
| `audience`  | `KnowledgeEntry.audience` (enum `KbAudience`) | multi | enum + RBAC (anonyme = only 'public') |
| `tags`      | `KnowledgeEntryTag` (M2M)                     | multi | dynamique DB                          |
| `status`    | `KnowledgeEntry.status`                       | mono  | uniquement admin                      |
| `dateRange` | `published_at`                                | range | from/to ISO timestamptz               |

### 5.2 Implémentation — 2 stratégies

#### Stratégie A — Subqueries parallèles (recommandation V1)

5 requêtes en parallèle côté server action :

```ts
// Pattern, à implémenter dans src/server/actions/knowledge/search.ts (Phase B)
const [results, typeFacets, domainFacets, tagFacets, total] = await Promise.all([
  prisma.$queryRaw<SearchHitRow[]>`...requête §3.2...`,
  prisma.$queryRaw<Facet[]>`
    SELECT e.type, COUNT(*)::int AS n
    FROM knowledge_translations t
    JOIN knowledge_entries e ON e.id = t.entry_id, q
    WHERE t.search_vector @@ q.tsq AND e.status='published' AND ...
    GROUP BY e.type
  `,
  prisma.$queryRaw<Facet[]>`... GROUP BY e.domain`,
  prisma.$queryRaw<Facet[]>`...join entry_tags ... GROUP BY tag_id`,
  prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int FROM ...`,
]);
```

Avantage : chaque facette utilise le **même index GIN** + filtre WHERE. Pénalité ≈ 5 × `ts_query @@ vector` mais les rows sont déjà dans le cache (warm path). p95 attendu : 150-200 ms.

#### Stratégie B — `GROUPING SETS` ou CTE unique

Plus rapide en théorie (1 round-trip) mais **plan analyzer complexe** + difficile à débugger. À considérer Sprint KB-21 si bench montre p95 > 300 ms.

### 5.3 Facettes contextuelles (multi-select)

Quand l'user sélectionne `type=guide`, les autres facettes doivent **réafficher leur cardinalité après filtre `type=guide`** (pattern Algolia/Elasticsearch). C'est-à-dire : chaque facette est calculée en omettant son propre filtre (cross-filter). À implémenter côté server action :

```ts
// Pseudo
const typeFacets = await countBy("type", { ...filters, type: undefined });
const domainFacets = await countBy("domain", { ...filters, domain: undefined });
const tagFacets = await countBy("tags", { ...filters, tags: undefined });
```

→ 3 requêtes additionnelles, justifiées pour UX clean. Coût additionnel ≈ 60 ms si index GIN warm.

---

## 6. ENDPOINT `/api/internal/kb/search`

### 6.1 Spec

| Champ                         | Type                                   | Description                                                         |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| `GET /api/internal/kb/search` | route                                  | server-only, Edge incompatible (Prisma + raw SQL)                   |
| **Query params**              |                                        |                                                                     |
| `q`                           | string, max 200 chars                  | requête utilisateur                                                 |
| `locale`                      | `'fr' \| 'en'`                         | par défaut header `Accept-Language` → fr                            |
| `type`                        | `KbType[]`                             | multi (`?type=article&type=faq`)                                    |
| `domain`                      | `KbDomain[]`                           | multi                                                               |
| `audience`                    | `KbAudience[]`                         | multi, **server-filtré par session** (anonyme = forcé `['public']`) |
| `tags`                        | `string[]`                             | tag slugs                                                           |
| `dateFrom` / `dateTo`         | ISO 8601                               | optionnels                                                          |
| `sort`                        | `'relevance' \| 'recent' \| 'helpful'` | default `'relevance'`                                               |
| `page`                        | int ≥ 1                                | default 1                                                           |
| `limit`                       | int 1-50                               | default 12                                                          |

### 6.2 Réponse

```ts
type SearchResponse = {
  results: Array<{
    id: string;
    slug: string; // /<locale>/<type-path>/<slug>
    type: KbType;
    domain: KbDomain;
    title: string;
    excerpt: string | null;
    snippet: string; // HTML avec <mark> sanitizé
    publishedAt: string; // ISO
    updatedAt: string;
    helpfulCount: number;
    pinned: boolean;
    featured: boolean;
    coverImageUrl: string | null;
    authors: Array<{ slug: string; name: string }>;
    rank: number; // debug only en dev
  }>;
  facets: {
    type: Array<{ value: KbType; count: number }>;
    domain: Array<{ value: KbDomain; count: number }>;
    tags: Array<{ id: string; slug: string; name: string; count: number }>;
  };
  total: number;
  page: number;
  pageCount: number;
  tookMs: number; // debug only en dev
  didYouMean: string[] | null; // suggestions trgm si total=0
};
```

### 6.3 Validation (Zod) + rate limit

- Schéma Zod `searchParamsSchema` (regroupé `src/server/actions/knowledge/_zod-schemas.ts`).
- **Rate limit** (mémoire `axionia_session_2026-05-09_sprint_24` rate-limit Redis bucket) :
  - Anonyme : **60 req/min/IP** (cohérent avec `/api/contact`).
  - Authentifié admin : 600 req/min/userId (debug, bulk testing).
  - Crawler (User-Agent Googlebot/...) : whitelist mais avec `cache-control: s-maxage=60`.

### 6.4 Caching

- **Pas de cache côté client** (privacy + facettes contextuelles, peu utile).
- **Cache server-side `unstable_cache`** (next 16) ou `cacheTag(['kb-search'])` pour requêtes populaires uniquement. Heuristique : ne cacher que si `q.length < 30 && filters.size <= 2 && page === 1` (couvre 80 % des hits). TTL 60 s. **Bust** sur tout event `kb.publish` / `kb.unpublish` / `kb.archive` via `revalidateTag('kb-search')`.
- **Header `Cache-Control`** pour edge Cloudflare : `s-maxage=30, stale-while-revalidate=60`. Pas de cache navigateur.

### 6.5 Endpoint admin contre endpoint public

**Décision Phase A** : 1 seul endpoint `/api/internal/kb/search` paramétré par session. Le RBAC est appliqué server-side :

- Session anonyme → `audiences = ['public']` forcé, `status = 'published'` forcé.
- Session client (NextAuth `client`) → `audiences = ['public', 'client']`, `status = 'published'`.
- Session admin (`reader`+) → `audiences` libre (jusqu'à `team`), `status` libre (incl. `draft`/`review`).
- Session `OWNER` (Will) → tout, incluant `audience='will-only'` et `confidentiality='secret'`.

Évite la duplication code + un cache miss inter-rôles ne pollue pas l'autre.

---

## 7. CIBLE V1.5 — pgvector + hybrid RRF

### 7.1 Préambule — modèle embedding

**Doctrine `claude-api`** : prompt caching obligatoire, sous-processeur déclaré. Or **Anthropic ne fournit pas d'API embeddings native en 2026-05** (la doctrine pointe vers Voyage AI pour les embeddings côté écosystème Anthropic). Trois candidats raisonnables :

| Modèle                          | Dim  | Coût input        | Multilingue     | Auto-hébergeable | Sous-processeur                    |
| ------------------------------- | ---- | ----------------- | --------------- | ---------------- | ---------------------------------- |
| **Voyage AI `voyage-3-large`**  | 1024 | $0.18 / 1M tokens | FR+EN OK        | non              | Voyage AI Inc. (US) — DPA standard |
| OpenAI `text-embedding-3-small` | 1536 | $0.02 / 1M tokens | FR+EN OK        | non              | OpenAI Ireland Ltd. (EU) — DPA OK  |
| OpenAI `text-embedding-3-large` | 3072 | $0.13 / 1M tokens | FR+EN excellent | non              | idem                               |
| **`bge-m3` (BAAI)**             | 1024 | $0 + RAM 2GB      | FR+EN OK        | OUI sur CPX32    | aucun — auto-hébergé               |

**Recommandation reality check** : **`bge-m3` auto-hébergé** via `text-embeddings-inference` (TEI) HuggingFace en container Coolify séparé (image `ghcr.io/huggingface/text-embeddings-inference:cpu-1.6`) pour éviter d'ajouter un sous-processeur. Coût marginal RAM (~2 GB) sur CPX32 (8 GB total), à valider Phase A STOP & ASK Will. Fallback en cas d'éviction OOM : OpenAI `text-embedding-3-small` (sous-processeur Ireland EU déjà acceptable RGPD).

**Doctrine** : le choix ne bloque pas V1 (FTS-only). C'est une décision V1.5, isolable.

### 7.2 Migration pgvector (Sprint KB-21, jamais avant)

```sql
-- À NE PAS EXÉCUTER EN PHASE A — spec V1.5 uniquement
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_translations
  ADD COLUMN IF NOT EXISTS embedding vector(1024); -- dim alignée au modèle retenu

-- Index ivfflat : compromise rappel/perf. lists ≈ sqrt(n_rows) (V1.5 = 10k → 100 lists).
-- Probes = 10 par défaut (à tuner).
CREATE INDEX IF NOT EXISTS knowledge_translations_embedding_ivfflat_idx
  ON knowledge_translations USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Alternative HNSW (pgvector 0.5+) — meilleur rappel mais build plus lent et plus de RAM.
-- À évaluer si bench ivfflat insuffisant (rappel < 0.9 sur 10k rows).
```

### 7.3 Pipeline d'embedding

Sur publish / update :

1. Concat `title + ' ' + excerpt + ' ' + body_text` (max 8 192 tokens, troncature word-aware).
2. Server action `embedEntry(entryId, locale)` :
   - Vérif RBAC `confidentiality NOT IN ('confidential','secret')` — refus dur si secret (test bloquant).
   - Appel API embedding (ou inference TEI local).
   - `UPDATE knowledge_translations SET embedding = $1 WHERE id = $2`.
3. Worker BullMQ `kb-embed-job` (mémoire `axionia_session_2026-05-09_sprints_15-23_audits`) avec retry 3× backoff exponentiel.
4. Sentry event `kb.embed.failed` si dernière tentative échoue.

### 7.4 Hybrid search RRF

Pattern Reciprocal Rank Fusion (Cormack et al. 2009, standard de facto 2024-2026) — combine rang FTS et rang cosine sans normaliser les scores (robuste à des scales différents).

```sql
WITH fts AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(...) DESC) AS r_fts
  FROM ... WHERE search_vector @@ websearch_to_tsquery(...) LIMIT 50
),
vec AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> :queryEmbedding LIMIT 50) AS r_vec
  FROM knowledge_translations WHERE locale=:locale ORDER BY embedding <=> :queryEmbedding LIMIT 50
)
SELECT
  COALESCE(fts.id, vec.id) AS id,
  (1.0 / (:rrfK + COALESCE(r_fts, 60))) + (1.0 / (:rrfK + COALESCE(r_vec, 60))) AS rrf_score
FROM fts FULL OUTER JOIN vec USING (id)
ORDER BY rrf_score DESC LIMIT :limit;
```

- **`k = 60`** est la valeur canonique de la littérature (Cormack & Clarke). À benchmarker contre `k = 40` et `k = 80` sur dataset Will (Sprint KB-21 bench). STOP & ASK §13 Q3.
- **Fallback rank** : 60 (≈ « pire que la 50e position du top-50 »). Évite NULL dans la div.
- **Optionnel rerank V1.5+** : Voyage `rerank-2` ou Cohere `rerank-multilingual-v3.0` sur top-K=20 hybrid → top-K=10 final. Coût ≈ $2/M docs. Décision Sprint KB-22 si volume justifie.

### 7.5 Endpoint `/api/internal/kb/rag` (V1.5)

Spec séparée Agent 10 (`10-AI-AUGMENTATION.md`). Réutilise la couche `hybridSearch()` server-side. Doit :

- Citer chaque source (URL slug + entryId + snippet).
- Refus si `confidentiality >= 'confidential'`.
- Cap réponse 1500 tokens.
- Cache 5 min par `(q + locale + topK)` hash.

---

## 8. COÛT EMBEDDINGS — chiffrage 3 scénarios

### 8.1 Hypothèses

- 1 entrée KB = ~5 KB texte plat ≈ **1 250 tokens** (moyenne FR+EN incl. tags+excerpt+body).
- 1 ré-embedding tous les **30 j en moyenne** (publish, mise à jour majeure, sinon stale OK).
- Embedding query side (recherche live) : **1 query = 1 embed** ≈ 50 tokens (cap 200).
- Trafic recherche estimé V1.5 : **500 req/jour** (recherche admin + public combinés, conservateur).

### 8.2 Calcul détaillé

#### Scénario 1 — 1 000 entrées

- Embeddings entrées : 1 000 × 1 250 = 1.25M tokens / mois (1 cycle complet)
- Embeddings queries : 500 × 30 × 50 = 750 k tokens / mois
- **Total : ~2M tokens / mois**

#### Scénario 2 — 10 000 entrées

- Embeddings entrées : 12.5M tokens / mois
- Embeddings queries : 750 k tokens / mois (même trafic search)
- **Total : ~13.25M tokens / mois**

#### Scénario 3 — 100 000 entrées

- Embeddings entrées : 125M tokens / mois
- Embeddings queries (trafic × 10) : 7.5M tokens / mois
- **Total : ~132.5M tokens / mois**

### 8.3 Coût mensuel par modèle (USD)

| Volume                    | bge-m3 (self-hosted) | OpenAI 3-small ($0.02/1M) | Voyage 3-large ($0.18/1M) | OpenAI 3-large ($0.13/1M) |
| ------------------------- | -------------------- | ------------------------- | ------------------------- | ------------------------- |
| 1k entrées (2M tok)       | **$0** + ~2 GB RAM   | $0.04                     | $0.36                     | $0.26                     |
| 10k entrées (13.25M tok)  | **$0** + ~2 GB RAM   | $0.27                     | $2.39                     | $1.72                     |
| 100k entrées (132.5M tok) | **$0** + ~4 GB RAM   | $2.65                     | $23.85                    | $17.23                    |

**Lecture** : même au scénario maxi 100k, OpenAI 3-small reste sous $3/mois. Le facteur déterminant est **RGPD / sous-processeur** (cf §9), pas le coût.

### 8.4 Coût total V1.5 (CPX32 amorti)

- Pas de Pinecone, pas de Weaviate Cloud, pas de Qdrant Cloud : **$0 stockage vector** (pgvector inclus dans Postgres existant).
- bge-m3 self-hosted : container TEI Coolify, RAM ≈ 2 GB partagée CPX32 (mémoire `axionia_hosting_hetzner` 8 GB total), **$0** infra.
- OpenAI 3-small back-up : ≤ $3/mois même scénario maxi.

**Verdict** : coût marginal négligeable. Décision V1.5 = arbitrage RGPD + qualité, pas budget.

---

## 9. RGPD — confidentialité + embedding

- Sous-processeur Anthropic / Voyage / OpenAI / HuggingFace **doit être listé dans `legal/sous-processeurs.ts`** AVANT activation V1.5 (mémoire `axionia_session_2026-05-09_sprint_24_1`).
- **Refus dur** : aucune entrée `confidentiality IN ('confidential','secret')` n'envoie son contenu à une API externe. Test bloquant côté server action `embedEntry`.
- **PII redaction** (mémoire `axionia_session_2026-05-09_sprint_24_1` Telegram) : `pii-redaction.ts` étendu pour scanner le `body_text` AVANT embedding externe. Si match → refus, log Sentry, alerte admin.
- **DPA** : Hetzner (auto-hébergé bge-m3 = aucun) / Cloudflare (déjà) + Stripe + DocuSeal (déjà). OpenAI / Voyage = à ajouter en cas de fallback.
- **Audit log** : event `kb.embed.created` + `kb.embed.refused` (raison) — étendre `ActivityLog` (mémoire `axionia_session_2026-05-09_sprint_24_1`).
- **Retention** : embedding supprimé si entrée passe `archived` + 90 j (cron `retention-purge` étendu Sprint KB-19, mémoire `axionia_session_2026-05-09_sprint_24`).

---

## 10. BENCH — cibles de performance

| Stack                                 | Volume      | Cible p50 | Cible p95    | Cible p99 | Justification                                                      |
| ------------------------------------- | ----------- | --------- | ------------ | --------- | ------------------------------------------------------------------ |
| **FTS V1**                            | 10k entrées | 30 ms     | **< 200 ms** | < 400 ms  | Web Vitals AGENTS.md, INP ≤ 100 ms compatible si rendering ≤ 50 ms |
| RAG V1.5 (embed + retrieve + LLM)     | 10k entrées | 400 ms    | **< 800 ms** | < 1500 ms | UX chatbot tolerable (mémoire `axionia_prompt_doc_sync` ?)         |
| Hybrid V1.5 (FTS + vec + RRF, no LLM) | 10k entrées | 80 ms     | **< 400 ms** | < 800 ms  | LCP friendly, fallback si embed API timeout                        |

Mesure : **k6 load test** (existe déjà Sprint Sign-off Complémentaire, mémoire `axionia_prompt_prod_signoff_complementaire`), parcours scripts à étendre :

- `tests/k6/kb-search-fts.js` : 50 VU, 30 s, queries random parmi top-1000 du dataset.
- `tests/k6/kb-search-rag.js` : 10 VU, 60 s, queries longues (≥ 50 chars).

GATE LHCI : `/recherche` doit conserver Performance ≥ 95, Accessibility = 100, Best Practices ≥ 95.

---

## 11. SURFACE PUBLIQUE `/recherche` — refonte Sprint KB-7

État actuel (`src/app/[locale]/recherche/page.tsx`) :

- Placeholder pur, 140 lignes, formulaire + liens statiques + JSON-LD `SearchAction`. Commentaire « Sprint 15 wires Postgres FTS » jamais honoré.
- `robots: { index: false, follow: true }` → page non indexée (OK conservé, on ne veut pas indexer les SERPs internes).

Refonte cible KB-7 :

1. **Client component minimal** : `<SearchInput />` debounce 250 ms + suggestions dropdown (top-5 entrées). Reste SSR pur.
2. **Server-side rendering** des 12 premiers résultats sur navigation `?q=` (no JS required).
3. **Facettes** : `<aside>` rail gauche (multi-select), URL state via searchParams.
4. **Pagination** SSR (`?page=2`), pas d'infinite scroll (mauvaise A11y).
5. **Empty state** : si `total=0` → block « Did you mean ? » (suggestions trgm fallback §3.3) + lien `/contact`.
6. **Heading SSOT** (mémoire `axionia_session_2026-05-12_interventions_hubs` heading SSOT créé) appliqué.
7. **Bundle ≤ 75 KB gz** (AGENTS.md). `<SearchInput>` ≤ 5 KB gz (juste useState + useDeferredValue).
8. **JSON-LD `SearchAction`** conservé tel quel (le `target` actuel est déjà conforme).

---

## 12. ANTI-PATTERNS À ÉVITER

1. **FTS sur HTML brut** : `to_tsvector(... body)` pollue avec balises. → utiliser `body_text` plain.
2. **FTS sans `unaccent`** : « evaluation » ne match pas « évaluation ». → config `fr_unaccent` + `english_stem` partout.
3. **`SELECT *` sans `LIMIT`** sur recherche : OOM sur grosse table. → toujours `LIMIT :limit OFFSET :offset` cappé à 50.
4. **Ranking applicatif post-SQL** : 2 round-trips, perte index GIN sargable. → SQL functions `IMMUTABLE`.
5. **Embedding `confidentiality='secret'` vers API externe** : breach RGPD. → refus dur server action.
6. **Cache résultats côté client** : leak audience cross-session. → no-store côté navigateur, cache uniquement edge (s-maxage).
7. **Tags non pondérés D** : on perd 30 % rappel sur requêtes courtes (« RAG », « audit »). → toujours setweight D.
8. **Index GIN sans `WHERE locale=:locale`** dans la requête : scan full table. → predicate locale obligatoire (le CASE dans search_vector ne suffit pas pour le planner).
9. **`ILIKE '%query%'`** comme fallback : sequential scan, p95 explose à 10k rows. → `pg_trgm` similarity + GIN.
10. **Tsquery non échappé** : input user `« audit & ia )` → exception SQL. → `websearch_to_tsquery` est safe par construction (parse-only), pas de `to_tsquery` brut avec input user.
11. **Recharger toute la table sur search** (prompt §5 anti-pattern explicite) : confirmé.
12. **Oublier `LIMIT`** (prompt §5 anti-pattern explicite) : confirmé.
13. **FTS sans `unaccent`** (prompt §5 anti-pattern explicite) : confirmé.
14. **Pagination par OFFSET large** : `OFFSET 10000` = scan complet. → V1 cap `page * limit ≤ 200` (≈ 17 pages × 12 résultats). Au-delà : keyset pagination (cursor `(rank, id)`).
15. **Mélange RBAC client + audience** sans test : leak `audience='team'` à un visiteur public. → tests E2E couvrant les 4 niveaux (anonyme, client, reader, owner).
16. **`ts_headline` sur `body` HTML** : balises dans le snippet. → `body_text` plain.
17. **Bust cache trop large** : `revalidatePath('/')` sur chaque publish = invalidation totale. → `revalidateTag('kb-search')` ciblé.
18. **Pas de cap `q.length`** : query 10 KB → DoS facile. → `z.string().max(200)` + 400 si dépassement.

---

## 13. STOP & ASK — décisions ouvertes Phase A

| #       | Question                                                            | Recommandation reality check                                                                                                | Bloquant V1 ?      |
| ------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Q1**  | Modèle embedding V1.5 retenu ?                                      | **`bge-m3` self-hosted** via TEI Coolify (RAM ~2 GB, $0 sous-processeur). Fallback `OpenAI text-embedding-3-small` si OOM.  | non (V1.5)         |
| **Q2**  | Dimension vector retenue ?                                          | **1024** (bge-m3 ou Voyage 3-large) si on évite OpenAI. **1536** si OpenAI 3-small retenu. Décide la migration `vector(N)`. | non (V1.5)         |
| **Q3**  | RRF k constant ?                                                    | **k = 60** standard littérature. Bench KB-21 confirme.                                                                      | non (V1.5)         |
| **Q4**  | 1 colonne `search_vector` CASE locale ou 2 colonnes `_fr` + `_en` ? | **1 colonne CASE locale** (1 index GIN au lieu de 2).                                                                       | OUI KB-7           |
| **Q5**  | Stratégie `tags_concat` : trigger DB ou recalcul application-side ? | **Application-side** dans server actions `updateEntry` / `addTag` / `removeTag`. Déterministe, testable.                    | OUI KB-7           |
| **Q6**  | Endpoint search admin vs public séparés ou unifiés ?                | **Unifié** avec RBAC server-side.                                                                                           | OUI KB-7           |
| **Q7**  | Cache server `unstable_cache` actif V1 ?                            | **OUI**, TTL 60 s, heuristique `q.length<30 && filters<=2 && page=1`. Bust sur `kb.publish`/`kb.unpublish`/`kb.archive`.    | non (KB-7+ tuning) |
| **Q8**  | Fallback fuzzy trgm si `total=0` ?                                  | **OUI**, mode dégradé block « Did you mean ».                                                                               | non (KB-7)         |
| **Q9**  | Bench cible p95 FTS = 200 ms acceptable ?                           | **OUI**, AGENTS.md INP ≤ 100 ms côté client compat.                                                                         | OUI KB-7           |
| **Q10** | Rerank model V1.5+ (Cohere / Voyage rerank-2) activé ?              | **NON V1.5**, à benchmarker Sprint KB-22 si qualité insuffisante.                                                           | non                |
| **Q11** | Index HNSW vs ivfflat V1.5 ?                                        | **ivfflat** V1.5 (build rapide, 100k rows OK). Migration HNSW si rappel < 0.9.                                              | non (V1.5)         |
| **Q12** | Tracking facette : referrer city tagué dans `kb_search` Plausible ? | **OUI** (mémoire `axionia_pseo_monitoring_tracking`) — extension du tracking pSEO existant.                                 | non (Sprint KB-20) |
| **Q13** | Suggest autocomplete V1 ou V1.5 ?                                   | **V1.5** — V1 reste search-on-submit (suffit).                                                                              | non                |

---

## 14. LIVRABLES SPRINT KB-7 (search) — récap pour le master plan

Sprint KB-7 « Recherche FTS unifiée » — chiffrage indicatif **2.5 dj** (Will solo) ou **1.5 dj** (Will + Claude binôme) :

1. Migration FTS knowledge*translations + config `english_stem` + index GIN (3 fichiers `migrations_fts/0003-0005*\*.sql`).
2. Server action `searchKnowledge()` + Zod `searchParamsSchema` (`src/server/actions/knowledge/search.ts`).
3. Endpoint `/api/internal/kb/search` (`src/app/api/internal/kb/search/route.ts`).
4. Refonte page publique `/recherche` (`src/app/[locale]/recherche/page.tsx`) — SSR + facettes + pagination + suggestions trgm fallback.
5. Tests : ≥ 8 unit (server action) + ≥ 4 integration (FTS + facettes + RBAC) + ≥ 2 E2E Playwright (anonyme + client) (≥ 14 tests total, cohérent §0.0 #18).
6. Plausible goals : `kb_search` + `kb_search_no_results` + `kb_search_did_you_mean_click`.
7. LHCI gate `/recherche` Performance ≥ 95.
8. Docs `_AUDIT/KNOWLEDGE-BASE-2026/SEARCH-RUNBOOK.md` (V1) + section ADR `0021-knowledge-base.md`.

Sprint KB-21 « pgvector + hybrid RAG » — chiffrage indicatif **4-5 dj** :

1. ADR `0022-pgvector-embeddings.md` (modèle, dim, sous-processeur tranchés Will).
2. Migration `CREATE EXTENSION vector` + colonne `embedding` + index ivfflat (`migrations_fts/0010_kb_pgvector.sql`).
3. Worker BullMQ `kb-embed-job` + container TEI Coolify (si bge-m3) ou client OpenAI SDK (si fallback).
4. Hybrid search SQL `searchKnowledgeHybrid()` avec RRF k=60.
5. Bench k6 RAG + Hybrid p95.
6. Tests retention purge embedding archived+90j.
7. Update `legal/sous-processeurs.ts` + DPA.

---

## 15. RÉFÉRENCES CROISÉES

- Reality check : `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md` §1.3, §1.4, §9.5.
- Prompt master : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` §0.0 (#10), §5 (Agent 5), §11 (sprints), §13 (chiffrage).
- FTS existant : `prisma/migrations_fts/0002_fts_setup.sql`.
- Init Postgres : `docker/postgres/init.sql`.
- Page recherche actuelle : `src/app/[locale]/recherche/page.tsx`.
- Doctrine Vitals : `AGENTS.md` (LCP ≤ 1800, INP ≤ 100, CLS = 0).
- Web Vitals audit : `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`.
- Plausible tracking : mémoire `axionia_plausible_ce_deploy_2026-05-13`.
- pii-redaction : `src/lib/pii-redaction.ts` (mémoire `axionia_session_2026-05-09_sprint_24_1`).
- Sous-processeurs : `src/content/subprocessors.ts` / `src/content/legal.ts`.

---

**Fin Agent 5.** AUDIT-ONLY confirmé : aucune migration jouée, aucun `pnpm add`, aucun commit. Recommandation forte = retenir Sprint KB-7 (FTS) sur la critical path Phase B et reporter Sprint KB-21 (pgvector) à un sprint dédié après validation qualité V1.
