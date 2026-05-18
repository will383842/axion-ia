# 15 — TYPE 4 : KB entries (Knowledge Base V4)

> Score : 78/100 — Status : 🟡 V1 partiel (FTS OK, vector stubbed, KB ingest externe livré, page publique livrée)

HEAD audité : `9c1adaa` (branche `main`). Auditeur : agent autopilot AUDIT-ONLY.

---

## 1. Description simple (Will-readable)

La Knowledge Base V4 est le « cerveau documentaire » d'Axion-IA. Elle stocke chaque article validé dans une table unique `KnowledgeEntry`. Le content-gen écrit dedans via une API HMAC (jamais directement) et la relit en lecture seule pour nourrir ses prompts (RAG). La KB sert aussi de source à la page publique `/connaissances`, qui n'affiche que les entrées triple-filtrées publiques.

## 2. Diagramme Mermaid (flow complet)

```mermaid
flowchart TD
  A[Admin /content-gen/settings/kb-ingest] -->|URL ou sitemap| B[server action ingestKbFromUrl / ingestKbFromSitemap]
  B --> C{respect robots.txt + ai.txt<br/>checkUrlAllowed}
  C -->|disallow| X1[skip URL]
  C -->|allowed| D[extractArticleFromUrl<br/>url-extractor.ts]
  D --> E[publishToKB<br/>kb-feeder.ts]
  E -->|HMAC X-KB-Signature + UUID v4| F[POST /api/internal/kb/ingest]
  F --> G[ingestEntry server action]
  G --> H{gates KB autoritaires<br/>1. PII scan<br/>2. Banned words<br/>3. Quality<br/>4. Dedup cosine >=0.92}
  H -->|422 fail| Y1[rejet définitif]
  H -->|202 pass| I[KnowledgeEntry row + KnowledgeTranslation FR]
  I --> J[searchKnowledge FTS]
  I --> K[generateEmbedding Voyage AI - stub V1]
  J --> L[retrieve - kb-client.ts]
  K --> L
  L --> M[generators LLM<br/>contexte RAG]
  I --> N[fetchPublicKbList / fetchPublicKbBySlug<br/>triple filtre public]
  N --> O[/fr/connaissances + /fr/connaissances/[slug]]
  I --> P[buildKnowledgeSitemapChunk]
  P --> Q[sub-sitemaps knowledge-1.xml..knowledge-N.xml]
  R[assertKbReady gate] -->|>=50 published + ratio>=60% + lastIngest<90j| MM[content-gen autorisé]
  R -->|fail KbNotReadyError| Z[content-gen bloqué]
```

## 3. Inputs / Outputs (fichier:ligne)

**Inputs**

