# Data model — Cœur LMS : cours, modules, leçons

Colonne vertébrale du LMS. Tous les autres docs (backend, frontend, admin) renvoient ici pour les noms de modèles et de champs.

> ⚠️ **CORRECTIONS FAISANT AUTORITÉ — lire `00-INDEX/CORRECTIONS-PRE-IMPLEMENTATION.md` avant de copier ces snippets.** En particulier : (A1) **toutes les PK/FK LMS sont en `@db.Uuid`** — les snippets ci-dessous en `String @id @default(uuid())` doivent être lus **avec `@db.Uuid` ajouté** sur la PK et toutes les FK ; (D4) ajouter `apercuPublic Boolean @default(false)` sur `ElearningLesson`. Le document de corrections l'emporte en cas de divergence.

**Conventions du repo respectées :** UUID en `id`, `@map` snake_case, `email`/textes en `citext` quand pertinent, enums Prisma, index sur les FK et les colonnes filtrées, timestamps `createdAt`/`updatedAt`. **Migrations additives** (ADR-0008). Code sous `src/server/elearning/**` (ADR-0007).

---

## 1. Vue d'ensemble

```
ElearningCourse (1 cours = ex. "Maîtriser l'IA au quotidien")
 └─ ElearningModule (chapitre, ordonné, déverrouillable)
     └─ ElearningLesson (leçon : vidéo | texte | pdf | quiz | embed)
         └─ ElearningResource (média rattaché, stocké sur R2/Stream)
```

- Le **suivi de progression** (`ElearningEnrollment`, `LessonProgress`, …) est dans `02-schema-progression-tracking.md`.
- Le **moteur de quiz** (`Quiz`, `Question`, `QuizAttempt`) est dans `03-schema-quiz-evaluations.md` (une `ElearningLesson` de type `quiz` pointe vers un `Quiz`).
- Le **lien vers la `Formation` Qualiopi existante** est **optionnel** : un cours e-learning peut être autonome (vendu seul) OU adossé à une formation présentielle.

---

## 2. Enums

```prisma
enum ElearningCourseStatut {
  brouillon       // en cours d'édition, invisible des apprenants
  publie          // visible/accessible
  archive         // retiré, conservé pour l'historique et les preuves
}

enum ElearningLessonType {
  video           // leçon vidéo (Cloudflare Stream/Bunny)
  texte           // contenu riche (blocs Tiptap/JSON)
  pdf             // document PDF (R2)
  quiz            // pointe vers un Quiz (cf. doc 03)
  embed           // intégration externe (ex. classe virtuelle replay)
  devoir          // travail à rendre (upload apprenant) — preuve FOAD
}

// Règle de déverrouillage d'un module/leçon (drip + gating).
// Détail produit dans 05-FRONTEND-APPRENANT/04-progression-deverrouillage.md
enum ElearningUnlockType {
  immediat              // ouvert dès l'accès
  apres_precedent       // après complétion de l'élément précédent
  date_fixe             // à une date calendaire
  offset_inscription    // J+N après l'octroi d'accès
  score_quiz            // après réussite d'un quiz (seuil) — gating de compétence
}
```

---

## 3. Modèle `ElearningCourse`

```prisma
model ElearningCourse {
  id            String                @id @default(uuid())
  slug          String                @unique @db.Citext        // URL publique
  titre         String                @db.VarChar(250)
  sousTitre     String?               @map("sous_titre") @db.VarChar(300)
  description   String?                                          // riche (markdown/JSON)
  objectifs     Json                  @default("[]")             // string[] objectifs pédagogiques
  prerequis     Json                  @default("[]")             // string[]
  publicVise    String?               @map("public_vise") @db.VarChar(300)
  dureeEstimeeMinutes Int?            @map("duree_estimee_minutes") // somme des leçons (cache)
  langue        String                @default("fr") @db.VarChar(5)

  statut        ElearningCourseStatut @default(brouillon)
  version       Int                   @default(1)                // incrément à chaque publication
  publishedAt   DateTime?             @map("published_at")

  // Lien OPTIONNEL vers une formation Qualiopi existante (présentiel/live)
  formationId   String?               @map("formation_id")
  formation     Formation?            @relation(fields: [formationId], references: [id], onDelete: SetNull)

  // FOAD / conformité (cf. 08-CONFORMITE)
  estFoad       Boolean               @default(true) @map("est_foad")  // parcours finançable FOAD
  seuilReussitePct Int                @default(70) @map("seuil_reussite_pct") // seuil global certificat

  // Vitrine / e-commerce (cf. doc 05)
  vendableSeul  Boolean               @default(false) @map("vendable_seul")
  imageCouvertureKey String?          @map("image_couverture_key")  // R2

  // Multi-tenant (ADR-0002) : null = catalogue global ; sinon réservé à un Client
  ownerClientId String?               @map("owner_client_id")
  ownerClient   Client?               @relation("ClientCoursesProprietaires", fields: [ownerClientId], references: [id], onDelete: SetNull)

  modules       ElearningModule[]
  enrollments   ElearningEnrollment[]                            // cf. doc 02

  createdAt     DateTime              @default(now()) @map("created_at")
  updatedAt     DateTime              @updatedAt @map("updated_at")

  @@index([statut])
  @@index([formationId])
  @@index([ownerClientId])
  @@map("elearning_courses")
}
```

> **Réutilisation :** `formation` pointe vers le modèle `Formation` existant ; `ownerClient` vers `Client` existant. Aucune duplication. La relation `Formation.elearningCourses` et `Client."ClientCoursesProprietaires"` sont à ajouter côté modèles existants (champ inverse, additif).

