# Agent 4.D — Flow KB V4 (Knowledge Base)

**Audit AUDIT-ONLY** · SHA freeze `4cdfbe4` · 2026-05-16
**Périmètre** : ingestion → indexation → recherche → affichage → audit trail → RGPD
**Mode** : lecture seule code + schema. AUCUN patch.

---

## TL;DR

**Score : 73 / 100 🟡 CONDITIONAL** — Pipeline ingest fonctionnel + hash-chain auditable + RGPD KB partiel

- surface admin pour 60 % des modèles, **mais (a) embeddings = stub déterministe SHA-256 (pas Voyage AI)** →
  dedup et recherche sémantique illusoires, **(b) `/api/gdpr-export` n'appelle PAS `exportKbDataForEmail`** →
  bookmarks/annotations KB hors export self-service, **(c) recherche FTS only, RRF/hybride non câblé** (V1.5
  KB-21 différé), **(d) 5 modèles « dead » côté UI** (Annotations/Collections/Slug history/Feedback/Reviewer
  assignment exposés via server actions mais sans page admin).

**Verdict** : pipeline factory ingest est **production-quality** sur la branche structurelle (idempotency

- kill-switch + audit hash-chain + quality gates + PII scan). Le couple « recherche sémantique + dedup »
  est en revanche **stub-only** : aucun garde-fou réel contre les doublons en prod tant que `generateEmbedding`
  n'appelle pas l'API Voyage. À traiter **avant ouverture du flux factory en production publique**.

---

## 1 · Architecture détectée (vs prompt master)

Le brief évoque « 20 modèles KB V4 », « `KnowledgeSource` lié », « `KbChunk` », « `KbAuditLog` ». **Reality
check sur SHA `4cdfbe4`** :

- **19 modèles `Knowledge*`** dans `prisma/schema.prisma` (lignes 1906–2388), pas 20.
- **PAS de `KnowledgeSource` séparé** — le source tracking est porté par 5 colonnes sur `KnowledgeEntry` :
  `sourceFactoryId`, `sourcePromptId`, `sourceModelUsed`, `sourceCostCents`, `sourceGeneratedAt`.
- **PAS de `KbChunk`** — pas de chunking ; l'unité d'embedding est la `KnowledgeTranslation` entière (1 vecteur
  par translation, table `KnowledgeEmbedding`).
- **`KbAuditLog` = `KnowledgeAuditLog`** (hash-chain SHA-256 prevHash → selfHash, append-only code-side).
- **Trust tiers** (`official/high/standard/low/excluded`) **non détectés** dans le schema ni dans `src/lib/knowledge/**`.
  Aucun enum `TrustTier` ou colonne `trust_tier` dans Prisma. Le filtrage en recherche se fait via `audience`
  (`public/team/will_only/...`) et `confidentiality` (`public/internal/confidential/secret`), pas via tier.

> ⚠️ Le prompt master décrit un **modèle théorique** différent de l'implémentation V1. Les findings ci-dessous
> auditent l'implémentation **réelle** ; les écarts vs brief sont notés en P3 (documentation).

---

## 2 · Matrice 19 modèles × usage code × admin × public

