# Backend — Tuteur RAG (assistance pédagogique FOAD)

> **Rôle réglementaire.** Ce composant est la brique technique qui matérialise l'**assistance technique ET pédagogique** exigée par l'**art. D.6313-3-1 (1°)** du Code du travail et contrôlée par l'**indicateur Qualiopi V8 n°19** (seule obligation FOAD nommée). Le tuteur RAG n'est PAS un gadget : sans accompagnement formalisé + traces, un parcours FOAD est **non finançable** (non-conformité majeure possible sur Ind.11 si les évaluations manquent ; non-conformité sur Ind.19 si l'accompagnement n'est ni accessible ni tracé). La **journalisation des échanges** produite ici est un élément du **faisceau de preuves** (R.6313-3 : preuve libre) que l'OPCO/DREETS peut réclamer en contrôle.
>
> **Anti-pattern à éviter (explicitement demandé par Will).** Pas de « wrapper ChatGPT nu ». Le tuteur est **ancré** (RAG sur le contenu réel du cours + la base de connaissances existante), **cite ses sources**, fonctionne en **mode socratique** (il guide, il ne donne pas les réponses des quiz), et **refuse honnêtement** plutôt que d'halluciner. Toutes ces propriétés sont des garde-fous codés, pas des consignes de prompt fragiles.
>
> Statut : **spécification** (à implémenter en V1 — cf. `11-ROADMAP/01-phasage-mvp-v1-v2.md`, le tuteur est listé V1 ; un MVP « assistance basique + traces » est requis dès le MVP pour la conformité FOAD).
> Dernière mise à jour : 2026-06-27.

---

## 1. EXISTANT réutilisé vs NEUF à construire

Le repo possède **déjà un moteur RAG complet et durci** : le **chatbot commercial** (`src/server/chatbot/**`, T-01→T-38, modèles `ChatTenant`/`ChatKbChunk`/`ChatConversation`/`ChatMessage`/`ChatSemanticCache`/`ChatEscalation`). On **réutilise ses patterns et ses briques**, mais on **ne le détourne pas** : le chatbot est public/anonyme/commercial, le tuteur est authentifié/pédagogique/preuve-FOAD. Cloisonnement strict (ADR-LMS-0007) → tout le code tuteur vit sous `src/server/elearning/tutor/**`.

### 1.1 Réutilisé tel quel (import direct, zéro duplication)

| Brique existante           | Fichier                                                                                                                                                                                                                          | Usage dans le tuteur                                                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Embeddings vectoriels**  | `src/lib/knowledge/embeddings.ts` (`generateEmbedding`, `EMBEDDING_MODEL_NAME = "voyage-3"`, `EMBEDDING_DIMENSION = 1024`, `cosineSimilarity`, `buildEmbeddingInput`, `checkEmbeddingHealth`, `EmbeddingConfidentialityRefusal`) | Indexation du contenu de cours + embedding des questions apprenant. **Même espace vectoriel 1024-dim** (Voyage `voyage-3`, `output_dimension: 1024`, Matryoshka) → pas de migration de dimension. Refus dur `confidential`/`secret` hérité. |
| **Provider LLM Anthropic** | `src/server/content-gen/providers/anthropic.ts` (`anthropicProvider.generate`, streaming, `cache_control: ephemeral`, `withRetry`, `assertCostCapAvailable`, `trackCost`)                                                        | Génération de la réponse tuteur en streaming, avec prompt caching sur le system prompt (contexte cours) et tracking de coût atomique.                                                                                                       |
| **Fusion RRF**             | `src/server/chatbot/retrieval/hybrid-search.ts` (`reciprocalRankFusion`)                                                                                                                                                         | Fonction pure réutilisable telle quelle pour fusionner vecteur + FTS.                                                                                                                                                                       |
| **Cost tracker**           | `src/server/content-gen/lib/cost-tracker.ts` (`trackCost`, `assertCostCapAvailable`)                                                                                                                                             | Cap de coût pré-appel + comptabilité par job.                                                                                                                                                                                               |
| **Telegram incident**      | `src/lib/telegram.ts` (`sendTelegram`)                                                                                                                                                                                           | Alerte ops si Voyage/Anthropic KO (le tuteur tombe en mode dégradé, cf. §9).                                                                                                                                                                |
| **R2 storage**             | `src/lib/r2-storage.ts`                                                                                                                                                                                                          | Lecture des PDF de leçon (`pdfKey`) pour indexation du contenu textuel.                                                                                                                                                                     |
| **Identité apprenant**     | `Trainee` + `PortailAcces` (`~schema.prisma:5274`, `:6236`) ; cf. `04-BACKEND/05-authentification-apprenant.md`                                                                                                                  | Le tuteur est **derrière l'auth apprenant** (cookie HttpOnly du portail). Chaque conversation est rattachée à un `traineeId` réel → traçabilité nominative (preuve FOAD).                                                                   |
| **Cours / leçons**         | `ElearningCourse`/`ElearningModule`/`ElearningLesson` (`03-DATA-MODEL/01-schema-cours-modules-lecons.md`)                                                                                                                        | Source du corpus RAG (`contenuJson`, `pdfKey`, `videoAssetId`→sous-titres) + scope de la conversation.                                                                                                                                      |
| **Quiz**                   | `Quiz`/`Question`/`QuizAttempt` (`03-DATA-MODEL/03-schema-quiz-evaluations.md`)                                                                                                                                                  | Détection « en cours de quiz » pour le garde-fou anti-triche (§9.4).                                                                                                                                                                        |

### 1.2 NEUF à construire