- Admin UI ingest externe : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/kb-ingest/page.tsx:31` (server actions `ingestKbFromUrl` / `ingestKbFromSitemap` importées L19-22).
- URL ou sitemap externes : passés à `parseSitemap()` (`src/server/content-gen/kb-ingest/sitemap-parser.ts:115`) ou `extractArticleFromUrl()` (`src/server/content-gen/kb-ingest/url-extractor.ts:100`).
- Robots/AI gate avant chaque fetch : `checkUrlAllowed()` (`src/server/content-gen/kb-ingest/robots-respect.ts:257`), cache TTL 10 min (`robots-respect.ts:31`).
- Content-gen interne : générateurs appellent `publishToKB({...})` (`src/server/content-gen/kb-feeder.ts:76`).
- Mapping `ContentType -> KbType` figé : `kb-feeder.ts:38-48` (`landing_ville -> industry_use_case`, `blog_article -> article`, `qa_derived -> faq`, etc.).

**Outputs**

- Row Prisma `KnowledgeEntry` + `KnowledgeTranslation` (FR uniquement V1) créées par `ingestEntry` (`src/server/actions/knowledge/ingest.ts`, importé par `src/app/api/internal/kb/ingest/route.ts:27`).
- Tables liées (déclarées dans `prisma/schema.prisma`) : `KnowledgeVersion`, `KnowledgeTag`, `KnowledgeEmbedding`, `KnowledgeAuditLog`, `KnowledgeIngestRequest`, `KnowledgeSlugHistory` — **UNKNOWN — requires fact-check** (non lues dans cette session, à confirmer via `Grep "model Knowledge" prisma/schema.prisma`).
- Lecture interne RAG : `retrieve()` (`src/server/content-gen/kb-client.ts:50`) délégue à `searchKnowledge()` (`src/lib/knowledge/search-fts.ts`) — mode `fts` par défaut, `vector`/`hybrid` retombe sur FTS (`kb-client.ts:80-81` warmup embedding puis fallback FTS).
- Lecture publique : `fetchPublicKbList()` + `fetchPublicKbBySlug()` (`src/lib/knowledge/public-fetch.ts:32` + L121 si présent) — triple filtre `status=published` + `audience=public` + `confidentiality=public` + `deletedAt=null` + `publishedAt<=now` + embargo (cf L8-13).
- Pages publiques :
  - Hub `/fr/connaissances` : `src/app/[locale]/connaissances/page.tsx:64` (ISR revalidate 3600 L30, FR-only L39+L67).
  - Détail `/fr/connaissances/[slug]` : `src/app/[locale]/connaissances/[slug]/page.tsx:59` (ISR + `dynamicParams=true` L26).
- Sitemap : chunks `knowledge-<n>` déclarés par `generateSitemaps()` (`src/app/sitemap.ts:229-266`) ; chunk size = `SITEMAP_CHUNK_SIZE` (cf import L26 + L258), dispatch via `id.startsWith("knowledge-")` (`sitemap.ts:363-373`), builder `buildKnowledgeSitemapChunk()` (`src/server/exporters/knowledge-sitemap.ts`).
- Health gate : `assertKbReady()` (`src/server/content-gen/kb-health.ts:125`) consommée par `src/server/queue/workers/content-gen-worker.ts` (cf grep résultat).
- Admin view-only : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/kb-readonly/page.tsx:21` (groupBy par type + recent 25 L30-40).

## 4. Quality gates (ordre)

Côté **content-gen** avant POST ingest :

1. Magic-string stub build-time : `kb-feeder.ts` n'a pas de short-circuit explicite, mais la fetch tombe sur `siteUrl` qui en build GHA = `https://axion-ia.com` (cf L86). **UNKNOWN — requires fact-check** : vérifier que `publishToKB` n'est pas appelé pendant le SSG (sinon stubbed Prisma + appel HTTP réel sans secret = erreur silencieuse).
2. Validation HMAC config : `KB_INGEST_SECRET >= 32 chars` (`kb-feeder.ts:78-84`).
3. Idempotency UUID v4 généré côté caller (`kb-feeder.ts:87` `randomUUID()`).

Côté **route ingest** (`src/app/api/internal/kb/ingest/route.ts`) — ordre strict :

1. Kill-switch (`route.ts:65-75`) → 503 + `Retry-After: 300` si engagé.
2. Lecture secret env (`route.ts:78-89`) → 500 si manquant.
3. HMAC `X-KB-Signature` présent (`route.ts:91-94`) → 401.
4. Idempotency-Key UUID v4 (`route.ts:96-105`) → 400.
5. `verifyKbSignature` (`route.ts:108-110`) → 401.
6. Zod validation `IngestBodySchema` (`route.ts:113-120`) → 422 + `fieldErrors`.
7. Délégation à `ingestEntry()` (`route.ts:27`) qui applique les **4 gates autoritaires KB** (PII / banned-words / quality / dedup cosine ≥ 0.92) — cf commentaire `kb-feeder.ts:7-12`. Implémentation détaillée dans `src/server/actions/knowledge/ingest.ts` (non lue cette session, à valider).

Côté **health gate** appelé en début d'orchestrator content-gen :

8. `assertKbReady()` (`kb-health.ts:125`) → throw `KbNotReadyError` si `< 50 entries published` OU `canonicalRatio < 0.6` OU `daysSinceLast >= 90`. Bypass possible via `KB_BYPASS=true` (`kb-health.ts:38-41`). Mode dégradé silencieux si DB inaccessible (`kb-health.ts:100-118`).

Côté **lecture publique** :

9. Triple filtre strict `public-fetch.ts:36-44` (status+audience+confidentiality+deletedAt+publishedAt+embargo). Aucune route publique ne doit appeler `prisma.knowledgeEntry` direct (commentaire `public-fetch.ts:13-15`).

## 5. Tests existants (tableau)

