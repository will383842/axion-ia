# IA pédagogique — Génération de contenu e-learning

> **But du document.** Spécifier l'**extension du Formation Engine** existant pour produire, à partir d'un **programme de formation** ou du **catalogue marketing**, les artefacts d'un cours e-learning : **scripts de leçons** (microlearning), **slides**, **quiz interactifs**. On **réutilise** le worker, la grille qualité, la critique adversariale, la validation humaine (`FileValidation`), le cache (`CacheIa`) et la traçabilité coût/tokens (`FormationGenerationJob`) déjà en production côté Qualiopi.
>
> **Statut :** spécification implémentable (MVP→V1). Aligné ADR-LMS-0006 (tracking xAPI-like), ADR-LMS-0007 (cloisonnement `src/server/elearning/**`), ADR-LMS-0008 (migrations additives).
>
> **Principe directeur :** _zéro duplication du moteur IA_. On rejoue les **mêmes primitives** que `qualiopi-formation-engine-worker.ts` (vérifié dans le code réel) en les pointant vers des **artefacts e-learning**. Tout ce qui peut être partagé l'est (cache, cost-tracker, retry, provider, grille). Tout ce qui doit être cloisonné (file de travail, state machine, validation) est **neuf et additif**.

---

## 0. EXISTANT réutilisé vs NEUF à construire

| Brique                                               | Statut                                                        | Chemin réel / cible                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider IA (Claude)                                 | **EXISTANT — réutilisé tel quel**                             | `anthropicProvider.generate()` — `src/server/content-gen/providers/anthropic.ts` (interface `GenerationRequest`/`GenerationResponse` dans `IProvider.ts`) |
| Garde-fou coût + ledger                              | **EXISTANT — réutilisé**                                      | `assertCostCapAvailable`, `trackCost` — `src/server/content-gen/lib/cost-tracker.ts`                                                                      |
| Retry exponentiel                                    | **EXISTANT — réutilisé**                                      | `withRetry` — `src/server/content-gen/lib/retry.ts`                                                                                                       |
| Cache des appels IA                                  | **EXISTANT — réutilisé** (table générique, clé hash)          | `buildCacheKey` / `getCachedIa` / `setCachedIa` — `src/server/qualiopi/engine/cache.ts` ; table `CacheIa` (`schema.prisma:5416`)                          |
| Grille qualité pondérée                              | **EXISTANT — réutilisé** (nouvelle clé `grille_elearning_v1`) | `getActiveGrille`, `evaluateFormationQuality`, `computeWeightedScore` ; modèle `GrilleQualiteConfig` (`schema.prisma:5399`) + `grille-schema.ts`          |
| Critique adversariale                                | **EXISTANT — réutilisé / spécialisé**                         | `runAdversarialCritique` — `src/server/qualiopi/engine/adversarial-critique.ts`                                                                           |
| Anti-hallucination                                   | **EXISTANT — réutilisé**                                      | `hasUnsourcedClaims` — `src/server/qualiopi/engine/anti-hallucination.ts`                                                                                 |
| Alerte job en échec                                  | **EXISTANT — réutilisé**                                      | `creerOuDedup({ code: "job_ia_echoue" })` — `src/server/qualiopi/alertes/alertes-service.ts`                                                              |
| Pattern worker BullMQ                                | **EXISTANT — copié-spécialisé**                               | `qualiopi-formation-engine-worker.ts` → modèle de référence                                                                                               |
| Stockage médias (PDF, slides exportées, sous-titres) | **EXISTANT — réutilisé**                                      | `uploadToR2` / `getSignedUrlR2` / `getSignedUploadUrlR2` — `src/lib/r2-storage.ts`                                                                        |
| Source d'entrée « programme »                        | **EXISTANT — lu**                                             | `Formation.programmeDetaille` (JSON produit par le Formation Engine), `Formation.objectifsPedagogiques`                                                   |
| Source d'entrée « catalogue »                        | **EXISTANT — lu**                                             | catalogue marketing statique `catalog-v2.ts` (SSOT publique)                                                                                              |
| File de travail authoring e-learning                 | **NEUF — additif**                                            | queue `elearning-authoring` + `src/server/queue/workers/elearning-authoring-worker.ts`                                                                    |
| State machine de génération e-learning               | **NEUF — additif**                                            | enum `ElearningAuthoringStatut` + modèle `ElearningAuthoringDraft`                                                                                        |
| Traçabilité coût par étape (e-learning)              | **NEUF — additif** (mirroir de `FormationGenerationJob`)      | `ElearningGenerationJob`                                                                                                                                  |
| Validation humaine (e-learning)                      | **NEUF — additif** (mirroir de `FileValidation`)              | `ElearningContentValidation`                                                                                                                              |
| Prompts e-learning (script/slides/quiz)              | **NEUF**                                                      | `src/server/elearning/authoring/prompts.ts`                                                                                                               |
| Parsers défensifs script/slides/quiz                 | **NEUF**                                                      | `src/server/elearning/authoring/parsers.ts`                                                                                                               |
| Quiz-gen → modèles quiz                              | **NEUF**                                                      | `src/server/elearning/authoring/quiz-gen.ts` (écrit `Quiz`/`Question` — cf. doc `03-schema-quiz-evaluations.md`)                                          |