- **Corpus RAG dédié e-learning** : modèle `ElearningTutorChunk` (chunks du contenu de cours, vectorisés) — distinct de `ChatKbChunk` (commercial) et de `KnowledgeEmbedding` (KB éditoriale). Cf. §4.
- **Journal de conversation tuteur** : `ElearningTutorConversation` + `ElearningTutorMessage` (rattachés à `Trainee`/`ElearningCourse`, conservés comme **preuve FOAD**). Cf. §4.
- **Escalade humaine formalisée** : `ElearningTutorEscalation` (délais de réponse formalisés = exigence Ind.19). Cf. §4 + §9.6.
- **Pipeline d'indexation** : worker `elearning-tutor-index-worker.ts` qui (re)construit les chunks à la publication d'un cours. Cf. §10.
- **Orchestrateur tuteur** : `src/server/elearning/tutor/orchestrator.ts` (retrieval → garde-fous → génération socratique → guard sortie → persistance). Cf. §3, §8.
- **System prompt socratique + ancrage + citations** : `src/server/elearning/tutor/system-prompt.ts`. Cf. §7, §6.
- **Route SSE + server action** : streaming de la réponse vers le lecteur de cours. Cf. §11.
- **Console admin** : configuration (modèle, seuils, ton), supervision des conversations, file d'escalades. Cf. §13.

---

## 2. Vue d'ensemble (un tour de tuteur)

```
Apprenant (authentifié portail, dans une leçon)
   │  POST /api/elearning/tutor  { courseId, lessonId?, message }
   ▼
[1] Auth apprenant (cookie PortailAcces → traineeId)           ── garde-fou accès
[2] Vérifier l'octroi d'accès au cours (ElearningEnrollment)    ── garde-fou périmètre
[3] Charger la config tuteur (modèle, seuils) + état quiz       ── garde-fou anti-triche (§9.4)
[4] Embedding de la question (Voyage voyage-3, 1024-dim)
[5] RETRIEVAL hybride scopé courseId :
        vecteur (pgvector cosine) + FTS (fr_unaccent) → RRF → top-K
        + (optionnel) chunks KB publics pertinents (knowledge_embeddings)
[6] Rerank léger + seuil de confiance
        └─ confiance faible → PAS d'appel LLM → réponse honnête + escalade (§9.6)
[7] Assemble SYSTEM PROMPT socratique + CONTEXTE (chunks, seule source) + état quiz
[8] Génération Anthropic en streaming (prompt caching sur le contexte cours)
[9] OUTPUT-GUARD : zéro-hallucination (URL/chiffres hors contexte), anti-leak quiz
        └─ violation → réponse de repli + escalade
[10] Persistance : ElearningTutorMessage (learner + tutor) + sources + coût + modèle + latence
        → PREUVE FOAD (faisceau R.6313-3 + traçabilité Ind.19)
   ▼
SSE → lecteur de cours (composant TutorPanel)
```

**Canal-agnostique, LLM injecté** (même philosophie que `src/server/chatbot/orchestrator.ts:handleTurn`) : l'orchestrateur reçoit `generateAnswer`/`retrieve`/`rerank` en dépendances injectables → testable sans appel réseau.

---

## 3. Architecture & arborescence (cloisonnement ADR-LMS-0007)

```
src/server/elearning/tutor/
├─ orchestrator.ts          # handleTutorTurn() — pipeline §2, deps injectables
├─ retrieval.ts             # hybridSearchTutor() — pgvector + FTS + RRF, scopé courseId
├─ rerank.ts                # rerank léger (réutilise pattern chatbot/retrieval/rerank)
├─ confidence.ts            # assessConfidence() — seuil → escalade sans LLM
├─ system-prompt.ts         # assembleTutorSystemPrompt() — socratique + ancrage + citations
├─ guards.ts                # verifyTutorOutput() — anti-hallucination + anti-leak quiz
├─ quiz-state.ts            # isQuizInProgress() — garde-fou anti-triche (§9.4)
├─ journal.ts               # persistTutorTurn() — écriture preuve FOAD
├─ escalation.ts            # openEscalation() / closeEscalation() — Ind.19 délais
├─ index-content.ts         # buildCourseChunks() — extraction texte cours → chunks
├─ config.ts               # readTutorConfig() — SiteSetting cat. "elearning_tutor"
└─ constants.ts             # RETRIEVAL_TOP_K, RERANK_TOP_N, seuils, modèles, caps

src/server/queue/workers/
├─ elearning-tutor-index-worker.ts        # (ré)indexation contenu cours → chunks + embeddings
└─ elearning-tutor-escalation-worker.ts   # notification équipe + relance SLA Ind.19

src/app/api/elearning/tutor/
└─ route.ts                 # POST SSE (force-dynamic, runtime=nodejs)

src/app/[locale]/(admin)/[adminPrefix]/elearning/tuteur/
├─ page.tsx                 # dashboard supervision conversations
├─ config/page.tsx          # configuration (modèle, seuils, ton)
└─ escalades/page.tsx       # file d'escalades (SLA Ind.19)

src/components/elearning/Tutor/
├─ TutorPanel.tsx           # panneau latéral dans le lecteur de cours (client)
├─ TutorMessage.tsx         # bulle + bloc « Sources » cliquables
└─ TutorEscalationForm.tsx  # « poser ma question à un formateur »

src/server/actions/elearning/
└─ tutor.ts                 # server actions (config admin, clôture escalade)
```

> **Stub-aware build (ADR 0026).** La route `/api/elearning/tutor` est `force-dynamic` + derrière auth → **jamais exécutée au build SSG** sous `stub.invalid`. Les workers respectent `BULLMQ_DISABLED=true`. `index-content.ts` ne fait aucun appel DB/Voyage au build (déclenché uniquement au runtime/worker). Aucune action requise côté contrat stub, mais : le client Prisma stub couvre déjà `[] / null / 0`, donc un éventuel pré-rendu d'une page admin sous stub renvoie une liste vide (acceptable).

---

## 4. Data model (NEUF — migrations strictement additives, ADR-LMS-0008)