| Fichier test                                                        | Lignes | `it(`/`test(` | Couverture                                                                                                         |
| ------------------------------------------------------------------- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/server/content-gen/kb-ingest/__tests__/url-extractor.spec.ts`  | 108    | 10            | Extraction `<main>`/`<article>`, strip script/style, MAX_BYTES, fetch timeout, wordCount min 100, robots fail-soft |
| `src/server/content-gen/kb-ingest/__tests__/sitemap-parser.spec.ts` | 135    | 7             | Parse urlset, parse sitemap-index récursif, MAX_URLS, decode XML entities                                          |
| `src/server/content-gen/kb-ingest/__tests__/robots-respect.spec.ts` | 83     | 8             | Disallow match, Allow override, Crawl-Delay, ai.txt opt-out, wildcard vs specific UA                               |
| `src/lib/knowledge/hmac.test.ts`                                    | 48     | 7             | `computeKbSignature` / `verifyKbSignature` timing-safe                                                             |
| `src/lib/knowledge/pii-scan.test.ts`                                | 53     | 9             | Détection emails/IBAN/tel/SSN                                                                                      |
| `src/lib/knowledge/banned-words.test.ts`                            | 67     | 9             | Liste mots bannis cas-sensitive / insensitive                                                                      |
| `src/lib/knowledge/quality-gates.test.ts`                           | 93     | 9             | Heuristic gates score / wordcount / readability                                                                    |
| `src/lib/knowledge/embeddings.test.ts`                              | 103    | n/c           | Voyage AI stub SHA-256 V1                                                                                          |
| `src/lib/knowledge/kill-switch.test.ts`                             | 67     | n/c           | `assertKillSwitchInactive`                                                                                         |
| `src/lib/knowledge/state-machine.test.ts`                           | 122    | n/c           | Transitions `draft -> review -> published -> deprecated`                                                           |
| `src/lib/knowledge/prisma-helpers.test.ts`                          | 301    | n/c           | Helpers Prisma KB (legacy mapping)                                                                                 |
| `src/lib/knowledge/legacy-mapping-additional.test.ts`               | 330    | n/c           | Mapping FAQ/case-study/help-article legacy → KB                                                                    |
| `src/lib/knowledge/seo-generator.test.ts`                           | 118    | n/c           | Slug + meta KB                                                                                                     |
| `src/lib/knowledge/locale-policy.test.ts`                           | 74     | n/c           | Politique FR canonique                                                                                             |
| `src/lib/knowledge/markdown-import.test.ts`                         | 113    | n/c           | Import MD → KnowledgeEntry                                                                                         |
| `src/lib/knowledge/tiptap-sanitize.test.ts`                         | 80     | n/c           | Sanitization HTML body Tiptap                                                                                      |
| `src/lib/knowledge/toc-readability.test.ts`                         | 85     | n/c           | TOC + readability score                                                                                            |
| `src/lib/knowledge/alt-text-validation.test.ts`                     | 51     | n/c           | Validation alt-text images                                                                                         |
| `src/lib/knowledge/kb-coverage.test.ts`                             | 91     | n/c           | Coverage KB par type/domaine                                                                                       |
| `src/lib/knowledge/legacy-import-mapping.test.ts`                   | 212    | n/c           | Import legacy global                                                                                               |

**Total** : 20 fichiers test KB / KB-ingest, ~2 250 lignes, ≥ 60 `it()`/`test()` cumulés (estimé sur grep + LOC).

## 6. Tests manquants

- **`kb-feeder.ts`** : aucun test direct sur `publishToKB()`. Gaps :
  - Réaction aux statuts 202 / 422 / 409 / 5xx (mock fetch).
  - Construction body conforme schéma Zod route (mapping `ContentType -> KbType`, champ `language: "fr"` literal).
  - Idempotency key format UUID v4.
- **`kb-health.ts`** : aucun test direct sur `getKbHealth()` / `assertKbReady()`. Gaps :
  - 3 seuils (50 / 0.6 / 90 jours) déclenchés individuellement.
  - `KB_BYPASS=true` court-circuite.
  - DB inaccessible (P2021) retourne bypass mode.
- **`kb-client.ts`** : aucun test sur `retrieve()`. Gaps :
  - Mode `vector` warmup + fallback FTS.
  - Filtres `types[]` / `audiences[]` propagés à `searchKnowledge`.
- **Route `/api/internal/kb/ingest`** : pas de test e2e route. Gaps :
  - Replay attack (idempotency-key déjà utilisé → 409).
  - Kill-switch engagé → 503.
  - HMAC invalide → 401 timing-safe.
- **`public-fetch.ts`** : pas de test sur triple filtre. Gap critique anti-leak drafts.
- **Page `/connaissances`** : pas de test Playwright/Vitest sur SSR + ISR.
- **`buildKnowledgeSitemapChunk` + dédup `buildExcludeSlugsByType`** : pas de test sur exclusion slugs (risque doublon sitemap-index).

## 7. Erreurs / edge cases

- **Build SSG GH Actions** : `publishToKB` ne doit JAMAIS être appelé pendant `next build` (DB stub `stub.invalid`, secret absent). À vérifier : aucun call-site n'est dans une page server component sans `force-dynamic` ni dans `generateStaticParams`. **UNKNOWN — requires fact-check** : `Grep -r "publishToKB" src/app`.
- **Réseau lent sur sitemap géant** : `parseSitemap` cap profondeur 2 + max 50 000 URLs (`sitemap-parser.ts:26+29+116`). Si sitemap-child > 50 MB → `null` silencieux (`L58-60`), donc URLs perdues sans alerte. Pas de log Sentry.
- **Crawl-Delay** : honored URL-par-URL (`url-extractor.ts:119-121`). Si une source impose 30s sur 50 URLs → ingest bloqué 25 min. Cap 30 s par delay (`robots-respect.ts:147`), mais multiplié par N URLs. Risque queue BullMQ timeout.
- **AI.txt opt-out** : retourne `allowed=false` (`robots-respect.ts:268-270`). Mais aucun event log/Sentry → invisible côté admin. Will ne sait pas pourquoi un site ne s'ingère pas.
- **Mapping `ContentType -> KbType` figé** (`kb-feeder.ts:38-48`) : si nouvel enum `ContentType` ajouté Prisma sans MAJ ici → erreur TypeScript build (bon) MAIS si record incomplet à runtime → `undefined` envoyé à Zod route → 422. Confirm : `Record<ContentType, KbType>` force exhaustivité au compile.
- **Health gate bypass mode silencieux DB-down** (`kb-health.ts:100-118`) : si la table `KnowledgeEntry` n'est pas migrée, on continue à générer du contenu **sans aucune KB**. Risque RAG vide → LLM hallucinations.
- **Page publique `/connaissances` ISR 3600s** : entry retirée de la KB met jusqu'à 1h à disparaître en CDN. Pas de purge programmatique liée à l'unpublish.
- **EN locale** : page hub renvoie `notFound()` si locale ≠ FR (`page.tsx:67`). Cohérent avec EN_LOCALE_DISABLED (cf `AGENTS.md`), mais le `generateMetadata` retourne `robots: noindex` plutôt que `notFound` (L39) — divergence robots vs page status.
- **Sitemap chunk count** : `Math.ceil((kbCount * 2) / SITEMAP_CHUNK_SIZE)` (`sitemap.ts:258`) — le `* 2` semble anticiper × 2 locales mais EN est filtré dynamiquement par `filterEnIfDisabled`. Risque chunks vides en queue de pagination. **UNKNOWN — requires fact-check** : impact crawl budget Google.
- **Dédup exclusion slugs** (`buildExcludeSlugsByType` `sitemap.ts:391-412`) : si un slug `case_study` migre TS → DB et reste dans `getAllCaseStudySlugs()`, il est exclu du sub-sitemap KB MAIS aussi du sub-sitemap cas-concrets (qui le ré-émet via builder TS). OK ici car le TS gagne par convention (`sitemap.ts:386`). Surveiller la coexistence.

## 8. Status global

🟡 **V1 partiel**. Pipeline ingest externe livré et testé (3 fichiers spec, ~25 it), health gate codé, page publique livrée avec triple filtre, sitemap chunké DB-aware. Manque : tests `kb-feeder` / `kb-health` / `kb-client` / `public-fetch` / route e2e, observabilité Sentry sur skip robots/ai.txt, et mode vector réel (Voyage AI live encore stubbed `kb-client.ts:80-81` cf commentaire L46-49 + `kb-feeder.ts:7-9`). Score 78/100. P1 immédiat : tester `publishToKB` + `assertKbReady` + `fetchPublicKbList`.
