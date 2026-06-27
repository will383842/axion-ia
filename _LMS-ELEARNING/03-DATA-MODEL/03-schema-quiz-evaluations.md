# Data model — Moteur de quiz & évaluations

Moteur de quiz **interactif** (12 types de questions, banque réutilisable, tirage aléatoire, shuffle, pondération, feedback configurable, déverrouillage par score) et son **articulation avec la preuve Qualiopi existante** (`EvaluationAcquis`) **sans la dupliquer**.

> **Lire d'abord** : `01-schema-cours-modules-lecons.md` (les modèles `ElearningLesson.quizId`, `ElearningModule.unlockQuizId`/`unlockScorePct`, `ElearningLesson.unlock*` pointent vers les modèles de **ce** document), `02-schema-progression-tracking.md` (`ElearningEnrollment`, `LessonProgress` — c'est lui qui fixe la **convention de type des PK LMS**, cf. §2) et `00-INDEX/DECISIONS-ARBITRAGES.md` (ADR-0006 tracking xAPI-like, ADR-0008 migrations additives).

**Conventions du repo respectées** : UUID en `id`, `@map` snake_case, enums Prisma, index sur FK + colonnes filtrées, timestamps `createdAt`/`updatedAt`, **migrations strictement additives** (ADR-LMS-0008), code sous `src/server/elearning/**` (ADR-LMS-0007).

---

## 1. Vue d'ensemble & frontière avec l'existant

```
QuizBank (banque réutilisable, scope cours ou global)
 └─ Question (12 types ; énoncé + payload typé)
     ├─ QuestionChoice  (options pour QCM / vrai-faux / appariement)
     └─ payloadJson     (structure typée : trous, ordre, paires, tolérance num.)

Quiz (rattaché à une ElearningLesson type=quiz, ou cible d'un unlockQuizId)
 ├─ QuizQuestion   (questions épinglées : ordre + pondération override)
 ├─ règles de tirage (N parmi M depuis la banque + filtres tag/difficulté)
 └─ QuizAttempt    (1 passage apprenant : snapshot, score, réussite vs seuil)
     └─ QuizAttemptAnswer (1 réponse par question : payload + points + correct?)
```

### EXISTANT (réutilisé, **non** dupliqué)