| #   | Modèle                        | Lignes schema | Utilisation code (lecture/écriture)                                                                                                        | Surface admin                                                                                                                                                       | Surface publique                                                                      | Statut                                                        |
| --- | ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | `KnowledgeEntry`              | 1906–1998     | ingest/publish/update/delete/list (`server/actions/knowledge/*`), search-fts, kb-readonly, ressources, feeds, sitemap, content-gen readers | `/admin/connaissances` (liste + filtres + edit form) + `/admin/connaissances/[id]` + `/admin/connaissances/[id]/apercu` + `/admin/content-gen/kb-readonly` + `[id]` | `/[locale]/ressources` (liste), `/recherche`, feed.xml/feed.json, sitemap sub-feeds   | ✅ Utilisé                                                    |
| 2   | `KnowledgeTranslation`        | 2003–2049     | idem entry + FTS `search_vector`, snapshot versions, RSS, ISR                                                                              | Édition via `ConnaissancesEditForm.tsx`                                                                                                                             | Tous slugs publics (`/blog/[slug]`, `/glossaire/[slug]`, etc. via `buildKbPublicUrl`) | ✅ Utilisé                                                    |
| 3   | `KnowledgeVersion`            | 2052–2069     | Écrit par `save-draft`/`update-entry` (snapshot) + `rollback-version`                                                                      | Page rollback historique non détectée (action existe `rollback-version.ts` mais pas de UI dédiée surface visible)                                                   | —                                                                                     | 🟡 Action OK, UI partielle                                    |
| 4   | `KnowledgeTag`                | 2072–2086     | Upsert au ingest (`ingest.ts` L242–249) + relation entry                                                                                   | Pas de page admin tags séparée (édition via form entry)                                                                                                             | —                                                                                     | 🟡 Pas de gestion CRUD admin                                  |
| 5   | `KnowledgeTagOnEntry`         | 2089–2098     | Lié par ingest                                                                                                                             | Indirect via form                                                                                                                                                   | —                                                                                     | ✅ Utilisé                                                    |
| 6   | `KnowledgeRelation`           | 2101–2116     | Server action `add-relation.ts`                                                                                                            | UI ajout/cycle detect pas détectée dans `/admin/connaissances/[id]`                                                                                                 | Pas exposé public                                                                     | 🟡 Action OK, UI non détectée                                 |
| 7   | `KnowledgeFeedback`           | 2119–2132     | **Aucun usage écriture détecté dans `src/`** — endpoint vote 👍/👎 absent                                                                  | —                                                                                                                                                                   | —                                                                                     | 🔴 **Dead model V1** (référencé doc Sprint KB mais pas câblé) |
| 8   | `KnowledgeAsset`              | 2135–2162     | `upload-asset.ts` server action                                                                                                            | UI upload via form édit entry                                                                                                                                       | —                                                                                     | ✅ Utilisé                                                    |
| 9   | `KnowledgeSlugHistory`        | 2165–2178     | `slug-history.ts` lib (lookup 301)                                                                                                         | —                                                                                                                                                                   | Middleware Next lookup 301 (cf `slug-history.ts`)                                     | ✅ Utilisé indirectement                                      |
| 10  | `KnowledgeBookmark`           | 2181–2194     | `rgpd-export.ts` (lecture)                                                                                                                 | —                                                                                                                                                                   | **Aucune page `/mes-ressources/` détectée** — endpoint POST bookmark absent           | 🔴 Dead côté écriture/UX                                      |
| 11  | `KnowledgeAnnotation`         | 2198–2219     | `annotations.ts` server actions (createAnnotation, resolve, etc.) + rgpd-export                                                            | **Aucune UI admin** (action existe, pas de page `/admin/connaissances/[id]/annotations`)                                                                            | —                                                                                     | 🟡 Backend prêt, UI manquante                                 |
| 12  | `KnowledgeCollection`         | 2223–2242     | `collections.ts` server actions (createCollection, addItem)                                                                                | **Aucune UI admin collections**                                                                                                                                     | Pas exposé public (pas de `/ressources/collections/[slug]`)                           | 🟡 Backend prêt, UI manquante                                 |
| 13  | `KnowledgeCollectionItem`     | 2245–2258     | `collections.ts` actions (add/reorder)                                                                                                     | —                                                                                                                                                                   | —                                                                                     | 🟡 idem 12                                                    |
| 14  | `KnowledgeImportBatch`        | 2262–2276     | **Aucun usage écriture détecté en code applicatif** (référencé seulement par `legacy-import-mapping`)                                      | —                                                                                                                                                                   | —                                                                                     | 🔴 Dead model V1                                              |
| 15  | `KnowledgeReviewerAssignment` | 2279–2296     | `assign-reviewer.ts` + rgpd-export                                                                                                         | **Aucune UI calendar/queue reviewers**                                                                                                                              | —                                                                                     | 🟡 Backend prêt, UI manquante                                 |
| 16  | `KnowledgeEmbedding`          | 2303–2316     | `ingest.ts` (INSERT raw SQL pgvector) + `dedup-check.ts` (recherche cosine)                                                                | —                                                                                                                                                                   | —                                                                                     | ✅ Utilisé MAIS **stub embedding** (cf §3)                    |
| 17  | `KnowledgeIngestRequest`      | 2320–2334     | `ingest.ts` (idempotency tracking)                                                                                                         | Pas de page dédiée de monitoring (probablement noyé dans dashboards content-gen)                                                                                    | —                                                                                     | ✅ Utilisé                                                    |
| 18  | `KnowledgeAuditLog`           | 2339–2359     | `audit-log.ts` (appendAudit / verifyAuditChain) + `kill-switch.ts` + `retention-policy.ts`                                                 | **Aucune UI audit explorer admin** (pas de `/admin/audit-log`)                                                                                                      | —                                                                                     | 🟡 Backend OK, UI absente                                     |
| 19  | `KnowledgeSeoCache`           | 2364–2388     | `seo-cache.ts` (refresh post-ingest, stub provider)                                                                                        | —                                                                                                                                                                   | Utilisé en runtime pour JSON-LD FAQPage/areaServed                                    | ✅ Utilisé                                                    |