> **Pourquoi un `ElearningGenerationJob` / `ElearningContentValidation` neufs plutôt que réutiliser `FormationGenerationJob` / `FileValidation` ?** Ces deux modèles existants portent une **FK `formationId` NOT NULL** (`schema.prisma:5437` et `:5456`). Or un `ElearningCourse` peut être **autonome** (`formationId` nullable, cf. `03-DATA-MODEL/01`). On ne peut donc pas s'y rattacher sans casser le NOT NULL → un modèle e-learning dédié est requis (additif, ADR-0008). En revanche `CacheIa` et `GrilleQualiteConfig` sont **génériques** (aucune FK formation) → réutilisés directement.

---

## 1. Vue d'ensemble du pipeline

```
ENTRÉE
  ├─ Formation.programmeDetaille  (sortie du Formation Engine Qualiopi)   [EXISTANT]
  ├─ Formation.objectifsPedagogiques / publicVise (offreSite)            [EXISTANT]
  └─ catalog-v2.ts (fiche marketing)                                      [EXISTANT]
        │
        ▼  (admin clique « Générer le cours e-learning avec l'IA »)
  ElearningAuthoringDraft (statut=plan)  ──enqueue──► queue "elearning-authoring"
        │
        ▼  worker elearning-authoring-worker.ts  (réutilise les primitives engine)
  [1] plan_parcours        → squelette modules/leçons (microlearning, durées)
  [2] backward_design +    → objectifs mesurables → contenu → évaluation
      persona_apprenant       (réutilise prompts engine OU variantes e-learning)
  [3] script_lecon (×N)    → script narré 2-10 min par leçon
  [4] slides_lecon (×N)    → deck de slides (JSON) par leçon
  [5] quiz_gen (×N)        → questions + barème + rationale (banque)
  [6] evaluate_qualite     → grille_elearning_v1 (score pondéré)
  [7] critique_adversariale→ 5 angles e-learning (engagement/charge cognitive…)
        │   └─ si score < plancher && passes < max → [refine] → re-[6]
        ▼
  [8] validation_humaine   → ElearningContentValidation (en_attente)  [AI Act art.50]
        │   (admin approuve / rejette / édite dans le course-builder)
        ▼
  [9] assemble_publish     → écrit ElearningModule / ElearningLesson / Quiz / Question
                              (statut cours = brouillon ; jamais auto-publié)
```

Chaque appel IA suit **exactement** la séquence éprouvée du moteur existant (cf. `qualiopi-formation-engine-worker.ts` l.202-251) :

1. `assertCostCapAvailable("anthropic", <budget>)` _(pré-call)_
2. `buildCacheKey(userPrompt, promptVersion, langue)` → `getCachedIa()` _(hit ⇒ skip IA)_
3. `withRetry(() => anthropicProvider.generate({ … }))`
4. `trackCost({ jobId, provider:"anthropic", model, tokensInput(+cacheRead+cacheCreation), tokensOutput, costUsd })` _(post-call)_
5. `setCachedIa({ cle, valeur, modele, tokensIn, tokensOut, coutUsd, promptVersion, ttlSeconds })`
6. trace `ElearningGenerationJob` (étape, status, tokensIn/Out, coutUsd, modele, dureeMs, cacheHit, metadata)

> **Règle machine d'états (identique au moteur Qualiopi) :** le worker **ne valide JAMAIS** lui-même. La transition `validation_humaine → assemble_publish` est déclenchée par une **server action admin** (RBAC `requireAdminPublish`), jamais par l'IA. Conformité **AI Act art. 50** : tout contenu IA passe par une revue humaine traçable.

---

## 2. Modèles Prisma neufs (additifs)

> Conventions repo : `id` UUID, `@map` snake_case, index sur FK + colonnes filtrées, timestamps. Migration **purement additive** (CREATE TABLE + ADD COLUMN nullable), `prisma/migrations/<timestamp>_elearning_authoring/` — cf. `03-DATA-MODEL/06-strategie-migrations.md`. Cohabite avec la magic string `stub.invalid` : ces tables ne sont **jamais** lues au SSG (génération = worker runtime uniquement), donc aucun risque build.

### 2.1 Enums

```prisma
/// Cible d'un brouillon de génération e-learning.
enum ElearningAuthoringSource {
  programme_formation   // depuis Formation.programmeDetaille (Qualiopi engine)
  catalogue             // depuis catalog-v2.ts (fiche marketing)
  brief_libre           // brief texte saisi par l'auteur
}

/// State machine du pipeline authoring (miroir de FormationStatutGeneration).
enum ElearningAuthoringStatut {
  plan                  // squelette à générer
  plan_genere
  contenu_evalue        // après grille + critique
  contenu_genere        // scripts+slides+quiz produits, attente validation
  contenu_valide        // validé humain → prêt à assembler
  assemble              // ElearningModule/Lesson/Quiz écrits (cours brouillon)
  echec                 // passes max atteintes sans validité (relançable)
}

/// Étape de validation humaine e-learning (miroir d'EtapeGeneration).
enum ElearningValidationEtape {
  plan
  scripts
  quiz
  assemblage
}
```

### 2.2 `ElearningAuthoringDraft` — porteur de la state machine