| Brique existante                                                 | Rôle                                                                                                                                                                                                                                                                              | Frontière                                                                                                                                                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EvaluationAcquis` (`prisma/schema.prisma:5653`)                 | **Preuve Qualiopi canonique** : synthèse par objectif pédagogique, grille de compétences (`competences` Json), `type` initiale/intermédiaire/**finale** (la finale fait foi). Indicateur Qualiopi **Ind.11** (évaluations qui jalonnent — non-conformité **majeure** si absente). | **Reste l'unique source de vérité de la preuve d'acquisition.** Le quiz ne la remplace pas : un quiz `final_certificatif` **projette** son résultat dans **une** ligne `EvaluationAcquis` (cf. §10). |
| `Questionnaire` (`:5704`)                                        | Satisfaction (chaud/froid) + positionnement, Ind.31⭐/off.8. **Ce n'est pas une évaluation notée.**                                                                                                                                                                               | Hors périmètre quiz. Aucun recouvrement.                                                                                                                                                             |
| `EvaluationType` enum (`:5630`)                                  | `initiale \| intermediaire \| finale`                                                                                                                                                                                                                                             | **Réutilisé tel quel** par `Quiz.evaluationType` (pas de nouvel enum redondant).                                                                                                                     |
| `NiveauAcquisition` enum (`:5637`)                               | `non_acquis \| partiellement_acquis \| acquis`                                                                                                                                                                                                                                    | **Réutilisé** lors de la projection quiz → `EvaluationAcquis.niveauGlobal`.                                                                                                                          |
| `Trainee` (`:5274`) / `Enrollment` (`:5310`) / `CoachingSession` | identités & rattachements Qualiopi (PK `@db.Uuid`)                                                                                                                                                                                                                                | `EvaluationAcquis` y est déjà relié (nullable depuis le 1-to-1 AFEST). On **ajoute** un 3ᵉ rattachement optionnel `elearningEnrollmentId` (cf. §10.2).                                               |
| `ElearningEnrollment` (doc 02)                                   | inscription e-learning d'un apprenant à un cours — **clé d'identité apprenant côté quiz**                                                                                                                                                                                         | `QuizAttempt.enrollmentId` y pointe. PK **`text`** (cf. §2).                                                                                                                                         |
| `DocumentGenere` (`:5507`) + `qrToken`                           | certificats/QR (PK `@db.Uuid`)                                                                                                                                                                                                                                                    | Le corrigé/relevé PDF d'un attempt à fort enjeu peut générer un `DocumentGenere` (réutilisé, **aucun nouveau modèle PDF**).                                                                          |
| `r2-storage.ts`                                                  | `uploadToR2`/`getSignedUrlR2`/`getSignedUploadUrlR2`                                                                                                                                                                                                                              | Questions type `upload`/`essai` (fichier joint) + médias d'énoncé → R2. **Pas de streaming**, juste fichiers.                                                                                        |
| RBAC `_guards.ts`                                                | `requireAdminRead/Write/Publish/Delete` (rôles `super_admin/admin/editor/reader`)                                                                                                                                                                                                 | Outil auteur + correction manuelle. Aucun nouveau système d'autorisation admin.                                                                                                                      |
| `IP_HASH_SALT` (pattern existant)                                | hash IP RGPD                                                                                                                                                                                                                                                                      | `QuizAttempt.ipHash` réutilise le même sel/algorithme (jamais d'IP en clair).                                                                                                                        |

### NEUF (à construire — ce document)

`QuizBank`, `Question`, `QuestionChoice`, `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAttemptAnswer` + 6 enums dédiés + 2 champs additifs nullable sur `EvaluationAcquis`.

> **Principe anti-duplication** : `QuizAttempt`/`QuizAttemptAnswer` = **runtime de correction** (logs, réponses brutes, points par question — c'est une **trace LMS** au sens R.6313-3, faisceau de preuves FOAD). `EvaluationAcquis` = **synthèse pédagogique par objectif** (la pièce que l'auditeur Qualiopi attend). Le quiz **alimente** l'éval, l'éval **référence** l'attempt. Un seul bloc « preuve d'acquisition », deux niveaux de granularité.

---

## 2. Convention de type des clés (CRITIQUE — alignée sur docs 01/02)

⚠️ **Point de cohérence à respecter à la lettre.** Le repo mélange deux types de PK :

- Les modèles **existants** Qualiopi (`Trainee`, `Enrollment`, `EvaluationAcquis`, `DocumentGenere`, `AdminUser`, `CoachingSession`…) ont une PK **`String @id @default(uuid()) @db.Uuid`** (colonne Postgres `uuid`).
- Les modèles **LMS neufs** (doc 01 : `ElearningCourse`/`Module`/`Lesson`/`Resource` ; doc 02 : `ElearningEnrollment`/`CourseProgress`/`ModuleProgress`/`LessonProgress`) ont une PK **`String @id @default(uuid())`** **sans** `@db.Uuid` (colonne Postgres `text`). Doc 02 le dit explicitement (« réutilise ElearningCourse, doc 01 — **PK text** » / « réutilise Trainee — **@db.Uuid obligatoire** »).

**Règle de ce document (pour que toutes les FK migrent sans erreur de type) :**

1. **Les 7 tables neuves du moteur quiz adoptent la convention LMS = PK `text`** (`String @id @default(uuid())`, **pas** de `@db.Uuid`). Cohérent avec doc 01/02.
2. **FK vers un modèle LMS (`text`)** → colonne **`text`** (pas de `@db.Uuid`) : `courseId`, `lessonId`, `bankId`, `quizId`, `questionId`, `attemptId`, `enrollmentId` (→ `ElearningEnrollment`), `sourceLessonId`, `poolBankId`.
3. **FK vers un modèle existant (`@db.Uuid`)** → colonne **`@db.Uuid`** : `traineeId` (→ `Trainee`), `evaluationAcquisId` (→ `EvaluationAcquis`), `corrigeParId`/`octroyeParId` (→ `AdminUser`).
4. **Le champ additif `evaluations_acquis.elearning_enrollment_id`** est **`text`** (il référence `ElearningEnrollment.id`, de type `text`) — Postgres autorise une FK `text → text` même si la PK propre de `evaluations_acquis` reste `uuid`. **Ne pas mettre `@db.Uuid` sur cette colonne.**

> En clair : **on ne met `@db.Uuid` que sur les FK qui pointent vers une table dont la PK est `uuid` (modèles existants)**. Tout le reste (intra-LMS) est `text`. C'est l'unique source d'incohérence possible — à vérifier en revue de migration (`06-strategie-migrations.md`).

---

## 3. Enums (neufs)

```prisma
/// 12 types de questions du moteur. Auto-correctibles sauf `essai` / `upload`
/// (correction manuelle) — cf. CorrectionMode et §6 (algorithmes de scoring).
enum QuestionType {
  qcm_mono        // choix unique parmi N (radio)
  qcm_multi       // choix multiple (cases ; scoring partiel possible)
  vrai_faux       // cas dégénéré de qcm_mono (2 choix)
  appariement     // relier éléments gauche ↔ droite (matchKey)
  texte_a_trous   // saisie libre dans des trous {{b1}} (réponses acceptées)
  menu_deroulant  // trous à choisir dans une liste déroulante (options par trou)
  ordonnancement  // remettre des items dans le bon ordre
  reponse_courte  // texte court auto-corrigé (patterns / normalisation)
  numerique       // valeur numérique avec tolérance (± / intervalle / unité)
  essai           // rédaction longue → correction MANUELLE
  upload          // fichier rendu (R2) → correction MANUELLE (preuve FOAD "devoir")
  zone_cliquable  // hotspot sur image (zones correctes)
}

/// Difficulté (filtre de tirage + analytics).
enum QuestionDifficulte {
  facile
  moyen
  difficile
}

/// Mode de correction d'une question / d'un quiz.
enum CorrectionMode {
  auto        // 100% automatique
  manuelle    // essai / upload : un correcteur humain note
  mixte       // quiz contenant au moins une question manuelle
}

/// Finalité pédagogique du quiz. Pilote l'articulation Qualiopi (cf. §10).
enum QuizFinalite {
  entrainement       // formatif, non bloquant, ne produit pas de preuve
  positionnement     // diagnostic d'entrée (Ind.8) → EvaluationAcquis type=initiale
  evaluation         // intermédiaire/jalon (Ind.11) → EvaluationAcquis type=intermediaire
  final_certificatif // évaluation finale → EvaluationAcquis type=finale (fait foi)
}

/// Quand l'apprenant voit le feedback / corrigé.
enum FeedbackMode {
  immediat          // après chaque question (mode entraînement)
  apres_soumission  // à la soumission de la tentative
  apres_reussite    // seulement une fois le seuil atteint
  apres_cloture     // seulement après date de clôture / fin de session
  aucun             // jamais (high-stakes)
}

