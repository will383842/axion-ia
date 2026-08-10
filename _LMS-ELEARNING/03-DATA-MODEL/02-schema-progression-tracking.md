# Data model — Suivi de progression & traçabilité (preuve FOAD)

Deuxième pilier du data model LMS. Ce document définit **l'accès** d'un apprenant à un cours (`ElearningEnrollment`), le **suivi fin** de sa progression (`LessonProgress` + agrégats `ModuleProgress` / `CourseProgress`) et le **journal d'événements horodatés** (`ElearningXapiStatement`) modélisé sur la grammaire xAPI (verbe/objet).

Ces tables constituent le **faisceau de preuves de réalisation FOAD** (R.6313-3 : preuve libre) exigé en contrôle OPCO / Qualiopi V8 (indicateurs 1, 6, 9, 10, **11 — majeur**, 12, 17, 19) et le socle « certification-ready » pour une activation CPF/EDOF ultérieure (ADR-LMS-0003).

**Conventions du repo respectées** (vérifiées sur `prisma/schema.prisma` réel) : UUID en `id`, `@map` snake_case pour colonnes et `@@map` pour tables, `@db.Citext` pour les emails, enums Prisma, index sur FK + colonnes filtrées, timestamps `createdAt`/`updatedAt`. **Migrations strictement additives** (ADR-LMS-0008 : CREATE TABLE + ADD COLUMN nullable, jamais de DROP). Code sous `src/server/elearning/**` (ADR-LMS-0007).

> ⚠️ **Note de typage des FK vers l'existant.** Les modèles LMS du doc 01 utilisent des PK `String @id @default(uuid())` (type Postgres `text`). Les modèles **existants** (`Trainee`, `Enrollment`, `Client`, `TrainingSession`, `DocumentGenere`) utilisent `@db.Uuid` (type Postgres `uuid`). Pour qu'une relation Prisma soit valide, **la colonne FK doit avoir exactement le même type que la PK référencée**. Donc : toute FK qui pointe vers `Trainee` / `Client` / `TrainingSession` / `Enrollment` / `DocumentGenere` est déclarée `@db.Uuid` ; toute FK qui pointe vers un modèle LMS (`ElearningCourse`, `ElearningModule`, `ElearningLesson`, `ElearningEnrollment`) reste `String` simple (text). Les exemples ci-dessous appliquent cette règle.

---

## 1. Vue d'ensemble

```
ElearningEnrollment (1 = "X a accès au cours Y", avec source + expiration)
 │   réutilise Trainee (apprenant) + ElearningCourse (cf. doc 01)
 │
 ├─ CourseProgress      (1:1 — agrégat global : %, statut, completedAt, certificat)
 ├─ ModuleProgress      (1 par module — agrégat : %, statut, déverrouillé ?)
 ├─ LessonProgress      (1 par leçon — détail : %, position vidéo, temps passé)
 └─ ElearningXapiStatement (N — journal horodaté verbe/objet = PREUVE brute)
```

**Pourquoi 3 niveaux d'agrégat ?**

- `LessonProgress` = **source de vérité fine** (reprise auto, heartbeat vidéo, complétion par leçon).
- `ModuleProgress` = **cache d'agrégat** par module : indispensable au **déverrouillage** (`unlockType = apres_precedent` / `score_quiz`) sans recompter toutes les leçons à chaque page (budget INP ≤ 100 ms).
- `CourseProgress` = **cache d'agrégat** au niveau cours : alimente le dashboard apprenant, le seuil de certificat (`ElearningCourse.seuilReussitePct`) et les exports de conformité.

> Les agrégats sont **dérivables** de `LessonProgress` + `QuizAttempt` (doc 03), mais on les **matérialise** pour la perf et pour figer la preuve (un agrégat = un instantané daté). Recalcul transactionnel par le service `progress-service.ts` à chaque mutation de `LessonProgress` (voir §8).

---

## 2. Enums (NEUF)