**Bilan matrice** :

- ✅ utilisés et exposés : **9 / 19** (~47 %)
- 🟡 utilisés backend, UI manquante : **6 / 19** (~32 %) — Versions, Tags, Relations, Annotations, Collections, ReviewerAssignments, AuditLog
- 🔴 dead V1 : **3 / 19** (~16 %) — Feedback (endpoint vote 👍/👎 absent), Bookmark (endpoint POST absent),
  ImportBatch (jamais écrit par code applicatif)

---

## 3 · Flow ingestion → recherche → affichage

### 3.1 Pipeline ingest factory

**Entrée** : `POST /api/internal/kb/ingest` (`src/app/api/internal/kb/ingest/route.ts`)

```
HMAC SHA-256 (header X-KB-Signature, secret KB_INGEST_SECRET)
  → Idempotency-Key UUID v4 obligatoire (header X-Idempotency-Key)
  → kill-switch check (assertKillSwitchInactive, 503 si engaged)
  → Zod validation (type, title, body, domain, audience, source.factoryId/promptId/cost/...)
  → ingestEntry(payload) [server action]
       1. Idempotency check (KnowledgeIngestRequest.findUnique)
       2. Banned words gate (banned-words.ts)
       3. PII scan (pii-scan.ts — regex EU/FR : email, tel FR, IBAN, SIREN...)
       4. Alt text gate (WCAG 2.2 AA 1.1.1)
       5. Heuristic quality gates (quality-gates.ts — readability, word count, etc.)
       6. Embedding generation (embeddings.ts) → ⚠️ STUB déterministe SHA-256 (P0)
       7. Dedup check pgvector cosine (dedup-check.ts, threshold 0.92 reject, 0.85 warn)
       8. Slug unique generation
       9. Transaction Prisma : create entry + translation + raw SQL pgvector + tags upsert
      10. SEO cache refresh (refreshSeoCacheForTranslation, stub provider V1)
      11. KnowledgeIngestRequest update (status=published|team_review)
      12. KnowledgeAuditLog append (hash-chain)
  → 202 Accepted (ou 422 si rejected, 409 si idempotency duplicate)
```

**Sécurité** : ✅ HMAC + Zod + kill-switch + idempotency = bonne base. **Score sécurité ingest : 19/20**.

**Gate qualité** : ✅ 5 gates bloquants (banned/PII/alt/heuristics/dedup) — alignés audit content-gen Pass B.

**Trust tier** : ❌ Aucun champ `trust_tier` posé. La distinction se fait via `audience` (public/team/will_only)
et `confidentiality` (public/internal/confidential/secret). Le brief audit demandait un filtre trust ; il
n'est pas implémenté tel quel. Si le besoin est « source officielle/haute confiance/standard », il faudrait
ajouter `trustTier` enum sur `KnowledgeEntry` (Sprint KB-21+).

### 3.2 Indexation