/// Cycle de vie d'une tentative.
enum QuizAttemptStatut {
  en_cours    // démarrée, reprise auto possible (état serveur)
  soumis      // réponses figées, correction auto faite
  a_corriger  // contient des questions manuelles non encore notées
  corrige     // correction manuelle terminée (score définitif)
  expire      // tempsLimiteSec dépassé → auto-soumission
  abandonne   // invalidée (admin / dépassement tentatives)
}
```

---

## 4. Banque & questions

### 4.1 `QuizBank` (banque réutilisable)

```prisma
model QuizBank {
  id          String           @id @default(uuid())     // PK text (convention LMS, §2)
  titre       String           @db.VarChar(250)
  description String?          @db.Text

  // Scope : null = banque globale réutilisable ; sinon rattachée à un cours.
  courseId    String?          @map("course_id")        // FK text → ElearningCourse
  course      ElearningCourse? @relation("CourseQuizBanks", fields: [courseId], references: [id], onDelete: SetNull)

  tags        Json             @default("[]")   // string[] : thèmes / compétences / objectifRef
  questions   Question[]

  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  @@index([courseId])
  @@map("elearning_quiz_banks")
}
```

> Champ inverse additif côté `ElearningCourse` : `quizBanks QuizBank[] @relation("CourseQuizBanks")` (relation sans colonne, FK portée par `QuizBank`).

### 4.2 `Question` (12 types ; énoncé + payload typé)

```prisma
model Question {
  id          String             @id @default(uuid())   // PK text (§2)
  bankId      String             @map("bank_id")         // FK text → QuizBank
  bank        QuizBank           @relation(fields: [bankId], references: [id], onDelete: Cascade)

  type        QuestionType
  enonce      String             @db.Text                 // énoncé (markdown léger / texte)
  enonceJson  Json?              @map("enonce_json")       // énoncé riche (blocs) optionnel
  consigne    String?            @db.Text                  // ex. "Sélectionnez toutes les bonnes réponses"
  mediaR2Key  String?            @map("media_r2_key")      // image/audio d'appui (R2)

  // Pondération & métadonnées
  points      Int                @default(1)               // poids par défaut (override possible dans QuizQuestion)
  difficulte  QuestionDifficulte @default(moyen)
  tags        Json               @default("[]")            // string[] : objectifRef (lien grille Qualiopi), thème
  objectifRef String?            @map("objectif_ref") @db.VarChar(120) // mappe vers un objectif pédagogique (Ind.11)

  // Comportement
  shuffleChoices  Boolean        @default(true) @map("shuffle_choices") // mélange des options à l'affichage
  correctionMode  CorrectionMode @default(auto) @map("correction_mode")
  scoringPartiel  Boolean        @default(false) @map("scoring_partiel") // qcm_multi/appariement/ordonnancement : points proportionnels

  // Feedback / pédagogie
  feedbackCorrect   String?      @map("feedback_correct") @db.Text
  feedbackIncorrect String?      @map("feedback_incorrect") @db.Text
  rationale         String?      @db.Text                  // explication détaillée (affichée selon FeedbackMode)

  // Payload typé selon `type` (cf. §5 pour les shapes exactes).
  // Utilisé par : texte_a_trous, menu_deroulant, ordonnancement, reponse_courte,
  // numerique, zone_cliquable. Les QCM/vrai_faux/appariement utilisent QuestionChoice.
  payloadJson Json?              @map("payload_json")

  // Provenance (IA quiz-gen — ADR V1 ; document-grounded). Null = saisie humaine.
  sourceIa       Boolean         @default(false) @map("source_ia")
  sourceLessonId String?         @map("source_lesson_id")  // FK text → ElearningLesson (leçon d'origine si généré)

  choices        QuestionChoice[]
  quizQuestions  QuizQuestion[]
  attemptAnswers QuizAttemptAnswer[]

  createdAt   DateTime           @default(now()) @map("created_at")
  updatedAt   DateTime           @updatedAt @map("updated_at")

  @@index([bankId])
  @@index([type])
  @@index([difficulte])
  @@index([objectifRef])
  @@map("elearning_questions")
}
```

> `sourceLessonId` est une **FK applicative** (non contrainte côté Prisma pour rester additif et éviter un cycle de dépendance avec doc 01) ; intégrité vérifiée en service. Ajouter, si souhaité, l'inverse `ElearningLesson.questionsGenerees Question[]`.

### 4.3 `QuestionChoice` (options des QCM / vrai-faux / appariement)

```prisma
model QuestionChoice {
  id          String   @id @default(uuid())     // PK text (§2)
  questionId  String   @map("question_id")       // FK text → Question
  question    Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  libelle     String   @db.Text
  mediaR2Key  String?  @map("media_r2_key")              // option illustrée (R2)
  ordre       Int      @default(0)                       // ordre auteur (avant shuffle)

  // QCM / vrai_faux : la bonne réponse.
  estCorrect  Boolean  @default(false) @map("est_correct")
  // appariement : clé d'appariement. Deux choices partageant matchKey forment
  // une paire correcte (côté gauche `colonne='gauche'`, droite `colonne='droite'`).
  matchKey    String?  @map("match_key") @db.VarChar(60)
  colonne     String?  @db.VarChar(10)                   // 'gauche' | 'droite' (appariement)

  // Feedback spécifique à l'option (distracteur expliqué — best practice).
  feedback    String?  @db.Text

  createdAt   DateTime @default(now()) @map("created_at")

  @@index([questionId])
  @@map("elearning_question_choices")
}
```

---

## 5. Shapes `payloadJson` par type (contrat applicatif — validé par Zod)

Schémas Zod dans `src/server/elearning/quiz/question-payloads.ts`. **Le serveur valide à la création ET re-valide à la correction** (jamais de confiance au client).

```ts
// texte_a_trous — énoncé avec marqueurs {{b1}}, {{b2}}…
{ blanks: [
    { id: "b1", reponses: ["RGPD", "rgpd"], casseSensible: false, accentsSensibles: false,
      trim: true, points: 1 },
    { id: "b2", reponses: ["CNIL"], casseSensible: false, points: 1 }
] }

