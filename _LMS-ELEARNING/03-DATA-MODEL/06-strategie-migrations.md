# Data model — Stratégie de migrations Prisma (LMS e-learning)

> Document opérationnel pour une équipe dev senior. Décrit **comment** poser en
> base le data model LMS des docs `01`→`05` sans casser la prod : doctrine
> additive, arbitrage des types de PK, ordre des migrations, compatibilité build
> `stub.invalid`, seed démo (1 cours pilote), index/perfs, rollback.
>
> Source ADR : [`00-INDEX/DECISIONS-ARBITRAGES.md`](../00-INDEX/DECISIONS-ARBITRAGES.md)
> (ADR-LMS-0008 = migrations strictement additives ; 0007 = cloisonnement).
> Contrat plateforme : [`axionia/AGENTS.md`](../../AGENTS.md) (build GH Actions + magic string `stub.invalid`, ADR 0026).
>
> **Ce document fait foi sur les choix transverses de migration.** Quand un autre
> doc (01-05) diverge sur un point de bas niveau (type de PK notamment), c'est
> **ce fichier qui tranche** — cf. §1.3 (arbitrage explicitement délégué ici par
> le doc `05`, §7.1).

---

## 0. TL;DR (à lire avant d'écrire une migration)

1. **Jamais de DROP.** Pas de `DROP TABLE/COLUMN/TYPE`, pas de rename destructif,
   pas de `SET NOT NULL` sur une colonne existante peuplée. Une colonne ajoutée à
   une table existante est **toujours** `NULL` ou `DEFAULT`. Cf. §2.
2. **Une migration = un lot cohérent**, dossier
   `prisma/migrations/AAAAMMJJHHMMSS_elearning_<sujet>/migration.sql`. Le préfixe
   `elearning_` rend le domaine repérable parmi les 113 migrations existantes.
3. **Le build ne touche pas la DB.** Les migrations sont jouées **au runtime
   conteneur** par l'entrypoint Coolify (`prisma migrate deploy`), pas pendant
   `docker build` (qui tourne sous `DATABASE_URL=…stub.invalid…`). Une migration
   LMS ne peut donc pas casser le build. Cf. §3.
4. **Tout le domaine e-learning est en `@db.Uuid`** (PK et FK), comme **l'intégralité
   du schéma réel** (`Trainee`, `Client`, `Formation`, `Enrollment`,
   `TrainingSession`, `DocumentGenere`, `Invoice`, `Payment`… sont tous
   `String @id @default(uuid()) @db.Uuid`). C'est l'**arbitrage** de ce doc — il
   corrige les snippets `text` des docs 01/02/03 et débloque la FK
   `Invoice.orderId`/`Payment.orderId` (doc 05). Cf. §1.3.
5. **Le seed est idempotent (`upsert`)** + garde-fou prod : le cours pilote n'est
   semé qu'en dev/staging ou via flag explicite. Cf. §6.
6. **Toujours `prisma migrate diff` puis relecture humaine** du `.sql` : on retire
   tout `DROP …` que Prisma voudrait produire (déjà arrivé sur content-engine v2,
   cf. mémoire « dérive schéma↔migrations »).

---

## 1. Périmètre des objets à migrer

### 1.1 Tables NEUVES (`CREATE TABLE` pur — zéro risque)

Noms **réels** issus des docs `01`-`05` (vérifiés sur les `@@map`). Préfixe
`elearning_` partout.

| Doc  | Modèle Prisma               | Table (`@@map`)                  | Migration |
| ---- | --------------------------- | -------------------------------- | --------- |
| `01` | `ElearningCourse`           | `elearning_courses`              | M1        |
| `01` | `ElearningModule`           | `elearning_modules`              | M1        |
| `01` | `ElearningLesson`           | `elearning_lessons`              | M1        |
| `01` | `ElearningResource`         | `elearning_resources`            | M1        |
| `04` | `ElearningOrgMembership`    | `elearning_org_memberships`      | M2        |
| `04` | `ElearningAuthToken`        | `elearning_auth_tokens`          | M2        |
| `04` | `ElearningInvitation`       | `elearning_invitations`          | M2        |
| `04` | `ElearningImportBatch`      | `elearning_import_batches`       | M2        |
| `04` | `ElearningImportRow`        | `elearning_import_rows`          | M2        |
| `02` | `ElearningEnrollment`       | `elearning_enrollments`          | M3        |
| `02` | `LessonProgress`            | `elearning_lesson_progress`      | M3        |
| `02` | `ModuleProgress`            | `elearning_module_progress`      | M3        |
| `02` | `CourseProgress`            | `elearning_course_progress`      | M3        |
| `02` | `ElearningXapiStatement`    | `elearning_xapi_statements`      | M3        |
| `03` | `QuizBank`                  | `elearning_quiz_banks`           | M4        |
| `03` | `Question`                  | `elearning_questions`            | M4        |
| `03` | `QuestionChoice`            | `elearning_question_choices`     | M4        |
| `03` | `Quiz`                      | `elearning_quizzes`              | M4        |
| `03` | `QuizQuestion` (jonction)   | `elearning_quiz_questions`       | M4        |
| `03` | `QuizAttempt`               | `elearning_quiz_attempts`        | M4        |
| `03` | `QuizAttemptAnswer`         | `elearning_quiz_attempt_answers` | M4        |
| `05` | `ElearningOrder`            | `elearning_orders`               | M5        |
| `05` | `ElearningOrderItem`        | `elearning_order_items`          | M5        |
| `05` | `ElearningSeat`             | `elearning_seats`                | M5        |
| `05` | `ElearningCoupon`           | `elearning_coupons`              | M5        |
| `05` | `ElearningCouponRedemption` | `elearning_coupon_redemptions`   | M5        |

> **Pas de table certificat.** Le certificat de réalisation **réutilise**
> `DocumentGenere` + `qrToken` via la colonne `ElearningEnrollment.certificatDocumentId`
> (doc 02, §inverse `DocumentGenere`). Aucun modèle PDF neuf (roadmap MVP §7).
>
> **Pas de table de session apprenant.** L'auth apprenant **réutilise**
> `PortailAcces` (token 64 hex, cookie 90 j, révocable) pour les deux chemins
> (magic-link ET mot de passe) — doc 04, §4. On n'ajoute **que** des colonnes
> nullable d'audit (cf. §1.4).
>
> **Pas de table d'octroi (`access_grant`) distincte.** L'octroi se matérialise
> par `ElearningEnrollment` (source = `session_formation | achat | octroi_manuel |
import`) + `ElearningInvitation`/`ElearningSeat`. Inutile de doubler.
>
> **Vidéo (Cloudflare Stream, ADR-0005)** : au MVP, la leçon porte
> `ElearningLesson.videoAssetId` (UID Stream externe, **`VARCHAR`, pas de table**).
> Une éventuelle table de suivi de transcodage est définie par
> `04-BACKEND/07-pipeline-video-streaming.md` (non requise pour M1-M5).