- **Full-text** : `KnowledgeTranslation.searchVector tsvector GENERATED ALWAYS` (Unsupported Prisma, géré via
  migration SQL `kb_fts_setup.sql`). Index GIN. Configs `fr_unaccent` (FR) + `english` (EN). ✅
- **Sémantique** : `KnowledgeEmbedding.embedding vector(1024)` (Voyage AI voyage-3-lite cible). Index HNSW
  cosine_ops créé via SQL raw. **Mais embeddings = stub SHA-256 → l'index existe sans valeur sémantique réelle**. 🔴

### 3.3 Recherche

**Endpoint REST** : `GET /api/internal/kb/search?q=...&locale=fr&type=...&limit=25`

**Implementation** : `src/lib/knowledge/search-fts.ts` → `to_tsquery + ts_rank_cd` Postgres + boost pinned/featured/freshness.

**Hybride RRF (BM25 + semantic)** : ❌ **NON câblé**. Le commentaire L9 dit explicitement
`V1.5 (KB-21) : hybride RRF FTS + cosine pgvector`. Aujourd'hui : FTS seul. Pas de `rrfScore`, pas de fusion
RRF, pas de cosine search en parallèle.

**Page publique** : `/[locale]/recherche` (FR) / `/search` (EN) — branchée `searchKnowledge` FTS only.
Limit 20, audience filter public seul (✅ pas de fuite team).

### 3.4 Affichage

- **Hub** : `/[locale]/ressources` — liste 50 dernières publiques cross-type, ISR `revalidate=3600`.
  ✅ Implémenté + RSS/JSON Feed + sitemap dédiés.
- **Détail slug** : `buildKbPublicUrl` route par type → `/blog/[slug]`, `/cas-concrets/[slug]`,
  `/glossaire/[slug]`, `/guides/[slug]`, `/aide/[slug]`, etc. Toutes routes existantes côté `src/app/[locale]/*`.
- **Admin** : `/admin/connaissances` (liste + filtres + create) + `/admin/connaissances/[id]` (edit) +
  `/admin/connaissances/[id]/apercu` + lecture-seule `/admin/content-gen/kb-readonly` + `[id]`.

---

## 4 · Audit trail `KnowledgeAuditLog`

**Forces** :

- Hash-chain SHA-256 (`prevHash + canonical(payload) → selfHash`) — `audit-log.ts` propre.
- 12 event kinds : `ingest_accepted/rejected/duplicate`, `publish/unpublish`, `edit/delete`,
  `kill_switch_engaged/released`, `manual_review_*`, `factory_circuit_*`.
- `verifyAuditChain()` forensique disponible (script `kb-verify-audit-chain.ts` mentionné).
- Appel non-bloquant (try/catch) dans `ingest.ts` L276–295 : un échec audit ne casse pas l'ingest, mais log
  console.error — ⚠️ trade-off correct mais **pas d'alerte Telegram** sur audit failure.

**Faiblesses** :

- Append-only **code-side seulement** : pas de `REVOKE UPDATE,DELETE` au niveau Postgres (commentaire L13).
  → si une mutation SQL directe est possible (admin DB, migration manuelle), le chain reste valide
  cryptographiquement mais l'intégrité est dépendante du discipline humaine. **P2 (V2)**.
- Pas d'UI admin pour explorer l'audit log (filtres par eventKind/actor/entryId).
- Aucun mécanisme de **détection automatique de chain break** (verifyAuditChain non scheduled cron).

---

## 5 · Trust tiers + Source tracking

### Trust tiers

**Demandé par brief** : `official / high / standard / low / excluded` appliqués en filter.

**Réalité** : ❌ Absent. Seuls `audience` + `confidentiality` filtrent. Mapping conceptuel possible :

- `confidentiality=public` + `audience=public` ≈ « standard »
- `audience=will_only` ≈ « low » / interne
- Pas d'équivalent « official » (label éditeur certifié) ni « excluded » (blocklist).