```prisma
model ElearningAuthoringDraft {
  id            String                   @id @default(uuid()) @db.Uuid

  // Cible : le cours en construction (peut être créé en amont, statut brouillon)
  courseId      String?                  @map("course_id") @db.Uuid
  course        ElearningCourse?         @relation(fields: [courseId], references: [id], onDelete: SetNull)

  // Source d'entrée
  source        ElearningAuthoringSource @default(programme_formation)
  formationId   String?                  @map("formation_id") @db.Uuid  // si source=programme_formation
  formation     Formation?               @relation("ElearningDrafts", fields: [formationId], references: [id], onDelete: SetNull)
  catalogueSlug String?                  @map("catalogue_slug") @db.VarChar(160) // si source=catalogue
  briefLibre    String?                  @map("brief_libre") @db.Text            // si source=brief_libre

  // Paramètres de génération
  langue        String                   @default("fr") @db.VarChar(5)
  cibleDureeMin Int?                     @map("cible_duree_min")  // durée totale visée (microlearning)
  nbModulesCible Int?                    @map("nb_modules_cible")

  // State machine
  statut        ElearningAuthoringStatut @default(plan)
  passes        Int                      @default(0)        // passes de refine effectuées
  promptVersion Int                      @default(1) @map("prompt_version")
  aiModel       String?                  @map("ai_model") @db.VarChar(80)

  // Artefacts intermédiaires (JSON brut avant écriture finale dans les modèles LMS)
  planJson      Json?                    @map("plan_json")      // squelette modules/leçons
  scriptsJson   Json?                    @map("scripts_json")   // { lessonKey: script }
  slidesJson    Json?                    @map("slides_json")    // { lessonKey: deck }
  quizJson      Json?                    @map("quiz_json")      // { lessonKey: quiz }
  scoreQualite  Int?                     @map("score_qualite")  // dernier score grille
  verdictCritique String?                @map("verdict_critique") @db.VarChar(16)

  jobs          ElearningGenerationJob[]
  validations   ElearningContentValidation[]

  createdAt     DateTime                 @default(now()) @map("created_at")
  updatedAt     DateTime                 @updatedAt @map("updated_at")

  @@index([statut])
  @@index([courseId])
  @@index([formationId])
  @@map("elearning_authoring_drafts")
}
```

> Champs inverses additifs (sans colonne) : `Formation.elearningDrafts ElearningAuthoringDraft[] @relation("ElearningDrafts")` et `ElearningCourse.authoringDrafts ElearningAuthoringDraft[]`.

### 2.3 `ElearningGenerationJob` — traçabilité fine (miroir `FormationGenerationJob`)

Champs **strictement identiques** à `FormationGenerationJob` (`schema.prisma:5454`) hormis la FK : on remplace `formationId` par `draftId`, et on ajoute `lessonKey` pour tracer les générations par leçon.

```prisma
model ElearningGenerationJob {
  id           String                  @id @default(uuid()) @db.Uuid
  draftId      String                  @map("draft_id") @db.Uuid
  draft        ElearningAuthoringDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)
  etape        String                  @db.VarChar(64)   // plan|backward_design|persona|script_lecon|slides_lecon|quiz_gen|evaluation|adversarial_critique|refine|assemble
  lessonKey    String?                 @map("lesson_key") @db.VarChar(120) // clé logique leçon (module.ordre/leçon.ordre)
  tentative    Int                     @default(1)
  status       String                  @db.VarChar(32)   // success|error|cache_hit
  tokensIn     Int                     @default(0) @map("tokens_in")
  tokensOut    Int                     @default(0) @map("tokens_out")
  coutUsd      Decimal                 @default(0) @map("cout_usd") @db.Decimal(10, 4)
  modele       String?                 @db.VarChar(80)
  dureeMs      Int?                    @map("duree_ms")
  cacheHit     Boolean                 @default(false) @map("cache_hit")
  errorMessage String?                 @map("error_message") @db.Text
  metadata     Json?
  createdAt    DateTime                @default(now()) @map("created_at")

  @@index([draftId, etape])
  @@map("elearning_generation_jobs")
}
```

### 2.4 `ElearningContentValidation` — validation humaine (miroir `FileValidation`)

```prisma
model ElearningContentValidation {
  id             String                   @id @default(uuid()) @db.Uuid
  draftId        String                   @map("draft_id") @db.Uuid
  draft          ElearningAuthoringDraft  @relation(fields: [draftId], references: [id], onDelete: Cascade)
  etape          ElearningValidationEtape
  statut         FileValidationStatut     @default(en_attente)  // RÉUTILISE l'enum existant en_attente|approuve|rejete
  consigne       String?                  @db.Text
  contenuPropose Json?                    @map("contenu_propose") // snapshot horodaté (jamais purgé — traçabilité)
  validePar      String?                  @map("valide_par") @db.Uuid // AdminUser.id
  valideAt       DateTime?                @map("valide_at")
  createdAt      DateTime                 @default(now()) @map("created_at")
  updatedAt      DateTime                 @updatedAt @map("updated_at")

  @@index([draftId, etape])
  @@index([statut])
  @@map("elearning_content_validations")
}
```

> `FileValidationStatut` (`schema.prisma:5391`, valeurs `en_attente|approuve|rejete`) est **réutilisé**. On ne crée PAS de nouvel enum de statut de validation.