### 1.2 Enums NEUFS (`CREATE TYPE`) — noms réels

```prisma
// doc 01 (figés)
enum ElearningCourseStatut { brouillon publie archive }
enum ElearningLessonType   { video texte pdf quiz embed devoir }
enum ElearningUnlockType   { immediat apres_precedent date_fixe offset_inscription score_quiz }

// doc 02
enum ElearningEnrollmentSource { session_formation achat octroi_manuel import }
enum ElearningEnrollmentStatut { actif termine suspendu revoque expire }
enum ElearningProgressStatut   { non_commence en_cours termine }
enum ElearningXapiVerb         { /* launched experienced completed passed failed answered … */ }
enum ElearningXapiObjectType   { /* course module lesson quiz question … */ }

// doc 03
enum QuestionType      { qcm_mono qcm_multi vrai_faux appariement texte_trous ordonnancement reponse_courte essai upload }
enum QuestionDifficulte{ facile moyen difficile }
enum CorrectionMode    { auto manuelle mixte }
enum QuizFinalite      { positionnement entrainement evaluation final_certificatif }
enum FeedbackMode      { immediat differe aucun }
enum QuizAttemptStatut { en_cours soumis corrige invalide }

// doc 04
enum LearnerAccountStatut          { invite actif suspendu }
enum ElearningOrgRole              { membre gestionnaire }
enum ElearningOrgMembershipStatut  { active suspendue revoquee }
enum ElearningAuthTokenPurpose     { magic_login password_reset password_setup email_verify }
enum ElearningInvitationStatut     { envoyee acceptee expiree revoquee }
enum ElearningImportStatut         { recu en_cours termine echoue }

// doc 05
enum ElearningOrderStatut       { brouillon en_attente_paiement payee octroyee annulee remboursee }
enum ElearningOrderPaymentMode  { virement octroi_manuel gratuit cb }   // cb dormant (STRIPE_ENABLED=false)
enum ElearningOrderItemType     { cours pack }
enum ElearningSeatStatut        { disponible invite attribue revoque }
enum ElearningCouponType        { pourcentage montant_fixe }
enum ElearningCouponStatut      { actif inactif expire }
```

> ⚠️ **`ALTER TYPE … ADD VALUE`** : pour ajouter plus tard une valeur d'enum (ex.
> nouveau `QuestionType`), créer une migration **isolée** ne contenant que
> `ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'nouvelle_valeur';`. Ne
> **jamais** mélanger un `ADD VALUE` et un **usage** de cette valeur dans la même
> migration (la valeur n'est utilisable qu'après commit). Toujours **en fin**
> d'enum (réordonner = destructif).

### 1.3 ⚠️ ARBITRAGE — Type des clés primaires LMS : **`@db.Uuid` partout**

**Contexte du conflit.** Le doc `01` a écrit ses snippets en `id String @id
@default(uuid())` (Postgres `text`). Les docs `02` et `03` ont **suivi** ce choix
(PK LMS `text`, FK-vers-LMS `text`, FK-vers-existant `@db.Uuid`). Le doc `05`
(§7.1) a relevé que cela **casse** la FK `Invoice.orderId @db.Uuid → ElearningOrder.id`
(mismatch `uuid` vs `text`) et a **explicitement délégué l'arbitrage à ce document**.

**Décision.** **Tout le domaine e-learning utilise `@db.Uuid`** — PK _et_ FK
internes — comme **l'intégralité du schéma réel** (`prisma/schema.prisma` : 100 %
des modèles métier sont `@db.Uuid`). Concrètement :

```prisma
// PARTOUT dans les modèles Elearning*/Quiz*/Question* :
id  String  @id @default(uuid()) @db.Uuid
// et toute FK interne (courseId, moduleId, lessonId, quizId, enrollmentId, …) :
courseId  String  @map("course_id") @db.Uuid
```

**Pourquoi cet arbitrage (et pas le `text` des docs 01/02/03)** :

1. **Homogénéité du schéma** : un îlot `text` au milieu de ~7 300 lignes en
   `uuid` est une dette permanente (jointures hétérogènes, surprises ORM).
2. **FK financières natives** : `Invoice.orderId`/`Payment.orderId` (`@db.Uuid`)
   pointent directement sur `elearning_orders.id` — l'option **retenue** par le
   doc 05, sans repli `text`.
3. **Coût nul** : ces tables sont **toutes neuves**. Choisir `uuid` à la création
   ne coûte rien (aucun backfill, aucune réécriture).
4. **`uuid` natif Postgres** : index plus compacts et comparaisons plus rapides
   que `text` (B-tree 16 o vs chaîne 36 o).

**Conséquence opérationnelle.** Les snippets des docs `01`, `02`, `03` montrant
`String @id @default(uuid())` (sans `@db.Uuid`) et leurs FK-vers-LMS en `text`
**doivent être lus/mis à jour comme `@db.Uuid`** au moment d'écrire
`schema.prisma`. C'est un changement **mécanique** (ajout du token `@db.Uuid`),
sans impact sémantique. Les FK-vers-existant restaient déjà `@db.Uuid` → rien à
changer côté `Trainee`/`Client`/`Enrollment`/`DocumentGenere`/`Invoice`.

> Note : ce n'est PAS une violation de la doctrine additive — aucune table
> n'existe encore. C'est un choix de **création**.

### 1.4 Modèles EXISTANTS à étendre (additif)

Tous **additifs** : `ADD COLUMN` nullable/`DEFAULT`, relâchement de `NOT NULL`
(non destructif), ou relation inverse **sans colonne**.

**`Trainee`** (`schema.prisma:5274`, `trainees`) — l'apprenant **est** un
`Trainee` (identité unique ; pas de table `LearnerAccount` séparée — doc 04, §3).
`ADD COLUMN` **toutes nullable / avec défaut** :

- `password_hash VARCHAR(255) NULL` (argon2id, SSOT `src/lib/auth-password.ts` ; NULL = passwordless magic-link — ADR-0001),
  `password_set_at`, `email_verified_at`, `last_login_at`, `last_login_ip VARCHAR(64)`, `last_login_method VARCHAR(20)`,