// menu_deroulant — chaque trou a une liste fermée d'options
{ blanks: [
    { id: "b1", options: ["MVP", "POC", "PoC"], bonne: "MVP", points: 1 }
] }

// ordonnancement — bon ordre = ordre du tableau
{ items: [ { id: "i1", libelle: "Cadrage" }, { id: "i2", libelle: "Conception" },
           { id: "i3", libelle: "Mise en prod" } ],
  scoring: "kendall_tau" }   // "exact" | "kendall_tau" | "positions_justes"

// reponse_courte — auto-correction texte
{ reponsesAcceptees: ["machine learning", "apprentissage automatique"],
  regex: null, normalisation: { casse: false, accents: false, trim: true },
  distanceLevenshteinMax: 0, points: 1 }

// numerique — valeur ± tolérance
{ valeur: 42, tolerance: 0.5, intervalle: null, unite: "%", points: 1 }
// ou intervalle:[40,44] (tolerance ignorée), unite optionnelle (texte exact ou null)

// zone_cliquable — hotspots sur image (coordonnées % du conteneur)
{ imageR2Key: "elearning/q/abc.png",
  zones: [ { id:"z1", forme:"rect", x:10, y:20, w:15, h:10, correcte:true } ],
  nbClicsAttendus: 1, scoringPartiel: false }