---

## 4. Modèle `ElearningModule`

```prisma
model ElearningModule {
  id           String              @id @default(uuid())
  courseId     String              @map("course_id")
  course       ElearningCourse     @relation(fields: [courseId], references: [id], onDelete: Cascade)

  titre        String              @db.VarChar(250)
  description  String?
  ordre        Int                                              // position dans le cours (0-based)

  // Déverrouillage du module (drip/gating) — cf. doc 04 frontend
  unlockType   ElearningUnlockType @default(apres_precedent) @map("unlock_type")
  unlockDate   DateTime?           @map("unlock_date")          // si date_fixe
  unlockOffsetJours Int?           @map("unlock_offset_jours")  // si offset_inscription
  unlockQuizId String?             @map("unlock_quiz_id")       // si score_quiz (cf. doc 03)
  unlockScorePct Int?              @map("unlock_score_pct")     // seuil exigé

  lessons      ElearningLesson[]

  createdAt    DateTime            @default(now()) @map("created_at")
  updatedAt    DateTime            @updatedAt @map("updated_at")

  @@unique([courseId, ordre])
  @@index([courseId])
  @@map("elearning_modules")
}
```

---

## 5. Modèle `ElearningLesson`

```prisma
model ElearningLesson {
  id           String              @id @default(uuid())
  moduleId     String              @map("module_id")
  module       ElearningModule     @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  titre        String              @db.VarChar(250)
  type         ElearningLessonType
  ordre        Int

  // Contenu selon le type
  contenuJson  Json?               @map("contenu_json")         // blocs riches (texte/embed)
  videoAssetId String?             @map("video_asset_id")       // id Cloudflare Stream/Bunny
  videoDureeSec Int?               @map("video_duree_sec")
  pdfKey       String?             @map("pdf_key")              // R2
  quizId       String?             @map("quiz_id")              // si type=quiz (cf. doc 03)

  dureeEstimeeMinutes Int?         @map("duree_estimee_minutes") // microlearning : viser 2-10 min
  obligatoire  Boolean             @default(true)               // compte dans la complétion

  // Déverrouillage fin (granularité leçon — best practice 2026)
  unlockType   ElearningUnlockType @default(apres_precedent) @map("unlock_type")
  unlockDate   DateTime?           @map("unlock_date")
  unlockOffsetJours Int?           @map("unlock_offset_jours")
  unlockQuizId String?             @map("unlock_quiz_id")
  unlockScorePct Int?              @map("unlock_score_pct")

  resources    ElearningResource[]
  progress     LessonProgress[]                                  // cf. doc 02

  createdAt    DateTime            @default(now()) @map("created_at")
  updatedAt    DateTime            @updatedAt @map("updated_at")

  @@unique([moduleId, ordre])
  @@index([moduleId])
  @@index([quizId])
  @@map("elearning_lessons")
}
```

---

## 6. Modèle `ElearningResource` (médias rattachés)

```prisma
model ElearningResource {
  id         String          @id @default(uuid())
  lessonId   String          @map("lesson_id")
  lesson     ElearningLesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  titre      String          @db.VarChar(250)
  type       String          @db.VarChar(40)     // pdf | image | audio | fichier | sous_titres
  r2Key      String          @map("r2_key")      // clé Cloudflare R2
  mimeType   String?         @map("mime_type") @db.VarChar(120)
  sizeBytes  Int?            @map("size_bytes")
  telechargeable Boolean     @default(false)     // droit de téléchargement
  ordre      Int             @default(0)

  createdAt  DateTime        @default(now()) @map("created_at")

  @@index([lessonId])
  @@map("elearning_resources")
}
```

> **Réutilisation :** stockage via `src/lib/r2-storage.ts` (`uploadToR2`, `getSignedUrlR2`, upload direct navigateur via `getSignedUploadUrlR2`). La vidéo NE passe PAS par `r2Key` mais par `videoAssetId` (Cloudflare Stream) — cf. ADR-0005.

---

## 7. Champs inverses à ajouter aux modèles existants (additif)

```prisma
// model Formation { ... }
  elearningCourses ElearningCourse[]

// model Client { ... }
  coursesProprietaires ElearningCourse[] @relation("ClientCoursesProprietaires")
```

Ces ajouts sont des relations inverses **sans colonne** côté Formation/Client (la FK est portée par `ElearningCourse`) → migration purement additive, zéro risque.

---

## 8. Notes d'implémentation

- **Versionnage / publication :** `statut` + `version` + `publishedAt`. Un cours en `brouillon` est invisible des apprenants. La publication incrémente `version` (traçabilité). Workflow détaillé dans `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md`.
- **Ordre :** `@@unique([..., ordre])` garantit un ordonnancement stable ; le drag&drop de l'outil auteur réécrit les `ordre` en transaction.
- **Durées :** `dureeEstimeeMinutes` au niveau leçon (microlearning) ; agrégé au cours pour l'affichage et l'**information de durée** exigée par D.6313-3-1 §2 (conformité FOAD).
- **i18n :** FR canonique (EN désactivé). Champ `langue` prévu pour une extension future, sans surcoût maintenant.

## Liens

- `02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`
- `03-schema-quiz-evaluations.md` — `Quiz`, `Question`, `QuizAttempt` (référencés par `quizId`/`unlockQuizId`)
- `02-ARCHITECTURE/reutilisation-existant.md` — réutilisation `Formation`/`Client`/R2
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique des `unlock*`
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — édition de cette structure