---

## 3. Le worker `elearning-authoring-worker.ts`

Fichier cible : `src/server/queue/workers/elearning-authoring-worker.ts`. **Calque** de `qualiopi-formation-engine-worker.ts` : même structure (handler par statut, `advanceStatut`, `traceJob`, `handleEvalDecision`), mêmes garde-fous. Concurrency basse (génération IA longue), lock long, limiter doux.

### 3.1 Données de job & registration

```ts
export interface ElearningAuthoringJobData {
  draftId: string;
  passesCourantes?: number;
}

export function startElearningAuthoringWorker(): Worker<ElearningAuthoringJobData> {
  const worker = new Worker<ElearningAuthoringJobData>(
    "elearning-authoring",
    elearningAuthoringWorkerHandler,
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 2,
      lockDuration: 600_000, // 10 min (un draft = N appels IA séquencés)
      limiter: { max: 5, duration: 60_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  );
  worker.on("ready", () => console.log("[elearning:authoring] worker ready"));
  worker.on("failed", (job, err) => {
    const draftId = job?.data?.draftId;
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 1;
    if (draftId && attemptsMade >= maxAttempts) {
      void creerOuDedup({
        code: "job_ia_echoue",
        niveau: "important",
        titre: "Génération e-learning en échec (DLQ)",
        message: `Draft ${draftId} : ${err.message}`.slice(0, 1000),
        cibleType: "ElearningAuthoringDraft",
        cibleId: draftId,
      }).catch(() => {});
    }
  });
  return worker;
}
```

> **Enregistrement** : ajouter `startElearningAuthoringWorker()` au bootstrap des workers (là où `startFormationEngineWorker()` est appelé). Respecte `BULLMQ_DISABLED=true` au build (pas de connexion Redis au SSG — cf. contrat `stub.invalid`).

### 3.2 Dispatch par statut (handler)

```ts
export async function elearningAuthoringWorkerHandler(job: Job<ElearningAuthoringJobData>) {
  const { draftId } = job.data;
  const passes = job.data.passesCourantes ?? 0;
  if (!draftId) throw new UnrecoverableError("draftId manquant");

  const draft = await loadDraftContext(draftId); // + source (Formation/catalogue/brief)
  if (!draft) throw new UnrecoverableError(`Draft introuvable : ${draftId}`);

  switch (draft.statut) {
    case "plan": {
      const [backwardDesign, persona] = await Promise.all([
        stepBackwardDesign(draft, passes), // réutilise prompts engine
        stepPersona(draft, passes),
      ]);
      await stepPlanParcours(draft, passes, backwardDesign, persona); // → plan_genere
      const evalResult = await stepEvaluateQualite(draft, passes);
      await handleEvalDecision(draft, passes, evalResult);
      break;
    }
    case "plan_genere": {
      const critique = await stepCritiqueAdversariale(draft, passes); // 5 angles e-learning
      if (critique?.verdict === "CRITIQUE")
        await stepRefinePlan(draft, passes, critique.axesAmelioration);
      const evalResult = await stepEvaluateQualite(draft, passes);
      await handleEvalDecision(draft, passes, evalResult);
      break;
    }
    case "contenu_evalue": {
      // Plan validé qualité → générer le contenu détaillé par leçon
      await stepGenerateScripts(draft, passes); // [3]
      await stepGenerateSlides(draft, passes); // [4]
      await stepGenerateQuiz(draft, passes); // [5]
      await stepCreateValidations(draft); // → contenu_genere + ElearningContentValidation(en_attente)
      break;
    }
    case "contenu_valide": {
      await stepAssemblePublish(draft); // [9] écrit Module/Lesson/Quiz
      break;
    }
    case "contenu_genere":
    case "assemble":
    case "echec":
    default:
      // attente validation humaine / terminal → no-op
      break;
  }
}
```

> `handleEvalDecision` est **identique** à celui du moteur Qualiopi (l.1094-1135) : si `!valide && passes < nbPassesMax` → `stepRefinePlan` puis ré-évaluation ; sinon on avance. `nbPassesMax` lu via `getActiveGrille()` (clé e-learning).

---

## 4. Étapes détaillées (prompts, budgets, cache, trace)

Chaque `step*` réutilise **le même squelette** que les steps du moteur Qualiopi. Voici les paramètres spécifiques à chaque étape. `langue = draft.langue` (FR canonique). `promptVersion` = `getActiveGrille("grille_elearning_v1")?.promptVersion ?? draft.promptVersion`.

| Étape (`etape`)        | `contentType` (tag cost)         | maxTokens | temp | Budget pré-call | TTL cache | Sortie                        |
| ---------------------- | -------------------------------- | --------- | ---- | --------------- | --------- | ----------------------------- |
| `backward_design`      | `elearning_backward_design`      | 2048      | 0.2  | 0.05            | 7 j       | objectifs→contenu→éval (JSON) |
| `persona`              | `elearning_persona`              | 2048      | 0.3  | 0.05            | 7 j       | persona apprenant (JSON)      |
| `plan`                 | `elearning_plan`                 | 4096      | 0.2  | 0.10            | 7 j       | `planJson` (modules/leçons)   |
| `script_lecon`         | `elearning_script`               | 4096      | 0.3  | 0.10 / leçon    | 7 j       | script narré par leçon        |
| `slides_lecon`         | `elearning_slides`               | 3072      | 0.2  | 0.08 / leçon    | 7 j       | deck JSON par leçon           |
| `quiz_gen`             | `elearning_quiz`                 | 3072      | 0.2  | 0.08 / leçon    | 7 j       | questions+barème par leçon    |
| `evaluation`           | `elearning_evaluation`           | 1024      | 0    | (via evaluate)  | —         | score pondéré                 |
| `adversarial_critique` | `elearning_adversarial_critique` | 2048      | 0.4  | (via critique)  | —         | verdict + axes                |
| `refine`               | `elearning_refine`               | 4096      | 0.3  | 0.10            | 3 j       | plan corrigé                  |