```

> `qcm_mono`, `qcm_multi`, `vrai_faux`, `appariement` n'utilisent **pas** `payloadJson` (tout est dans `QuestionChoice`). `essai`/`upload` n'ont pas de barème auto : `payloadJson` peut porter une **grille de correction** indicative (`{ criteres: [{ libelle, pointsMax }], consignesFichier: { mimes, tailleMaxMo } }`).

---

## 6. Algorithmes de scoring (référence pour `src/server/elearning/quiz/scoring.ts`)

Tout le scoring est **côté serveur** sur les données figées du snapshot (cf. §8). `points` effectifs = `QuizQuestion.pointsOverride ?? Question.points`.

| Type                               | Règle (avec `scoringPartiel=false`)                                | Si `scoringPartiel=true`                                    |
| ---------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------ | --- |
| `qcm_mono` / `vrai_faux`           | choix == unique `estCorrect` → points pleins, sinon 0              | n/a                                                         |
| `qcm_multi`                        | ensemble sélectionné == ensemble des `estCorrect` → plein, sinon 0 | `points × (justes − faux_cochés) / nbCorrects`, planché à 0 |
| `appariement`                      | toutes les paires `matchKey` correctes → plein                     | `points × pairesJustes / nbPaires`                          |
| `texte_a_trous` / `menu_deroulant` | tous les trous justes → plein                                      | somme des `points` par trou juste                           |
| `ordonnancement`                   | ordre exact → plein                                                | `kendall_tau` ou `positions_justes` selon `scoring`         |
| `reponse_courte`                   | match exact après normalisation (ou Levenshtein ≤ seuil, ou regex) | n/a                                                         |
| `numerique`                        | `                                                                  | saisi − valeur                                              | ≤ tolerance` (ou ∈ intervalle) et unité OK | n/a |
| `zone_cliquable`                   | tous les clics dans des zones `correcte` et nb attendu             | `points × zonesJustes / nbZones`                            |
| `essai` / `upload`                 | **0 en auto** → `correcte=null`, attempt passe `a_corriger`        | correcteur saisit `noteManuelle`                            |

**Score tentative** : `scorePct = round(100 × Σ pointsObtenus / Σ pointsMax)`. **Réussite** : `scorePct ≥ Quiz.seuilReussitePct`. Si au moins une question manuelle non notée → `reussite` reste `null` et `statut=a_corriger` (pas de gating tant que non corrigé).

---

## 7. Quiz & sélection de questions

### 7.1 `Quiz`

```prisma
model Quiz {
  id          String        @id @default(uuid())   // PK text (§2)

  // Rattachement : une ElearningLesson type=quiz pointe ici via lesson.quizId,
  // ET/OU un module/leçon référence ce quiz pour le gating via unlockQuizId.
  // On garde le lien inverse explicite (1 quiz peut être la cible d'1 leçon).
  lessonId    String?          @unique @map("lesson_id")   // FK text → ElearningLesson
  lesson      ElearningLesson? @relation("LessonQuiz", fields: [lessonId], references: [id], onDelete: SetNull)
  courseId    String           @map("course_id")           // FK text → ElearningCourse
  course      ElearningCourse  @relation("CourseQuizzes", fields: [courseId], references: [id], onDelete: Cascade)

  titre       String        @db.VarChar(250)
  consigne    String?       @db.Text
  finalite    QuizFinalite  @default(evaluation)

  // Barème & réussite
  seuilReussitePct Int      @default(70) @map("seuil_reussite_pct") // gating de compétence (vraie note)
  noteSur          Int      @default(100) @map("note_sur")
  ponderationActive Boolean @default(true) @map("ponderation_active") // sinon chaque question = 1 pt

  // Tentatives
  maxTentatives           Int? @map("max_tentatives")     // null = illimité
  delaiEntreTentativesSec Int? @map("delai_entre_tentatives_sec") // anti-bruteforce léger

  // Mélange & tirage (anti-triche léger : randomisation)
  shuffleQuestions  Boolean  @default(true) @map("shuffle_questions")
  tirageAleatoire   Boolean  @default(false) @map("tirage_aleatoire") // N parmi M depuis la banque
  nbQuestionsTirees Int?     @map("nb_questions_tirees")
  poolBankId        String?  @map("pool_bank_id")              // FK text → QuizBank (source du tirage)
  poolFiltreJson    Json?    @map("pool_filtre_json")          // { tags?, difficulte?, objectifRef? }

  // Temps (anti-triche serveur : horloge serveur fait foi)
  tempsLimiteSec    Int?     @map("temps_limite_sec")

  // Feedback / restitution
  feedbackMode           FeedbackMode @default(apres_soumission) @map("feedback_mode")
  afficherScore          Boolean      @default(true) @map("afficher_score")
  afficherCorrige        Boolean      @default(true) @map("afficher_corrige")
  afficherBonnesReponses Boolean      @default(true) @map("afficher_bonnes_reponses")

  // Articulation Qualiopi (cf. §10). Si true et finalite ∈ {positionnement,
  // evaluation, final_certificatif}, une tentative réussie PROJETTE une ligne
  // EvaluationAcquis (type dérivé de evaluationType).
  genereEvaluationAcquis Boolean         @default(false) @map("genere_evaluation_acquis")
  evaluationType         EvaluationType?                            // réutilise l'enum existant (:5630)

  questions   QuizQuestion[]
  attempts    QuizAttempt[]

  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")

  @@index([courseId])
  @@index([finalite])
  @@index([poolBankId])
  @@map("elearning_quizzes")
}
```

> Champs inverses additifs : `ElearningCourse.quizzes Quiz[] @relation("CourseQuizzes")` et `ElearningLesson.quiz Quiz? @relation("LessonQuiz")`. Le `unlockQuizId`/`unlockScorePct` du doc 01 (sur `ElearningModule`/`ElearningLesson`) **référencent un `Quiz.id`** (FK **applicative** non contrainte côté Prisma pour rester additif et éviter un cycle de cascade ; intégrité vérifiée dans `unlock-engine.ts`).

### 7.2 `QuizQuestion` (questions épinglées, ordonnées, pondérées)

```prisma
model QuizQuestion {
  id          String   @id @default(uuid())     // PK text (§2)
  quizId      String   @map("quiz_id")           // FK text → Quiz
  quiz        Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)
  questionId  String   @map("question_id")       // FK text → Question
  question    Question @relation(fields: [questionId], references: [id], onDelete: Restrict)

  ordre          Int                                // ordre fixe (si shuffleQuestions=false)
  pointsOverride Int?    @map("points_override")    // surclasse Question.points pour ce quiz
  obligatoire    Boolean @default(true)             // compte dans scoreMax

  @@unique([quizId, questionId])
  @@unique([quizId, ordre])
  @@index([quizId])
  @@map("elearning_quiz_questions")
}
```

**Modes de composition (combinables)** :

1. **Épinglé** : `QuizQuestion` liste explicite, ordre maîtrisé.
2. **Tirage** : `tirageAleatoire=true` + `poolBankId` + `poolFiltreJson` + `nbQuestionsTirees` → le service tire **N parmi M** au démarrage de chaque tentative.
3. **Mixte** : un socle épinglé + un complément tiré (le service complète jusqu'à `nbQuestionsTirees`).

Le **résultat du tirage + l'ordre mélangé + l'ordre des options** est **figé dans `QuizAttempt.questionsSnapshot`** (reproductibilité, équité, preuve).

---

## 8. Tentatives & réponses (runtime)

### 8.1 `QuizAttempt`

```prisma
model QuizAttempt {
  id          String            @id @default(uuid())   // PK text (§2)
  quizId      String            @map("quiz_id")         // FK text → Quiz
  quiz        Quiz              @relation(fields: [quizId], references: [id], onDelete: Cascade)

  // Identité apprenant : l'inscription e-learning (doc 02) est la clé.
  // traineeId dénormalisé pour requêtes/reporting (réutilise Trainee existant).
  enrollmentId String              @map("enrollment_id")   // FK text → ElearningEnrollment (doc 02)
  enrollment   ElearningEnrollment @relation("ElearningQuizAttempts", fields: [enrollmentId], references: [id], onDelete: Cascade)
  traineeId    String?             @map("trainee_id") @db.Uuid   // FK uuid → Trainee (existant)
  trainee      Trainee?            @relation("TraineeQuizAttempts", fields: [traineeId], references: [id], onDelete: SetNull)

  numeroTentative Int               @map("numero_tentative")     // 1,2,3… (unicité ci-dessous)
  statut          QuizAttemptStatut @default(en_cours)

  // Snapshot figé : questions tirées + ordre + ordre des options (équité/preuve).
  // [{ questionId, ordre, type, points, choixOrdre:[choiceId…], payloadPublic }]
  questionsSnapshot Json        @map("questions_snapshot")

  // Scores (remplis à la soumission / correction)
  scoreBrut   Int?              @map("score_brut")                // Σ points obtenus
  scoreMax    Int?              @map("score_max")                 // Σ points possibles
  scorePct    Int?              @map("score_pct")
  reussite    Boolean?                                            // null tant que a_corriger
  noteSur     Int?              @map("note_sur")                  // copie de Quiz.noteSur

  // Temps (horloge SERVEUR = source de vérité — anti-triche léger)
  tempsLimiteSec Int?           @map("temps_limite_sec")          // copie au démarrage
  tempsPasseSec  Int?           @map("temps_passe_sec")
  startedAt    DateTime         @default(now()) @map("started_at")
  submittedAt  DateTime?        @map("submitted_at")
  corrigeAt    DateTime?        @map("corrige_at")
  expiresAt    DateTime?        @map("expires_at")                // startedAt + tempsLimiteSec

  // Correction manuelle (essai/upload)
  correctionManuelleRequise Boolean @default(false) @map("correction_manuelle_requise")
  corrigeParId String?         @map("corrige_par_id") @db.Uuid    // FK uuid → AdminUser correcteur

  // Traçabilité / CNIL : IP HASHÉE (jamais en clair), UA tronqué. Logs techniques
  // conservés 6 mois–1 an (CNIL 2021-122). Réutilise le pattern IP_HASH_SALT.
  ipHash        String?        @map("ip_hash") @db.VarChar(64)
  userAgentHash String?        @map("user_agent_hash") @db.VarChar(64)

  // Articulation Qualiopi : ligne EvaluationAcquis produite par cette tentative.
  evaluationAcquisId String?   @unique @map("evaluation_acquis_id") @db.Uuid  // FK uuid → EvaluationAcquis
  evaluationAcquis   EvaluationAcquis? @relation("AttemptEvaluation", fields: [evaluationAcquisId], references: [id], onDelete: SetNull)

  answers      QuizAttemptAnswer[]

  createdAt    DateTime        @default(now()) @map("created_at")
  updatedAt    DateTime        @updatedAt @map("updated_at")

  @@unique([quizId, enrollmentId, numeroTentative], map: "attempt_unique_per_try")
  @@index([quizId])
  @@index([enrollmentId])
  @@index([traineeId])
  @@index([statut])
  @@map("elearning_quiz_attempts")
}
```

### 8.2 `QuizAttemptAnswer`

```prisma
model QuizAttemptAnswer {
  id          String      @id @default(uuid())   // PK text (§2)
  attemptId   String      @map("attempt_id")      // FK text → QuizAttempt
  attempt     QuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  questionId  String      @map("question_id")     // FK text → Question
  question    Question    @relation(fields: [questionId], references: [id], onDelete: Restrict)

  // Réponse brute apprenant, shape selon le type :
  //   qcm_*/vrai_faux  : { choiceIds: ["…"] }
  //   appariement      : { paires: [{ gaucheId, droiteId }] }
  //   texte_a_trous    : { blanks: { b1:"…", b2:"…" } }
  //   menu_deroulant   : { blanks: { b1:"…" } }
  //   ordonnancement   : { ordre: ["i2","i1","i3"] }
  //   reponse_courte   : { texte: "…" }
  //   numerique        : { valeur: 42, unite:"%" }
  //   zone_cliquable   : { clics: [{x,y}] }
  //   essai            : { texte: "…" }
  //   upload           : { fichierR2Key:"…", nomOriginal:"…", mime:"…", tailleOctets:N }
  reponseJson Json        @map("reponse_json")

  pointsObtenus Float?    @map("points_obtenus")   // null tant que non corrigé (manuel)
  pointsMax     Float     @map("points_max")
  correcte      Boolean?                            // null = en attente correction manuelle

  // Correction manuelle (essai/upload)
  correctionManuelle    Boolean @default(false) @map("correction_manuelle")
  noteManuelle          Float?  @map("note_manuelle")
  commentaireCorrecteur String? @map("commentaire_correcteur") @db.Text
  corrigeParId          String? @map("corrige_par_id") @db.Uuid   // FK uuid → AdminUser

  feedbackDonne String?    @map("feedback_donne") @db.Text  // feedback figé montré à l'apprenant

  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  @@unique([attemptId, questionId])
  @@index([attemptId])
  @@index([questionId])
  @@map("elearning_quiz_attempt_answers")
}
```

> Champs inverses additifs : `Trainee.quizAttempts QuizAttempt[] @relation("TraineeQuizAttempts")` et `ElearningEnrollment.quizAttempts QuizAttempt[] @relation("ElearningQuizAttempts")` (relations sans colonne — la 2ᵉ est à déclarer côté doc 02, qui liste déjà ses relations inverses).

---

## 9. Déverrouillage par score (gating) — câblage avec le doc 01

Le doc 01 a posé sur `ElearningModule` / `ElearningLesson` : `unlockType=score_quiz`, `unlockQuizId`, `unlockScorePct`. Sémantique implémentée par `src/server/elearning/quiz/unlock-engine.ts` :

1. **Vrai gating par note** (pas attempt-only) : un module/leçon `score_quiz` est déverrouillé ssi il existe une `QuizAttempt` sur `unlockQuizId` avec `statut ∈ {soumis,corrige}` **et** `scorePct ≥ unlockScorePct` (ou `Quiz.seuilReussitePct` si `unlockScorePct` null).
2. **Verrou affiché AVEC sa raison** : le service renvoie `{ verrouille:true, raison:"Réussissez le quiz « X » (≥ 80 %) — meilleur score: 65 %", quizId, scoreRequis, meilleurScore }` (best practice 2026 : jamais un cadenas muet).
3. **Override admin** : `ElearningEnrollment.metadata` (ou un champ `overridesJson` si ajouté en doc 02) peut forcer le déverrouillage d'un module → l'unlock-engine court-circuite le gating (tracé pour preuve). Pas de table dédiée.
4. **Tant que `a_corriger`** : la tentative ne déverrouille pas (la note n'est pas définitive). Email/notif quand la correction manuelle est faite (`elearning-quiz-grading-worker`).

---

## 10. Articulation avec `EvaluationAcquis` (preuve Qualiopi, **sans duplication**)

### 10.1 Règle d'or

`QuizAttempt` = **trace de réalisation** (faisceau de preuves FOAD, R.6313-3 : logs LMS + travaux + évaluations). `EvaluationAcquis` = **synthèse par objectif** que l'auditeur attend (Ind.11). **On ne recopie pas le détail** des réponses dans `EvaluationAcquis` : on **projette une synthèse** et on **lie** les deux par FK.

### 10.2 Champs additifs sur `EvaluationAcquis` (migration additive, nullable)

```prisma
// model EvaluationAcquis { … existant inchangé (prisma/schema.prisma:5653) … }

  /// E-learning FOAD autonome (ni Enrollment collectif, ni CoachingSession).
  /// Étend l'invariant applicatif : exactement UN de
  /// (enrollmentId, coachingSessionId, elearningEnrollmentId).
  /// ⚠️ COLONNE `text` (référence ElearningEnrollment.id qui est `text`, cf. §2) —
  /// PAS de @db.Uuid ici, même si la PK de evaluations_acquis est uuid.
  elearningEnrollmentId String?            @map("elearning_enrollment_id")
  elearningEnrollment   ElearningEnrollment? @relation("ElearningEvaluations", fields: [elearningEnrollmentId], references: [id], onDelete: Cascade)

  /// Tentative de quiz source de cette évaluation (traçabilité bidirectionnelle).
  /// Relation inverse pure (la FK est portée par QuizAttempt.evaluationAcquisId).
  quizAttempt           QuizAttempt?       @relation("AttemptEvaluation")

  // + index additif
  // @@index([elearningEnrollmentId])