Conventions du repo : UUID `id`, `@map` snake_case, `citext` pour emails, enums Prisma, index sur FK + colonnes filtrées, timestamps. Colonnes vectorielles `vector(1024)` + `tsvector` ajoutées via une migration SQL manuelle (comme `migrations_fts` du chatbot, T-02) — pgvector + extension `unaccent`/config FTS `fr_unaccent` déjà présentes en prod (utilisées par `chat_kb_chunks`).

### 4.1 Enums

```prisma
enum ElearningTutorMessageRole {
  learner   // message de l'apprenant
  tutor     // réponse du tuteur IA
  system    // note système (escalade ouverte, mode dégradé…) — non affichée comme bulle
}

enum ElearningTutorEscalationStatut {
  ouverte       // en attente de réponse formateur (SLA Ind.19 court)
  en_cours      // prise en charge
  repondue      // formateur a répondu (délai respecté = preuve)
  cloturee      // résolue
}

enum ElearningTutorTurnIssue {
  ok
  low_confidence    // retrieval faible → escaladé sans LLM
  guard_violation   // sortie bloquée (hallucination/leak quiz)
  quiz_locked       // question pendant un quiz → refus pédagogique
  provider_down     // LLM/embedding KO → mode dégradé
  cost_capped       // cap de coût atteint → mode éco
}
```

### 4.2 `ElearningTutorChunk` — corpus RAG du contenu de cours

```prisma
/// Chunks RAG dérivés du contenu d'un cours e-learning (leçons texte/pdf/sous-titres).
/// `embedding vector(1024)` + `tsv tsvector` ajoutés via migration SQL manuelle.
/// DISTINCT de ChatKbChunk (commercial) et KnowledgeEmbedding (KB éditoriale).
model ElearningTutorChunk {
  id          String           @id @default(uuid()) @db.Uuid
  courseId    String           @map("course_id")
  course      ElearningCourse  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  // Provenance fine → permet la citation « source » cliquable côté apprenant.
  moduleId    String?          @map("module_id")
  lessonId    String?          @map("lesson_id")
  sourceType  String           @db.VarChar(30)   // lesson_text | lesson_pdf | lesson_caption | resource
  sourceRef   String           @db.VarChar(255)  // id leçon/ressource (ancre dans l'UI)
  titreSource String?          @map("titre_source") @db.VarChar(250) // titre leçon (affiché dans le bloc Sources)
  ordre       Int              @default(0)        // ordre du chunk dans la leçon (reconstruction)
  contenu     String           @db.Text           // texte du chunk
  tokensEstimes Int            @default(0) @map("tokens_estimes")
  // Colonnes ajoutées via migration SQL ($queryRaw) :
  embedding   Unsupported("vector(1024)")?
  tsv         Unsupported("tsvector")?
  // Versionnage : on réindexe à chaque publication de cours (ElearningCourse.version).
  courseVersion Int            @default(1) @map("course_version")
  actif       Boolean          @default(true)
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  @@index([courseId, actif])
  @@index([lessonId])
  @@map("elearning_tutor_chunks")
}
```

Index vectoriel + FTS (migration SQL manuelle, additive) :

```sql
-- migration: 20260701000000_elearning_tutor_chunks_fts
ALTER TABLE "elearning_tutor_chunks" ADD COLUMN IF NOT EXISTS "embedding" vector(1024);
ALTER TABLE "elearning_tutor_chunks" ADD COLUMN IF NOT EXISTS "tsv" tsvector;
CREATE INDEX IF NOT EXISTS elearning_tutor_chunks_embedding_hnsw
  ON "elearning_tutor_chunks" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS elearning_tutor_chunks_tsv_gin
  ON "elearning_tutor_chunks" USING gin ("tsv");
-- tsv alimenté à l'écriture via $executeRaw (websearch_to_tsquery('fr_unaccent', ...)),
-- même config FTS que chat_kb_chunks (aucune nouvelle extension à créer).
```

### 4.3 `ElearningTutorConversation` + `ElearningTutorMessage` — journal = preuve FOAD

```prisma
/// Conversation tuteur d'un apprenant sur un cours (état serveur, preuve FOAD).
model ElearningTutorConversation {
  id          String          @id @default(uuid()) @db.Uuid
  traineeId   String          @map("trainee_id") @db.Uuid
  trainee     Trainee         @relation(fields: [traineeId], references: [id], onDelete: Cascade)
  courseId    String          @map("course_id")
  course      ElearningCourse @relation(fields: [courseId], references: [id], onDelete: Cascade)
  // Lien fort à l'inscription e-learning → rattache l'accompagnement à un parcours
  // finançable précis (BPF, dossier OPCO, certificat de réalisation).
  enrollmentId String?        @map("enrollment_id") @db.Uuid  // ElearningEnrollment (doc 02)
  statut      String          @default("active") @db.VarChar(20)
  resume      String?         @db.Text   // contexte long résumé (T-31-like), n'efface jamais les messages bruts
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")

  messages    ElearningTutorMessage[]
  escalations ElearningTutorEscalation[]

  @@index([traineeId, courseId])
  @@index([enrollmentId])
  @@map("elearning_tutor_conversations")
}

/// Message individuel — chaque tour persiste l'échange COMPLET (assistance Ind.19 tracée).
model ElearningTutorMessage {
  id             String                     @id @default(uuid()) @db.Uuid
  conversationId String                     @map("conversation_id") @db.Uuid
  conversation   ElearningTutorConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           ElearningTutorMessageRole
  contenu        String                     @db.Text
  // Sources citées (chunks RAG) — JSON [{ sourceType, sourceRef, lessonId, titreSource }]
  sources        Json?
  issue          ElearningTutorTurnIssue    @default(ok)
  // Observabilité / coût (réutilise la sémantique de chat_messages) :
  modele         String?                    @db.VarChar(80)
  tokensInput    Int?                       @map("tokens_input")
  tokensOutput   Int?                       @map("tokens_output")
  coutUsd        Decimal?                   @map("cout_usd") @db.Decimal(10, 6)
  latenceMs      Int?                       @map("latence_ms")
  // Contexte pédagogique du tour (leçon où la question a été posée) :
  lessonId       String?                    @map("lesson_id")
  // Feedback apprenant (pouce +1/-1) — signal qualité de l'accompagnement.
  feedback       Int?
  createdAt      DateTime                   @default(now()) @map("created_at")

  @@index([conversationId, createdAt])
  @@map("elearning_tutor_messages")
}
```

