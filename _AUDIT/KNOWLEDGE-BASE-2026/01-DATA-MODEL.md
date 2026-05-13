# 01 — DATA MODEL — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`
> Agent : 1 — Taxonomie & schéma de données
> Date : 2026-05-13
> Statut : DRAFT (Phase A audit-only — zéro modification de `prisma/schema.prisma`)
> Référence : HEAD `main` (commit `95bba36`), seed contextuel `00-REALITY-CHECK.md`

---

## 0. TL;DR

- 13 modèles `Knowledge*` proposés (12 V1 + 1 V1.5 `KnowledgeEmbedding`).
- 7 enums dédiés (`KbType`, `KbDomain`, `KbAudience`, `KbConfidentiality`, `KbStatus`, `KbPipelineStage`, `KbRelationKind`) — **aucun n'étend `PublishStatus`** (recommandation forte : isoler la doctrine éditoriale de la doctrine booking).
- Pattern `KnowledgeEntry` (structural, common) + `KnowledgeTranslation` (locale-scoped, body Tiptap triple-source HTML/JSON/text) **strictement aligné sur `Article` + `ArticleTranslation` existants** (Sprint 24 C4 — `00-REALITY-CHECK.md §1.1`).
- Migration zero-downtime **expand → backfill → contract** sur 4 modèles legacy (`Article`, `CaseStudy`, `FAQ`, `HelpArticle`) + 2 hardcode (`/glossaire`, `/guide-ia`).
- `KnowledgeEmbedding` table dédiée séparée (V1.5) avec `vector(1024)` — extension `pgvector` à charger en Sprint KB-21 (cf. `00-REALITY-CHECK.md §1.3`, pgvector absent en V1).
- 8 STOP & ASK ouverts numérotés (§9).
- Volumétrie prod : palier 1k = 50 MB body, 10k = 500 MB, 100k = 5 GB ; assets cover ≈ 100 MB pour 1 k entries.

---

## 1. PRINCIPES DIRECTEURS DU SCHÉMA