### 4.1 `stepPlanParcours` — squelette du parcours [NEUF]

But : transformer le `programmeDetaille` (Qualiopi) **ou** la fiche catalogue en **arborescence microlearning** : modules ordonnés, leçons de 2-10 min, type de chaque leçon (`video`/`texte`/`pdf`/`quiz`/`devoir`), placement des quiz **bloquants** (gating par score). Respecte les enums de `03-DATA-MODEL/01` (`ElearningLessonType`, `ElearningUnlockType`).

System prompt (extrait, `src/server/elearning/authoring/prompts.ts:buildPlanSystemPrompt`) :

```
Tu es ingénieur pédagogique e-learning (FOAD). À partir d'un programme de formation,
tu conçois un parcours asynchrone microlearning. Règles :
- Leçons courtes : 2 à 10 minutes (estime duree_estimee_minutes).
- Chaque module se termine par une évaluation qui JALONNE le parcours (Qualiopi Ind.11).
- Place un quiz BLOQUANT (unlockType=score_quiz) en fin de module : le module suivant
  ne s'ouvre qu'au score seuil.
- Alterne les types de leçon (jamais un seul type par module).
- Couvre TOUS les objectifs pédagogiques fournis (backward design).
Réponds UNIQUEMENT en JSON valide, sans markdown.
Format : { "modules": [ { "titre", "ordre", "unlockType",
  "lessons": [ { "titre","type","ordre","dureeEstimeeMinutes","obligatoire",
                 "unlockType","unlockScorePct?","objectifsCouverts":[...] } ] } ] }
```

User prompt : injecte `objectifsPedagogiques`, `programmeDetaille` (ou fiche catalogue), `persona`, `backwardDesign`, `cibleDureeMin`, `nbModulesCible`. Cache key = `buildCacheKey(userPrompt, promptVersion, langue)`. Parsing défensif (`parsers.ts:parsePlan`) : valide via un schéma Zod miroir des enums LMS ; en cas d'échec → `planJson=null`, trace `status:"error"`, le job échoue (visible).

Persistance : `draft.planJson = parsed`, `advanceStatut(draft, "plan_genere")`.

### 4.2 `stepBackwardDesign` / `stepPersona` — réutilisation directe [EXISTANT]

On **réutilise** `buildBackwardDesignSystemPrompt/UserPrompt` et `buildPersonaSystemPrompt/UserPrompt` de `src/server/qualiopi/engine/prompts.ts` (déjà importés par le moteur Qualiopi, l.42-46). Entrée adaptée : `titre`, `dureeHeures` (≈ `cibleDureeMin/60`), `modalite="distanciel"` (FOAD), `objectifsPedagogiques`, `publicVise`. Idempotence : si `draft.planJson?.backwardDesign` présent → cache hit (comme l.276 du moteur).

### 4.3 `stepGenerateScripts` — script narré par leçon [NEUF]

Pour **chaque leçon** du `planJson` (boucle, `lessonKey = "${module.ordre}.${lesson.ordre}"`), produit un script pédagogique exploitable :

- leçon `video` → **script narration** (texte à dire, ~150 mots/min × durée) + indications visuelles → alimentera plus tard l'enregistrement / la TTS ; stocké pour rédaction du `contenuJson` et des sous-titres.
- leçon `texte` → **blocs riches** (intro, sections H2, exemples, encadré « à retenir », mini-exercice) au format `contenuJson` (blocs Tiptap/JSON, cf. `ElearningLesson.contenuJson` dans `03-DATA-MODEL/01`).
- leçon `devoir` → **consigne + critères d'évaluation** (preuve FOAD).

Anti-hallucination : `hasUnsourcedClaims(script)` → warning non bloquant (comme l.841 du moteur). Sortie agrégée dans `draft.scriptsJson = { [lessonKey]: { type, contenuJson, narration?, transcript? } }`. **Une trace `ElearningGenerationJob` par leçon** (`lessonKey` renseigné) — granularité coût fine.

> **Note budget Web Vitals** : la génération est **100 % serveur (worker)**, hors chemin de rendu apprenant. Aucun impact LCP/INP/CLS. Les artefacts produits (texte/JSON) restent légers ; la vidéo passe par le pipeline `04-BACKEND/07-pipeline-video-streaming.md` (Cloudflare Stream), pas par l'IA.

### 4.4 `stepGenerateSlides` — deck par leçon [NEUF]