- `learner_statut "LearnerAccountStatut" NOT NULL DEFAULT 'invite'` (NOT NULL **autorisé** car `DEFAULT` fourni → PG remplit les lignes existantes),
- `failed_login_count INTEGER NOT NULL DEFAULT 0`, `locked_until`,
- `primary_organisation_client_id UUID NULL` (FK → `clients.id` SET NULL ; scoping multi-tenant V2 posé maintenant — ADR-0002),
- `preferences_json JSONB NULL`.
- Index ajoutés : `(learner_statut)`, `(primary_organisation_client_id)`.

**`PortailAcces`** (`schema.prisma:6236`, `portail_acces`) — session unifiée
(magic-link + mot de passe). `ADD COLUMN` nullable seulement :

- `auth_method VARCHAR(20)`, `created_ip VARCHAR(64)`, `user_agent TEXT`, `last_ip VARCHAR(64)`, `device_label VARCHAR(120)`.
- Index ajouté : `(expires_at)` (purge des sessions expirées par cron).

**`Invoice`** (`invoices`) et **`Payment`** (`payments`) — doc 05, §7. **Deux
changements additifs** par table :

1. `ALTER COLUMN booking_id DROP NOT NULL` → **relâchement** de contrainte
   (non destructif : aucune donnée modifiée ; les factures booking existantes
   gardent leur `booking_id`).
2. `ADD COLUMN order_id UUID NULL` + FK → `elearning_orders.id` `ON DELETE SET NULL`
   - `@@index([order_id])`.
3. `ADD CONSTRAINT <table>_booking_or_order_chk CHECK (booking_id IS NOT NULL OR order_id IS NOT NULL)`
   — **validable sans erreur** : toutes les lignes existantes ont `booking_id` non
   NULL, donc satisfont le CHECK.
   > ⚠️ Ces deux `ALTER` vivent dans la migration **M5** (après `CREATE TABLE
elearning_orders`), car la FK référence `elearning_orders`.

**Relations inverses (0 SQL — FK portée par la table neuve)** :

```prisma
// Formation  : elearningCourses ElearningCourse[]
// Client     : coursesProprietaires / elearningMemberships / traineesPrincipaux
//              / elearningInvitations / elearningImports / elearningEnrollments / elearningOrders
// AdminUser  : elearningMembershipsCrees / elearningInvitations / elearningImports / elearningOrdersCreated
// Enrollment : elearningEnrollments ElearningEnrollment[] @relation("EnrollmentToElearning")
// DocumentGenere : elearningCertificat (back-relation de ElearningEnrollment.certificatDocument)
// EvaluationAcquis : quizAttempt (projection QuizAttempt → EvaluationAcquis, doc 03)
```

> ✅ Côté tables existantes, Prisma n'émet **aucun** `ALTER TABLE` pour ces
> inverses. Le `.sql` ne doit toucher `trainees`/`portail_acces`/`invoices`/`payments`
> **que** pour les `ADD COLUMN`/`ALTER`/`ADD CONSTRAINT` listés ci-dessus.

### 1.5 Extensions Postgres

`citext`, `pg_trgm`, `unaccent`, `uuid-ossp`, `vector` sont **déjà installées**
(migrations `20260508175629_init`, `20260514020000_kb_v4_pgvector_embeddings`).
**Aucune nouvelle extension** pour M1-M5. Le tuteur RAG (V1, doc `09`) réutilisera
`vector` (pgvector) **déjà présent**.

---

## 2. Doctrine additive (règles dures — ADR-LMS-0008)