| Principe                                                                                    | Justification                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 entrée polymorphique** (`KnowledgeEntry`) plutôt qu'1 table par type                    | DRY, recherche cross-type triviale, surface admin unique. Compense le risque "fourre-tout" par enums stricts (`KbType`) + indexes ciblés.                                                                                                                     |
| **Triple-source body** (`bodyJson` canonique + `body` HTML rendered + `bodyText` plain)     | Pattern Sprint 24 C4 déjà éprouvé (`ArticleTranslation.bodyJson/bodyText`, `HelpArticleTranslation.bodyJson/bodyText`, `CaseStudyTranslation.problemJson/problemText/solutionJson/solutionText`). FTS pointe sur `bodyText` (clean — cf. reality check §1.4). |
| **Locale-scoped translations** dans une table dédiée plutôt que colonnes `_fr`/`_en` inline | Cohérent avec `ArticleTranslation`/`CaseStudyTranslation`/`HelpArticleTranslation`. Évite le pattern `FAQ.questionFr` (rigide, casse l'ajout de locales futures).                                                                                             |
| **Soft-delete** (`deletedAt`) sur `KnowledgeEntry` et `KnowledgeAsset`                      | Récupération possible 30 j (cf. retention-purge Sprint 24, `00-REALITY-CHECK.md §4.1`). Status `archived` ≠ `deletedAt` (cf. STOP & ASK 7).                                                                                                                   |
| **Audit log externalisé** via `ActivityLog` existant (events `kb.*`)                        | Pas de nouvelle table — réutilise infra (`00-REALITY-CHECK.md §1.1`).                                                                                                                                                                                         |
| **Versions immutables** (`KnowledgeVersion`) — pas de `updatedAt`                           | Audit forensic, restore exact, comparaison diff.                                                                                                                                                                                                              |
| **Indexes composites stratégiques**                                                         | Listes filtrables admin (`type, status, audience`), public hub (`type, publishedAt`), revue (`reviewDueAt`), expiration RGPD (`expiresAt`).                                                                                                                   |
| **Author existant conservé** (pas de `KnowledgeAuthor` neuf)                                | `Author` (`schema.prisma` 791-806) est déjà bilingue avec slug/bio/avatar/linkedin. STOP & ASK 5 propose l'étendre via FK directe `KnowledgeEntry.assignedAuthorId → Author`.                                                                                 |

---

## 2. ENUMS PROPOSÉS

### 2.1 `KbType` — 16 valeurs

```prisma
enum KbType {
  article           // Blog
  case_study        // Cas concret
  help_article      // Centre d'aide
  faq               // Question fréquente
  glossary_term     // Terme glossaire
  guide             // Guide IA long-form
  methodology       // Méthodologie (interne ou publique)
  doctrine          // Doctrine Axion-IA (interne ou cliente)
  adr               // Architecture Decision Record (interne)
  prompt_template   // Template de prompt (interne)
  sop               // Standard Operating Procedure (interne)
  post_mortem       // Post-mortem (interne)
  tool_card         // Fiche outil (interne ou cliente)
  competitor_card   // Fiche concurrent (interne)
  commercial_doc    // Document commercial (interne ou client)
  onboarding_step   // Étape onboarding (client)
}
```

**Justification** : alignement strict §12.1 du master prompt. Aucune valeur traduite (DB stable). Ajout de valeur ultérieure = migration `ALTER TYPE ... ADD VALUE` (non-bloquant Postgres).

### 2.2 `KbDomain` — 10 valeurs

```prisma
enum KbDomain {
  commercial
  technical
  legal
  hr
  product
  client
  watch          // Veille marché
  internal
  editorial
  methodology
}
```

**Justification** : §12.2 master prompt. Une entrée appartient à exactement 1 domaine (relation 1:1, pas N:N). Domain ≠ tag : le tag est libre, le domain est borné.

### 2.3 `KbAudience` — 4 valeurs

```prisma
enum KbAudience {
  public        // Indexable, accessible non-authent
  client        // Authent client requise
  team          // Authent admin requise (role >= editor)
  will_only     // Will-only (role = owner)
}
```

**Justification** : §12.3 master prompt. Détermine la visibilité runtime + sitemap exclusion + robots `noindex` pour `client`/`team`/`will_only`.

### 2.4 `KbConfidentiality` — 4 valeurs

```prisma
enum KbConfidentiality {
  public         // Aucune restriction
  internal       // Diffusable client si audience='client'
  confidential   // Filigrane PDF + watermark visuel + interdiction d'envoi API externe (Agent 10 §9.10 reality check)
  secret         // Idem + 2FA obligatoire pour lire
}
```

**Justification** : ortho à `audience` — une entrée peut être `audience='public', confidentiality='public'` (article blog) OU `audience='client', confidentiality='confidential'` (doctrine client filigranée). Check bloquant en Sprint KB-21 : refus dur d'envoi à API externe (Claude/OpenAI) si `confidentiality IN ('confidential', 'secret')`.

### 2.5 `KbStatus` — 7 valeurs (DÉDIÉ, NE PAS ÉTENDRE `PublishStatus`)

```prisma
enum KbStatus {
  draft        // Brouillon WIP
  review       // En revue (reviewer assigné)
  approved     // Validé, en attente de publication (scheduled OU manuel)
  scheduled    // Publication programmée (scheduledFor)
  published    // Visible (selon audience)
  archived     // Retiré, conservé (consultable admin)
  deprecated   // Obsolète (banner UI "remplacé par…" via relation kind=replaces)
}
```

**RECOMMANDATION FORTE (Phase A) : créer `KbStatus` dédié plutôt qu'étendre `PublishStatus` global** (cf. STOP & ASK 1).

- `PublishStatus` actuel a 3 valeurs (`draft`/`published`/`archived`, `schema.prisma:205-209`) utilisées par `Article`, `CaseStudy`, `FAQ`, `HelpArticle`, `Category`. Le polluer avec `review`/`approved`/`scheduled`/`deprecated` crée :
  - **Risque sémantique cross-domaine** : `Category.status='review'` n'a aucun sens.
  - **Risque migration** : `ALTER TYPE PublishStatus ADD VALUE ...` impacte tous les consumers existants ; chaque switch/case devient incomplet.
  - **Risque doctrine** : `00-REALITY-CHECK.md §1.2` recommande explicitement le découplage.
- Enum dédié = isolation propre + workflow propre (cf. `KbPipelineStage` ci-dessous pour la dimension orthogonale).

### 2.6 `KbPipelineStage` — 9 valeurs (workflow détaillé)

```prisma
enum KbPipelineStage {
  idea         // Sujet identifié (pré-brief)
  brief        // Brief écrit, en attente d'auteur
  draft        // Auteur en rédaction
  review       // En revue (reviewer assigné)
  approved     // Validé reviewer
  scheduled    // Publication programmée
  published    // Live
  archived
  deprecated
}
```

**Justification** : `KbStatus` est l'état **technique** (visibilité), `KbPipelineStage` est l'état **éditorial** (suivi production cf. Sprint KB-14 calendar admin). Les deux sont orthogonaux :

- `status=published` + `pipelineStage=published` (cas nominal).
- `status=draft` + `pipelineStage=idea` / `brief` / `draft` (avant publication).
- `status=archived` + `pipelineStage=deprecated` (entrée retirée car remplacée).

Permet le **kanban éditorial** sans polluer le champ technique.

### 2.7 `KbRelationKind` — 7 valeurs

```prisma
enum KbRelationKind {
  replaces       // toEntry est remplacée par fromEntry (deprecated chain)
  cites          // fromEntry cite toEntry (footnote, source)
  depends_on     // fromEntry dépend de toEntry (prérequis lecture)
  related_to     // Relation lâche bidirectionnelle (UI suggérée)
  supersedes     // ADR/doctrine supersedes (chaîne ADR)
  contradicts    // Détection automatique conflit (alerte reviewer)
  extends        // fromEntry étend toEntry (sous-méthodologie, sous-doctrine)
}
```

**Justification** : couvre ADR (`supersedes`), doctrine évolutive (`extends`), suggestions UI (`related_to`), citations académiques (`cites`), chaînes de remplacement (`replaces`), prérequis lecture (`depends_on`), audit qualité (`contradicts`). Cycle detection (cf. `KnowledgeRelation`) en server action — DAG souhaité pour `depends_on`/`supersedes`/`replaces`/`extends`, multigraph pour `related_to`/`cites`/`contradicts`.

---

## 3. MODÈLES PRISMA CIBLES

### 3.1 `KnowledgeEntry` (table racine polymorphique)

```prisma
model KnowledgeEntry {
  id                  String              @id @default(uuid()) @db.Uuid

  // Discriminator + classification
  type                KbType
  domain              KbDomain
  audience            KbAudience          @default(public)
  confidentiality     KbConfidentiality   @default(public)
  status              KbStatus            @default(draft)
  pipelineStage       KbPipelineStage     @default(idea)

  // Présentation
  coverImageId        String?             @map("cover_image_id") @db.Uuid
  coverImage          KnowledgeAsset?     @relation("CoverImage", fields: [coverImageId], references: [id], onDelete: SetNull)
  heroLayout          String?             @db.VarChar(40)    // SSOT côté src/content/knowledge/hero-layouts.ts
  pinned              Boolean             @default(false)
  featured            Boolean             @default(false)
  featuredUntil       DateTime?           @map("featured_until")

  // Série / collection (V1.5 — préparé V1)
  seriesId            String?             @map("series_id") @db.Uuid
  // (pas de FK self car KnowledgeSeries est V1.5 — laisser nullable string V1)

  // Slug racine (locale-agnostique, identifiant stable cross-langue)
  slug                String              @unique @db.VarChar(180)

  // Compteurs aggregés (dénormalisés pour perf liste)
  viewsCount          Int                 @default(0) @map("views_count")
  helpfulUpCount      Int                 @default(0) @map("helpful_up_count")
  helpfulDownCount    Int                 @default(0) @map("helpful_down_count")

  // Planning éditorial
  scheduledFor        DateTime?           @map("scheduled_for")
  embargoUntil        DateTime?           @map("embargo_until")
  publishedAt         DateTime?           @map("published_at")
  reviewedAt          DateTime?           @map("reviewed_at")
  reviewDueAt         DateTime?           @map("review_due_at")   // Échéance de revue récurrente
  expiresAt           DateTime?           @map("expires_at")      // RGPD purge

  // Imputation
  createdById         String?             @map("created_by_id") @db.Uuid
  updatedById         String?             @map("updated_by_id") @db.Uuid
  reviewerId          String?             @map("reviewer_id") @db.Uuid
  assignedAuthorId    String?             @map("assigned_author_id") @db.Uuid
  assignedAuthor      Author?             @relation(fields: [assignedAuthorId], references: [id], onDelete: SetNull)
  assignedReviewerId  String?             @map("assigned_reviewer_id") @db.Uuid

  // Brief éditorial
  briefMarkdown       String?             @map("brief_markdown") @db.Text
  targetWordCount     Int?                @map("target_word_count")
  targetKeyword       String?             @map("target_keyword") @db.VarChar(180)

  // Soft-delete
  deletedAt           DateTime?           @map("deleted_at")

  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt @map("updated_at")

  // Relations
  translations        KnowledgeTranslation[]
  versions            KnowledgeVersion[]
  tags                KnowledgeTagOnEntry[]
  outgoingRelations   KnowledgeRelation[]  @relation("FromEntry")
  incomingRelations   KnowledgeRelation[]  @relation("ToEntry")
  feedback            KnowledgeFeedback[]
  bookmarks           KnowledgeBookmark[]
  reviewerAssignments KnowledgeReviewerAssignment[]
  slugHistory         KnowledgeSlugHistory[]

  // Indexes — voir §4 pour justification fine
  @@index([type, status, audience])
  @@index([type, publishedAt(sort: Desc)])
  @@index([status, pipelineStage])
  @@index([publishedAt(sort: Desc)])
  @@index([reviewDueAt])
  @@index([expiresAt])
  @@index([pinned, featured])
  @@index([domain, status])
  @@index([assignedAuthorId])
  @@index([assignedReviewerId])
  @@index([scheduledFor])
  @@index([deletedAt])

  @@map("knowledge_entries")
}
```

**Justification champs sensibles** :

| Champ                 | Cardinality                        | Cascade   | Justification                                                        |
| --------------------- | ---------------------------------- | --------- | -------------------------------------------------------------------- |
| `coverImageId`        | 0..1 → 1 `KnowledgeAsset`          | `SetNull` | Suppression de l'asset ne tue pas l'entrée (asset library partagée). |
| `assignedAuthorId`    | 0..1 → 1 `Author`                  | `SetNull` | Auteur peut quitter sans casser l'historique.                        |
| `seriesId`            | 0..1 (V1 nullable string, V1.5 FK) | n/a V1    | Préparé V1 pour éviter migration de schéma V1.5.                     |
| `slug`                | UNIQUE global                      | n/a       | Identifiant cross-langue (locale slug en translation).               |
| `pinned` + `featured` | bools                              | n/a       | Index composite pour requête "homepage cards".                       |
| `deletedAt`           | nullable                           | n/a       | Soft-delete (recovery 30j via retention cron).                       |
| `briefMarkdown`       | Text                               | n/a       | Brief éditorial WIP avant rédaction (Sprint KB-14).                  |

### 3.2 `KnowledgeTranslation` (locale-scoped body — pattern `ArticleTranslation`)

```prisma
model KnowledgeTranslation {
  id                String          @id @default(uuid()) @db.Uuid
  entryId           String          @map("entry_id") @db.Uuid
  entry             KnowledgeEntry  @relation(fields: [entryId], references: [id], onDelete: Cascade)
  locale            Locale

  title             String          @db.VarChar(255)
  slug              String          @db.VarChar(255)
  excerpt           String?         @db.Text

  // Triple-source Tiptap (Sprint 24 / C4 pattern — reality check §1.1)
  body              String          @db.Text             // HTML rendered (source de vérité affichage)
  bodyJson          Json?           @map("body_json")    // Tiptap doc JSON (canonique pour édition + IA)
  bodyText          String?         @map("body_text") @db.Text  // Plain text (FTS — reality check §1.4)

  // SEO meta locale-scoped
  metaTitle         String?         @map("meta_title") @db.VarChar(70)
  metaDescription   String?         @map("meta_description") @db.VarChar(160)
  ogImageId         String?         @map("og_image_id") @db.Uuid
  ogImage           KnowledgeAsset? @relation("OgImage", fields: [ogImageId], references: [id], onDelete: SetNull)

  // Métriques rédaction
  readingTime       Int?            @map("reading_time")        // Minutes
  wordCount         Int?            @map("word_count")
  readabilityScore  Float?          @map("readability_score")   // Flesch-Kincaid FR/EN
  qualityScore      Float?          @map("quality_score")       // Composite (cf. Sprint KB-19)

  // Alt text bloquant (Agent 12 a11y — reality check §9.12)
  // Structure : { [imageId: string]: string }   — assertion server-side avant publish
  alts              Json?

  // FTS — GENERATED tsvector (config fr_unaccent FR / english EN, materialized par locale via WHERE)
  // Note Prisma : `Unsupported("tsvector")` car non typé natif Prisma.
  // Migration FTS séparée (Sprint KB-7) — alignée sur reality check §1.4.
  searchVector      Unsupported("tsvector")? @map("search_vector")

  versions          KnowledgeVersion[]

  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")

  @@unique([entryId, locale])
  @@unique([locale, slug])
  @@index([slug])
  @@index([locale, qualityScore])
  // GIN index FTS créé hors-Prisma (migration SQL native KB-7)
  @@map("knowledge_translations")
}
```

**Justification** :

- `@@unique([entryId, locale])` : 1 traduction par locale (pattern `ArticleTranslation` schema.prisma:757).
- `@@unique([locale, slug])` : éviter doublon slug intra-locale (pattern `ArticleTranslation:758`).
- `body`/`bodyJson`/`bodyText` = triple-source identique à `ArticleTranslation` lignes 746-750 (`00-REALITY-CHECK.md §1.1` confirme pattern Sprint 24 C4).
- `searchVector` GENERATED (non Prisma-natif) : migration SQL séparée Sprint KB-7 reproduit le pattern `migrations_fts/0002_fts_setup.sql` (reality check §1.4).
- `alts` JSON : storage clé/valeur des alt-text. Assertion server-side bloquante avant publish (Agent 12 / Sprint KB-19).
- `qualityScore` Float : seuil paramétrable via `Setting` (`00-REALITY-CHECK.md §1.1`).

### 3.3 `KnowledgeVersion` (immutable history)

```prisma
model KnowledgeVersion {
  id              String                 @id @default(uuid()) @db.Uuid
  entryId         String                 @map("entry_id") @db.Uuid
  entry           KnowledgeEntry         @relation(fields: [entryId], references: [id], onDelete: Cascade)
  translationId   String?                @map("translation_id") @db.Uuid
  translation     KnowledgeTranslation?  @relation(fields: [translationId], references: [id], onDelete: SetNull)
  version         Int                    // Auto-incrément intra-entry via server action

  // Snapshot complet (entry + translation + tags + relations à T)
  snapshotJson    Json                   @map("snapshot_json")

  createdById     String?                @map("created_by_id") @db.Uuid
  createdAt       DateTime               @default(now()) @map("created_at")
  // PAS de updatedAt — versions immutables

  @@unique([entryId, translationId, version])
  @@index([entryId, version(sort: Desc)])
  @@index([createdAt])
  @@map("knowledge_versions")
}
```

**Justification** :

- **Pas de `updatedAt`** : volonté forensique (intégrité historique).
- `translationId` nullable : permet d'enregistrer une version d'entry-structurel (changement status/tags) sans dupliquer translation body.
- `@@unique([entryId, translationId, version])` : pas de collision version intra-entrée+translation.
- `snapshotJson` : 1 doc complet par version (entry + translation + tags + relations sortantes). Permet restore complet sans reconstituer. Coût stockage acceptable (cf. §7 volumétrie).
- Cascade `Cascade` sur `entryId` : suppression hard-delete d'une entrée tue ses versions (soft-delete via `deletedAt` les préserve).

### 3.4 `KnowledgeTag` + `KnowledgeTagOnEntry` (M2M)

```prisma
model KnowledgeTag {
  id            String              @id @default(uuid()) @db.Uuid
  slug          String              @unique @db.VarChar(120)
  nameFr        String              @map("name_fr") @db.VarChar(120)
  nameEn        String              @map("name_en") @db.VarChar(120)
  descFr        String?             @map("desc_fr") @db.Text
  descEn        String?             @map("desc_en") @db.Text
  color         String?             @db.VarChar(7)    // Hex CSS (#rrggbb) — chip color UI
  createdAt     DateTime            @default(now()) @map("created_at")

  entries       KnowledgeTagOnEntry[]

  @@index([slug])
  @@map("knowledge_tags")
}

model KnowledgeTagOnEntry {
  entryId   String          @map("entry_id") @db.Uuid
  tagId     String          @map("tag_id") @db.Uuid
  entry     KnowledgeEntry  @relation(fields: [entryId], references: [id], onDelete: Cascade)
  tag       KnowledgeTag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([entryId, tagId])
  @@index([tagId])
  @@map("knowledge_tags_on_entries")
}
```

**Justification** :

- Pattern strict copié de `ArticleTag` + `ArticleTagOnArticle` (schema.prisma:763-785).
- **Composite PK `[entryId, tagId]`** : naturel pour M2M, évite surrogate id. Index `[tagId]` ajouté pour "liste des entrées par tag" (route facette `/blog/tag/[slug]`).
- Cascade `Cascade` des deux côtés : supprimer un tag délie automatiquement, supprimer une entrée délie aussi.
- Pas de colonne `createdAt` sur la table de liaison (sobre — pattern existant) ; si besoin temporel, le tracking passe par `ActivityLog`.
- STOP & ASK 6 : confirme la pertinence du composite PK vs surrogate id.

### 3.5 `KnowledgeRelation` (entry-to-entry typed graph)

```prisma
model KnowledgeRelation {
  id              String          @id @default(uuid()) @db.Uuid
  fromEntryId     String          @map("from_entry_id") @db.Uuid
  fromEntry       KnowledgeEntry  @relation("FromEntry", fields: [fromEntryId], references: [id], onDelete: Cascade)
  toEntryId       String          @map("to_entry_id") @db.Uuid
  toEntry         KnowledgeEntry  @relation("ToEntry", fields: [toEntryId], references: [id], onDelete: Cascade)
  kind            KbRelationKind

  createdById     String?         @map("created_by_id") @db.Uuid
  createdAt       DateTime        @default(now()) @map("created_at")

  @@unique([fromEntryId, toEntryId, kind])
  @@index([toEntryId, kind])
  @@index([fromEntryId, kind])
  @@map("knowledge_relations")
}
```

**Justification** :

- `@@unique([fromEntryId, toEntryId, kind])` : pas de doublon de relation typée. Une même paire peut avoir plusieurs `kind` (ex : `A related_to B` + `A cites B`).
- `Cascade` des deux côtés : suppression hard-delete cascade les relations. Soft-delete d'une entrée laisse les relations en place (à filtrer côté query).
- **Cycle detection** : pas de contrainte SQL native — implémentée en server action (`addRelation.ts`, Sprint KB-8). DAG souhaité pour `depends_on`/`supersedes`/`replaces`/`extends` (refus côté server), multigraph autorisé pour `related_to`/`cites`/`contradicts`. STOP & ASK 8.
- Pas de `updatedAt` (relations sont créées/supprimées, jamais modifiées en place).

### 3.6 `KnowledgeFeedback` (1/IP/entry/24h)

```prisma
model KnowledgeFeedback {
  id          String          @id @default(uuid()) @db.Uuid
  entryId     String          @map("entry_id") @db.Uuid
  entry       KnowledgeEntry  @relation(fields: [entryId], references: [id], onDelete: Cascade)
  locale      Locale
  vote        KbFeedbackVote
  ipHash      String          @map("ip_hash") @db.VarChar(64)    // sha256(ip + salt) — RGPD compliant
  sessionId   String?         @map("session_id") @db.VarChar(64)
  createdAt   DateTime        @default(now()) @map("created_at")

  @@unique([entryId, ipHash, createdAt])    // Pas de strict — rate limit applicatif Redis (1/24h)
  @@index([entryId, locale, vote])
  @@index([createdAt])
  @@map("knowledge_feedback")
}

enum KbFeedbackVote {
  up
  down
}
```

**Justification** :

- `ipHash` sha256(IP + salt secret) — pattern RGPD-compliant (cf. `pii-redaction.ts` réutilisable, reality check §4.1).
- Rate limit **applicatif via Redis bucket** existant (`src/lib/rate-limit.ts`, reality check §4.3) — 1 vote/IP/entry/24h. La contrainte SQL `@@unique` ne peut pas exprimer "1 par 24h" : on s'appuie sur Redis avec TTL=86400.
- `@@unique([entryId, ipHash, createdAt])` : barrière supplémentaire (impossible 2 votes même seconde).
- Compteurs aggregés (`helpfulUpCount`/`helpfulDownCount` sur `KnowledgeEntry`) mis à jour par trigger SQL ou server action transactionnelle.
- `Cascade` sur `entryId` : feedback meurt avec l'entrée.

### 3.7 `KnowledgeAsset` (asset library partagée)

```prisma
model KnowledgeAsset {
  id              String     @id @default(uuid()) @db.Uuid
  mimeType        String     @map("mime_type") @db.VarChar(80)
  originalPath    String     @map("original_path") @db.VarChar(512)
  // Variantes processed (sharp Sprint KB-11 — webp/avif × {320, 640, 1024, 1920})
  // Structure : { webp: { 320: "/path", 640: "..." }, avif: { ... } }
  processedPaths  Json?      @map("processed_paths")

  width           Int?
  height          Int?
  bytes           Int
  // SHA-256 du fichier brut — déduplication, intégrité, cache key
  hash            String     @unique @db.VarChar(64)
  altText         String?    @map("alt_text") @db.Text
  caption         String?    @db.Text

  uploadedById    String?    @map("uploaded_by_id") @db.Uuid
  usageCount      Int        @default(0) @map("usage_count")    // GC orphan detection (Sprint KB-11)

  deletedAt       DateTime?  @map("deleted_at")    // Soft-delete
  createdAt       DateTime   @default(now()) @map("created_at")

  // Reverse relations
  coverFor        KnowledgeEntry[]         @relation("CoverImage")
  ogImageFor      KnowledgeTranslation[]   @relation("OgImage")

  @@index([hash])
  @@index([uploadedById])
  @@index([deletedAt])
  @@index([mimeType])
  @@map("knowledge_assets")
}
```

**Justification** :

- `hash` unique SHA-256 : déduplication absolue (même fichier uploadé 2x = 1 row). Permet aussi cache CDN sur hash.
- `processedPaths` JSON : structure flexible pour ajouter formats futurs (HEIF, AV1...) sans migration.
- `usageCount` : maintenu par server actions (increment on assignment, decrement on unassignment). Permet GC asset-orphans (Sprint KB-11 worker `asset-gc`).
- Soft-delete `deletedAt` : récupération possible (retention-purge tue après 30j si `usageCount=0`).
- Cascade `SetNull` côté `KnowledgeEntry.coverImageId` et `KnowledgeTranslation.ogImageId` (suppression d'asset ne tue pas l'entrée).
- Volume Coolify persistant `/data/knowledge-assets/` à confirmer Will (STOP & ASK reality check §9.13, hors scope agent 1).

### 3.8 `KnowledgeSlugHistory` (301 redirects)

```prisma
model KnowledgeSlugHistory {
  id          String          @id @default(uuid()) @db.Uuid
  oldLocale   Locale          @map("old_locale")
  oldType     KbType          @map("old_type")
  oldSlug     String          @map("old_slug") @db.VarChar(255)
  entryId     String          @map("entry_id") @db.Uuid    // Entry cible actuelle
  entry       KnowledgeEntry  @relation(fields: [entryId], references: [id], onDelete: Cascade)
  changedAt   DateTime        @default(now()) @map("changed_at")
  reason      String?         @db.Text

  @@unique([oldLocale, oldType, oldSlug])
  @@index([entryId])
  @@map("knowledge_slug_history")
}
```

**Justification** :

- `@@unique([oldLocale, oldType, oldSlug])` : 1 ancien slug = 1 entrée cible (pas de chaîne ambiguë). Si renommage en cascade `A → B → C`, 2 rows `A→C` + `B→C` (compactage automatique par server action).
- Lookup O(1) en middleware Next pour générer 301 `Location` header.
- `entryId` Cascade : suppression d'entrée tue l'historique (RGPD).
- **Backfill initial Sprint KB-2** : peupler depuis `Article.slug` actuel (préserve l'historique URL avant migration).

### 3.9 `KnowledgeBookmark` (surface client)

```prisma
model KnowledgeBookmark {
  id                  String          @id @default(uuid()) @db.Uuid
  entryId             String          @map("entry_id") @db.Uuid
  entry               KnowledgeEntry  @relation(fields: [entryId], references: [id], onDelete: Cascade)
  clientEmail         String?         @map("client_email") @db.Citext
  sessionId           String?         @map("session_id") @db.VarChar(64)
  privateNoteMarkdown String?         @map("private_note_markdown") @db.Text
  createdAt           DateTime        @default(now()) @map("created_at")

  @@unique([entryId, clientEmail])
  @@index([clientEmail, createdAt(sort: Desc)])
  @@index([sessionId])
  @@map("knowledge_bookmarks")
}
```

**Justification** :

- Surface client (Sprint KB-9) : permet à un client authent NextAuth (réutilisation Booking V1, reality check §4.1) de bookmarker des entrées `audience='client'` ou `'public'`.
- `clientEmail` OU `sessionId` (XOR souple — l'un OU l'autre est rempli). Pas de contrainte CHECK car Prisma ne la supporte pas nativement ; assertion server-side dans `bookmarkEntry.ts`.
- `privateNoteMarkdown` : note privée du client (encryption-at-rest hors scope V1, à reconsidérer en V1.5 si demande).
- `@@unique([entryId, clientEmail])` : pas de double-bookmark.

### 3.10 `KnowledgeImportBatch` (audit imports)

```prisma
model KnowledgeImportBatch {
  id              String              @id @default(uuid()) @db.Uuid
  source          KbImportSource
  sourceRef       String?             @map("source_ref") @db.VarChar(255)    // Path git, URL Notion, etc.
  importedById    String?             @map("imported_by_id") @db.Uuid
  entriesCount    Int                 @default(0) @map("entries_count")
  status          KbImportStatus      @default(pending)
  errorLog        Json?               @map("error_log")
  createdAt       DateTime            @default(now()) @map("created_at")
  completedAt     DateTime?           @map("completed_at")

  @@index([source, status])
  @@index([importedById])
  @@map("knowledge_import_batches")
}

enum KbImportSource {
  audit_md          // _AUDIT/*.md mapping manuel (reality check §9.16)
  markdown_git      // Markdown depuis dépôt git
  notion            // Notion API (STOP & ASK reality check §9.16)
  csv               // CSV bulk
  legacy_db         // Migration depuis articles/case_studies/faqs/help_articles (Sprint KB-2)
  legacy_source     // Hardcode source (`/glossaire/page.tsx`, `/guide-ia/page.tsx` — reality check §3.2)
}

enum KbImportStatus {
  pending
  running
  succeeded
  failed
  partial
}
```

**Justification** :

- Traçabilité provenance pour audit + RGPD.
- `errorLog` JSON : structure libre pour stocker rapports d'import (lignes erronées CSV, conflits slug, etc.).
- Index `[source, status]` pour dashboard imports admin (Sprint KB-16).

### 3.11 `KnowledgeReviewerAssignment` (revue éditoriale)

```prisma
model KnowledgeReviewerAssignment {
  id            String                    @id @default(uuid()) @db.Uuid
  entryId       String                    @map("entry_id") @db.Uuid
  entry         KnowledgeEntry            @relation(fields: [entryId], references: [id], onDelete: Cascade)
  reviewerId    String                    @map("reviewer_id") @db.Uuid
  assignedById  String?                   @map("assigned_by_id") @db.Uuid
  assignedAt    DateTime                  @default(now()) @map("assigned_at")
  status        KbReviewerAssignmentStatus @default(pending)
  dueAt         DateTime?                 @map("due_at")
  acceptedAt    DateTime?                 @map("accepted_at")
  completedAt   DateTime?                 @map("completed_at")
  reviewerNote  String?                   @map("reviewer_note") @db.Text

  @@unique([entryId, reviewerId])
  @@index([reviewerId, status])
  @@index([dueAt])
  @@map("knowledge_reviewer_assignments")
}

enum KbReviewerAssignmentStatus {
  pending
  accepted
  rejected
  completed
}
```

**Justification** :

- 1 assignation par (entry, reviewer) — un même reviewer ne peut être assigné 2 fois à la même entrée.
- `dueAt` indexé : queue "revues en retard" Sprint KB-14 (`/connaissances/files-attente-revue`).
- Status `rejected` permet au reviewer de refuser explicitement (force réassignation).
- Cascade `Cascade` sur `entryId` (assignation meurt avec entrée).

### 3.12 `KnowledgeEmbedding` (V1.5 — table dédiée séparée)

```prisma
// V1.5 — Sprint KB-21 — ADR séparé + migration `CREATE EXTENSION vector;`
// (Postgres 17 + pgvector 0.7+ — reality check §1.3)

model KnowledgeEmbedding {
  id              String                  @id @default(uuid()) @db.Uuid
  translationId   String                  @unique @map("translation_id") @db.Uuid
  translation     KnowledgeTranslation    @relation(fields: [translationId], references: [id], onDelete: Cascade)

  // 1024 dims = Voyage AI / OpenAI text-embedding-3-small projection / Claude embeddings (futur)
  // Indexé ivfflat ou hnsw selon volume (cf. ADR Sprint KB-21).
  embedding       Unsupported("vector(1024)")
  model           String                  @db.VarChar(80)     // ex : "voyage-3", "text-embedding-3-small"
  modelVersion    String                  @map("model_version") @db.VarChar(40)
  dimensionality  Int                     @default(1024)
  embeddedAt      DateTime                @default(now()) @map("embedded_at")

  // Index pgvector créé hors-Prisma :
  //   CREATE INDEX knowledge_embeddings_vec_hnsw ON knowledge_embeddings
  //     USING hnsw (embedding vector_cosine_ops);
  // Choix HNSW vs ivfflat selon volumétrie (cf. Sprint KB-21 ADR).

  @@index([model, modelVersion])
  @@map("knowledge_embeddings")
}
```

**Justification** :

- **Table SÉPARÉE** (pas colonne sur `KnowledgeTranslation`) car :
  - Extension `pgvector` absente en V1 (`00-REALITY-CHECK.md §1.3`).
  - Permet ne pas charger l'extension V1 — migration V1.5 idempotente `CREATE EXTENSION IF NOT EXISTS vector;`.
  - Table peut être TRUNCATE pour réembedding sans toucher aux translations.
  - Schéma `Unsupported` reste isolé.
- `1:1 translationId UNIQUE` : 1 embedding par traduction.
- `model` + `modelVersion` versionnés : permet réembedding progressif quand modèle change (Sprint KB-21 worker `reindex-embeddings`).
- Cascade `Cascade` : suppression de traduction tue son embedding.
- STOP & ASK 4 : confirmer V1.5 vs anticiper en V1 (mais migration table vide en V1 ne coûte rien).

---

## 4. INDEXES STRATÉGIQUES — JUSTIFICATION

| Index                                  | Modèle                                    | Requête cible                                                  | Volumétrie attendue         |
| -------------------------------------- | ----------------------------------------- | -------------------------------------------------------------- | --------------------------- |
| `(type, status, audience)`             | `KnowledgeEntry`                          | Liste admin filtrée par type + filtre status + filtre audience | < 10 ms sur 100k rows       |
| `(type, publishedAt DESC)`             | `KnowledgeEntry`                          | Hub public `/blog`, `/cas-concrets` etc. (récents par type)    | < 5 ms                      |
| `(status, pipelineStage)`              | `KnowledgeEntry`                          | Kanban éditorial (Sprint KB-14)                                | < 5 ms                      |
| `publishedAt DESC`                     | `KnowledgeEntry`                          | Feed RSS global, sitemap                                       | < 10 ms                     |
| `reviewDueAt`                          | `KnowledgeEntry`                          | Queue "revues en retard" `/connaissances/files-attente-revue`  | < 5 ms                      |
| `expiresAt`                            | `KnowledgeEntry`                          | Cron retention-purge                                           | < 5 ms                      |
| `(pinned, featured)`                   | `KnowledgeEntry`                          | Homepage cards / hub featured                                  | < 5 ms                      |
| `(domain, status)`                     | `KnowledgeEntry`                          | Filtre admin par domain                                        | < 5 ms                      |
| `assignedAuthorId`                     | `KnowledgeEntry`                          | "Mes entrées" auteur                                           | < 5 ms                      |
| `scheduledFor`                         | `KnowledgeEntry`                          | Cron publication programmée                                    | < 5 ms                      |
| `deletedAt`                            | `KnowledgeEntry`                          | Filtre soft-delete (toutes queries WHERE deletedAt IS NULL)    | partial index possible V1.5 |
| `(entryId, version DESC)`              | `KnowledgeVersion`                        | Historique versions UI                                         | < 5 ms                      |
| `slug` UNIQUE                          | `KnowledgeEntry` + `KnowledgeTranslation` | Lookup public par URL                                          | < 1 ms                      |
| GIN sur `searchVector`                 | `KnowledgeTranslation`                    | FTS Sprint KB-7                                                | < 50 ms sur 100k rows       |
| `hash` UNIQUE                          | `KnowledgeAsset`                          | Déduplication upload                                           | < 1 ms                      |
| `(entryId, locale, vote)`              | `KnowledgeFeedback`                       | Compteurs locale-scoped                                        | < 5 ms                      |
| `(oldLocale, oldType, oldSlug)` UNIQUE | `KnowledgeSlugHistory`                    | Middleware 301 lookup                                          | < 1 ms                      |
| HNSW sur `embedding`                   | `KnowledgeEmbedding` (V1.5)               | KNN search top-k similaires                                    | < 100 ms sur 100k rows      |

**Note tags JSON GIN** : le master prompt évoque "GIN sur tags JSON" — non applicable au schéma proposé car les tags sont stockés via table de liaison `KnowledgeTagOnEntry` (pas en colonne JSON sur l'entrée). Le pattern JSON GIN s'appliquerait si on stockait `tags: string[]` en colonne JSON dans `KnowledgeEntry`. Recommandation : **conserver la table de liaison** (cohérence pattern `ArticleTag` existant, requêtes facette plus simples) — donc pas de GIN nécessaire. Si Will veut basculer JSON, à arbitrer en STOP & ASK 6 bis.

---

## 5. MIGRATION ZERO-DOWNTIME — STRATÉGIE EXPAND-BACKFILL-CONTRACT

### 5.1 Vue d'ensemble (4 modèles legacy + 2 hardcode)

| Source                                                                  | Cible                                                                                                               | Volumétrie seed                                           | Pattern     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------- |
| `Article` + `ArticleTranslation` + `ArticleTag` + `ArticleTagOnArticle` | `KnowledgeEntry` (type='article') + `KnowledgeTranslation` + `KnowledgeTag` + `KnowledgeTagOnEntry`                 | ~12 articles                                              | Direct DB   |
| `CaseStudy` + `CaseStudyTranslation`                                    | `KnowledgeEntry` (type='case_study') + `KnowledgeTranslation` (concat problem+solution en `bodyJson` doc structuré) | ~6 cas                                                    | Direct DB   |
| `FAQ` (inline `_fr`/`_en`)                                              | `KnowledgeEntry` (type='faq') + `KnowledgeTranslation` × 2                                                          | ~16 entrées                                               | Direct DB   |
| `HelpArticle` + `HelpArticleTranslation`                                | `KnowledgeEntry` (type='help_article') + `KnowledgeTranslation`                                                     | ~8 entrées                                                | Direct DB   |
| `/glossaire/page.tsx` hardcode `TERMS`                                  | `KnowledgeEntry` (type='glossary_term') + `KnowledgeTranslation`                                                    | ~30 termes (à confirmer audit `00-REALITY-CHECK.md §3.2`) | Source code |
| `/guide-ia/page.tsx` hardcode                                           | `KnowledgeEntry` (type='guide') + `KnowledgeTranslation`                                                            | À auditer Sprint KB-2                                     | Source code |

### 5.2 Phase EXPAND — Sprint KB-1 (créer les tables vides)

```sql
-- Migration : YYYYMMDDHHMMSS_kb_01_expand_knowledge_tables/migration.sql
-- (Prisma génère + on ajoute SQL natif pour FTS GENERATED + partial indexes)

-- Étape 1 : enums (CREATE TYPE)
CREATE TYPE "KbType" AS ENUM (...);
CREATE TYPE "KbDomain" AS ENUM (...);
-- etc. (7 enums)

-- Étape 2 : tables Knowledge* (12 modèles V1, KnowledgeEmbedding V1.5 reportée Sprint KB-21)
CREATE TABLE "knowledge_entries" ( ... );
CREATE TABLE "knowledge_translations" ( ... );
-- etc.

-- Étape 3 : FTS GENERATED column (hors Prisma)
ALTER TABLE knowledge_translations ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  CASE locale
    WHEN 'fr' THEN
      setweight(to_tsvector('fr_unaccent', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('fr_unaccent', coalesce(excerpt, '')), 'B') ||
      setweight(to_tsvector('fr_unaccent', coalesce(body_text, '')), 'C')
    WHEN 'en' THEN
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(body_text, '')), 'C')
  END
) STORED;

CREATE INDEX knowledge_translations_search_idx
  ON knowledge_translations USING GIN (search_vector);
```

**Pré-requis** : pas de modification des tables legacy. Application code lit/écrit toujours `articles`/`case_studies`/`faqs`/`help_articles`.

### 5.3 Phase BACKFILL — Sprint KB-2 (recopie)

Script `scripts/import-knowledge-from-legacy.ts` (CLI, idempotent, dry-run par défaut) :

```ts
// Pseudocode
for (const article of await prisma.article.findMany({
  include: { translations: true, tags: true, author: true, category: true },
})) {
  const entryId = generateUuid();

  // 1. Insert KnowledgeEntry (status mappé : Article.status → KbStatus)
  await prisma.knowledgeEntry.create({
    data: {
      id: entryId,
      type: "article",
      domain: inferDomain(article), // heuristique : category → domain
      audience: "public",
      confidentiality: "public",
      status: mapPublishStatusToKbStatus(article.status),
      pipelineStage: article.status === "published" ? "published" : "draft",
      assignedAuthorId: article.authorId,
      slug: article.translations.find((t) => t.locale === "fr")?.slug ?? generateSlug(),
      publishedAt: article.publishedAt,
      viewsCount: article.viewsCount,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    },
  });

  // 2. Insert KnowledgeTranslation × 2 (fr + en)
  for (const t of article.translations) {
    await prisma.knowledgeTranslation.create({
      data: {
        entryId,
        locale: t.locale,
        title: t.title,
        slug: t.slug,
        excerpt: t.excerpt,
        body: t.body,
        bodyJson: t.bodyJson,
        bodyText: t.bodyText,
        metaTitle: t.metaTitle,
        metaDescription: t.metaDescription,
        // ogImageId : créer KnowledgeAsset si t.ogImage non null
      },
    });

    // 3. Slug history : préserver l'URL actuelle
    await prisma.knowledgeSlugHistory.create({
      data: {
        oldLocale: t.locale,
        oldType: "article",
        oldSlug: t.slug,
        entryId,
        reason: "migration_kb_v1",
      },
    });
  }

  // 4. Tags : créer KnowledgeTag + KnowledgeTagOnEntry
  for (const tagOnArticle of article.tags) {
    const kbTag = await prisma.knowledgeTag.upsert({
      where: { slug: tagOnArticle.tag.slug },
      create: {
        /* copie depuis ArticleTag */
      },
      update: {},
    });
    await prisma.knowledgeTagOnEntry.create({
      data: { entryId, tagId: kbTag.id },
    });
  }
}
```

Idem pour `CaseStudy`, `FAQ` (création `bodyJson` minimal `{type: 'doc', content: [{type: 'paragraph', text: answerFr}]}`), `HelpArticle`.

**Spécifique hardcode** :

- `/glossaire` : `scripts/import-glossary-from-source.ts` parse `src/app/[locale]/glossaire/page.tsx` constante `TERMS`, génère N entries `type='glossary_term'`.
- `/guide-ia` : idem si hardcode confirmé (audit Sprint KB-2).

**Garanties script** :

- Idempotent (rerunnable — `KnowledgeImportBatch` track les imports).
- Dry-run par défaut (`--apply` flag pour écriture).
- Transaction par entry (rollback partiel possible).
- Verification post-migration : `SELECT COUNT(*) FROM knowledge_entries WHERE type='article'` = `SELECT COUNT(*) FROM articles`.

### 5.4 Phase BASCULE — Sprints KB-3 à KB-7 (cohabitation)

- Admin lit/écrit `Knowledge*` exclusivement.
- Routes publiques `/blog`, `/cas-concrets`, `/centre-aide`, `/faq`, `/glossaire`, `/guide-ia` basculent progressivement (strangler pattern — reality check §10 décision 16) :
  - V1 lecture seule depuis `Knowledge*` (les tables legacy deviennent en lecture-seule applicative).
  - Writes admin sur `Knowledge*` uniquement.
- Sync inverse OPTIONNELLE (si rollback nécessaire) : trigger ou cron qui réplique `Knowledge*` → `articles`/etc. — **non recommandé** (coût ops, ne pas faire sauf demande).

### 5.5 Phase CONTRACT — Sprint KB-5 ou ultérieur (drop tables legacy)

Une fois prod stable (≥ 4 semaines de cohabitation sans incident) :

```sql
-- Migration : YYYYMMDDHHMMSS_kb_05_contract_drop_legacy/migration.sql

-- Drop ordering : enfants d'abord
DROP TABLE article_tags_on_articles;
DROP TABLE article_tags;
DROP TABLE article_translations;
DROP TABLE articles;

DROP TABLE case_study_translations;
-- (case_studies garde testimonialId FK — drop séparé après dépendance retirée)

DROP TABLE help_article_translations;
DROP TABLE help_articles;

DROP TABLE faqs;
```

**Pré-requis CONTRACT** :

1. ≥ 4 semaines prod sans incident KB.
2. Aucun code applicatif référence `prisma.article` etc.
3. Tests E2E passent sans tables legacy (CI gate).
4. Backup DB préalable (Hetzner snapshot + dump filtré KB).
5. Will valide via STOP & ASK final Sprint KB-5.

**Note `CaseStudy.testimonialId`** : ce FK pointe vers `Testimonial` (modèle non-KB conservé en V1 d'après reality check §10 décision 17). Migration : `KnowledgeEntry` (type=case_study) **n'a pas** de FK testimonial direct ; on crée une `KnowledgeRelation` kind='cites' vers une entrée si `Testimonial` est aussi migré (V2) OU on garde le FK dans une table de jonction dédiée `KnowledgeCaseStudyTestimonial` (V1). STOP & ASK supplémentaire à arbitrer Sprint KB-2.

---

## 6. STATUS MAPPING — `PublishStatus` → `KbStatus`

| `PublishStatus` (legacy) | `KbStatus` (cible) | `KbPipelineStage` (cible) |
| ------------------------ | ------------------ | ------------------------- |
| `draft`                  | `draft`            | `draft`                   |
| `published`              | `published`        | `published`               |
| `archived`               | `archived`         | `archived`                |

Pas de valeur legacy mappant `review`/`approved`/`scheduled`/`deprecated` — ces états sont créés post-migration via workflow admin.

---

## 7. VOLUMÉTRIE ESTIMÉE PROD

### 7.1 Hypothèses

- Tiptap JSON moyen : **5 KB** par traduction (HTML ~12 KB rendered, text plain ~2 KB).
- Versions moyennes : **10 par entrée** sur 12 mois (auteur + reviewer + republish cycles).
- Cover image moyenne post-sharp : **100 KB** (webp 1024w).
- Cover image processed × 4 formats × 4 widths = **8 variantes × ~50 KB moy = 400 KB par cover**.

### 7.2 Paliers prod

| Palier            | Entries | Translations (×2 locales) | Body total                            | Versions | Snapshots versions                 | Assets                         | TOTAL approx                                            |
| ----------------- | ------- | ------------------------- | ------------------------------------- | -------- | ---------------------------------- | ------------------------------ | ------------------------------------------------------- |
| Seed (M0)         | 80      | 160                       | 800 KB                                | 0        | 0                                  | 50 covers × 0.4 MB = 20 MB     | **~21 MB**                                              |
| Cible V1 (M+6)    | 1 000   | 2 000                     | 10 MB (HTML) + 10 MB JSON + 4 MB text | 10 k     | ~25 MB (JSON snapshots compressés) | 1 000 covers × 0.4 MB = 400 MB | **~450 MB**                                             |
| Cible V1.5 (M+18) | 10 000  | 20 000                    | 100 MB + 100 MB + 40 MB               | 100 k    | ~250 MB                            | 10 000 × 0.4 MB = 4 GB         | **~4.5 GB** + embeddings 1024d × 4 bytes × 20k = ~80 MB |
| Cible V2 (M+36)   | 100 000 | 200 000                   | 1 GB + 1 GB + 400 MB                  | 1 M      | ~2.5 GB                            | 100 000 × 0.4 MB = 40 GB       | **~45 GB** + embeddings ~800 MB                         |

### 7.3 Implications infra

- **CPX32 disk 80 GB** (mémoire `axionia_hosting_hetzner`) : OK V1 (450 MB) + V1.5 (4.5 GB) + V2 (45 GB) sur 3 ans. Pas de migration disque nécessaire.
- **pg_dump V1.5** : ~4.5 GB → upload Cloudflare R2 ~5 min compressed.
- **DR restore KB-only** (cf. reality check §9.17) : dump filtré `pg_dump -t 'knowledge_*'` ≈ 500 MB compressed V1.5.

---

## 8. ANTI-PATTERNS IDENTIFIÉS (audit doctrinaire)

| Anti-pattern                              | Statut schéma proposé | Justification                                                                   |
| ----------------------------------------- | --------------------- | ------------------------------------------------------------------------------- |
| **1 table par type** (anti-DRY)           | ✅ ÉVITÉ              | `KnowledgeEntry` polymorphique avec discriminator `KbType`.                     |
| **Body JSON sans index FTS**              | ✅ ÉVITÉ              | `bodyText` plain + GENERATED `searchVector` + GIN.                              |
| **Oubli `createdById` / `updatedById`**   | ✅ ÉVITÉ              | Présents sur `KnowledgeEntry` + `KnowledgeVersion`.                             |
| **Oubli soft-delete `deletedAt`**         | ✅ ÉVITÉ              | Présent sur `KnowledgeEntry` + `KnowledgeAsset`.                                |
| **Étendre `PublishStatus` global**        | ✅ ÉVITÉ              | `KbStatus` dédié — voir §2.5 + STOP & ASK 1.                                    |
| **Stocker tags en JSON colonne sans GIN** | ✅ ÉVITÉ              | Table de liaison `KnowledgeTagOnEntry` avec PK composite.                       |
| **Index manquant sur slug**               | ✅ ÉVITÉ              | UNIQUE + `@@index([slug])` sur les 2 niveaux.                                   |
| **Relations cycliques non détectées**     | ⚠️ APPLICATIF         | DAG validation côté server action `addRelation.ts` (Sprint KB-8). STOP & ASK 8. |
| **Status + Pipeline confondus**           | ✅ ÉVITÉ              | `KbStatus` (technique) ≠ `KbPipelineStage` (éditorial).                         |
| **Author dupliqué**                       | ✅ ÉVITÉ              | Réutilisation `Author` existant via `assignedAuthorId` FK. STOP & ASK 5.        |
| **FTS sur HTML brut**                     | ✅ ÉVITÉ              | `searchVector` pointe sur `bodyText` plain (reality check §1.4).                |
| **Versions mutables**                     | ✅ ÉVITÉ              | Pas de `updatedAt` sur `KnowledgeVersion`.                                      |

---

## 9. STOP & ASK OUVERTS — Phase A → Phase B

### STOP & ASK 1 — `KbStatus` dédié vs étendre `PublishStatus`

**Recommandation forte Phase A : `KbStatus` DÉDIÉ.**

- Pour : isolation domaines (booking ≠ KB), workflow propre, migration future safe.
- Contre : 1 enum de plus dans le schéma (acceptable).

→ Will valide / refuse.

### STOP & ASK 2 — `glossary_term` : FR/EN même entry ou 2 entries ?

**Hypothèse Phase A : MÊME entry, 2 translations (cohérence avec articles).**

- Pour : 1 terme glossaire = 1 concept (acrostiche FR + EN du même mot).
- Contre : si EN diverge sémantiquement (rare), 2 entries cleanly.

→ Will tranche. Si "même entry", `KnowledgeTranslation` accepte FR `slug='intelligence-artificielle'` + EN `slug='artificial-intelligence'` du même `entryId`.

### STOP & ASK 3 — Slug EN du hub blog : `/en/blog` ou `/en/articles` ?

**§12.4 master prompt** définit `article: { fr: '/blog', en: '/blog' }`. Mais convention web EN = `/blog` aussi. Confirmation : OK garder `/en/blog`.

### STOP & ASK 4 — pgvector V1 ou V1.5 ?

**Recommandation Phase A : V1.5** (cf. reality check §1.3, extension absente, ADR séparé Sprint KB-21).

- Alternative : table `KnowledgeEmbedding` créée en V1 (vide) avec extension chargée mais index vide.
- Coût V1 si V1.5 only : 1 migration ADD TABLE en V1.5.
- Coût V1 si table vide : 1 migration EXTENSION + ADD TABLE en V1 + alimentation en V1.5.

→ Will tranche.

### STOP & ASK 5 — `Author` existant vs `KnowledgeAuthor` neuf ?

**Recommandation forte Phase A : RÉUTILISER `Author` existant** (reality check §1.1 confirme bilingue inline + FK existante depuis `Article`).

- Pour : pas de duplication, `Author` déjà bilingue (`bioFr`/`bioEn`/`avatarUrl`/`linkedinUrl`).
- Contre : couplage léger avec legacy (acceptable — `Author` est doctrinairement transverse, pas booking-spécifique).

→ Will valide.

### STOP & ASK 6 — `KnowledgeTagOnEntry` composite PK ok vs surrogate id ?

**Recommandation Phase A : COMPOSITE PK** (pattern `ArticleTagOnArticle` schema.prisma:777-785 strictement identique).

- Pour : sobre, cohérent legacy.
- Contre : pas de tracking créatif (qui a tagué quand) — acceptable car `ActivityLog` couvre.

→ Will valide.

### STOP & ASK 6 bis — Tags en table de liaison vs colonne JSON sur entry ?

**Recommandation Phase A : TABLE DE LIAISON.**

- Pour : pattern existant, requêtes facette simples (`/blog/tag/[slug]`), tag metadata partagée (nameFr/nameEn/descFr/color).
- Contre : 1 table de plus.

→ Will valide.

### STOP & ASK 7 — Soft-delete (`deletedAt`) vs `status='archived'` ?

**Recommandation Phase A : LES DEUX, dimensions différentes.**

- `status='archived'` = visible admin, masqué public, intentionnel.
- `deletedAt IS NOT NULL` = supprimé, recovery 30j, retention-purge cron.
- Pattern : utilisateur clique "Archiver" → `status='archived'`. Clique "Supprimer" → `deletedAt=now()`.

→ Will valide.

### STOP & ASK 8 — Relations cycliques autorisées ou bloquantes ?

**Recommandation Phase A : DAG pour `depends_on`/`supersedes`/`replaces`/`extends` (bloquant), multigraph pour `related_to`/`cites`/`contradicts` (autorisé).**

- Implémentation : assertion server-side BFS dans `addRelation.ts` (Sprint KB-8).
- Pas de contrainte SQL native (Postgres ne supporte pas DAG natif).
- Test bloquant : tentative `A depends_on B` puis `B depends_on A` → throw `KbRelationCycleError`.

→ Will valide.

---

## 10. PRÉ-REQUIS PHASE B (avant Sprint KB-1)

1. Will tranche les 8 STOP & ASK §9.
2. Will tranche les décisions reality check §10 (top-level 1-5 minimum).
3. Will commit/stash le WIP booking (`00-REALITY-CHECK.md §7.1`).
4. Will valide le chemin ADR : `docs/adr/0021-knowledge-base.md` (cf. reality check §6).
5. Agent 2 (SSOT) reçoit ce 01-DATA-MODEL.md en input pour générer le tableau enums + helpers.
6. Agent 5 (Search) reçoit le tsvector GENERATED template pour Sprint KB-7.
7. Agent 8 (Workflow) reçoit la matrice `KbStatus` / `KbPipelineStage` orthogonale.

---

**Fin du data model.** Document prêt à fusionner avec les 17 autres agents pour synthèse Phase A.