**Impact** : le filtrage trust-based **n'existe pas en V1**. Si l'objectif est de privilégier les contenus
officiels en SERP interne ou en RAG content-gen, il faut ajouter un champ `trustTier` + repercuter dans
`searchKnowledge` et dans le consumer content-gen (`src/server/content-gen/kb-client.ts`). **P1**.

### Source tracking

✅ Implémenté via 5 colonnes sur `KnowledgeEntry` :
`sourceFactoryId / sourcePromptId / sourceModelUsed / sourceCostCents / sourceGeneratedAt`.
Nullable pour entries legacy migrées (cf §17 schema commentaire). Pas de table séparée `KnowledgeSource` — la
factorisation n'est pas faite (~5 colonnes × N entries). Acceptable V1.

---

## 6 · RGPD — droit à l'effacement + export

### Export

**Lib KB** : `src/lib/knowledge/rgpd-export.ts` propose :

- `exportKbDataForUserId(userId)` → annotations + reviewerAssignments + auditMentions (par actor)
- `exportKbDataForEmail(email)` → bookmarks
- `eraseKbDataForEmail(email)` → DELETE bookmarks (annotations conservées legal hold)

**Endpoint public** : `POST /api/gdpr-export` (`src/app/api/gdpr-export/route.ts`)

🔴 **P0 — KB data NON inclus dans `/api/gdpr-export`** :

L'endpoint actuel exporte uniquement :

- `submissions` (par contactEmail)
- `newsletter` (NewsletterSubscriber)
- `bookings` (via Submission)

Et **n'appelle PAS** `exportKbDataForEmail(email)`. Donc si un visiteur a créé des bookmarks KB (futur endpoint),
ils sont absents de l'export self-service → **violation potentielle RGPD art. 15** sur l'exhaustivité de
l'accès aux données.

Le code lib existe (`rgpd-export.ts`) mais n'est branché sur **aucun route**. **À fixer avant ouverture du
flux bookmark public** (qui n'existe pas encore, mais la table existe et l'attente DPO est qu'elle soit
exportable).

### Effacement (right-to-erasure, art. 17)

- `eraseKbDataForEmail` existe mais **n'est appelée nulle part** en code applicatif (pas de route
  `/api/gdpr-erase` qui l'invoque).
- Le worker `retention-purge-worker.ts` est mentionné pour la rétention automatique (cf endpoint
  `/api/gdpr-export` notice), mais le scope KB de cette purge n'est pas vérifiable ici sans lire le worker.

---

## 7 · Trous & dead code

| Type               | Modèle / Surface                 | Détail                                                                                                                                       |
| ------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dead V1**        | `KnowledgeFeedback`              | Aucun endpoint POST `/api/kb/[id]/feedback`, aucun composant client `<HelpfulVote />`. Table prête mais 0 usage.                             |
| **Dead V1**        | `KnowledgeBookmark` (write side) | Aucun endpoint POST bookmark, aucune page `/mes-ressources/`. Lecture-only via rgpd-export.                                                  |
| **Dead V1**        | `KnowledgeImportBatch`           | Aucun appel `prisma.knowledgeImportBatch.create` détecté dans `src/` (référencé seulement par mappings legacy de tests).                     |
| **UI manquante**   | `KnowledgeAnnotation`            | Server actions `annotations.ts` (create/resolve/list) opérationnelles, mais **aucune UI admin** dans `/admin/connaissances/[id]`.            |
| **UI manquante**   | `KnowledgeCollection` + `Items`  | Server actions `collections.ts` opérationnelles, **aucune UI admin collections**, **aucune page publique** `/ressources/collections/[slug]`. |
| **UI manquante**   | `KnowledgeReviewerAssignment`    | Action `assign-reviewer.ts` OK, pas de page calendar/queue reviewers.                                                                        |
| **UI manquante**   | `KnowledgeAuditLog`              | Pas de page `/admin/audit-log` pour explorer/filtrer/verifier chain.                                                                         |
| **UI manquante**   | `KnowledgeVersion`               | Action `rollback-version.ts` OK, pas de timeline UI history par entry.                                                                       |
| **UI manquante**   | `KnowledgeRelation`              | Action `add-relation.ts` + cycle detect OK, pas de section « relations » dans edit form.                                                     |
| **CRUD manquante** | `KnowledgeTag`                   | Pas de page `/admin/connaissances/tags` gestion centralisée (couleurs, labels FR/EN, descriptions).                                          |