```prisma
/// Source d'octroi d'un accès e-learning — traçabilité commerciale & conformité.
enum ElearningEnrollmentSource {
  session_formation   // dérivé automatiquement d'un Enrollment présentiel/live réalisé
  achat               // commande e-commerce (Order, doc 05) — MVP : virement, V1 : CB
  octroi_manuel       // ouvert à la main par un admin (1 clic)
  import_masse        // import CSV d'une liste (entreprise) — provisioning en masse
  entreprise          // octroyé via un compte/contrat entreprise (multi-tenant V2)
}

/// État du droit d'accès (≠ progression). Pilote l'autorisation d'ouvrir le cours.
enum ElearningEnrollmentStatut {
  actif         // accès ouvert et utilisable
  suspendu      // gelé temporairement (impayé, litige) — accès refusé, données conservées
  expire        // expiresAt dépassé — accès refusé, données conservées (preuve)
  revoque       // retiré définitivement par admin — accès refusé, données conservées
  termine       // cours complété + certifié — accès lecture seule maintenu
}

/// État de progression d'un élément (leçon/module/cours). Modelé sur les états LMS standard.
enum ElearningProgressStatut {
  non_commence  // verrouillé OU ouvert mais jamais ouvert par l'apprenant
  en_cours      // au moins une interaction enregistrée
  termine       // critère de complétion atteint (cf. §8)
  echoue        // pour un module gaté par quiz : seuil non atteint après épuisement des tentatives
}

/// Verbes xAPI supportés (sous-ensemble du registre ADL — grammaire verbe/objet, ADR-LMS-0006).
/// On ne dépend PAS d'un LRS ; on stocke un statement minimal future-proof.
enum ElearningXapiVerb {
  launched      // a ouvert le cours / la leçon
  initialized   // a démarré la lecture d'un média
  progressed    // a avancé (heartbeat vidéo / scroll texte) — porte un percent
  paused        // a mis en pause
  resumed       // a repris (reprise auto)
  completed     // a terminé l'élément
  passed        // a réussi un quiz (seuil atteint)
  failed        // a échoué un quiz
  answered      // a répondu à une question (détail dans doc 03)
  experienced   // a consulté une ressource (pdf, embed)
  attended      // présence à une classe virtuelle (replay/embed) — passerelle FOAD
  submitted     // a rendu un devoir (lesson type=devoir) — preuve travail FOAD
}

/// Nature de l'objet ciblé par un statement xAPI (le "object" de la grammaire).
enum ElearningXapiObjectType {
  course
  module
  lesson
  quiz
  question
  resource
  devoir
}
```

---

## 3. Modèle `ElearningEnrollment` (NEUF) — le droit d'accès