### 4.4 `ElearningTutorEscalation` — accompagnement humain formalisé (Ind.19)

```prisma
/// Question escaladée vers un formateur humain (assistance pédagogique accessible
/// + délais FORMALISÉS — exigence Ind.19 / D.6313-3-1 §1).
model ElearningTutorEscalation {
  id             String                         @id @default(uuid()) @db.Uuid
  conversationId String                         @map("conversation_id") @db.Uuid
  conversation   ElearningTutorConversation     @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  traineeId      String                         @map("trainee_id") @db.Uuid
  courseId       String                         @map("course_id")
  question       String                         @db.Text
  contexte       String?                        @db.Text  // leçon + extraits vus par le tuteur
  statut         ElearningTutorEscalationStatut @default(ouverte)
  // SLA formalisé (config) → délai cible de réponse ; preuve du « délai formalisé ».
  dueAt          DateTime?                      @map("due_at")
  // Affectation + réponse formateur (réutilise FormateurMagicLink / espace-formateur).
  formateurId    String?                        @map("formateur_id") @db.Uuid
  reponse        String?                        @db.Text
  repondueAt     DateTime?                      @map("repondue_at")
  emailEnvoye    Boolean                        @default(false) @map("email_envoye")
  createdAt      DateTime                       @default(now()) @map("created_at")
  updatedAt      DateTime                       @updatedAt @map("updated_at")

  @@index([statut, dueAt])
  @@index([courseId])
  @@map("elearning_tutor_escalations")
}
```

> **Champs inverses additifs** (relations sans colonne côté modèles existants — zéro risque) :
>
> ```prisma
> // model Trainee { ... }
>   tutorConversations ElearningTutorConversation[]
>   tutorEscalations   ElearningTutorEscalation[]      // via traineeId (optionnel : relation simple ou scalaire)
> // model ElearningCourse { ... }
>   tutorChunks        ElearningTutorChunk[]
>   tutorConversations ElearningTutorConversation[]
> ```

> **Config tuteur** : stockée en `SiteSetting` (catégorie `elearning_tutor`, JSON), comme les configs Qualiopi/chatbot — pas de table dédiée. Clés : `model`, `escalationModel`, `confidenceThreshold`, `retrievalTopK`, `rerankTopN`, `maxTokens`, `costCapDailyUsd`, `escalationSlaHours`, `tone` (`socratique`|`direct`), `includeKbChunks` (bool). Cf. §13 + §14.

---

## 5. RAG — ancrage sur le contenu du cours (+ KB existante)

### 5.1 Indexation du contenu de cours (`index-content.ts` + worker)

Déclenché à la **publication d'un cours** (`ElearningCourse.statut → publie`, incrément `version`) via enqueue BullMQ → `elearning-tutor-index-worker.ts`. Idempotent : on supprime/désactive les chunks de la version précédente et on recrée.

Extraction du texte par type de leçon (`ElearningLessonType`) :

| Type leçon       | Source de texte                                                  | Méthode                                                                                            |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `texte`          | `ElearningLesson.contenuJson` (blocs Tiptap/JSON)                | aplatir les blocs → texte brut                                                                     |
| `pdf`            | `ElearningLesson.pdfKey` (R2)                                    | `getSignedUrlR2` → extraction texte (pdf-parse) ; **fallback vide si échec, jamais throw**         |
| `video`          | sous-titres `ElearningResource` (`type = "sous_titres"`, WebVTT) | parse VTT → texte (les sous-titres WCAG sont déjà produits, cf. `07-pipeline-video-streaming.md`)  |
| `quiz`           | **NON indexé**                                                   | les questions/réponses de quiz ne doivent JAMAIS entrer dans le corpus du tuteur (anti-leak, §9.4) |
| `embed`/`devoir` | `contenuJson` (consignes)                                        | aplatir ; jamais les corrigés                                                                      |

Chunking : ~500–800 tokens, chevauchement ~80, **un chunk ne traverse pas deux leçons** (la provenance fine `lessonId` est load-bearing pour la citation). Embedding via `generateEmbedding(text, confidentiality)` (réutilise `src/lib/knowledge/embeddings.ts`). `tsv` rempli via `$executeRaw … to_tsvector('fr_unaccent', $contenu)`. Le worker écrit en transaction et trace le coût Voyage (tokens) via `trackCost`.

> **Refus dur de confidentialité** hérité : un contenu marqué `confidential`/`secret` (si jamais on étend ce concept aux cours) n'est PAS envoyé à Voyage (`EmbeddingConfidentialityRefusal`). En pratique le contenu de cours est `public` pour ses apprenants ; le refus reste un garde-fou de sécurité.

### 5.2 Retrieval hybride scopé cours (`retrieval.ts`)