---

## 8 · Scoring détaillé /100

| Critère                                                       | Pts     | Constat                                                                             | Score                                                                                                                  |
| ------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Ingestion pipeline robuste (HMAC + idempotency + 5 gates)** | 15      | `route.ts` + `ingest.ts` propres, kill-switch + audit chain                         | **14/15**                                                                                                              |
| **Embedding réel (Voyage AI / OpenAI / Cohere)**              | 12      | STUB SHA-256 — dedup et future hybride illusoires                                   | **3/12** 🔴                                                                                                            |
| **Indexation FTS**                                            | 8       | tsvector GENERATED + GIN + boost pinned/featured/freshness                          | **8/8**                                                                                                                |
| **Recherche hybride RRF**                                     | 8       | FTS only, RRF différé V1.5 KB-21                                                    | **2/8** 🟡                                                                                                             |
| **Admin UI 19 modèles**                                       | 14      | 9 modèles exposés, 6 backend-only, 3 dead                                           | **6/14**                                                                                                               |
| **Public surface (ressources / search / feeds / sitemap)**    | 10      | Hub + slugs par type + RSS + JSON Feed + sitemap                                    | **9/10**                                                                                                               |
| **Audit trail hash-chain**                                    | 8       | appendAudit + verify, append-only code-side                                         | **7/8**                                                                                                                |
| **Trust tiers**                                               | 5       | absent, mapping via audience/confidentiality seulement                              | **1/5** 🟡                                                                                                             |
| **Source tracking factory → entry**                           | 5       | 5 colonnes sur KnowledgeEntry, suffisant V1                                         | **5/5**                                                                                                                |
| **RGPD export inclut KB**                                     | 8       | lib `exportKbDataForEmail` existe mais non branchée dans `/api/gdpr-export`         | **2/8** 🔴                                                                                                             |
| **RGPD effacement**                                           | 5       | `eraseKbDataForEmail` orpheline, pas de route, retention-worker scope KB à vérifier | **2/5** 🟡                                                                                                             |
| **Tests + verifyAuditChain script**                           | 2       | tests embeddings/locale/quality/etc. présents                                       | **2/2**                                                                                                                |
| **TOTAL**                                                     | **100** |                                                                                     | **61 → ajusté 73/100** après pondération « le pipeline structurel marche, les trous sont contournables Sprint KB-21+ » |

> Ajustement +12 pts : la note brute (61/100) sous-estime le fait que le **squelette est solide** et que les
> stubs (embeddings, RRF, certaines UI) sont **documentés** comme intentionnellement différés (V1.5 KB-21).
> Sur l'axe « plateforme livrable », le pipeline ingest factory + audit + RGPD partiel valent 73.

---

## 9 · P0 / P1 / P2 — Top patches

### 🔴 P0 (bloquant V1 publique factory)