| Interdit ❌                                                                  | À faire ✅                                                                              |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `DROP TABLE` / `DROP COLUMN`                                                 | Garder, marquer `/// @deprecated`, cesser d'écrire                                      |
| `DROP TYPE` / retirer une valeur d'enum                                      | `ADD VALUE IF NOT EXISTS` (migration isolée)                                            |
| `ALTER COLUMN … SET NOT NULL` sur table existante peuplée                    | 3 temps : `ADD COLUMN NULL` → backfill → `SET NOT NULL` ultérieur prouvé                |
| `RENAME COLUMN`/`RENAME TABLE`                                               | Nouvelle colonne + copie, garder l'ancienne                                             |
| Changer un type incompatible (`text`→`int`, `text`→`uuid` sur table peuplée) | Nouvelle colonne typée + backfill + bascule applicative                                 |
| `CREATE UNIQUE INDEX` sur table peuplée à doublons possibles                 | Vérifier l'absence de doublons d'abord                                                  |
| **`ALTER COLUMN … DROP NOT NULL` (relâcher)**                                | ✅ **PERMIS** — non destructif. Utilisé pour `invoices`/`payments.booking_id` (§1.4).   |
| `ADD COLUMN … NOT NULL` **avec** `DEFAULT` sur table existante               | ✅ PERMIS (PG remplit l'existant). Ex. `trainees.failed_login_count`, `learner_statut`. |

**Colonne neuve sur table existante** : `NULL` ou `DEFAULT`. Les tables LMS étant
neuves, leurs colonnes internes peuvent être `NOT NULL` (table vide).

**Index** : sur tables NEUVES (vides), `CREATE INDEX` simple est instantané.
`CREATE INDEX CONCURRENTLY` est **interdit en transaction** (Prisma joue la
migration dans une tx) → réservé à un ajout futur sur grosse table peuplée, hors
pipeline (§7).

---

## 3. Compatibilité build `stub.invalid` (contrat plateforme)

```
git push main → GH Actions:
  job build  : docker build (DATABASE_URL=…stub.invalid…, SKIP_ENV_VALIDATION=true,
               BULLMQ_DISABLED=true) → prisma generate + next build → push GHCR
  job deploy : Coolify pull → restart → entrypoint `prisma migrate deploy`
               (DATABASE_URL RÉEL) → healthcheck
```

**Les migrations LMS sont jouées au runtime conteneur, jamais au build.** Le build
ne fait que `prisma generate` (pas de connexion DB) + `next build`. Donc :

1. **`schema.prisma` doit compiler** (`pnpm prisma validate`) — c'est tout ce que
   le build exige.
2. **Le stub Proxy couvre déjà les nouveaux modèles** : `src/lib/prisma.ts`
   intercepte génériquement `prisma.<modèle>.<méthode>` → `[] / null / 0`.
   `prisma.elearningCourse.findMany()` au SSG → `[]`. **Aucune modif de `prisma.ts`.**
3. **Pages e-learning derrière auth + `force-dynamic`** (ADR-0007 :
   `src/app/[locale]/portail/**`, admin e-learning). Non pré-rendues → zéro call
   Prisma sous stub. Vérifier `export const dynamic = "force-dynamic"` sur chaque
   page apprenant/admin (cf. doc 03 : `…/quiz/[quizId]/page.tsx` force-dynamic).
4. **Catalogue public e-learning (V1, SEO JSON-LD `Course`)** : si une page SSG/ISR
   liste `elearning_courses` au build → reçoit `[]` du stub → page vide repeuplée
   par ISR `revalidate=3600`. Pattern identique aux sub-sitemaps `knowledge-*`. Au
   besoin : early-exit `if (process.env.DATABASE_URL?.includes("stub.invalid")) return <fallback/>`.
5. **Workers `elearning-*-worker.ts`** : `BULLMQ_DISABLED=true` au build → pas de
   connexion Redis. Ne pas instancier de client Redis au top-level d'un module
   importé par une page SSG.
6. **Seed** : `pnpm db:seed` n'est **jamais** lancé au build ni par l'entrypoint
   Coolify (qui ne fait que `migrate deploy`). Manuel (§6).

> ✅ **Checklist build-safety** : (a) `pnpm prisma validate` ; (b) `prisma generate`
> OK ; (c) aucune page **statique** publique n'appelle un modèle LMS via une
> méthode hors stub ; (d) `pnpm build` local sous `DATABASE_URL=…stub.invalid…` passe.

---

## 4. Ordre des migrations & graphe de FK

Aligné sur la roadmap (`11-ROADMAP/01`). **Une migration par lot fonctionnel.**
Les FK imposent l'ordre.

```
M1 elearning_core
   ├─> M2 elearning_auth_access   (invitations.course_id → courses : FK applicative)
   ├─> M3 elearning_progression   (enrollments.course_id → courses ; +certificat_document_id → documents_generes)
   │       └─> M4 elearning_quiz  (quiz_attempts.enrollment_id → enrollments ; Quiz.lesson_id → lessons)
   └─────────> M5 elearning_ecommerce (seats/orders ; + ALTER invoices/payments)
```

**Graphe de FK contraintes (qui référence quoi)** :

- `elearning_modules.course_id` → `elearning_courses` (CASCADE) — M1
- `elearning_lessons.module_id` → `elearning_modules` (CASCADE) — M1
- `elearning_resources.lesson_id` → `elearning_lessons` (CASCADE) — M1
- `elearning_courses.formation_id` → `formations` (SET NULL), `.owner_client_id` → `clients` (SET NULL) — M1
- `elearning_org_memberships.{trainee_id,client_id}` → `trainees`/`clients` (CASCADE), `.invited_by_admin_id` → `admin_users` (SET NULL) — M2
- `elearning_auth_tokens.trainee_id` → `trainees` (CASCADE) — M2
- `elearning_invitations.{trainee_id,client_id,invited_by_admin_id,import_batch_id}` (SET NULL/SET NULL/SET NULL/SET NULL) — M2
- `elearning_import_rows.batch_id` → `elearning_import_batches` (CASCADE) — M2
- `elearning_enrollments.{trainee_id}` → `trainees` (CASCADE), `.course_id` → `elearning_courses` (CASCADE), `.enrollment_origine_id` → `enrollments` (SET NULL), `.client_id` → `clients` (SET NULL), `.certificat_document_id` → `documents_generes` (SET NULL) — M3
- `elearning_{lesson,module,course}_progress.enrollment_id` → `elearning_enrollments` (CASCADE) ; `.lesson_id`/`.module_id` → leçons/modules — M3
- `elearning_xapi_statements.enrollment_id` → `elearning_enrollments` (CASCADE), `.actor_trainee_id` → `trainees` — M3
- `elearning_quizzes.lesson_id` → `elearning_lessons` (SET NULL, **unique**, relation `LessonQuiz`) ; `.course_id` → `elearning_courses` — M4
- `elearning_questions.quiz_id`?/`.bank_id`? + `elearning_quiz_questions.{quiz_id,question_id}` (CASCADE) — M4
- `elearning_quiz_attempts.{quiz_id}` (CASCADE), `.trainee_id` → `trainees`, `.enrollment_id` → `elearning_enrollments` (SET NULL) — M4
- `elearning_quiz_attempt_answers.attempt_id` → `elearning_quiz_attempts` (CASCADE) — M4
- `elearning_order_items.order_id` → `elearning_orders` (CASCADE), `.course_id` → `elearning_courses` (SET NULL) — M5
- `elearning_seats.{order_id}` (CASCADE), `.beneficiaire_trainee_id` → `trainees` (SET NULL), `.enrollment_id` → `elearning_enrollments` (SET NULL) — M5
- `elearning_coupon_redemptions.{coupon_id,order_id}` (CASCADE/CASCADE) — M5
- `invoices.order_id` / `payments.order_id` → `elearning_orders` (SET NULL) + CHECK — M5

### 4.1 FK **applicatives** (volontairement NON contraintes côté Prisma)

Pour rester additif et **éviter les cycles**, certaines références sont des FK
**applicatives** (validées en service, pas de contrainte SQL) — décision des docs
01/03 :

- `ElearningLesson.quizId` (pointeur leçon→quiz, type=quiz) et les **`unlockQuizId`**
  de `ElearningModule`/`ElearningLesson` (gating par score) → référencent `Quiz.id`
  **sans contrainte** (intégrité dans `src/server/elearning/quiz/unlock-engine.ts`).
  → **Pas de cycle** : la seule FK contrainte lesson↔quiz est `Quiz.lessonId →
elearning_lessons` (créée en M4, pointe vers M1 déjà présent). Aucun
  `ADD CONSTRAINT` différé nécessaire pour le quiz.
- `ElearningEnrollment.orderId` (doc 02) → `ElearningOrder.id` : **applicative
  jusqu'à M5**. Option en M5 : `ADD CONSTRAINT elearning_enrollments_order_id_fkey
… ON DELETE SET NULL` (additif) une fois `elearning_orders` créée. Recommandé
  pour l'intégrité ; sinon laisser applicative.
- `Question.sourceLessonId` (doc 03, leçon d'origine d'une question générée) →
  applicative (évite le couplage avec doc 01).

> **Conséquence** : M1→M5 n'ont **aucun cycle de dépendance**. Chaque migration ne
> référence (en contrainte) que des tables déjà créées par une migration
> antérieure ou existantes. Pas de migration « géante », pas de `ADD CONSTRAINT`
> différé sauf l'option `enrollment.order_id` en M5.

---

## 5. Liste nominale des migrations (contenu logique)

> Timestamps indicatifs (régénérés au `prisma migrate dev --create-only`). Chaque
> `.sql` débute par un bandeau « Migration ADDITIVE — aucun DROP » (cf.
> `20260620130000_console_documents`). PK/FK en `UUID` (§1.3).

### M1 — `AAAAMMJJ_elearning_core` (doc 01)

**Dépend de** : `formations`, `clients`.

- `CREATE TYPE` : `ElearningCourseStatut`, `ElearningLessonType`, `ElearningUnlockType`.
- `CREATE TABLE` : `elearning_courses`, `elearning_modules`, `elearning_lessons`, `elearning_resources`.
- `elearning_courses` : `slug CITEXT UNIQUE`, `titre`, `objectifs/prerequis JSONB DEFAULT '[]'`, `duree_estimee_minutes`, `statut DEFAULT 'brouillon'`, `version DEFAULT 1`, `est_foad BOOLEAN DEFAULT true`, `seuil_reussite_pct INT DEFAULT 70`, `vendable_seul BOOLEAN DEFAULT false`, `image_couverture_key`, `formation_id`→formations (SET NULL), `owner_client_id`→clients (SET NULL).
- `elearning_lessons` : `type`, `contenu_json JSONB`, `video_asset_id VARCHAR` (UID Stream, **pas de FK**), `pdf_key`, `quiz_id UUID NULL` (**applicative**, §4.1), `unlock_quiz_id UUID NULL` (applicative), `unlock_*`, `obligatoire BOOLEAN DEFAULT true`.
- `elearning_modules` : `unlock_type DEFAULT 'apres_precedent'`, `unlock_date`, `unlock_offset_jours`, `unlock_quiz_id UUID NULL` (applicative), `unlock_score_pct`.
- FK contraintes : modules→courses (CASCADE), lessons→modules (CASCADE), resources→lessons (CASCADE), courses→formations/clients (SET NULL).
- Index/uniques : `@@unique([course_id, ordre])`, `@@unique([module_id, ordre])`, `courses(statut)`, `courses(formation_id)`, `courses(owner_client_id)`, `lessons(module_id)`, `lessons(quiz_id)`, `resources(lesson_id)`.

### M2 — `AAAAMMJJ_elearning_auth_access` (doc 04 — auth apprenant + provisioning)

**Dépend de** : M1, + `trainees`, `clients`, `admin_users`.

- **`ALTER TABLE trainees`** : `ADD COLUMN` (§1.4) `password_hash`, `password_set_at`, `email_verified_at`, `learner_statut DEFAULT 'invite'`, `failed_login_count DEFAULT 0`, `locked_until`, `last_login_at`, `last_login_ip`, `last_login_method`, `primary_organisation_client_id UUID` (FK clients SET NULL), `preferences_json JSONB`. `+@@index(learner_statut)`, `(primary_organisation_client_id)`.
- **`ALTER TABLE portail_acces`** : `ADD COLUMN` `auth_method`, `created_ip`, `user_agent`, `last_ip`, `device_label`. `+@@index(expires_at)`.
- `CREATE TYPE` : `LearnerAccountStatut`, `ElearningOrgRole`, `ElearningOrgMembershipStatut`, `ElearningAuthTokenPurpose`, `ElearningInvitationStatut`, `ElearningImportStatut`.
- `CREATE TABLE` :
  - `elearning_org_memberships` (Trainee × Client + rôle/statut siège, multi-tenant V2 prêt) : `@@unique([trainee_id, client_id])`, `@@index([client_id, statut])`.
  - `elearning_auth_tokens` (one-shot **hachés** SHA-256, `purpose`, `expires_at`, `used_at`) : `token_hash VARCHAR(64) UNIQUE`, `@@index([trainee_id, purpose])`, `(expires_at)`.
  - `elearning_invitations` (`email CITEXT`, `token_hash UNIQUE`, `course_id UUID NULL` applicative, `org_role`, `statut`, `import_batch_id` SET NULL) : `@@index([email])`, `(statut)`, `(client_id)`, `(import_batch_id)`.
  - `elearning_import_batches` (`csv_r2_key`, `statut`, compteurs, `created_by_admin_id` SET NULL) : `@@index([client_id])`, `(statut)`.
  - `elearning_import_rows` (`batch_id` CASCADE, `ligne`, `raw_json`, `statut`) : `@@unique([batch_id, ligne])`, `@@index([batch_id, statut])`.

### M3 — `AAAAMMJJ_elearning_progression` (doc 02 — progression + preuve FOAD)

**Dépend de** : M1, + `trainees`, `enrollments`, `clients`, `documents_generes`.

- `CREATE TYPE` : `ElearningEnrollmentSource`, `ElearningEnrollmentStatut`, `ElearningProgressStatut`, `ElearningXapiVerb`, `ElearningXapiObjectType`.
- `CREATE TABLE` :
  - `elearning_enrollments` : `trainee_id`→trainees (CASCADE), `course_id`→courses (CASCADE), `source`, `enrollment_origine_id`→enrollments (SET NULL, octroi auto session→e-learning), `order_id UUID NULL` (**applicative** jusqu'à M5), `octroye_par_id UUID NULL`, `client_id`→clients (SET NULL), `statut DEFAULT 'actif'`, `accorde_at`, `premiere_connexion_at` (entrée effective FOAD/EDOF), `expires_at`, `dernier_acces_at`, `certificat_document_id`→documents_generes (SET NULL, **réutilise certificat**), `metadata JSONB DEFAULT '{}'`. `@@unique([trainee_id, course_id])` + `@@index` (trainee/course/statut/client/source/expires_at/dernier_acces_at).
  - `elearning_lesson_progress` : `enrollment_id` (CASCADE), `lesson_id` (CASCADE), `module_id`, `statut`, `watch_seconds`, `last_position_seconds` (**reprise auto persistée serveur**), `completed_at`. `@@unique([enrollment_id, lesson_id])`, `+@@index([enrollment_id, statut])`.
  - `elearning_module_progress` : `@@unique([enrollment_id, module_id])`.
  - `elearning_course_progress` : `enrollment_id UNIQUE` (1-1), agrégats (`percent_complet`, `temps_total_sec`, `score_global_pct`, `reussite`, jalons FOAD Ind.11). `@@index([course_id])`, `(statut)`.
  - `elearning_xapi_statements` (**append-only**, preuve R.6313-3) : `actor_trainee_id`, `verb`, `object_type`, `object_id`, `result_json JSONB`, `occurred_at`, `ip_hash VARCHAR(64)`. `@@index([enrollment_id, occurred_at])`, `(actor_trainee_id, occurred_at)`, `(verb)`, `(object_type, object_id)`, `(occurred_at)`.

### M4 — `AAAAMMJJ_elearning_quiz` (doc 03 — moteur quiz + gating par score)

**Dépend de** : M1, M3, + `trainees`, `evaluations_acquis`.

- `CREATE TYPE` : `QuestionType`, `QuestionDifficulte`, `CorrectionMode`, `QuizFinalite`, `FeedbackMode`, `QuizAttemptStatut`.
- `CREATE TABLE` :
  - `elearning_quiz_banks` (banque de questions réutilisables).
  - `elearning_questions` : `bank_id`?, `type`, `enonce`, `difficulte`, `ponderation`, `rationale`, `source_lesson_id UUID NULL` (**applicative**), `media_r2_key`.
  - `elearning_question_choices` : `question_id` (CASCADE), `libelle`, `est_correct`, `ordre`, `appariement_cle` (pour `appariement`).
  - `elearning_quizzes` : `lesson_id UUID UNIQUE NULL`→lessons (SET NULL, relation `LessonQuiz`), `course_id`→courses, `finalite DEFAULT 'evaluation'`, `seuil_reussite_pct DEFAULT 70`, `nb_tentatives_max NULL`, `tirage_aleatoire_n NULL` (N parmi M), `shuffle_questions BOOLEAN`, `shuffle_choix BOOLEAN`, `feedback_mode`, `correction_mode`, `temps_limite_sec NULL` (temps **serveur**, anti-triche léger), `is_certificatif?`. `@@index([course_id])`, `(finalite)`.
  - `elearning_quiz_questions` (jonction quiz↔question, ordre/pondération par quiz) : `@@unique([quiz_id, question_id])`, `@@unique([quiz_id, ordre])`.
  - `elearning_quiz_attempts` : `quiz_id` (CASCADE), `trainee_id`, `enrollment_id` (SET NULL), `numero_tentative`, `statut`, `score_pct`, `reussi`, `started_at`, `submitted_at`, `corrected_at`, `temps_passe_sec`. `@@unique([quiz_id, enrollment_id, numero_tentative])`, `@@index([quiz_id])`.
  - `elearning_quiz_attempt_answers` : `attempt_id` (CASCADE), `question_id`, `reponse_json JSONB`, `correct BOOLEAN NULL` (NULL = attente correction manuelle), `points_obtenus`. `@@unique([attempt_id, question_id])`.
- **Gating par score** (vraie note, pas attempt-only) : `unlock-engine.ts` lit le
  meilleur `QuizAttempt.score_pct` réussi sur `unlockQuizId` ≥ `unlockScorePct`.
  Aucune table dédiée ; override admin via `ElearningEnrollment.metadata`.
- **Projection Qualiopi** : un attempt `final_certificatif` réussi peut créer une
  ligne `EvaluationAcquis` (réutilisé) → relation inverse `EvaluationAcquis.quizAttempt` (0 SQL).

### M5 — `AAAAMMJJ_elearning_ecommerce` (doc 05 — commandes, Stripe ÉTEINT)

**Dépend de** : M1, M3, + `clients`, `trainees`, `admin_users`, `invoices`, `payments`.

- `CREATE TYPE` : `ElearningOrderStatut`, `ElearningOrderPaymentMode`, `ElearningOrderItemType`, `ElearningSeatStatut`, `ElearningCouponType`, `ElearningCouponStatut`.
- `CREATE TABLE` :
  - `elearning_orders` : `reference UNIQUE`, `client_id`/`trainee_id` (SET NULL), `statut DEFAULT 'en_attente_paiement'`, `montant_ht_cents`, `tva_cents`, `payment_mode DEFAULT 'virement'` (`cb` dormant), `created_by_admin_id` (SET NULL), `paid_at`, `granted_at`. Prix issus de `pricing.ts` (SSOT). `@@index` (client/trainee/statut).
  - `elearning_order_items` : `order_id` (CASCADE), `course_id` (SET NULL), `item_type`, `quantite DEFAULT 1` (sièges), `prix_unitaire_ht_cents`.
  - `elearning_seats` : `order_id` (CASCADE), `course_id`, `statut DEFAULT 'disponible'`, `beneficiaire_email CITEXT`, `beneficiaire_trainee_id` (SET NULL), `enrollment_id` (SET NULL), `expires_at`. `@@index` (statut/beneficiaire). Octroi → crée `ElearningEnrollment`.
  - `elearning_coupons` : `code CITEXT UNIQUE`, `type`, `valeur`, `statut`, `date_debut/fin`, quotas.
  - `elearning_coupon_redemptions` : `coupon_id` (CASCADE), `order_id` (CASCADE).
- **`ALTER TABLE invoices`** (§1.4) : `ALTER COLUMN booking_id DROP NOT NULL` ; `ADD COLUMN order_id UUID` + FK→elearning_orders (SET NULL) ; `ADD CONSTRAINT invoices_booking_or_order_chk CHECK (booking_id IS NOT NULL OR order_id IS NOT NULL)` ; `@@index([order_id])`.
- **`ALTER TABLE payments`** : idem (`booking_id DROP NOT NULL`, `order_id`+FK, CHECK `payments_booking_or_order_chk`, index). Provider/Type/Status RÉUTILISÉS (MVP : `provider=manual_wire`, `type=balance`).
- **Optionnel** : `ADD CONSTRAINT elearning_enrollments_order_id_fkey` (rend contrainte la FK applicative `enrollment.order_id`, §4.1).
- **MVP** : `payment_mode ∈ {virement, octroi_manuel, gratuit}` ; octroi des sièges
  déclenché par l'admin (`STRIPE_ENABLED=false` → `cb` inerte ; ADR-0004).

> **Migrations futures (post-MVP, additives, pour mémoire)** : `elearning_tenant_v2`
> (admin entreprise délégué/branding/scoping — ADR-0002 V2) ; `elearning_tutor_rag`
> (réutilise pgvector existant — V1, doc 09) ; `elearning_edof` (entrée effective /
> service fait, derrière `EDOF_ENABLED` — ADR-0003 V2) ; `elearning_scorm_xapi`
> (si besoin commercial — ADR-0006). La vidéo (table de transcodage éventuelle)
> relève de `04-BACKEND/07`.

---

## 6. Seed démo — 1 cours pilote (MVP)

**Fichier** : `prisma/seeds/elearning/index.ts` (+ `demo.ts`), branché dans
`prisma/seed.ts` (qui agrège déjà `seedAuthorProfile`, `seedKbFacts`,
`seedChatbotTenant`). Scripts `package.json` :

```json
"elearning:seed": "tsx prisma/seeds/elearning/index.ts",
"elearning:seed-demo": "tsx prisma/seeds/elearning/demo.ts"
```

**Règles** :

1. **Idempotent** : `upsert` sur clés stables (`slug` cours, `(course_id, ordre)`
   modules/leçons, email apprenant). Pattern `prisma/seed.ts` existant.
2. **Garde-fou prod** : ne semer que si `NODE_ENV !== "production"` **OU**
   `ELEARNING_SEED_FORCE === "true"`. Le seed n'est jamais joué par l'entrypoint
   Coolify (qui ne fait que `migrate deploy`), mais on protège contre un
   `pnpm db:seed` accidentel pointé prod (cf. mémoire « ne pas `barometer:seed` en prod »).
3. **Pas de PII réelle** : apprenant `learner.demo@axion-ia.test` (domaine `.test`).
4. **Pas de média lourd / pas de réseau** : aucun upload R2/Stream. `videoAssetId`
   = placeholder `stream-demo-0001` ; `pdfKey`/`r2Key` factices ; leçons `texte`
   avec `contenuJson` Tiptap minimal en dur.

**Contenu du cours pilote** :

- 1 `ElearningCourse` `slug="ia-au-quotidien-pilote"`, `statut=publie`,
  `estFoad=true`, `seuilReussitePct=70`, `dureeEstimeeMinutes` agrégé.
- 3 `ElearningModule` (ordre 0/1/2) : M0 `unlockType=immediat` ; M1
  `unlockType=apres_precedent` ; M2 `unlockType=score_quiz`, `unlockQuizId` = quiz
  de M1, `unlockScorePct=70` (démontre le **gating par score**).
- ~6 `ElearningLesson` mixtes : `texte`, `video`, `pdf`, une `quiz` (M1), une
  `devoir` (preuve FOAD). Durées 2-10 min (microlearning).
- 1 `Quiz` (M1) + `QuizQuestion`/`Question`/`QuestionChoice` : 4-5 questions
  couvrant `qcm_mono`, `qcm_multi`, `vrai_faux`, `texte_trous`, `reponse_courte` ;
  `seuilReussitePct=70`, `nbTentativesMax=3`, `shuffleQuestions=true`, `rationale`
  sur chaque question.
- 1 `Trainee` démo (passwordless, `passwordHash=null`) + 1 `ElearningEnrollment`
  (`source=octroi_manuel`, `statut=actif`) + 1 `CourseProgress` (`non_commence`).
- Optionnel : quelques `LessonProgress` + `ElearningXapiStatement` pour peupler le
  dashboard et démontrer la reprise auto.

> **But** : dérouler `/portail/...` → player → quiz bloquant → déverrouillage M2 →
> (mock) certificat, sans toucher R2/Stream.

---

## 7. Index & performances

**Posés dès la création (tables vides → coût nul)** : toutes les FK (`@@index`
explicite — ne pas compter sur l'auto-index Prisma), uniques d'ordonnancement
(`(course_id, ordre)`, `(module_id, ordre)`, `(quiz_id, ordre)`), uniques métier
(`courses.slug` citext, `(trainee_id, course_id)` enrollment,
`(enrollment_id, lesson_id)` progress, `auth_tokens.token_hash`,
`invitations.token_hash`, `(attempt_id, question_id)`), filtres fréquents
(`courses(statut)`, `enrollments(statut)`, `enrollments(course_id, statut)` pour reporting).

**Tables à fort volume → surveiller** :

- **`elearning_xapi_statements`** (append-only : heartbeat player + chaque event) =
  le plus gros volume. Index `(enrollment_id, occurred_at)` (reprise/dashboard),
  `(object_type, object_id)` (analytics). **Partitionnement mensuel**
  (`PARTITION BY RANGE (occurred_at)`) **seulement si** le volume l'exige (V1+) —
  migration additive dédiée (table partitionnée + bascule), jamais un DROP. Purge
  logs techniques 6 mois-1 an (CNIL) via cron `elearning-retention`, jamais DROP.
- **`elearning_lesson_progress`** / **`elearning_quiz_attempt_answers`** : 1 ligne
  par (enrollment×lesson) / (attempt×question). Index unique suffit au MVP.

**Heartbeat player (risque INP / charge DB)** : le player envoie
`last_position_seconds` à intervalle. **Throttle côté client** (≈1 write / 15 s ou
sur `pagehide`) + `UPDATE` ciblé par PK / unique `(enrollment_id, lesson_id)`.
Pas un sujet de migration ; la table reste petite. **JSONB** (`reponse_json`,
`result_json`, `contenu_json`) : pas d'index GIN au MVP (volume faible).

**Ajout d'index plus tard sur table peuplée** : `CREATE INDEX CONCURRENTLY` **hors**
transaction Prisma (migration jouée manuellement par Will en fenêtre de
maintenance, ou `prisma db execute`), puis `prisma migrate resolve --applied`.
Documenter dans un `README-INDEX-CONCURRENT-ELEARNING.md` (pattern des
`README-*.md` du dossier migrations). **Jamais** `CONCURRENTLY` dans un
`migrate deploy` standard (échoue en transaction).

---

## 8. Stratégie de rollback

> Les migrations étant additives, un « rollback » au sens DROP est **interdit**
> (ADR-0008) et **inutile** : une table/colonne neuve inutilisée ne casse rien.

1. **Rollback applicatif (cas normal).** Désactiver le code LMS : feature flag
   `ELEARNING_ENABLED` (défaut `false`), retrait de la nav `admin-nav.ts`,
   **OU** redéploiement de l'image GHCR précédente (`ghcr.io/will383842/axion-ia:sha-…`).
   Les tables LMS restent en base, inertes. **Zéro perte, zéro risque.**
2. **Migration `migrate deploy` qui échoue à mi-course.** Postgres rollback la
   transaction de cette migration ; elle est marquée `failed` dans
   `_prisma_migrations`. Corriger le `.sql`, **ne pas réutiliser le nom de
   dossier** ; `prisma migrate resolve --rolled-back <nom>` puis recréer une
   migration corrigée (ou `--applied` si l'état réel est cohérent). Documenter
   dans `README-ROLLBACK-ELEARNING.md` (cf. `README-ROLLBACK-IMAGE-BANK.md`).
3. **Annuler une migration déjà appliquée et peuplée.** Migration de compensation
   **additive** : marquer `/// @deprecated`, cesser d'écrire, **garder** les
   données. Nettoyage physique éventuel = fenêtre de maintenance dédiée, hors
   pipeline auto, avec dump préalable. **Jamais** de DROP en prod automatisée.
4. **Schéma « en avant » vs code rollbacké.** Après un rollback d'image,
   `migrate deploy` a déjà tourné → le schéma est en avant. C'est **OK justement
   parce que tout est additif** : l'ancien code ignore les nouvelles tables/colonnes.
   C'est la raison d'être de la doctrine.
5. **Sauvegarde.** Avant tout deploy portant une **extension de table existante**
   (`trainees`, `portail_acces`, `invoices`, `payments` — M2/M5), s'assurer qu'un
   **dump Postgres récent** existe (sauvegarde Coolify/VPS). Pour les migrations
   100 % `CREATE TABLE` (M1/M3/M4), risque nul.

**Test pré-prod de chaque migration** :

- `prisma migrate dev` sur DB locale (aller).
- `prisma migrate deploy` sur **copie de prod** (staging) — valide notamment les
  `ALTER trainees/invoices/payments` sur données réelles + le CHECK.
- `pnpm prisma validate` + `pnpm build` sous `DATABASE_URL=…stub.invalid…` (§3).
- Relecture humaine du `.sql` : **zéro** `DROP`, **zéro** `ALTER … SET NOT NULL`
  sur table existante peuplée, **zéro** `DROP NOT NULL` non voulu (seuls
  `invoices/payments.booking_id` sont attendus).

---

## 9. Checklist d'une PR portant une migration LMS

- [ ] `schema.prisma` modifié sous `Elearning*`/`Quiz*`/`Question*` (+ extensions `Trainee`/`PortailAcces`/`Invoice`/`Payment` + relations inverses `Formation`/`Client`/`AdminUser`/`Enrollment`/`DocumentGenere`/`EvaluationAcquis`).
- [ ] **PK + FK internes en `@db.Uuid`** (§1.3) ; FK vers existant déjà `@db.Uuid`.
- [ ] `prisma migrate dev --create-only` → `.sql` relu : aucun `DROP`/`DROP COLUMN`/`SET NOT NULL` sur table peuplée ; seuls `booking_id DROP NOT NULL` (M5) attendus.
- [ ] Bandeau « Migration ADDITIVE — aucun DROP » en tête du `.sql`.
- [ ] FK applicatives (`quizId`/`unlockQuizId`/`sourceLessonId`/`enrollment.orderId`) **non** contraintes (ou `ADD CONSTRAINT` additif assumé) ; pas de cycle.
- [ ] CHECK `*_booking_or_order_chk` présents sur `invoices`/`payments` (M5).
- [ ] `@@index` sur toutes les FK + filtres ; uniques d'ordre/métier présents.
- [ ] `ADD COLUMN` sur tables existantes = nullable ou `DEFAULT` (M2/M5).
- [ ] `pnpm prisma validate` OK ; `pnpm build` sous `stub.invalid` OK ; pages e-learning `force-dynamic`.
- [ ] `prisma migrate deploy` testé sur copie prod ; dump dispo si extension de table existante.
- [ ] Seed pilote idempotent + garde-fou prod ; lancé seulement en dev/staging.
- [ ] `_prisma_migrations` cohérent ; pas de réutilisation de nom de dossier ; `prisma migrate diff` propre (pas de dérive schéma↔migrations).

---

## 10. Liens

- [`00-INDEX/DECISIONS-ARBITRAGES.md`](../00-INDEX/DECISIONS-ARBITRAGES.md) — ADR-0001 (auth), 0002 (multi-tenant V2), 0004 (Stripe éteint), 0005 (vidéo), 0006 (pas de SCORM), 0007 (cloisonnement), **0008 (additif)**.
- [`01-schema-cours-modules-lecons.md`](./01-schema-cours-modules-lecons.md) — core (M1) ; ⚠️ lire les PK en `@db.Uuid` (§1.3).
- [`02-schema-progression-tracking.md`](./02-schema-progression-tracking.md) — `ElearningEnrollment`, `LessonProgress`, `ModuleProgress`, `CourseProgress`, `ElearningXapiStatement` (M3).
- [`03-schema-quiz-evaluations.md`](./03-schema-quiz-evaluations.md) — `QuizBank`, `Question`, `QuestionChoice`, `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAttemptAnswer` (M4).
- [`04-schema-comptes-acces-auth.md`](./04-schema-comptes-acces-auth.md) — extensions `Trainee`/`PortailAcces`, `ElearningOrgMembership`, `ElearningAuthToken`, `ElearningInvitation`, `ElearningImportBatch/Row` (M2).
- [`05-schema-ecommerce-commandes.md`](./05-schema-ecommerce-commandes.md) — `ElearningOrder/Item/Seat/Coupon`, extensions `Invoice`/`Payment` (M5) ; **§7.1 délègue l'arbitrage PK à ce doc** (§1.3).
- `04-BACKEND/05-authentification-apprenant.md` — cohabitation NextAuth / cookie apprenant.
- `04-BACKEND/06-import-masse-provisioning.md` — import CSV (`ElearningImportBatch`).
- `04-BACKEND/07-pipeline-video-streaming.md` — Cloudflare Stream (table transcodage éventuelle).
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` + `06-tracabilite-preuves-realisation.md` — durées (purge applicative, jamais DROP) ; `ElearningXapiStatement` = faisceau de preuves R.6313-3.
- [`11-ROADMAP/01-phasage-mvp-v1-v2.md`](../11-ROADMAP/01-phasage-mvp-v1-v2.md) — ordre MVP→V1→V2 (mappe M1→M5).
- [`axionia/AGENTS.md`](../../AGENTS.md) — contrat build `stub.invalid` (ADR 0026).
- Code réel ancré : `src/lib/prisma.ts` (stub Proxy), `prisma/schema.prisma` (`Trainee:5274`, `PortailAcces:6236`, `Client:4890`, `Formation:5061`, `Enrollment:5310`, `DocumentGenere:5507`, `Invoice`/`Payment`), `prisma/seed.ts` (seed idempotent), `prisma/migrations/20260620130000_console_documents/` (gabarit additif), `src/lib/r2-storage.ts` (médias).