Produit un `slidesJson` par leçon : tableau de slides `{ titre, puces[], noteOrateur, suggestionVisuel }`. Volontairement **structuré** (pas d'image générée ici) : le rendu visuel est fait côté course-builder. Sert aussi de support téléchargeable (export PDF ultérieur via `@react-pdf/renderer`, archivé R2 par `uploadToR2`). Cache + trace identiques.

### 4.5 `stepGenerateQuiz` — quiz-gen ancré sur le contenu [NEUF]

`src/server/elearning/authoring/quiz-gen.ts`. Pour chaque module (quiz de fin = **gating**) et optionnellement par leçon (auto-évaluation), génère des questions **ancrées sur le script de la leçon** (document-grounded — on passe le `contenuJson`/script comme contexte, pas une connaissance libre → réduit l'hallucination).

Types supportés (alignés `03-DATA-MODEL/03-schema-quiz-evaluations.md`) : `qcm_mono`, `qcm_multi`, `vrai_faux`, `appariement`, `texte_a_trous`, `ordonnancement`, `reponse_courte`, `essai` (correction manuelle), `upload`. L'IA génère **seulement** les types auto-corrigeables + `essai`/`upload` avec grille ; jamais elle ne fixe le seuil de réussite (décidé par l'auteur).

Format de sortie (JSON, parsé par `parsers.ts:parseQuiz`) :

```json
{
  "questions": [
    {
      "type": "qcm_mono",
      "enonce": "…",
      "ponderation": 1,
      "options": [
        { "texte": "…", "correct": true, "feedback": "…" },
        { "texte": "…", "correct": false, "feedback": "Pourquoi c'est faux." }
      ],
      "rationale": "Explication de la bonne réponse (affichée après tentative).",
      "objectifCouvert": "obj_3",
      "difficulte": "moyenne"
    }
  ]
}
```

System prompt impose : 1 question = 1 objectif vérifiable, distracteurs plausibles non piégeux, `rationale` obligatoire, `feedback` par option, **interdiction d'inventer** des faits absents du contenu fourni. Le worker **n'écrit pas** encore `Quiz`/`Question` : il remplit `draft.quizJson`. L'écriture en base a lieu à l'assemblage (§4.9), après validation humaine.

### 4.6 `stepEvaluateQualite` — grille e-learning [EXISTANT spécialisé]

Réutilise `evaluateFormationQuality()` (`engine/evaluate.ts`) en lui passant les **critères de la grille `grille_elearning_v1`** (modèle `GrilleQualiteConfig`, clé `cleUnique="grille_elearning_v1"`, `actif=true`). On **fail-loud** si la grille active est absente (même politique que le moteur, l.563-578 : ne jamais certifier sans contrôle). `contenu` = JSON `{ planJson, scriptsJson, quizJson }`.

Grille e-learning proposée (somme poids = 100, format `grille-schema.ts`) — seed SQL idempotent dans `prisma/migrations_fts/` :

| id                    | libellé                                                                  | poids | scoreMin |
| --------------------- | ------------------------------------------------------------------------ | ----- | -------- |
| `microlearning`       | Leçons courtes 2-10 min, charge cognitive maîtrisée                      | 15    | 60       |
| `alignement_obj_eval` | Chaque objectif couvert par contenu **et** un item de quiz               | 20    | 60       |
| `gating_pertinent`    | Quiz bloquants placés là où la compétence est critique                   | 15    | 60       |
| `qualite_quiz`        | Distracteurs plausibles, rationale présente, pas de question piège       | 20    | 60       |
| `engagement_async`    | Variété des types, exemples concrets, interaction (FOAD asynchrone)      | 15    | 60       |
| `accessibilite_foad`  | Transcripts/sous-titres prévus, langage clair (WCAG, Ind. accessibilité) | 15    | 60       |

`draft.scoreQualite = result.scoreGlobal`. `valide = scoreGlobal >= scorePlancher` (80 par défaut). `advanceStatut → "contenu_evalue"`.

### 4.7 `stepCritiqueAdversariale` — 5 angles e-learning [EXISTANT spécialisé]

Deux options, **option A retenue** pour réutilisation maximale : appeler `runAdversarialCritique()` tel quel (5 angles génériques pertinents aussi en e-learning : engagement / transférabilité / mémorisation / adéquation public / réalisme exercices) en lui passant `structure = JSON.stringify(planJson+scriptsJson)`. Option B (V1) : variante `runElearningCritique()` avec angles spécialisés (**charge cognitive**, **autonomie asynchrone**, **clarté des consignes sans formateur présent**, **anti-décrochage**, **équité d'évaluation à distance**) — même contrat de retour `AdversarialCritiqueResult`. Si `verdict==="CRITIQUE"` → `stepRefinePlan` forcé en injectant `axesAmelioration` (comme l.1026-1039 du moteur). `draft.verdictCritique = result.verdict`.

### 4.8 `stepRefinePlan` — boucle de raffinement [EXISTANT pattern]

Identique à `stepRefine` (l.643-747) : injecte le `commentaire` de l'évaluation **et/ou** les `axesAmelioration` de la critique dans le prompt, régénère le `planJson` (et invalide les scripts/quiz dépendants si le plan change structurellement), retrace, `advanceStatut → "contenu_evalue"`, ré-évalue. Borné par `nbPassesMax` (grille).

### 4.9 `stepAssemblePublish` — écriture des modèles LMS [NEUF]

Déclenché quand `statut="contenu_valide"` (après approbation humaine). En **une transaction Prisma** (`prisma.$transaction`) :

1. Upsert `ElearningModule` (depuis `planJson.modules`, `ordre`, `unlockType`/`unlockScorePct`).
2. Upsert `ElearningLesson` par module (`type`, `ordre`, `contenuJson` depuis `scriptsJson`, `dureeEstimeeMinutes`, `obligatoire`).
3. Pour les leçons `quiz` et quiz de fin de module : créer `Quiz` + `Question` (+ options/feedback/rationale) depuis `quizJson` (cf. modèles doc 03) ; rattacher `ElearningLesson.quizId` / `ElearningModule.unlockQuizId`.
4. Recalculer `ElearningCourse.dureeEstimeeMinutes` (somme leçons) — information de durée exigée **D.6313-3-1 §2** (FOAD).
5. `ElearningCourse.statut` **reste `brouillon`** ; la publication finale est une action admin séparée (course-builder) qui incrémente `version` + `publishedAt`.
6. `advanceStatut(draft, "assemble")`.

> Idempotence : ré-exécuter l'assemblage ne duplique pas (upsert par `@@unique([courseId, ordre])` / `@@unique([moduleId, ordre])` du data model). Snapshot conservé dans `ElearningContentValidation.contenuPropose` (jamais purgé — traçabilité IA Act + preuve FOAD).

---

## 5. Validation humaine & AI Act art. 50

`stepCreateValidations(draft)` (appelé fin §4.5) avance `statut → "contenu_genere"` et crée, en transaction, les `ElearningContentValidation` en attente :

- une `etape=plan` (déjà revue implicitement au plan, optionnelle),
- une `etape=scripts` (snapshot `scriptsJson` tronqué 10 000 car),
- une `etape=quiz` (snapshot `quizJson`),
- l'`etape=assemblage` est créée juste avant la publication.

Le `contenuPropose` stocke `{ snapshot, modele, promptVersion, generatedAt }` (même forme que `FileValidation`, l.864-871). L'admin revoit/édite dans le **course-builder** (`06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md`), puis :

- **Approuve** → server action met `statut=approuve`, `validePar`, `valideAt` ; quand toutes les étapes requises sont approuvées → `draft.statut="contenu_valide"` + ré-enqueue le worker (déclenche §4.9).
- **Rejette** (avec `consigne`) → `statut=rejete` + ré-enqueue avec `passesCourantes+1` pour un refine ciblé.

Aucun contenu IA n'atteint un apprenant sans **trace de revue humaine** (qui, quand) → conformité **AI Act art. 50** (transparence contenu généré) et **Qualiopi** (responsabilité pédagogique de l'OF).

---

## 6. Coût, cache et garde-fous (réutilisés)

- **Cap coût** : `assertCostCapAvailable("anthropic", budget)` avant **chaque** appel ; un draft = somme bornée d'appels. Le budget par étape (table §4) protège contre une explosion sur un cours à 40 leçons.
- **Cache** : `CacheIa` partagé avec le moteur Qualiopi. Clé = `SHA-256(userPrompt | promptVersion | langue)`. **Conséquence vertueuse** : régénérer un cours après un petit changement ne re-paie que les leçons modifiées (les prompts inchangés font cache hit → `status:"cache_hit"`, `coutUsd:0`). TTL 7 j (contenu), 3 j (refine).
- **Ledger** : `trackCost()` agrège dans le même ledger que le content-gen → coût e-learning visible dans le reporting coût IA existant. `tokensInput` inclut `cacheReadInputTokens + cacheCreationInputTokens` (prompt caching Anthropic), comme le moteur (l.222-226).
- **Retry** : `withRetry()` (backoff) sur chaque `generate()`. Échec définitif → `worker.on("failed")` → alerte `job_ia_echoue` dédupliquée.
- **Stub build** : aucune lecture de ces tables au SSG ; `BULLMQ_DISABLED=true` empêche le worker de tourner au build. Conforme au contrat `stub.invalid`.

---

## 7. Déclenchement & Server Actions

Fichier : `src/server/elearning/authoring/actions.ts` (Server Actions, RBAC via `requireAdminWrite`/`requireAdminPublish` — `src/server/actions/knowledge/_guards.ts`).

| Action                                           | RBAC                  | Effet                                                                                                                   |
| ------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `creerDraftDepuisFormation(formationId, params)` | `requireAdminWrite`   | crée `ElearningAuthoringDraft(source=programme_formation, statut=plan)` + `enqueue("elearning-authoring", { draftId })` |
| `creerDraftDepuisCatalogue(slug, params)`        | `requireAdminWrite`   | idem `source=catalogue`                                                                                                 |
| `creerDraftDepuisBrief(brief, params)`           | `requireAdminWrite`   | idem `source=brief_libre`                                                                                               |
| `relancerGeneration(draftId)`                    | `requireAdminWrite`   | re-enqueue (statut relançable : `plan`/`contenu_evalue`/`echec`)                                                        |
| `approuverValidation(validationId)`              | `requireAdminPublish` | `statut=approuve` ; si toutes OK → `draft.statut="contenu_valide"` + re-enqueue                                         |
| `rejeterValidation(validationId, consigne)`      | `requireAdminPublish` | `statut=rejete` + re-enqueue `passes+1`                                                                                 |
| `editerArtefact(draftId, lessonKey, patch)`      | `requireAdminWrite`   | édition manuelle d'un script/quiz avant assemblage                                                                      |

L'enqueue réutilise l'infra BullMQ existante (`getBullConnectionOrThrow`, mêmes options `attempts`/backoff que `formation-engine`). UI déclencheur : bouton **« Générer le cours e-learning avec l'IA »** dans le course-builder (`06-CONSOLE-ADMIN/03`) et entrée de nav sous la section e-learning d'`admin-nav.ts` (le composant monté est `AdminSidebarNav.tsx`).

---

## 8. Conformité FOAD intégrée par construction

La génération **produit nativement** les preuves exigées (cf. `08-CONFORMITE/01-foad-d6313-3-1.md`, `06-tracabilite-preuves-realisation.md`) :

- **Évaluations qui jalonnent (Ind. 11 — non-conformité MAJEURE si absente)** : le plan impose un quiz de fin de module + évaluations intermédiaires ; le gating par score garantit qu'elles sont **passées**, pas seulement affichées.
- **Information durée (D.6313-3-1 §2)** : `dureeEstimeeMinutes` calculée et stockée au cours.
- **Assistance pédagogique (Ind. 19)** : le contenu généré inclut consignes claires + critères ; complété par le **tuteur RAG** (`04-BACKEND/09-tuteur-rag-assistant.md`).
- **Traçabilité** : `ElearningGenerationJob` (qui/quoi/combien) + `ElearningContentValidation` (revue humaine) = faisceau de preuves de la conception ; complété au runtime par `LessonProgress`/`QuizAttempt` (`03-DATA-MODEL/02`).

---

## 9. Tests (Vitest, mocks Prisma + provider)

Sous `src/server/elearning/authoring/*.spec.ts` — mêmes patterns que `engine/*.spec.ts` (provider IA mocké, Prisma mock distinct du stub build-time) :

- `parsers.spec.ts` : `parsePlan`/`parseQuiz`/`parseSlides` défensifs (JSON sale, markdown, champs manquants, clamp pondération, énums LMS invalides rejetées).
- `quiz-gen.spec.ts` : 1 question ↔ 1 objectif, `rationale` obligatoire, feedback par option, types non auto-corrigeables marqués correction manuelle.
- `worker.spec.ts` : machine d'états (plan→…→assemble), boucle refine bornée par `nbPassesMax`, fail-loud sans grille active, cache hit ⇒ `coutUsd:0`, fail-soft trace.
- `actions.spec.ts` : RBAC (un `reader` ne peut pas générer), transition validation→`contenu_valide` seulement quand toutes les étapes requises approuvées.
- Conformité : un plan généré contient **au moins une évaluation jalonnante par module** (garde anti-régression Ind. 11).

---

## 10. Risques & décisions ouvertes

- **Coût sur gros cours** : un cours de 40 leçons = ~80 appels (script+slides+quiz). Mitigation : caps par étape + cache + génération **par module à la demande** plutôt que tout le cours d'un coup (option `nbModulesCible`/génération incrémentale en V1).
- **Qualité quiz** : risque de distracteurs faibles. Mitigation : critère `qualite_quiz` poids 20 + critique adversariale + revue humaine obligatoire.
- **Modèle IA** : `anthropicProvider` (Claude) déjà câblé et facturé dans le ledger ; pas de provider neuf. Choix du modèle exact (Sonnet vs Opus) géré par `provider-router`/`ProviderConfig` existant — décision coût/qualité à arbitrer comme pour le content-gen.
- **Grille e-learning** : seed initial proposé §4.6 ; à affiner avec Will (poids/seuils) avant activation (`actif=true`).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0006 (tracking xAPI-like), 0007 (cloisonnement), 0008 (migrations additives)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse`/`Module`/`Lesson`/`Resource`, enums `ElearningLessonType`/`ElearningUnlockType`
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `LessonProgress`, `ElearningEnrollment` (runtime)
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`/`Question`/`QuizAttempt` (cibles de l'assemblage §4.9)
- `03-DATA-MODEL/06-strategie-migrations.md` — migration additive des modèles §2
- `04-BACKEND/03-workers-bullmq-crons.md` — enregistrement du worker `elearning-authoring`
- `04-BACKEND/07-pipeline-video-streaming.md` — Cloudflare Stream (les leçons `video` produites ici y branchent leur asset)
- `04-BACKEND/09-tuteur-rag-assistant.md` — assistance pédagogique (Ind. 19), réutilise le RAG knowledge
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — UI « Générer avec l'IA », revue/édition des validations
- `08-CONFORMITE/01-foad-d6313-3-1.md` & `06-tracabilite-preuves-realisation.md` — preuves FOAD produites par construction
- **Code de référence (réutilisé) :** `src/server/queue/workers/qualiopi-formation-engine-worker.ts`, `src/server/qualiopi/engine/{cache,evaluate,adversarial-critique,grille,grille-schema,prompts,scoring,anti-hallucination}.ts`, `src/server/content-gen/providers/anthropic.ts`, `src/server/content-gen/lib/{cost-tracker,retry}.ts`, `src/lib/r2-storage.ts`
  </content>
  </invoke>