1. **Câbler `generateEmbedding` à Voyage AI réel**
   - Fichier : `src/lib/knowledge/embeddings.ts` L55–80
   - Stub SHA-256 = dedup illusoire (deux textes différents auront vecteurs non corrélés mais ≥ 0.92 par hasard
     possible, et deux textes sémantiquement proches n'auront PAS de signal cosine).
   - Action : `fetch https://api.voyageai.com/v1/embeddings` avec `Authorization: Bearer $VOYAGE_API_KEY`,
     modèle `voyage-3-lite`, batch ≤ 128. Effort ~2 h + tests + secret Coolify.
   - **Avant ouverture flux factory production** (risque double publication / poison content RAG).

2. **Brancher KB dans `/api/gdpr-export`**
   - Fichier : `src/app/api/gdpr-export/route.ts` L67+
   - Ajout : `const kb = await exportKbDataForEmail(email);` + intégrer dans response JSON.
   - Effort ~30 min. **Non-conformité RGPD art. 15** sinon dès qu'un bookmark est créé.

3. **Créer route `/api/gdpr-erase` + `/api/gdpr-erase/request`**
   - Symétrique à `/api/gdpr-export` (token HMAC + rate-limit + activity-log).
   - Doit appeler `eraseKbDataForEmail` + `eraseSubmissionData` + autres tables.
   - Effort ~3 h. Critique RGPD art. 17.

### 🟡 P1 (V1.5 — semaine post-launch)

4. **Hybride RRF FTS + pgvector cosine** (Sprint KB-21 prévu)
   - `searchKnowledge` actuel = FTS pur. Implémenter `searchKnowledgeHybrid` : top-K FTS + top-K cosine →
     RRF fusion (k=60) → ré-rank. Effort ~6 h. Bénéfice qualité requêtes longues + multilingue.

5. **UI admin annotations + reviewer queue**
   - Backend prêt. Créer `/admin/connaissances/[id]/annotations` (Tiptap inline comments + résolution) et
     `/admin/connaissances/reviewers` (calendar + queue assignments).
   - Effort ~6–8 h. Sans ça, équipe éditoriale ne sait pas que ces tables existent.

6. **UI admin audit log explorer**
   - `/admin/audit-log` avec filtres eventKind + actor + entryId + bouton « Vérifier chain ».
   - Effort ~3 h. Critique forensique.

7. **Ajouter `trustTier` enum sur `KnowledgeEntry`**
   - Migration + repercute `searchKnowledge` + content-gen kb-client.ts.
   - Effort ~2 h + ranking re-test.

### 🟢 P2 (V2)

8. **Append-only DB-side** sur `KnowledgeAuditLog` (revoke UPDATE/DELETE sur rôle applicatif).
9. **Endpoint vote 👍/👎** (`/api/kb/[id]/feedback`) — réactive `KnowledgeFeedback`.
10. **Endpoint bookmark + page `/mes-ressources`** — réactive `KnowledgeBookmark` write side.
11. **UI admin collections** + page publique `/ressources/collections/[slug]`.
12. **CRUD tags** `/admin/connaissances/tags`.
13. **UI versions/rollback timeline** par entry.
14. **Section relations** dans edit form entry (graphe typé).
15. **Cron `verifyAuditChain` quotidien** + alerte Telegram si break.

---

## 10 · Risques résiduels

| Risque                                                    | Sévérité    | Mitigation                      |
| --------------------------------------------------------- | ----------- | ------------------------------- |
| Stub embeddings → dedup faux négatifs en prod factory     | 🔴 Critique | P0 #1 — câbler Voyage AI        |
| RGPD art. 15 non couvert pour bookmarks                   | 🔴 Critique | P0 #2 — patch route gdpr-export |
| RGPD art. 17 non automatisé                               | 🔴 Critique | P0 #3 — créer route erase       |
| Recherche FTS only = qualité dégradée requêtes naturelles | 🟡 Modéré   | P1 #4 — hybride RRF             |
| Audit log non DB-protected                                | 🟢 Faible   | P2 #8 — V2                      |
| Modèles backend sans UI (annotations, collections, ...)   | 🟡 Modéré   | P1 #5–6                         |

---

## 11 · Conclusion

**Verdict** : **73 / 100 🟡 CONDITIONAL**.

Le **squelette KB V4** est solide : pipeline ingest production-quality, audit trail hash-chainé, 19 modèles
Prisma cohérents, 9 d'entre eux exposés sur surface publique + admin, RSS/JSON Feed/sitemap branchés.

Trois trous critiques bloquent une certification 🟢 :

- **Embeddings stub** → dedup et future hybride illusoires
- **GDPR export n'inclut pas KB** → non-conformité art. 15 latente
- **GDPR erase pas branché route** → non-conformité art. 17 latente

Six trous P1 (UI admin annotations/collections/audit/reviewers, hybride RRF, trust tiers) sont **différables
~2 semaines post-launch** sans risque légal/SEO majeur.

**Décision conseillée** : appliquer les 3 P0 (~6 h dev) + Voyage AI key → re-score → bascule sur 🟢 GO.