```

> ⚠️ Ce sont les **seules** modifications d'un modèle existant. Strictement additives (colonne nullable + 2 relations inverses + index). L'invariant « exactement un rattachement » est **applicatif** (service `projection-evaluation.ts`), pas une contrainte SQL — cohérent avec le pattern AFEST déjà en place (commentaire `:5657`).

### 10.3 Pipeline de projection

`src/server/elearning/quiz/projection-evaluation.ts`, déclenché par `elearning-quiz-grading-worker` quand une tentative passe `soumis`/`corrige` :

```
SI quiz.genereEvaluationAcquis ET attempt.statut ∈ {soumis,corrige} ET attempt.reussite calculée :
  type        = quiz.evaluationType (positionnement→initiale, evaluation→intermediaire,
                final_certificatif→finale)
  upsert EvaluationAcquis (clé logique = (rattachement, type, quizAttemptId)) AVEC :
    scoreObtenu = attempt.scoreBrut
    scoreMax    = attempt.scoreMax
    scorePct    = attempt.scorePct
    reussite    = attempt.reussite
    niveauGlobal= scorePct≥seuil ? acquis : (scorePct≥seuil/2 ? partiellement_acquis : non_acquis)
    competences = agrégat par Question.objectifRef
                  [{ libelle, note(1-3), observations?, objectifRef }]  // format EXISTANT (:5671)
    documentId  = null (PDF relevé optionnel via DocumentGenere si high-stakes)
  attempt.evaluationAcquisId = eval.id   // lien retour