Cœur de l'octroi d'accès (« ouvrir l'accès à qui on veut »). **Réutilise** `Trainee` (PAS de nouvelle table apprenant) et `ElearningCourse` (doc 01). Un même `Trainee` peut avoir N `ElearningEnrollment` (un par cours).

```prisma
model ElearningEnrollment {
  id          String                     @id @default(uuid())

  // ── Qui (réutilise Trainee — @db.Uuid obligatoire) ──────────────────────────
  traineeId   String                     @map("trainee_id") @db.Uuid
  trainee     Trainee                    @relation("TraineeElearningEnrollments", fields: [traineeId], references: [id], onDelete: Cascade)

  // ── Quoi (réutilise ElearningCourse, doc 01 — PK text) ──────────────────────
  courseId    String                     @map("course_id")
  course      ElearningCourse            @relation(fields: [courseId], references: [id], onDelete: Cascade)

  // ── D'où vient l'accès ──────────────────────────────────────────────────────
  source      ElearningEnrollmentSource
  /// Si source=session_formation : Enrollment présentiel/live d'origine (réutilise l'existant).
  enrollmentOrigineId String?            @map("enrollment_origine_id") @db.Uuid
  enrollmentOrigine   Enrollment?        @relation("EnrollmentToElearning", fields: [enrollmentOrigineId], references: [id], onDelete: SetNull)
  /// Si source=achat : commande e-learning (Order, doc 05). FK ajoutée quand doc 05 livré.
  orderId     String?                    @map("order_id")
  /// Si source=octroi_manuel : admin ayant ouvert l'accès (traçabilité RBAC).
  octroyeParId String?                   @map("octroye_par_id") @db.Uuid
  /// Multi-tenant (ADR-LMS-0002) : entreprise propriétaire du siège. Null en MVP individuel.
  clientId    String?                    @map("client_id") @db.Uuid
  client      Client?                    @relation("ClientElearningEnrollments", fields: [clientId], references: [id], onDelete: SetNull)

  // ── Cycle de vie de l'accès ──────────────────────────────────────────────────
  statut      ElearningEnrollmentStatut  @default(actif)
  /// Octroi (= "date d'inscription"). Base de calcul du drip offset_inscription (doc 01).
  accordeAt   DateTime                   @default(now()) @map("accorde_at")
  /// Entrée effective FOAD/EDOF = 1re connexion réelle substantielle (≠ accordeAt).
  /// Renseigné par progress-service au 1er statement `launched`. Clé pour EDOF (ADR-LMS-0003).
  premiereConnexionAt DateTime?          @map("premiere_connexion_at")
  /// Expiration de l'accès (null = illimité). Au-delà : statut→expire (cron).
  expiresAt   DateTime?                  @map("expires_at")
  /// Dernière activité (dérivée du dernier statement). Pilote les relances anti-décrochage (Ind.12).
  dernierAccesAt DateTime?              @map("dernier_acces_at")
  /// Motif si statut=suspendu/revoque (traçabilité).
  suspenduRaison String?               @map("suspendu_raison") @db.VarChar(300)

  // ── Conformité / certificat ──────────────────────────────────────────────────
  /// Certificat de réalisation émis (DocumentGenere, modèle officiel heures réalisées).
  certificatDocumentId String?           @map("certificat_document_id") @db.Uuid
  certificatDocument   DocumentGenere?   @relation("ElearningCertificat", fields: [certificatDocumentId], references: [id], onDelete: SetNull)
  certificatEmisAt     DateTime?         @map("certificat_emis_at")

  // ── Agrégats (relations inverses) ────────────────────────────────────────────
  courseProgress  CourseProgress?
  moduleProgress  ModuleProgress[]
  lessonProgress  LessonProgress[]
  statements      ElearningXapiStatement[]

  metadata    Json                       @default("{}")   // import CSV : ligne d'origine, etc.
  createdAt   DateTime                   @default(now()) @map("created_at")
  updatedAt   DateTime                   @updatedAt @map("updated_at")

  @@unique([traineeId, courseId], map: "elearning_enrollment_unique")
  @@index([traineeId])
  @@index([courseId])
  @@index([statut])
  @@index([clientId])
  @@index([source])
  @@index([expiresAt])
  @@index([dernierAccesAt])
  @@map("elearning_enrollments")
}
```

**Réutilisation explicite :**

- `Trainee` (`prisma/schema.prisma:5274`) — apprenant, PII chiffrée, **pas** de `passwordHash` (ajouté en additif par le doc 04 auth).
- `Enrollment` (`:5310`) — l'inscription présentiel/live d'origine (passerelle automatique session → e-learning).
- `Client` (`:4890`) — CRM entreprise (siège financé, multi-tenant V2).
- `DocumentGenere` (`:5507`) + `qrToken` — certificat de réalisation, **même pipeline** que les attestations Qualiopi.

**Champs inverses additifs à poser sur les modèles existants** (relations sans colonne, zéro risque) :

```prisma
// model Trainee { ... }
  elearningEnrollments ElearningEnrollment[] @relation("TraineeElearningEnrollments")

// model Enrollment { ... }
  elearningEnrollments ElearningEnrollment[] @relation("EnrollmentToElearning")

// model Client { ... }
  elearningEnrollments ElearningEnrollment[] @relation("ClientElearningEnrollments")

// model DocumentGenere { ... }
  elearningCertificats ElearningEnrollment[] @relation("ElearningCertificat")
```

---

## 4. Modèle `LessonProgress` (NEUF) — la source de vérité fine

Une ligne par couple (accès, leçon). Pilote la **reprise automatique** (best practice 2026 : `dernierePositionSec` persisté côté serveur), la barre de progression et le calcul de complétion.

```prisma
model LessonProgress {
  id            String                  @id @default(uuid())

  enrollmentId  String                  @map("enrollment_id")
  enrollment    ElearningEnrollment     @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  lessonId      String                  @map("lesson_id")
  lesson        ElearningLesson         @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  /// Dénormalisé pour requêtes/agrégats par module sans jointure (perf INP).
  moduleId      String                  @map("module_id")

  statut        ElearningProgressStatut @default(non_commence)

  // ── Progression média (vidéo/texte) ─────────────────────────────────────────
  /// % vu / lu (0–100). Vidéo : maxWatchedSec / dureeSec. Texte : scroll/checkpoints.
  percentVu     Int                     @default(0) @map("percent_vu")
  /// Position de reprise (secondes). Sert au "reprendre où j'en étais".
  dernierePositionSec Int               @default(0) @map("derniere_position_sec")
  /// Point le plus loin réellement atteint (anti-seek-to-end : on ne valide pas
  /// une vidéo en sautant à la fin). Base du calcul de percentVu vidéo.
  maxPositionSec Int                    @default(0) @map("max_position_sec")
  /// Temps réellement passé (somme des deltas heartbeat, en secondes). PREUVE FOAD
  /// (durée d'activité par leçon) — pas la durée de la vidéo, le temps actif réel.
  tempsPasseSec Int                     @default(0) @map("temps_passe_sec")
  /// Nb d'ouvertures de la leçon (engagement).
  nbVues        Int                     @default(0) @map("nb_vues")

  // ── Devoir (lesson.type=devoir) — preuve de travail FOAD ─────────────────────
  /// Clé R2 du fichier rendu par l'apprenant (cf. r2-storage.ts getSignedUploadUrlR2).
  devoirR2Key   String?                 @map("devoir_r2_key")
  devoirRenduAt DateTime?               @map("devoir_rendu_at")

  // ── Jalons ───────────────────────────────────────────────────────────────────
  premiereVueAt DateTime?               @map("premiere_vue_at")
  completedAt   DateTime?               @map("completed_at")
  /// Verrou affiché : true si la leçon est actuellement déverrouillée pour cet apprenant.
  /// Cache du calcul de unlock (doc 01) — recalculé par progress-service.
  estDeverrouille Boolean               @default(false) @map("est_deverrouille")

  createdAt     DateTime                @default(now()) @map("created_at")
  updatedAt     DateTime                @updatedAt @map("updated_at")

  @@unique([enrollmentId, lessonId], map: "lesson_progress_unique")
  @@index([enrollmentId])
  @@index([lessonId])
  @@index([moduleId])
  @@index([enrollmentId, statut])
  @@map("elearning_lesson_progress")
}
```

**Champ inverse additif** sur `ElearningLesson` (doc 01 prévoit déjà `progress LessonProgress[]` ligne 169 — rien à ajouter).

**Règles de mise à jour (service, pas DB)** :

- `percentVu` ne **décroît jamais** (monotone) ; `dernierePositionSec` peut reculer (reprise/seek).
- `maxPositionSec` = max courant ; un seek arrière n'invalide pas la progression acquise.
- `tempsPasseSec` accumule des deltas plafonnés (anti-triche léger : un delta heartbeat > intervalle attendu × 1,5 est tronqué — l'apprenant a laissé l'onglet ouvert).
- complétion vidéo : `maxPositionSec ≥ 0,95 × videoDureeSec` (anti seek-to-end).

---

## 5. Modèle `ModuleProgress` (NEUF) — agrégat par module

Cache d'agrégat indispensable au **déverrouillage** (`apres_precedent`, `score_quiz`) et à l'affichage du verrou + sa raison.

```prisma
model ModuleProgress {
  id            String                  @id @default(uuid())

  enrollmentId  String                  @map("enrollment_id")
  enrollment    ElearningEnrollment     @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  moduleId      String                  @map("module_id")
  module        ElearningModule         @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  statut        ElearningProgressStatut @default(non_commence)
  /// % de complétion du module = leçons obligatoires terminées / total obligatoires.
  percentComplet Int                    @default(0) @map("percent_complet")
  lecconsTerminees Int                  @default(0) @map("lecons_terminees")
  lecconsTotal   Int                    @default(0) @map("lecons_total")

  // ── Gating ───────────────────────────────────────────────────────────────────
  estDeverrouille Boolean               @default(false) @map("est_deverrouille")
  /// Raison affichée si verrouillé (best practice : "verrou AVEC sa raison").
  /// Ex. "Terminez le module précédent", "Réussissez le quiz (70 %)", "Disponible le 12/07".
  verrouRaison  String?                 @map("verrou_raison") @db.VarChar(300)
  /// Meilleur score quiz de gating obtenu (si unlockType=score_quiz). Cf. doc 03.
  meilleurScorePct Int?                 @map("meilleur_score_pct")
  /// Override admin : force le déverrouillage indépendamment des règles (traçé).
  overrideDeverrouille Boolean          @default(false) @map("override_deverrouille")
  overridePar   String?                 @map("override_par") @db.Uuid

  completedAt   DateTime?               @map("completed_at")
  createdAt     DateTime                @default(now()) @map("created_at")
  updatedAt     DateTime                @updatedAt @map("updated_at")

  @@unique([enrollmentId, moduleId], map: "module_progress_unique")
  @@index([enrollmentId])
  @@index([moduleId])
  @@map("elearning_module_progress")
}
```

**Champ inverse additif** sur `ElearningModule` (doc 01) :

```prisma
// model ElearningModule { ... }
  progress ModuleProgress[]
```

---

## 6. Modèle `CourseProgress` (NEUF) — agrégat global (1:1)

Instantané global par accès : alimente le dashboard, le seuil de certificat et les exports conformité. Relation **1:1** avec `ElearningEnrollment`.

```prisma
model CourseProgress {
  id            String                  @id @default(uuid())

  enrollmentId  String                  @unique @map("enrollment_id")
  enrollment    ElearningEnrollment     @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  /// Dénormalisé pour reporting par cours sans jointure.
  courseId      String                  @map("course_id")

  statut        ElearningProgressStatut @default(non_commence)
  /// % global = leçons obligatoires terminées / total (cache, recalculé).
  percentComplet Int                    @default(0) @map("percent_complet")
  modulesTermines Int                   @default(0) @map("modules_termines")
  modulesTotal   Int                    @default(0) @map("modules_total")
  lecconsTerminees Int                  @default(0) @map("lecons_terminees")
  lecconsTotal   Int                    @default(0) @map("lecons_total")

  // ── Temps & engagement (PREUVE FOAD : durée moyenne / réelle, D.6313-3-1 §2) ──
  /// Σ tempsPasseSec de toutes les leçons. Agrégat pour certificat & contrôle OPCO.
  tempsTotalSec Int                     @default(0) @map("temps_total_sec")

  // ── Réussite / certificat ────────────────────────────────────────────────────
  /// Score global de réussite (moyenne pondérée des quiz, cf. doc 03). Comparé à
  /// ElearningCourse.seuilReussitePct pour décider l'émission du certificat.
  scoreGlobalPct Int?                   @map("score_global_pct")
  reussite      Boolean                 @default(false)
  /// Complétion = 100 % des leçons obligatoires terminées (≠ réussite quiz).
  completedAt   DateTime?               @map("completed_at")

  // ── Jalons d'évaluation FOAD (Ind.11 — MAJEUR : évaluations qui jalonnent/concluent) ──
  evaluationsJalonsCount Int            @default(0) @map("evaluations_jalons_count")
  evaluationFinaleFaite  Boolean        @default(false) @map("evaluation_finale_faite")

  createdAt     DateTime                @default(now()) @map("created_at")
  updatedAt     DateTime                @updatedAt @map("updated_at")

  @@index([courseId])
  @@index([statut])
  @@map("elearning_course_progress")
}
```

---

## 7. Modèle `ElearningXapiStatement` (NEUF) — journal horodaté = PREUVE brute

Journal **append-only** des événements (ADR-LMS-0006 : grammaire xAPI verbe/objet, **sans dépendre d'un LRS**). C'est le **faisceau de preuves R.6313-3** (logs LMS) — complément des agrégats et des évaluations. Insertion par le service ; **jamais d'UPDATE/DELETE** (sauf purge de rétention).

```prisma
model ElearningXapiStatement {
  id            String                  @id @default(uuid())

  enrollmentId  String                  @map("enrollment_id")
  enrollment    ElearningEnrollment     @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  /// Acteur dénormalisé (Trainee) pour requêtes de preuve sans jointure. @db.Uuid.
  traineeId     String                  @map("trainee_id") @db.Uuid

  // ── Grammaire xAPI : actor (implicite = trainee) / verb / object ─────────────
  verb          ElearningXapiVerb
  objectType    ElearningXapiObjectType @map("object_type")
  /// Id de l'objet ciblé (lessonId / moduleId / quizId / questionId / resourceId / courseId).
  /// String simple (les objets LMS ont des PK text). Non typé FK : l'objet peut être archivé.
  objectId      String                  @map("object_id")

  // ── result (optionnel selon le verbe) ────────────────────────────────────────
  /// Pour progressed : % atteint au moment de l'event. Pour passed/failed : score.
  resultPercent Int?                    @map("result_percent")
  resultScoreRaw Int?                   @map("result_score_raw")
  resultScoreMax Int?                   @map("result_score_max")
  resultSuccess Boolean?                @map("result_success")
  /// Durée ISO 8601 (ex. "PT30S") ou secondes du segment concerné.
  resultDurationSec Int?                @map("result_duration_sec")

  // ── context (preuve forensique légère, RGPD-minimisé) ────────────────────────
  /// IP hachée SHA-256 (jamais en clair — aligné sur la pratique image-bank IP_HASH_SALT).
  ipHash        String?                 @map("ip_hash") @db.VarChar(64)
  userAgent     String?                 @map("user_agent") @db.VarChar(300)
  /// Position vidéo au moment de l'event (corrobore LessonProgress).
  positionSec   Int?                    @map("position_sec")
  /// Payload xAPI complet (extensions, sous-titres actifs, etc.) pour export futur LRS.
  raw           Json?

  /// Horodatage de l'événement (serveur — temps serveur, anti-triche). Indexé.
  occurredAt    DateTime                @default(now()) @map("occurred_at")
  createdAt     DateTime                @default(now()) @map("created_at")

  @@index([enrollmentId, occurredAt])
  @@index([traineeId, occurredAt])
  @@index([verb])
  @@index([objectType, objectId])
  @@index([occurredAt])
  @@map("elearning_xapi_statements")
}
```

**Champ inverse additif** sur `Trainee` (optionnel — on peut requêter par `traineeId` indexé sans relation déclarée ; si on déclare la relation il faut le champ inverse) :

```prisma
// model Trainee { ... }  (optionnel)
  elearningStatements ElearningXapiStatement[]
```

> Si on ne veut pas charger le modèle `Trainee` de relations, on **n'ajoute pas** le champ inverse et on retire la `@relation` côté statement en gardant `traineeId @db.Uuid` indexé comme simple colonne dénormalisée. **Décision recommandée : pas de relation déclarée vers Trainee** (statement = journal autonome), seul `enrollmentId` porte une vraie FK.

---

## 8. Logique de calcul (services — NEUF, `src/server/elearning/`)

Aucune logique métier en DB. Tout passe par des services transactionnels.

| Service (fichier cible)                               | Rôle                                                                                                                                                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/elearning/progress/progress-service.ts`   | `recordLessonProgress()` : upsert `LessonProgress`, recalcule `ModuleProgress` + `CourseProgress` en **une transaction Prisma**, émet le(s) `ElearningXapiStatement`, met à jour `dernierAccesAt` / `premiereConnexionAt`. |
| `src/server/elearning/progress/unlock-service.ts`     | Évalue les règles `ElearningUnlockType` (doc 01) par apprenant, écrit `estDeverrouille` + `verrouRaison` sur `ModuleProgress`/`LessonProgress`. Respecte `overrideDeverrouille`.                                           |
| `src/server/elearning/progress/completion-service.ts` | Décide complétion (100 % obligatoires) + réussite (`scoreGlobalPct ≥ seuilReussitePct`) ; déclenche l'émission du certificat.                                                                                              |
| `src/server/elearning/xapi/statement-emitter.ts`      | Construit/insère les statements (append-only) ; helper unique appelé par tous les autres services.                                                                                                                         |

**Chaîne typique (lecture vidéo)** : player → server action `recordHeartbeat` → `progress-service.recordLessonProgress()` → (1) upsert `LessonProgress` (percentVu/position/temps), (2) statement `progressed`, (3) recalc `ModuleProgress`, (4) si module complété → statement `completed` + recalc `CourseProgress`, (5) si cours complété + réussi → enqueue émission certificat.

**Endpoints / actions associés (doc 04)** :

- Server actions sous `src/server/elearning/actions/progress-actions.ts` : `recordHeartbeat`, `markLessonComplete`, `resumePosition`, `submitDevoir`.
- API route légère `src/app/api/elearning/heartbeat/route.ts` (`force-dynamic`, derrière auth apprenant) pour le heartbeat haute fréquence (sendBeacon-friendly), throttlé serveur (~1 statement/15 s/leçon).

---

## 9. Workers & crons (NEUF — BullMQ, convention `elearning-*-worker.ts`)

Sous `src/server/queue/workers/` (mêmes conventions que `image-bank-*-worker.ts`, `qualiopi-formation-*`), files déclarées dans `src/server/queue/queues.ts`.

| Worker / cron                                 | Rôle                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `elearning-progress-rollup-worker.ts`         | Recalcule à froid les agrégats (filet de sécurité si un calcul transactionnel a divergé) ; réconcilie `CourseProgress` nocturne.                              |
| `elearning-access-lifecycle-worker.ts` (cron) | Passe `statut → expire` quand `expiresAt` dépassé ; ferme les accès.                                                                                          |
| `elearning-relance-worker.ts` (cron)          | Détecte l'inactivité (`dernierAccesAt`) → relance anti-décrochage (Qualiopi **Ind.12**), via `email-worker` + React Email (doc 04/10). V1.                    |
| `elearning-certificat-worker.ts`              | Génère le certificat de réalisation (`DocumentGenere` + `qrToken`) à la complétion+réussite ; réutilise le pipeline PDF Qualiopi.                             |
| `elearning-xapi-purge-worker.ts` (cron)       | Purge les `ElearningXapiStatement` au-delà de la rétention logs technique (voir §10). Les **agrégats** (preuve de réalisation) sont conservés plus longtemps. |

---

## 10. Conformité — ce que ces tables prouvent

Mapping direct avec la mission FOAD (R.6313-3 : **preuve libre**, faisceau de preuves ; le relevé de connexion seul est insuffisant).

| Exigence                                                                                        | Donnée probante                                                                                            |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Entrée effective** (FOAD/EDOF)                                                                | `ElearningEnrollment.premiereConnexionAt` (1er `launched`)                                                 |
| **Suivi d'assiduité / activités réelles**                                                       | `LessonProgress.tempsPasseSec` + `nbVues` + `ElearningXapiStatement` (`progressed`/`completed`)            |
| **Durée moyenne** (D.6313-3-1 §2)                                                               | `CourseProgress.tempsTotalSec` + `ElearningCourse.dureeEstimeeMinutes` (doc 01)                            |
| **Évaluations qui jalonnent / concluent** (Ind.11 — MAJEUR)                                     | `CourseProgress.evaluationsJalonsCount` / `evaluationFinaleFaite` + `QuizAttempt` (doc 03)                 |
| **Travaux rendus** (preuve de travail)                                                          | `LessonProgress.devoirR2Key` / `devoirRenduAt` (lesson type=devoir)                                        |
| **Assistance technique ET pédagogique** (Ind.19 — seule obligation FOAD nommée)                 | traces tuteur RAG / messages (doc 04/09) + statements `experienced` ; ce doc fournit le squelette horodaté |
| **Certificat de réalisation** (heures réalisées, modèle officiel obligatoire depuis 01/06/2020) | `ElearningEnrollment.certificatDocumentId` → `DocumentGenere`                                              |
| **Logs LMS horodatés**                                                                          | `ElearningXapiStatement` (temps serveur, IP hachée)                                                        |

**Rétention (RGPD + obligations OF)** — appliquée par les workers de purge, **migrations additives** :

- Agrégats de réalisation (`CourseProgress`, `ModuleProgress`, `LessonProgress`) + certificat : **3 à 5 ans** (preuve de réalisation, L.6362-6) — alignés sur `DocumentGenere.suppressionPrevueAt` (5 ans).
- `ElearningXapiStatement` (logs techniques) : **6 mois à 1 an** (CNIL 2021-122) → `elearning-xapi-purge-worker`.
- Données financières/comptables associées (factures e-learning) : 6 ans fiscal / 10 ans comptable — portées par les modèles e-commerce (doc 05), pas ici.
- **RGPD effacement** : la suppression d'un `Trainee` (`deletedAt` + `RgpdDemande` existants) cascade sur `ElearningEnrollment` (`onDelete: Cascade`) → progression supprimée ; on conserve les agrégats anonymisés si une obligation légale de preuve l'exige (à arbitrer dans `08-CONFORMITE/05`).

> ⚠️ L'IP est **hachée SHA-256** (jamais en clair), réutilisant la convention `IP_HASH_SALT` déjà en place pour la banque d'images. Le proctoring n'est **pas** modélisé ici (high-stakes only, CNIL : proportionné/optionnel — doc 03 + 08).

---

## 11. Index & performances

- Lecture player (chemin chaud, budget INP) : `LessonProgress` lu par `@@unique([enrollmentId, lessonId])` (point read). Le rendu d'un module lit `ModuleProgress` (1 ligne) au lieu d'agréger N `LessonProgress`.
- Dashboard apprenant : 1 read `CourseProgress` par cours (`enrollmentId` unique).
- Heartbeat : écriture ciblée 1 ligne `LessonProgress` + 1 insert statement (throttlé serveur) → pas de fan-out coûteux.
- Exports conformité / reporting admin : `ElearningXapiStatement` filtré par `@@index([enrollmentId, occurredAt])` / `@@index([objectType, objectId])`.
- `force-dynamic` sur toutes les pages/handlers apprenant (derrière auth) → **compatible contrat build `stub.invalid`** (aucun appel DB au SSG ; rien à pré-rendre).

---

## 12. EXISTANT réutilisé vs NEUF (récap)

**Réutilisé (aucune duplication)** :

- `Trainee` (`schema.prisma:5274`), `Enrollment` (`:5310`), `Client` (`:4890`), `TrainingSession` (`:5148`), `DocumentGenere`+`qrToken` (`:5507`), `r2-storage.ts` (`getSignedUploadUrlR2` pour devoirs), `email-worker` + React Email, pipeline PDF Qualiopi (certificat), conventions BullMQ (`queues.ts`).

**Neuf (ce document)** :

- Tables : `elearning_enrollments`, `elearning_lesson_progress`, `elearning_module_progress`, `elearning_course_progress`, `elearning_xapi_statements`.
- Enums : `ElearningEnrollmentSource`, `ElearningEnrollmentStatut`, `ElearningProgressStatut`, `ElearningXapiVerb`, `ElearningXapiObjectType`.
- Champs inverses additifs sur `Trainee` / `Enrollment` / `Client` / `DocumentGenere` / `ElearningModule`.
- Services `progress-service` / `unlock-service` / `completion-service` / `statement-emitter` + workers `elearning-*`.

---

## Liens

- `01-schema-cours-modules-lecons.md` — `ElearningCourse` / `Module` / `Lesson` / `ElearningUnlockType` (référencés ici).
- `03-schema-quiz-evaluations.md` — `Quiz` / `Question` / `QuizAttempt` : alimentent `meilleurScorePct`, `scoreGlobalPct`, gating `score_quiz`, statements `passed`/`failed`/`answered`.
- `04-schema-comptes-acces-auth.md` — auth apprenant hybride (ajout `Trainee.passwordHash` nullable) ; protège les routes de progression.
- `05-schema-ecommerce-commandes.md` — `Order` (FK `ElearningEnrollment.orderId`, source=achat).
- `06-strategie-migrations.md` — séquence des migrations additives (ADR-LMS-0008).
- `04-BACKEND/01-services-domaine.md` & `03-workers-bullmq-crons.md` — implémentation des services/workers cités.
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` & `04-progression-deverrouillage.md` — consommateurs de ces tables (player, heartbeat, verrous).
- `08-CONFORMITE/01-foad-d6313-3-1.md`, `02-qualiopi-indicateurs-foad.md`, `05-rgpd-conservation-preuves.md`, `06-tracabilite-preuves-realisation.md` — exploitation de la preuve produite ici.