Calque sur `src/server/chatbot/retrieval/hybrid-search.ts` mais **filtré par `courseId`** (jamais le contenu d'un autre cours) et requêtes paramétrées `$queryRaw` (zéro injection SQL) :

```ts
// vecteur (pgvector cosine), scopé cours + actif
SELECT id, lesson_id, source_type, source_ref, titre_source, contenu
FROM "elearning_tutor_chunks"
WHERE "course_id" = ${courseId} AND "actif" = true AND "embedding" IS NOT NULL
ORDER BY "embedding" <=> ${literal}::vector
LIMIT ${topK}

// FTS lexicale (fr_unaccent), scopé cours + actif
SELECT id, lesson_id, source_type, source_ref, titre_source, contenu
FROM "elearning_tutor_chunks", websearch_to_tsquery('fr_unaccent', ${query}) AS q
WHERE "course_id" = ${courseId} AND "actif" = true AND "tsv" @@ q
ORDER BY ts_rank_cd("tsv", q) DESC
LIMIT ${topK}
```

Fusion par **`reciprocalRankFusion`** importé tel quel de `chatbot/retrieval/hybrid-search.ts`. **Repli FTS-seul** si l'embedding est un stub (`modelVersion` suffixé `-stub`, c.-à-d. `VOYAGE_API_KEY` absente) ou si Voyage est down — exactement comme le chatbot (dégradé mais fonctionnel ; alerte Telegram via `embeddings.ts`).

**Élargissement KB (optionnel, flag `includeKbChunks`)** : si la question dépasse le cours (« qu'est-ce que le RGPD ? »), on peut ajouter des chunks **publics** de `KnowledgeEmbedding`/`KnowledgeEntry` (KB éditoriale existante). Ces chunks sont marqués `sourceType = "kb"` et leur citation pointe vers la ressource publique. **Par défaut OFF en MVP** : on reste strictement ancré sur le cours pour éviter les digressions et limiter le coût.

### 5.3 Rerank + seuil de confiance

- **Rerank** (`rerank.ts`) : réutilise le pattern `chatbot/retrieval/rerank` (rerank Voyage si dispo, sinon repli sur l'ordre RRF). top-N injecté au prompt (`RERANK_TOP_N`, défaut 5).
- **Confiance** (`confidence.ts`, `assessConfidence`) : si le meilleur score est sous `confidenceThreshold`, on **n'appelle PAS le LLM** → réponse honnête + escalade (§9.6). Économie + anti-hallucination.

---

## 6. Citations obligatoires

**Contrainte produit + conformité** : toute réponse ancrée DOIT exposer ses sources (transparence pédagogique + traçabilité). Deux niveaux :

1. **Prompt** : le system prompt impose « quand tu utilises le CONTEXTE, référence l'extrait par son numéro `[n]` » (cf. §7) — calqué sur `chatbot/generation/system-prompt.ts` (« cite la source (type:référence) »).
2. **Persistance structurée** : on **ne fait pas confiance** au LLM pour formater proprement les sources. L'orchestrateur persiste dans `ElearningTutorMessage.sources` la liste **réelle** des chunks injectés (`{ sourceType, sourceRef, lessonId, titreSource, ordre }`), indépendamment du texte. Le composant `TutorMessage.tsx` rend un **bloc « Sources »** avec des **liens cliquables** vers la leçon/ancre (`lessonId` + `sourceRef`) — l'apprenant peut vérifier dans le cours.

> Rendu : « D'après la leçon _Les biais de l'IA_ (§2), … » + chips cliquables. Si `sources` est vide (réponse non ancrée, ex. relance socratique pure), pas de bloc Sources — et le garde-fou (§9.1) s'assure qu'aucune affirmation factuelle non sourcée ne passe.

---

## 7. Mode socratique (system prompt)

Le tuteur **guide** vers la compréhension, il ne **livre pas** la réponse toute faite — surtout pas les corrigés de quiz/devoir. C'est ce qui le distingue d'un wrapper ChatGPT et ce qui en fait un outil pédagogique.

`assembleTutorSystemPrompt(opts)` (calque sur `chatbot/generation/system-prompt.ts:assembleSystemPrompt`), avec **`cache_control: ephemeral`** sur le bloc contexte cours (prompt caching Anthropic — le contexte est stable sur une session) :

```
Tu es le tuteur pédagogique d'Axion-IA pour le cours « <titre cours> ».
Tu accompagnes <prénom apprenant> dans son apprentissage en formation à distance (FOAD).

RÔLE & MÉTHODE (socratique) :
- Ton objectif est que l'apprenant COMPRENNE, pas qu'il obtienne une réponse à recopier.
- Privilégie les questions de relance, les indices progressifs, les reformulations et les
  analogies. Ne donne la réponse directe que si l'apprenant est manifestement bloqué après
  un ou deux indices, ou s'il demande une définition factuelle simple.
- Encourage, sois bienveillant et concis. Réponds TOUJOURS en français.

ANCRAGE (règle absolue) :
- Réponds UNIQUEMENT à partir du CONTEXTE ci-dessous (extraits du cours). N'invente jamais
  un fait, un chiffre, une date ou une URL absent du CONTEXTE. Si l'information manque,
  dis-le honnêtement et propose de transmettre la question à un formateur.
- Quand tu t'appuies sur un extrait, référence-le par son numéro [n].

INTERDICTIONS (anti-triche) :
- Ne donne JAMAIS la réponse d'un quiz, d'un devoir ou d'une évaluation. Si la question
  ressemble à un item d'évaluation, explique le CONCEPT sous-jacent et invite l'apprenant
  à réessayer par lui-même — ne révèle pas la bonne option.
- Ne rédige pas à la place de l'apprenant un travail qui sera évalué.

TRANSPARENCE (AI Act art. 50) :
- Tu es une intelligence artificielle d'assistance. Rappelle-le si on te le demande.
- Pour toute question hors de ta portée (administratif, financement, attestation,
  technique plateforme), oriente vers un formateur (bouton « Poser ma question »).

## CONTEXTE (seule source autorisée pour répondre)
[1] (lesson_text:<lessonId>) <titre leçon> — <contenu chunk>
[2] (lesson_pdf:<ref>) ...
...
## ÉTAT (contexte du tour)
Leçon en cours : <titre>.  [Quiz en cours : OUI → mode anti-triche renforcé]
## RÉSUMÉ (tours précédents)  <resume si présent>
```

- **Brand-voice** : héritage optionnel de la persona pédagogique via `injectBrandVoiceForType(prompt, "qa_derived")` (réutilise `src/server/content-gen/brand/brand-voice.ts`) pour le ton + l'AI Act + les mots bannis. À évaluer : la voix « Manon » est commerciale ; pour le tuteur, un ton **pédagogue/encourageant** est préférable. Recommandation MVP : ne PAS injecter la brand-voice commerciale, garder le ton socratique défini ci-dessus (`tone` config).
- **Thinking** : `thinking: { type: "adaptive", display: "omitted" }` (le raisonnement n'est pas montré à l'apprenant ; `omitted` = défaut, pas de coût d'affichage). Cf. §14.
- **Adaptation au niveau** : le prompt peut intégrer le score/progression de l'apprenant (`LessonProgress`, `QuizAttempt`) pour calibrer le niveau d'indice — V1.5.

---

## 8. Orchestrateur (`orchestrator.ts`)

`handleTutorTurn(input, ctx, deps)` — mêmes principes que `chatbot/orchestrator.ts:handleTurn` (deps injectables, fail-soft, jamais d'erreur brute côté apprenant).

```ts
export interface TutorTurnInput {
  readonly traineeId: string;
  readonly courseId: string;
  readonly lessonId?: string;
  readonly message: string;
  readonly conversationId?: string;
}
export interface TutorTurnResult {
  readonly text: string;
  readonly sources: ReadonlyArray<TutorSource>;
  readonly issue: ElearningTutorTurnIssue;
  readonly escalate: boolean; // l'UI propose « poser ma question à un formateur »
  readonly conversationId: string;
  readonly model?: string;
  readonly costUsd?: number;
}
export interface TutorDeps {
  readonly generateAnswer?: TutorGenerateFn; // défaut → anthropicProvider.generate
  readonly retrieve?: typeof hybridSearchTutor;
  readonly rerank?: typeof rerankTutorChunks;
  readonly acquireLlmSlot?: () => boolean; // TokenBucket (réutilise chatbot/resilience)
}
```

Séquence (référence §2). Points de garde-fou intégrés :

1. **Accès** : vérifier `ElearningEnrollment` (trainee ↔ course actif). Sinon 403 (jamais de tuteur sur un cours non octroyé).
2. **Anti-triche** : `isQuizInProgress(traineeId, courseId, lessonId)` → si vrai, `issue = quiz_locked`, mode renforcé (§9.4).
3. **Cap coût** : `assertCostCapAvailable("elearning_tutor", 0.05)` (réutilise cost-tracker). Cap atteint → mode éco (escalade, pas d'appel LLM).
4. **Backpressure** : `TokenBucket` (réutilise `chatbot/resilience/token-bucket.ts`) — afflux → escalade plutôt que 429.
5. Retrieval → confiance → génération → guard → persistance (§9, §10).

Toute exception LLM/embedding est capturée → `issue = provider_down` + réponse de repli + escalade (jamais d'erreur brute). La **persistance du tour** (`persistTutorTurn`) a lieu **dans tous les cas** (y compris escalade/guard/provider_down) : l'événement d'assistance est tracé même si la réponse IA n'a pas abouti — c'est la trace qui compte pour Ind.19.

---

## 9. Garde-fous

### 9.1 Anti-hallucination (output-guard) — `guards.ts:verifyTutorOutput`

Calque sur `src/server/chatbot/security/output-guard.ts:verifyOutput` : la sortie ne doit contenir **aucune URL inventée** (hors routes connues + ancres de leçon du cours) ni **chiffre/affirmation factuelle non présent dans le CONTEXTE**. Violation → `issue = guard_violation` → réponse de repli (« Je préfère ne pas avancer une information incertaine — je transmets ta question à un formateur ») + escalade. C'est le filet qui empêche un « wrapper ChatGPT » de raconter n'importe quoi.

### 9.2 Ancrage strict (retrieval gate)

Pas de chunk pertinent (confiance faible, §5.3) → pas d'appel LLM → réponse honnête + escalade. Le tuteur ne « répond de mémoire » jamais.

### 9.3 Confidentialité

Refus dur `confidential`/`secret` à l'embedding (hérité `EmbeddingConfidentialityRefusal`). Le contexte cours n'envoie que des chunks `actif` du cours octroyé.

### 9.4 Anti-triche quiz (`quiz-state.ts`)

`isQuizInProgress` interroge `QuizAttempt` (statut « en cours », doc 03) pour la leçon/quiz courant. Deux protections cumulées :

- **Corpus** : les leçons `quiz` ne sont **jamais indexées** (§5.1) → les bonnes réponses n'existent pas dans le RAG.
- **Prompt + guard** : si quiz en cours, le system prompt passe en mode renforcé (interdiction explicite de donner une option) ET `verifyTutorOutput` bloque une réponse qui citerait littéralement un libellé de réponse de quiz (comparaison serveur contre les libellés du `Quiz` courant). Violation → `issue = quiz_locked`, message pédagogique de repli.
- **Anti-triche léger, proportionné CNIL** : pas de proctoring. Randomisation des questions + temps serveur côté quiz (cf. doc 03) ; le tuteur ne fait que _refuser de souffler_.

### 9.5 Périmètre / hors-sujet

Question hors cours et hors KB → réponse honnête + orientation formateur. Pas de réponse généraliste « ChatGPT ».

### 9.6 Escalade humaine formalisée (Ind.19) — `escalation.ts`

Déclenchée par : confiance faible, guard, provider down, cost cap, OU clic explicite « Poser ma question à un formateur ». `openEscalation` crée `ElearningTutorEscalation` (`statut = ouverte`, `dueAt = now + escalationSlaHours`), enqueue `elearning-tutor-escalation-worker.ts` → notifie l'équipe (Nodemailer + React Email + Telegram). Le **délai formalisé** (`dueAt`/SLA) et la **réponse tracée** (`reponse`/`repondueAt`) sont la **preuve directe de l'accompagnement Ind.19** (« assistance accessible + délais formalisés »). Réponse formateur via l'espace-formateur existant (`FormateurMagicLink`).

### 9.7 Abus / rate-limit

`TokenBucket` par instance (réutilise `chatbot/resilience`) + cap coût quotidien. RGPD : pas de PII apprenant superflue dans le prompt (prénom suffit).

---

## 10. Journalisation (preuve FOAD) — `journal.ts`

`persistTutorTurn` écrit, **à chaque tour** et dans tous les cas :

- `ElearningTutorMessage` (role `learner`) : la question.
- `ElearningTutorMessage` (role `tutor`) : la réponse (ou le message de repli), `sources` (chunks réels), `issue`, `modele`, `tokensInput/Output`, `coutUsd`, `latenceMs`, `lessonId`.
- mise à jour `ElearningTutorConversation.updatedAt` (+ `resume` si compaction T-31-like).

**Valeur conformité** :

- **R.6313-3 (preuve libre)** : les logs LMS d'accompagnement font partie du **faisceau de preuves** de réalisation (avec évaluations + travaux + relevés de connexion). Le relevé de connexion seul est insuffisant ; ces traces d'assistance le complètent.
- **Ind.19** : montre que l'assistance pédagogique a été **accessible et délivrée**, avec horodatage et nominativité (`traineeId` ↔ `enrollmentId`).
- **Export** : une server action admin exporte par apprenant/cours (PDF/CSV via `DocumentGenere` + QR, réutilisé) pour le dossier OPCO/contrôle DREETS.

**Conservation (cf. `08-CONFORMITE/05-rgpd-conservation-preuves.md`)** :

- Contenu pédagogique des échanges (preuve de réalisation) : **3–5 ans** (L.6362-6).
- Si rattaché à un financement OPCO : aligné **6 ans** (L.102B LPF) ; comptable **10 ans** (L.123-22) pour les pièces financières liées.
- Métadonnées techniques pures (latence, coût, IP éventuelle) : **6 mois–1 an** (CNIL 2021-122) → purge séparée par cron (réutilise le pattern de purge RGPD existant). **Ne pas confondre** : on purge les logs techniques tôt, on conserve la preuve pédagogique longtemps.
- **Droit à l'effacement / export** : intégré au mécanisme RGPD stagiaire existant (`DemandeRgpd`-like, `~schema.prisma:6275`) — l'export inclut les conversations tuteur ; l'effacement anonymise (ne casse pas la preuve agrégée mais retire la PII).

---

## 11. Workers, queues, route & server actions

### 11.1 Workers BullMQ (`src/server/queue/workers/`)

- **`elearning-tutor-index-worker.ts`** : (ré)indexe le contenu d'un cours → `ElearningTutorChunk` + embeddings + tsv. Enqueue à `ElearningCourse.statut → publie` (et bouton admin « Réindexer le tuteur »). Idempotent par `courseVersion`. Respecte `BULLMQ_DISABLED`.
- **`elearning-tutor-escalation-worker.ts`** : notifie l'équipe (email + Telegram) à l'ouverture d'une escalade, relance si SLA `dueAt` dépassé sans `repondueAt` (preuve que le délai formalisé est suivi).

### 11.2 Route SSE (`src/app/api/elearning/tutor/route.ts`)

`POST`, `export const dynamic = "force-dynamic"`, `runtime = "nodejs"`. Auth apprenant (cookie `PortailAcces` → `traineeId`, cf. doc 05). Streaming SSE de la réponse (réutilise le pattern de la route chatbot T-07 + le streaming `anthropicProvider.generate` via `onStreamChunk`). À la fin du stream : `persistTutorTurn`. Body : `{ courseId, lessonId?, message, conversationId? }`.

### 11.3 Server actions (`src/server/actions/elearning/tutor.ts`)

RBAC admin via `requireAdminRead/Write` (réutilise `src/server/actions/knowledge/_guards.ts`, rôles `super_admin/admin/editor/reader`) :

- `reindexCourseTutor(courseId)` (Write) — enqueue indexation.
- `listTutorConversations(filter)` / `getTutorConversation(id)` (Read) — supervision.
- `respondEscalation(id, reponse)` (Write, ou via espace-formateur) — clôt l'escalade, trace `repondueAt`.
- `updateTutorConfig(json)` (Write) — écrit le `SiteSetting` catégorie `elearning_tutor`.
- `exportTutorProofs(traineeId, courseId)` (Read) — génère la preuve d'accompagnement (`DocumentGenere`).

---

## 12. Frontend apprenant (rappel — détaillé dans `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md`)

- **`TutorPanel.tsx`** : panneau latéral dans le lecteur de cours (client component), ouvert via bouton. Envoie à `/api/elearning/tutor`, rend le stream.
- **`TutorMessage.tsx`** : bulle + bloc « Sources » cliquables (§6) + pouce de feedback (`ElearningTutorMessage.feedback`).
- **`TutorEscalationForm.tsx`** : « Poser ma question à un formateur » (déclenche `openEscalation`).
- **Web Vitals / WCAG 2.2 AA** : composant lazy-loadé (n'impacte pas le First Load JS du lecteur), focus management, libellés ARIA, contraste AA. Le tuteur est derrière auth → hors budget des 15 pages publiques, mais on garde l'INP ≤ 100 ms sur l'envoi (streaming, pas de blocage).

---

## 13. Console admin (rappel — `06-CONSOLE-ADMIN`)

Section `elearning/tuteur` montée dans `AdminSidebarNav.tsx` (⚠️ c'est `AdminSidebarNav.tsx` qui est monté, pas `AdminSidebar.tsx`) + entrée dans `admin-nav.ts`, sous le pôle e-learning. Pages : **dashboard** (volume de questions, taux d'escalade, taux de confiance, coût/jour, feedback moyen), **config** (modèle, seuils, ton, SLA, `includeKbChunks`, cap coût), **escalades** (file SLA Ind.19, prise en charge). Composants `AdminPageShell`/`AdminTable`/`AdminBadge`/`StatCard`.

---

## 14. Coûts

### 14.1 Modèles & tarifs (source de vérité : skill `claude-api`, table courante)

| Modèle            | ID                  | Input $/1M          | Output $/1M | Usage tuteur                                                                               |
| ----------------- | ------------------- | ------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Claude Haiku 4.5  | `claude-haiku-4-5`  | 1,00                | 5,00        | **Défaut tuteur** : dialogue socratique court, bien ancré (le RAG fait le gros du travail) |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | 3,00                | 15,00       | Escalade qualité (question complexe / faible confiance reformulée)                         |
| Claude Opus 4.8   | `claude-opus-4-8`   | 5,00                | 25,00       | Réservé (synthèses pédagogiques longues, V1.5) — `costCap` strict                          |
| Voyage `voyage-3` | —                   | embeddings 1024-dim | —           | indexation cours + embedding question (réutilise `embeddings.ts`)                          |

> ⚠️ **Dette à corriger** : la table `PRICING` dans `src/server/content-gen/providers/anthropic.ts` est **périmée** (elle indique Opus `$15/$75`, ancien tarif). Les tarifs courants (skill `claude-api`) sont Opus 4.8 **$5/$25**, Sonnet 4.6 $3/$15, Haiku 4.5 $1/$5. Le tuteur **doit** lire un pricing à jour pour son cost-cap — soit corriger la table partagée, soit fournir son propre pricing dans `tutor/config.ts`. **À trancher avec Will** avant implémentation (impact aussi le content-gen).

### 14.2 Leviers de coût (tous déjà disponibles dans le repo)

- **Prompt caching** (`cache_control: ephemeral` sur le bloc CONTEXTE cours) : le contexte est stable sur une session → cache read ~0,1× (le `anthropicProvider` track déjà `cache_read_input_tokens`/`cache_creation_input_tokens`). Gros gain quand l'apprenant pose plusieurs questions sur la même leçon.
- **RAG > contexte massif** : on n'injecte que `RERANK_TOP_N` chunks (~5), pas tout le cours → prompt court.
- **Modèle par défaut Haiku 4.5** : suffisant car le contenu est ancré ; on n'escalade vers Sonnet 4.6 que sur reformulation difficile.
- **Cost-cap** : `assertCostCapAvailable` pré-appel + `costCapDailyUsd` config → mode éco (escalade humaine) au lieu de dépenser sans limite.
- **Confidence gate** : retrieval faible → **0 appel LLM** (escalade directe).
- **Semantic cache (V1.5)** : questions fréquentes par cours (calque `ChatSemanticCache`) → 0 retrieval/0 LLM sur question proche. Hors MVP.
- **Thinking `adaptive` + `display: "omitted"`** : pas de surcoût d'affichage du raisonnement.

### 14.3 Ordre de grandeur

Un tour ancré ≈ 1–3 k tokens input (contexte + question) + 0,2–0,5 k output. Sur Haiku 4.5 avec caching, ≈ **0,003–0,01 $/tour**. Embedding question ≈ négligeable. L'indexation d'un cours est un one-shot par version. Budgétisation : `costCapDailyUsd` par défaut conservateur (ex. 5 $/jour), monitoring via le dashboard admin (§13) et `trackCost`.

---

## 15. Pourquoi ce n'est PAS un « wrapper ChatGPT nu » (récapitulatif)

1. **Ancré** : réponses issues du contenu réel du cours (RAG hybride pgvector+FTS), pas de la mémoire du modèle (confidence gate + output-guard).
2. **Cité** : sources structurées persistées + bloc « Sources » cliquable (§6).
3. **Socratique** : guide par indices, ne livre pas la réponse (§7) ; **refuse de souffler les quiz** (§9.4).
4. **Honnête** : confiance faible / hors-sujet / panne → escalade humaine tracée, jamais d'invention (§9).
5. **Tracé** : chaque échange = preuve FOAD nominative et horodatée (§10) — un wrapper ChatGPT ne produit aucune preuve réglementaire.
6. **Maîtrisé en coût** : RAG + caching + Haiku par défaut + cost-cap (§14).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0006 (tracking style xAPI), ADR-0007 (cloisonnement), ADR-0008 (migrations additives)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson/Resource` (source du corpus)
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress` (rattachement, adaptation au niveau)
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz/Question/QuizAttempt` (garde-fou anti-triche)
- `04-BACKEND/05-authentification-apprenant.md` — auth apprenant (cookie `PortailAcces`) qui protège la route tuteur
- `04-BACKEND/03-workers-bullmq-crons.md` — workers `elearning-tutor-*`
- `04-BACKEND/07-pipeline-video-streaming.md` — sous-titres WebVTT (source d'indexation des leçons vidéo)
- `04-BACKEND/08-ia-pedagogique-generation.md` — génération de quiz IA (partage le provider Anthropic + cost-tracker)
- `04-BACKEND/10-emails-notifications.md` — notifications d'escalade (Nodemailer + React Email)
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — intégration `TutorPanel`
- `08-CONFORMITE/01-foad-d6313-3-1.md` — D.6313-3-1 (assistance + info durée + évaluations)
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — Ind.19 (assistance), Ind.11 (évaluations), Ind.12 (anti-décrochage)
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — durées de conservation des journaux tuteur
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — faisceau de preuves (R.6313-3)
- **Code existant réutilisé** : `src/lib/knowledge/embeddings.ts`, `src/server/chatbot/retrieval/hybrid-search.ts`, `src/server/chatbot/security/output-guard.ts`, `src/server/chatbot/generation/system-prompt.ts`, `src/server/content-gen/providers/anthropic.ts`, `src/server/content-gen/lib/cost-tracker.ts`, `src/lib/r2-storage.ts`