```

- **`final_certificatif` réussi** = la ligne `EvaluationAcquis type=finale` qui **fait foi** (comme le dit déjà le commentaire schema `:5652`) → débloque le **certificat de réalisation** e-learning (`05-FRONTEND-APPRENANT/06-*`, réutilise `DocumentGenere`/`qrToken` + `ElearningEnrollment.certificatDocumentId` du doc 02).
- **Idempotence** : re-passer une tentative met à jour la **même** ligne par type (pas de doublon de preuve). La **meilleure** tentative réussie fait foi (politique configurable côté service).
- **Pas de projection** pour `finalite=entrainement` (formatif pur — pas une preuve).

---

## 11. Backend, workers, routes, composants (chemins cibles)

### Services (`src/server/elearning/quiz/`)

- `quiz-runtime.ts` — `startAttempt` (tirage + shuffle + snapshot + `expiresAt`), `saveAnswer` (autosave/reprise), `submitAttempt` (verrou + correction auto), `resumeAttempt`.
- `scoring.ts` — algorithmes §6 (pur, testable, déterministe).
- `question-payloads.ts` — schémas Zod des shapes §5 (validation create + correction).
- `unlock-engine.ts` — gating par score §9 (consommé par le player, doc 01/02).
- `projection-evaluation.ts` — §10.3 (quiz → `EvaluationAcquis`).
- `quiz-authoring.ts` — CRUD banque/questions/quiz (outil auteur).
- `quiz-gen-ai.ts` (V1) — génération de questions **document-grounded** : réutilise le **RAG knowledge** existant + `@anthropic-ai/sdk` (cf. skill qualiopi `runAdversarialCritique`/grille), ancrage + citations, `sourceIa=true`.

### Server Actions (`src/app/[locale]/(admin)/[adminPrefix]/elearning/quiz/actions.ts`)

CRUD banques/questions/quiz, import questions, prévisualisation « as-student ». **RBAC** via `requireAdminWrite`/`requireAdminPublish`/`requireAdminDelete` (`src/server/actions/knowledge/_guards.ts`, rôles `super_admin/admin/editor/reader`). Correction manuelle → `requireAdminWrite`.

### Routes apprenant (extension portail, ADR-LMS-0007)

- `src/app/[locale]/portail/cours/[courseSlug]/quiz/[quizId]/page.tsx` — **`force-dynamic`** (auth apprenant, jamais SSG ; compatible contrat `stub.invalid`).
- Server Actions apprenant dédiées (système d'auth **séparé de NextAuth**, ADR-LMS-0001 ; cookie portail `PortailAcces` 64hex HttpOnly).

### Composants (`src/components/elearning/quiz/`)

`QuizPlayer.tsx`, `QuestionRenderer.tsx` (switch sur 12 types), `ChoiceQuestion`, `MatchingQuestion`, `ClozeQuestion`, `OrderingQuestion`, `HotspotQuestion`, `UploadQuestion`, `QuizResult.tsx`, `QuizTimer.tsx`. **WCAG 2.2 AA** : appariement/ordonnancement offrent une **alternative au glisser** (2.5.7), cibles ≥ 24 px (2.5.8), navigation clavier + focus visible, timer annonçable (aria-live), pas d'autoplay, auth accessible (3.3.8). Côté admin : `src/components/admin/elearning/quiz/QuestionEditor.tsx`, `QuizBuilder.tsx`, `QuestionBankBrowser.tsx`, `ManualGradingPanel.tsx`.

### Workers / queues (`src/server/queue/workers/`)

- `elearning-quiz-grading-worker.ts` — correction manuelle terminée → recalcul score → `projection-evaluation` → notif apprenant ; auto-soumission des tentatives `expire` (cron). Queue `elearning-quiz`.
- Réutilise `email-worker.ts` (templates React Email Nodemailer) pour « résultat disponible » / « quiz à corriger ». Tracking interne **xAPI-like** (ADR-0006 verbe/objet : `answered`/`passed`/`failed`) émis depuis `submitAttempt` vers `ElearningXapiStatement` (doc 02).

### Admin nav (`src/lib/admin-nav.ts` — ⚠️ sidebar montée = `AdminSidebarNav.tsx`, pas `AdminSidebar.tsx`)

Sous le pôle e-learning : entrées **Banque de questions**, **Quiz**, **Corrections en attente** (badge `a_corriger`). Pages via `AdminPageShell`/`AdminPageHeader`/`AdminTable`/`AdminBadge`/`StatCard`.

---

## 12. Anti-triche, RGPD & conformité (proportionné — CNIL)

- **Randomisation** (`shuffleQuestions`, `shuffleChoices`, `tirageAleatoire`) + **horloge serveur** (`expiresAt`/`tempsLimiteSec`) = anti-triche **léger** suffisant pour le standard. **Pas de proctoring** par défaut (CNIL : proportionné, optionnel, **alternative obligatoire**) — réservé aux quiz `final_certificatif` à fort enjeu, derrière un flag, jamais imposé.
- **IP/UA hashés** (`ipHash`/`userAgentHash`, sel `IP_HASH_SALT` réutilisé), jamais en clair ; logs techniques **6 mois–1 an** (CNIL 2021-122).
- **Preuves FOAD** : `QuizAttempt` + `QuizAttemptAnswer` (logs/travaux) + `EvaluationAcquis` (synthèse) + fichiers `upload` (R2) = faisceau R.6313-3 (relevé de connexion seul insuffisant) ; exportables (doc `08-CONFORMITE`). Conservation **3–5 ans** preuves de réalisation (L.6362-6), **6 ans** fiscal/OPCO (L.102B LPF), **10 ans** comptable (L.123-22).
- **Ind.11 (majeur)** : tout cours FOAD certifiant **doit** comporter au moins un quiz `evaluation`/`final_certificatif` projetant une `EvaluationAcquis` — garde-fou applicatif à la publication du cours (`quiz-authoring.ts` + check publication doc 01 §8). L'**assistance pédagogique** (tutorat, délais formalisés) relève d'Ind.19 (cf. tuteur RAG `04-BACKEND/09-*`).

---

## 13. Récapitulatif des migrations (additif — ADR-LMS-0008)

**Nouvelles tables** (PK `text`, §2) : `elearning_quiz_banks`, `elearning_questions`, `elearning_question_choices`, `elearning_quizzes`, `elearning_quiz_questions`, `elearning_quiz_attempts`, `elearning_quiz_attempt_answers`.
**Nouveaux enums** : `QuestionType`, `QuestionDifficulte`, `CorrectionMode`, `QuizFinalite`, `FeedbackMode`, `QuizAttemptStatut`.
**Colonnes additives sur table existante** : `evaluations_acquis.elearning_enrollment_id` (nullable, **`text`**) + index `@@index([elearningEnrollmentId])`.
**Relations inverses (sans colonne)** : `ElearningCourse.quizBanks/quizzes`, `ElearningLesson.quiz` (+ option `questionsGenerees`), `ElearningEnrollment.quizAttempts` (doc 02) + `elearningEvaluations`, `Trainee.quizAttempts`, `EvaluationAcquis.quizAttempt`.
**Types FK** : `@db.Uuid` UNIQUEMENT sur `traineeId`, `evaluationAcquisId`, `corrigeParId` (→ modèles existants `uuid`). Tout le reste = `text` (intra-LMS).
**Aucun DROP. Aucune colonne NOT NULL ajoutée à une table existante.**

---

## Liens

- `01-schema-cours-modules-lecons.md` — `ElearningLesson.quizId`, `ElearningModule/Lesson.unlock*` (référencent `Quiz`/`QuizAttempt` d'ici) ; PK LMS `text`
- `02-schema-progression-tracking.md` — `ElearningEnrollment` (clé `QuizAttempt.enrollmentId`), `LessonProgress`, `ElearningXapiStatement` (tracking xAPI-like) ; **fixe la convention de type PK (§2)**
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0006 (tracking), ADR-0007 (cloisonnement), ADR-0008 (migrations additives)
- `02-ARCHITECTURE/reutilisation-existant.md` — réutilisation `EvaluationAcquis`/`Trainee`/`DocumentGenere`/R2/RBAC
- `04-BACKEND/08-ia-pedagogique-generation.md` (V1) — IA quiz-gen document-grounded (RAG)
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` — player & rendu des 12 types (WCAG 2.2 AA)
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique du gating par score
- `06-CONSOLE-ADMIN/06-gestion-banque-quiz.md` — outil auteur banque/quiz + corrections
- `08-CONFORMITE/*` — Ind.11 (évaluations), Ind.19 (assistance), R.6313-3 (preuves FOAD), CNIL (proctoring/logs)
- `06-strategie-migrations.md` — alignement des types de clés (§2) & ordre des migrations
