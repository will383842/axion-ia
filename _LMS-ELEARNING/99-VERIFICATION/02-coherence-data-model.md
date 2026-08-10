# Audit adversarial — Cohérence transverse du data model LMS

> **Rôle de ce document.** Vérification **adversariale** de la cohérence transverse du data model
> e-learning : noms de modèles / champs / enums Prisma identiques **partout** (docs `01`→`06` +
> `02-ARCHITECTURE/reutilisation-existant.md`), relations valides, FK typées correctement, absence
> de contradiction data-model ↔ migration, **migrations strictement additives** (ADR-LMS-0008).
>
> **Méthode.** Lecture intégrale des docs socle (`03-DATA-MODEL/01`→`06`, `00-INDEX/DECISIONS-ARBITRAGES.md`,
> `11-ROADMAP/01`, `02-ARCHITECTURE/reutilisation-existant.md`) **confrontée au code réel** :
> `prisma/schema.prisma` (modèles `Trainee:5274`, `Enrollment:5310`, `Client:4890`, `Formation:5061`,
> `EvaluationAcquis:5653`, `Questionnaire:5704`, `DocumentGenere:5507`, `PortailAcces:6236`,
> `Invoice:1695`, `Payment:1644`, `AdminUser:1526` + enums `Locale:40`, `DocumentType:5481`,
> `EvaluationType:5630`, `NiveauAcquisition:5637`), `src/lib/r2-storage.ts`,
> `src/server/qualiopi/portail/portail-service.ts`, `src/lib/admin-nav.ts`.
>
> **Convention de lecture des verdicts.**
>
> - 🔴 **P0 — bloquant** : casse `prisma validate` / la migration / le runtime si écrit tel quel. À corriger AVANT d'écrire `schema.prisma`.
> - 🟠 **P1 — majeur** : ne casse pas forcément la compilation mais produit un schéma divergent des specs (mauvais `@map`, mauvais `onDelete`) → bug silencieux / preuve FOAD fausse.
> - 🟡 **P2 — modéré** : dette de cohérence documentaire (un doc en retard sur un autre) ; risque qu'un dev implémente la mauvaise version.
> - ✅ **Validé** : cohérent, à conserver tel quel (listé pour que l'équipe fasse confiance au reste).
>
> Dernière mise à jour : 2026-06-27.

---

## 0. Verdict global

Le data model est **globalement solide et bien ancré** sur le code réel (réutilisation `Trainee`/`Client`/
`Enrollment`/`EvaluationAcquis`/`DocumentGenere`/`Invoice`/`Payment`/R2/RBAC correcte, doctrine additive
respectée, FK vers l'existant correctement typées `@db.Uuid`). **Mais** la cohérence transverse présente
**une faille de fond** (le type des PK, §C1) et **une vague de dérive de noms d'enums et de champs entre le
document de migration `06` et les documents de design `01`→`05`** (§C3, §P1). Ces dérives sont **dangereuses
parce que silencieuses** : un dev qui écrit `schema.prisma` en suivant `06` (qui se déclare « fait foi »)
produira des **valeurs d'enum et des `@map` faux** par rapport au code applicatif spécifié dans `01`→`05`.

| Sévérité       | Nombre | Nature                                                                                                                                                                                |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 P0 bloquant | **3**  | C1 type PK (text↔uuid), C2 `onDelete` impossible, C3 dérive de **valeurs** d'enum                                                                                                     |
| 🟠 P1 majeur   | **4**  | dérive de **noms de colonnes `@map`**, `actor_trainee_id`, inverses à consolider, certificat (mécanisme divergent)                                                                    |
| 🟡 P2 modéré   | **5**  | `reutilisation-existant.md` désynchronisé (noms de modèles), inverses Trainee erronés, convention de préfixe, `DocumentType` ADD VALUE manquant de la liste M, `octroyeParId` sans FK |
| ✅ Validé      | —      | typage FK→existant, relations nommées uniques, absence de collision de modèle, projection `EvaluationAcquis`, additivité, relâche `Invoice.bookingId`                                 |

**Action immédiate recommandée.** Avant toute écriture de `schema.prisma` : (1) acter §C1 dans `01`/`02`/`03`/`05`
(bandeau de correction `@db.Uuid`), (2) **régénérer** `06-strategie-migrations.md` §1.2 (enums) et §5 (champs M1-M5)
**à partir** des docs `01`→`05` (qui sont la source de design des membres/champs), (3) corriger le `onDelete`
de `QuizAttempt.enrollmentId` (§C2), (4) resynchroniser `02-ARCHITECTURE/reutilisation-existant.md` (§P2-1).

---

## 1. Référentiel consolidé (source unique recommandée)

Inventaire **réconcilié** des modèles NEUFS et de leur table `@@map`, avec le doc qui **fait foi** sur les
membres/champs. (Tous en `@db.Uuid` après arbitrage §C1.)

| Modèle Prisma (recommandé)  | Table `@@map`                    | Doc source de design | Migration |
| --------------------------- | -------------------------------- | -------------------- | --------- |
| `ElearningCourse`           | `elearning_courses`              | 01                   | M1        |
| `ElearningModule`           | `elearning_modules`              | 01                   | M1        |
| `ElearningLesson`           | `elearning_lessons`              | 01                   | M1        |
| `ElearningResource`         | `elearning_resources`            | 01                   | M1        |
| `ElearningOrgMembership`    | `elearning_org_memberships`      | 04                   | M2        |
| `ElearningAuthToken`        | `elearning_auth_tokens`          | 04                   | M2        |
| `ElearningInvitation`       | `elearning_invitations`          | 04                   | M2        |
| `ElearningImportBatch`      | `elearning_import_batches`       | 04                   | M2        |
| `ElearningImportRow`        | `elearning_import_rows`          | 04                   | M2        |
| `ElearningEnrollment`       | `elearning_enrollments`          | 02                   | M3        |
| `LessonProgress`            | `elearning_lesson_progress`      | 02                   | M3        |
| `ModuleProgress`            | `elearning_module_progress`      | 02                   | M3        |
| `CourseProgress`            | `elearning_course_progress`      | 02                   | M3        |
| `ElearningXapiStatement`    | `elearning_xapi_statements`      | 02                   | M3        |
| `QuizBank`                  | `elearning_quiz_banks`           | 03                   | M4        |
| `Question`                  | `elearning_questions`            | 03                   | M4        |
| `QuestionChoice`            | `elearning_question_choices`     | 03                   | M4        |
| `Quiz`                      | `elearning_quizzes`              | 03                   | M4        |
| `QuizQuestion`              | `elearning_quiz_questions`       | 03                   | M4        |
| `QuizAttempt`               | `elearning_quiz_attempts`        | 03                   | M4        |
| `QuizAttemptAnswer`         | `elearning_quiz_attempt_answers` | 03                   | M4        |
| `ElearningOrder`            | `elearning_orders`               | 05                   | M5        |
| `ElearningOrderItem`        | `elearning_order_items`          | 05                   | M5        |
| `ElearningSeat`             | `elearning_seats`                | 05                   | M5        |
| `ElearningCoupon`           | `elearning_coupons`              | 05                   | M5        |
| `ElearningCouponRedemption` | `elearning_coupon_redemptions`   | 05                   | M5        |

> ⚠️ **Incohérence de nommage de modèle** : `QuizBank`/`Question`/`QuestionChoice`/`Quiz`/`QuizQuestion`/
> `QuizAttempt`/`QuizAttemptAnswer` sont **non préfixés** alors que tout le reste du domaine est `Elearning*`.
> Voir §P2-3 (collision réelle vérifiée = aucune, mais décision de convention à acter).

---

## 2. 🔴 P0 — Incohérences bloquantes

### C1 — Type des clés primaires : `text` (docs 01/02/03/05) **vs** `@db.Uuid` (doc 06, qui fait foi)

**Constat.** C'est l'incohérence la plus grave et la plus systémique.

- **Docs `01`, `02`, `03`, `05`** déclarent leurs PK LMS en **`String @id @default(uuid())` sans `@db.Uuid`**
  (= colonne Postgres `text`), et bâtissent **toute une règle de typage FK autour de ce choix** :
  - `02` §0 (note ⚠️ « typage des FK ») : « toute FK vers un modèle LMS reste `String` simple (text) ».
  - `03` **§2 entier** (« CONVENTION DE TYPE DES CLÉS — CRITIQUE ») : règle détaillée FK-vers-LMS = `text`,
    et **§10.2 instruction explicite** : `evaluations_acquis.elearning_enrollment_id` « **COLONNE `text` … PAS de
    `@db.Uuid` ici** ».
- **Doc `06` §1.3** (« ⚠️ ARBITRAGE ») **inverse cette décision** : « **Tout le domaine e-learning utilise
  `@db.Uuid` — PK et FK internes** » et déclare : « les snippets des docs `01`, `02`, `03` … **doivent être
  lus/mis à jour comme `@db.Uuid`** ». Le doc 06 se proclame « **fait foi sur les choix transverses de migration** ».

**Vérification code réel.** L'arbitrage `06` est le bon : `Trainee.id`, `Enrollment.id`, `EvaluationAcquis.id`,
`Invoice.id`, `Client.id` sont **tous** `String @id @default(uuid()) @db.Uuid` (vérifié `schema.prisma:5275, 5311,
5654, 1696, 4890`). Un îlot `text` au milieu serait une dette permanente, **et** casserait la FK
`Invoice.orderId @db.Uuid → ElearningOrder.id` si `ElearningOrder.id` restait `text` (mismatch `uuid`↔`text`,
Prisma refuse).

**Pourquoi c'est P0 et pas juste cosmétique.** Le danger n'est pas l'arbitrage (clair) mais **les pièges
résiduels laissés dans les docs de design**, qu'un dev appliquera littéralement :

1. **`03` §10.2** ordonne explicitement de **NE PAS** mettre `@db.Uuid` sur
   `evaluations_acquis.elearning_enrollment_id`. Sous l'arbitrage `06`, `ElearningEnrollment.id` **EST** `uuid` →
   cette colonne **DOIT** être `@db.Uuid`. **Suivre `03` §10.2 = FK invalide / migration en échec.**
2. **`03` §2** (toute la grille FK-vers-LMS en `text`) est désormais **fausse** dans son intégralité.
3. **`05`** : les snippets `id String @id @default(uuid())` (sans `@db.Uuid`) et les commentaires « `@db.Uuid`
   si §7.1 retenu » laissent l'ambiguïté ouverte alors que `06` l'a tranchée.
4. **`02`** : la note §0 sur le typage FK-vers-LMS `text` est fausse.

**Correctif (obligatoire).**

- Ajouter en **tête** de `01`, `02`, `03`, `05` un bandeau : _« ⚠️ Type des PK/FK internes corrigé par
  `06-strategie-migrations.md` §1.3 → lire tous les `@id`/FK internes comme `@db.Uuid`. »_
- **Réécrire** `03` §2 et **`03` §10.2** : `elearning_enrollment_id` devient `String? @map("elearning_enrollment_id") @db.Uuid`.
- Supprimer les options « repli text » de `05` §7.1 (tranché).
- Conserver inchangées les FK-vers-existant (`traineeId`, `clientId`, `evaluationAcquisId`, `corrigeParId`,
  `enrollmentOrigineId`, `certificatDocumentId`…) : déjà `@db.Uuid` ✅.

---

### C2 — `QuizAttempt.enrollmentId` : `onDelete: Cascade` + NOT NULL (doc 03) **vs** `SET NULL` (doc 06 M4)

**Constat.**

- **Doc `03` §8.1** : `enrollmentId String @map("enrollment_id")` (**NON nullable**) +
  `@relation("ElearningQuizAttempts", … onDelete: Cascade)`.
- **Doc `06` §4 (graphe FK) et §5 M4** : « `elearning_quiz_attempts.enrollment_id` → `elearning_enrollments`
  (**SET NULL**) ».

**Pourquoi P0.** `ON DELETE SET NULL` est **impossible** sur une colonne `NOT NULL` (Postgres rejette la
contrainte). Les deux specs sont donc **mutuellement exclusives** et l'une est invalide. Sémantiquement, la
règle RGPD posée par `02` §10 (« suppression d'un `Trainee` cascade sur `ElearningEnrollment` → progression
supprimée ») implique que les tentatives **suivent** l'enrollment → **Cascade** est le bon choix, et
`enrollmentId` doit rester **NOT NULL** (une tentative sans inscription n'a aucun sens : c'est la clé d'identité
apprenant côté quiz, cf. `03` §8.1).

**Correctif.** Retenir **`03`** : `enrollmentId` NON nullable, `onDelete: Cascade`. Corriger `06` §4 et §5 M4
(remplacer « SET NULL » par « CASCADE »). NB : `QuizAttempt.traineeId` (lui) reste **nullable + SET NULL** (FK
dénormalisée vers `Trainee` — cohérent doc 03/06).

---

### C3 — Dérive des **valeurs d'enum** entre doc 06 §1.2 et les docs de design 01-05

**Constat.** `06` §1.2 prétend lister les « noms réels » des enums, mais **diverge des docs de design** sur de
nombreux **membres**. Comme les docs `01`→`05` sont la **source du design applicatif** (le code lit/écrit ces
valeurs : machines à états, scoring, gating, projection Qualiopi), **ce sont elles qui font foi sur les membres**
(le `06` ne fait foi que sur la **doctrine de migration** et l'**arbitrage PK** — pas sur l'énumération métier
qu'il a manifestement résumée à la hâte). Toute valeur écrite selon `06` qui diffère de `01`-`05` produira un
**bug runtime** (valeur d'enum inconnue du service, `switch` non exhaustif, etc.).

| Enum                                                                     | Source de design (FAIT FOI)                                                                                                                                                            | doc 06 §1.2 (À CORRIGER)                                                                                                                                                                          | Sévérité        |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `ElearningEnrollmentSource`                                              | `02` : `session_formation, achat, octroi_manuel, **import_masse**, **entreprise**`                                                                                                     | `session_formation, achat, octroi_manuel, **import**` (renomme `import_masse`→`import`, **supprime** `entreprise`)                                                                                | 🔴              |
| `ElearningProgressStatut`                                                | `02` : `non_commence, en_cours, termine, **echoue**`                                                                                                                                   | `non_commence, en_cours, termine` (**supprime `echoue`** — pourtant requis pour un module gaté par quiz, `02` §2)                                                                                 | 🔴              |
| `QuestionType`                                                           | `03` : 12 types `qcm_mono, qcm_multi, vrai_faux, appariement, **texte_a_trous**, **menu_deroulant**, ordonnancement, reponse_courte, **numerique**, essai, upload, **zone_cliquable**` | 9 types : renomme `texte_a_trous`→`texte_trous`, **supprime** `menu_deroulant`, `numerique`, `zone_cliquable`                                                                                     | 🔴              |
| `FeedbackMode`                                                           | `03` : `immediat, apres_soumission, apres_reussite, apres_cloture, aucun`                                                                                                              | `immediat, **differe**, aucun` (3 valeurs entièrement différentes ; `differe` n'existe nulle part ailleurs)                                                                                       | 🔴              |
| `QuizAttemptStatut`                                                      | `03` : `en_cours, soumis, **a_corriger**, corrige, **expire**, **abandonne**`                                                                                                          | `en_cours, soumis, corrige, **invalide**` (**supprime `a_corriger`** — pourtant central à la correction manuelle, `03` §6/§9 ; ajoute `invalide`)                                                 | 🔴              |
| `ElearningOrgRole`                                                       | `04` : `membre, **manager**, **org_admin**`                                                                                                                                            | `membre, **gestionnaire**`                                                                                                                                                                        | 🔴              |
| `ElearningOrgMembershipStatut`                                           | `04` : `active, **suspended**, **revoked**` (anglais)                                                                                                                                  | `active, **suspendue**, **revoquee**` (français)                                                                                                                                                  | 🟠              |
| `ElearningAuthTokenPurpose`                                              | `04` : `**email_verification**, password_reset, magic_login, password_setup`                                                                                                           | `magic_login, password_reset, password_setup, **email_verify**`                                                                                                                                   | 🔴              |
| `ElearningOrderStatut`                                                   | `05` : `brouillon, en_attente_paiement, **partiellement_payee**, payee, octroyee, annulee, remboursee, **expiree**`                                                                    | `brouillon, en_attente_paiement, payee, octroyee, annulee, remboursee` (**supprime** `partiellement_payee` + `expiree`, tous deux utilisés par la machine à états `05` §10 / worker d'expiration) | 🔴              |
| `ElearningOrderPaymentMode`                                              | `05` : `virement, **stripe**, **opco**, gratuit, octroi_manuel`                                                                                                                        | `virement, octroi_manuel, gratuit, **cb**` (renomme `stripe`→`cb`, **supprime `opco`** — pourtant `05` §4/§12 s'appuie sur `paymentMode=opco` + `opcoDossierRef`)                                 | 🔴              |
| `ElearningCouponStatut`                                                  | `05` : `actif, **suspendu**, **epuise**, expire`                                                                                                                                       | `actif, **inactif**, expire`                                                                                                                                                                      | 🟠              |
| `ElearningEnrollmentStatut`                                              | `02` : `actif, suspendu, expire, revoque, termine`                                                                                                                                     | `actif, termine, suspendu, revoque, expire` (mêmes membres, **ordre** différent)                                                                                                                  | 🟡 (ordre seul) |
| `QuizFinalite`                                                           | `03` : `entrainement, positionnement, evaluation, final_certificatif`                                                                                                                  | `positionnement, entrainement, evaluation, final_certificatif` (ordre seul)                                                                                                                       | 🟡              |
| `CorrectionMode`                                                         | `03` : `auto, manuelle, mixte`                                                                                                                                                         | identique                                                                                                                                                                                         | ✅              |
| `ElearningInvitationStatut` / `ElearningImportStatut`                    | `04`                                                                                                                                                                                   | identiques                                                                                                                                                                                        | ✅              |
| `ElearningSeatStatut` / `ElearningCouponType` / `ElearningOrderItemType` | `05`                                                                                                                                                                                   | identiques                                                                                                                                                                                        | ✅              |
| `ElearningCourseStatut` / `ElearningLessonType` / `ElearningUnlockType`  | `01`                                                                                                                                                                                   | identiques                                                                                                                                                                                        | ✅              |
| `QuestionDifficulte`                                                     | `03`                                                                                                                                                                                   | identique                                                                                                                                                                                         | ✅              |
| `ElearningXapiVerb` / `ElearningXapiObjectType`                          | `02` (12 verbes / 7 types)                                                                                                                                                             | `/* … */` placeholders dans `06` → **incomplet** (pas un conflit mais à compléter depuis `02`)                                                                                                    | 🟡              |

**Correctif.** **Régénérer `06` §1.2 mot pour mot depuis `01`-`05`.** Acter une **table des enums = source unique**
(je recommande de la placer dans `06` puisqu'il pilote les `CREATE TYPE`, **mais copiée fidèlement** des docs de
design). Décisions de fond à trancher au passage (et à propager) :

- `import_masse` **ou** `import` ? (recommandé : `import_masse` — explicite, cohérent avec `ElearningImportBatch`).
- `stripe` **ou** `cb` pour le mode de paiement ? (recommandé : `stripe` — cohérent avec `PaymentProvider.stripe`
  existant et le flag `STRIPE_ENABLED`). **Garder `opco`** (financement réel décrit `05` §12).
- Langue des membres : **français** partout sauf là où l'existant impose l'anglais. `04` mélange (`active` EN vs
  `suspended/revoked`). Recommandé : aligner sur le français du reste du domaine (`active`→garder, mais
  `suspendue`/`revoquee`) **ou** tout-anglais — **choisir une fois** et propager.

---

## 3. 🟠 P1 — Incohérences majeures

### P1-1 — Noms de colonnes `@map` : doc 06 (§5 M1-M5) invente des colonnes absentes de 02/03

Le doc `06` §5 décrit le **contenu des migrations** avec des noms de colonnes qui **ne correspondent pas** aux
`@map` des modèles de design. Comme la migration SQL doit refléter exactement les `@map`, ces écarts produiraient
un schéma divergent (ou une migration qui ne matche pas `schema.prisma` → dérive `prisma migrate diff`).

| Table                        | Colonnes **doc 02/03 (`@map`, font foi)**                                                                          | Colonnes **doc 06 §5 (fausses)**                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `elearning_lesson_progress`  | `percent_vu`, `derniere_position_sec`, `max_position_sec`, `temps_passe_sec`, `nb_vues` (`02` §4)                  | `watch_seconds`, `last_position_seconds` (inventés ; ne couvrent même pas tous les champs) |
| `elearning_xapi_statements`  | `trainee_id` (`02` §7, dénormalisé)                                                                                | `actor_trainee_id` (`06` §4 + M3)                                                          |
| `elearning_xapi_statements`  | `result_percent`, `result_score_raw`, `result_score_max`, `result_success`, `result_duration_sec`, `raw` (`02` §7) | `result_json JSONB` (agrégé inventé)                                                       |
| `elearning_quiz_attempts`    | `reussite`, `corrige_at` (`03` §8.1)                                                                               | `reussi`, `corrected_at` (`06` M4)                                                         |
| `elearning_quizzes`          | `max_tentatives`, `nb_questions_tirees`, `shuffle_questions`, `temps_limite_sec`, `feedback_mode` (`03` §7.1)      | `nb_tentatives_max`, `tirage_aleatoire_n`, `shuffle_choix`, `is_certificatif?` (`06` M4)   |
| `elearning_question_choices` | `match_key` (`03` §4.3)                                                                                            | `appariement_cle` (`06` M4)                                                                |
| `elearning_questions`        | `points`, `payload_json` (`03` §4.2)                                                                               | `ponderation` (`06` M4)                                                                    |

**Correctif.** `06` §5 doit **décrire** les migrations en reprenant les `@map` exacts de `02`/`03`. Idéalement,
le `.sql` est **généré** par `prisma migrate dev --create-only` à partir du `schema.prisma` (lui-même écrit
depuis `02`/`03`) — ce qui élimine ces divergences manuelles. Le doc `06` ne doit lister que des **noms réels**.

### P1-2 — `ElearningXapiStatement` : nom de la colonne acteur (`trainee_id` vs `actor_trainee_id`)

Cas particulier de P1-1, mais isolé car structurant pour les **index de preuve** : `02` §7 indexe
`@@index([traineeId, occurredAt])` sur `trainee_id` ; `06` §4 parle de `actor_trainee_id`. **Retenir `trainee_id`**
(`02` fait foi). Vérifier que `02` §7 confirme l'**absence de relation déclarée** vers `Trainee` (décision
recommandée : colonne dénormalisée indexée, pas de `@relation`) → cohérent, à conserver.

### P1-3 — Relations inverses à **consolider** : `ElearningEnrollment` et `Trainee` reçoivent des inverses définis dans plusieurs docs

Aucun doc ne contient la **liste complète** des relations inverses d'un même modèle : elles sont **éparpillées**.
Qui écrira `ElearningEnrollment` / `Trainee` dans `schema.prisma` doit **agréger** ces inverses sous peine d'un
`@relation` orphelin (erreur `prisma validate` : « missing opposite relation field »).

**`ElearningEnrollment` — inverses à réunir :**

- `courseProgress CourseProgress?`, `moduleProgress ModuleProgress[]`, `lessonProgress LessonProgress[]`,
  `statements ElearningXapiStatement[]` → **doc 02 §3**.
- `quizAttempts QuizAttempt[] @relation("ElearningQuizAttempts")`, `elearningEvaluations EvaluationAcquis[] @relation("ElearningEvaluations")`
  → **doc 03 §8.2 / §10.2**.
- `seat ElearningSeat?` → **doc 05 §7.4**.

**`Trainee` — inverses/colonnes à réunir :**

- `passwordHash`, `passwordSetAt`, `emailVerifiedAt`, `learnerStatut`, anti-bruteforce, `primaryOrganisation*`,
  `preferencesJson` + `orgMemberships`, `authTokens`, `invitationsRecues`, `elearningEnrollments` → **doc 04 §3**.
- `quizAttempts QuizAttempt[] @relation("TraineeQuizAttempts")` → **doc 03 §8.2**.
- `elearningOrders`, `elearningSeats`, `couponRedemptions` → **doc 05 §7.4 / §9**.
- (option, **non recommandée** par `02` §7) `elearningStatements`.

**Correctif.** Ajouter une **annexe « inverses consolidés par modèle existant »** (Trainee, Client, AdminUser,
ElearningCourse, ElearningEnrollment, DocumentGenere, EvaluationAcquis, Enrollment, Formation) — voir §5 ci-dessous,
que j'ai pré-rempli.

### P1-4 — Certificat e-learning : mécanisme de rattachement divergent entre docs

- **Doc 02 §3** (fait foi data-model) : la FK est portée par **`ElearningEnrollment.certificatDocumentId → DocumentGenere`**
  (relation `"ElearningCertificat"`, inverse `DocumentGenere.elearningCertificats`).
- **`reutilisation-existant.md` §8** propose une **alternative** : « éventuellement une relation
  `elearningEnrollmentId?` sur `DocumentGenere` … sinon `metadata Json` ». → **mécanisme inverse** (FK côté
  `DocumentGenere`), qui **doublonnerait** la relation du doc 02 si implémenté en plus.

**Correctif.** Trancher **doc 02** (FK côté `ElearningEnrollment`) ; retirer la suggestion concurrente de
`reutilisation-existant.md` §8 (ou la marquer « écartée — voir 03-DATA-MODEL/02 »). **Une seule** relation
certificat ↔ enrollment.

---

## 4. 🟡 P2 — Incohérences modérées (dette documentaire)

### P2-1 — `02-ARCHITECTURE/reutilisation-existant.md` désynchronisé : noms de modèles obsolètes

Ce doc (antérieur à la finalisation du data-model) emploie des **noms de modèles qui n'existent plus** dans les
docs `03`/`04` :

| `reutilisation-existant.md` (obsolète)                                                                            | Data-model réel (03/04)                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ElearningQuiz`, `ElearningQuestion`, `ElearningQuizAttempt` (§0, §14, §16, Récap)                                | `Quiz`, `Question`, `QuizAttempt` (non préfixés, doc 03)                                                                                         |
| `ElearningAccess` (modèle de session apprenant, §0, §4, §16, Récap) + `Trainee.elearningAccess ElearningAccess[]` | **N'EXISTE PAS** : doc 04 §4 décide explicitement de **réutiliser `PortailAcces`** et « **ne crée PAS** de `LearnerSession` ».                   |
| `Trainee.lessonProgress LessonProgress[]` (§1)                                                                    | **FAUX** : `LessonProgress` (doc 02 §4) n'a **pas** de FK `traineeId` (il relie `enrollmentId`+`lessonId`). Cette relation inverse est invalide. |
| `Trainee.passwordHash @db.Text` (§1)                                                                              | doc 04 §3 : `@db.VarChar(255)` (divergence de type — mineure mais à aligner)                                                                     |

**Correctif.** Resynchroniser `reutilisation-existant.md` : `ElearningQuiz*`→`Quiz/Question/QuizAttempt` ;
supprimer toute mention du modèle `ElearningAccess` (remplacer par « réutilise `PortailAcces` étendu, doc 04 ») ;
supprimer `Trainee.lessonProgress` et `Trainee.elearningAccess` de la liste d'ajouts ; aligner le type de
`passwordHash`.

### P2-2 — Convention de préfixe `Elearning*` non uniforme

Le moteur quiz (`Quiz`, `Question`, `QuestionChoice`, `QuizBank`, `QuizQuestion`, `QuizAttempt`,
`QuizAttemptAnswer`) est **non préfixé** ; tout le reste est `Elearning*`. **Vérifié sur le code réel :
aucune collision** — `prisma/schema.prisma` ne contient **pas** de modèle `Quiz`, `Question`, `QuizBank`,
`QuizAttempt` ni `Order` (seul `Questionnaire` existe, nom distinct). Donc ce n'est pas bloquant, mais c'est
une **incohérence de style** + un risque futur (un module `Question` générique pourrait un jour entrer en
collision). **Décision à acter** : soit garder non préfixé (entériner dans `06`), soit préfixer
`ElearningQuiz/ElearningQuestion/…` (alors **aligner `reutilisation-existant.md` qui les préfixe déjà**, et
mettre à jour `03` + le référentiel §1). Recommandation : **préfixer** pour homogénéité et zéro risque de
collision future (`@@map` inchangés). Tables `@@map` `elearning_*` déjà correctes dans les deux cas.

### P2-3 — `DocumentType` : ajout de valeur non listé dans les migrations M1-M5

`reutilisation-existant.md` §8 propose `DocumentType.certificat_realisation_elearning` **ou** réutiliser
`certificat_realisation` (vérifié présent : `schema.prisma:5493`). Si une **nouvelle valeur** est retenue, c'est
un `ALTER TYPE "DocumentType" ADD VALUE …` — **absent** de la liste nominale des migrations (`06` §5, M1-M5) et
qui **doit être une migration isolée** (cf. `06` §1.2 ⚠️ : ne jamais mélanger `ADD VALUE` et usage). **Correctif :**
trancher (recommandé : **réutiliser `certificat_realisation`** si le modèle officiel est identique → zéro
migration d'enum) et, si nouvelle valeur, l'ajouter explicitement à `06` comme migration dédiée.

### P2-4 — `ElearningEnrollment.octroyeParId` : colonne `@db.Uuid` sans `@relation` ni FK

Doc 02 §3 : `octroyeParId String? @db.Uuid` (« admin ayant ouvert l'accès — traçabilité RBAC ») **sans** relation
vers `AdminUser`, alors que tous les autres « créé/invité par admin » du domaine **ont** une `@relation`
(`createdByAdminId`→`AdminElearningOrders`, `invitedByAdminId`→`AdminElearningMemberships`, etc.). **Incohérence
de pattern.** Soit on assume une colonne d'audit nue (documenter « FK applicative, pas de contrainte »), soit on
ajoute la relation `octroyePar AdminUser? @relation("AdminElearningEnrollmentsOctroyes")` + inverse sur `AdminUser`
(additif, recommandé pour l'intégrité).

### P2-5 — `ElearningXapiVerb` / `ElearningXapiObjectType` incomplets dans doc 06

`06` §1.2 laisse `/* … */` au lieu de lister les 12 verbes / 7 types de `02` §2. À **compléter** depuis `02`
avant d'écrire le `CREATE TYPE` (sinon valeurs manquantes : `attended`, `submitted`, `experienced`, etc. =
preuves FOAD perdues).

---

## 5. Annexe — Relations inverses consolidées (à poser sur les modèles EXISTANTS / cross-doc)

> Toutes **additives**, **sans colonne** côté table existante (la FK est portée par la table neuve) → 0 SQL sur
> les tables existantes pour ces inverses (Prisma n'émet aucun `ALTER`). Source vérifiée : docs 02/03/04/05.

```prisma
// model Trainee {  (schema.prisma:5274 — + colonnes additives doc 04 §3)
  elearningEnrollments  ElearningEnrollment[]        @relation("TraineeElearningEnrollments")  // 02
  orgMemberships        ElearningOrgMembership[]     @relation("TraineeOrgMemberships")         // 04
  authTokens            ElearningAuthToken[]                                                    // 04
  invitationsRecues     ElearningInvitation[]        @relation("InvitationTrainee")            // 04
  primaryOrganisation   Client?                      @relation("TraineeOrganisationPrincipale", fields:[primaryOrganisationClientId], references:[id], onDelete:SetNull) // 04
  quizAttempts          QuizAttempt[]                @relation("TraineeQuizAttempts")          // 03
  elearningOrders       ElearningOrder[]             @relation("TraineeElearningOrders")        // 05
  elearningSeats        ElearningSeat[]              @relation("TraineeElearningSeats")         // 05
  couponRedemptions     ElearningCouponRedemption[]  @relation("TraineeCouponRedemptions")     // 05
  // (NE PAS ajouter lessonProgress / elearningAccess : invalides, cf. P2-1)

// model Client {  (4890)
  coursesProprietaires  ElearningCourse[]            @relation("ClientCoursesProprietaires")    // 01
  elearningEnrollments  ElearningEnrollment[]        @relation("ClientElearningEnrollments")    // 02
  elearningMemberships  ElearningOrgMembership[]     @relation("ClientElearningMemberships")    // 04
  traineesPrincipaux    Trainee[]                    @relation("TraineeOrganisationPrincipale") // 04
  elearningInvitations  ElearningInvitation[]        @relation("ClientElearningInvitations")    // 04
  elearningImports      ElearningImportBatch[]       @relation("ClientElearningImports")        // 04
  elearningOrders       ElearningOrder[]             @relation("ClientElearningOrders")         // 05
  elearningCoupons      ElearningCoupon[]            @relation("ClientElearningCoupons")        // 05

// model AdminUser {  (1526)
  elearningMembershipsCrees   ElearningOrgMembership[] @relation("AdminElearningMemberships")   // 04
  elearningInvitationsEmises  ElearningInvitation[]    @relation("AdminElearningInvitations")   // 04
  elearningImportsLances      ElearningImportBatch[]   @relation("AdminElearningImports")       // 04
  elearningOrdersCreated      ElearningOrder[]         @relation("AdminElearningOrders")        // 05
  elearningCoupons            ElearningCoupon[]        @relation("AdminElearningCoupons")       // 05
  // (option P2-4) elearningEnrollmentsOctroyes ElearningEnrollment[] @relation("AdminElearningEnrollmentsOctroyes")

// model Formation {  (5061)
  elearningCourses      ElearningCourse[]                                                       // 01

// model Enrollment {  (5310)
  elearningEnrollments  ElearningEnrollment[]        @relation("EnrollmentToElearning")         // 02

// model DocumentGenere {  (5507)
  elearningCertificats  ElearningEnrollment[]        @relation("ElearningCertificat")           // 02

// model EvaluationAcquis {  (5653 — + colonne additive elearningEnrollmentId @db.Uuid, cf. C1)
  elearningEnrollment   ElearningEnrollment?         @relation("ElearningEvaluations", fields:[elearningEnrollmentId], references:[id], onDelete:Cascade) // 03
  quizAttempt           QuizAttempt?                 @relation("AttemptEvaluation")             // 03

// model ElearningEnrollment {  (02 — agrège inverses de 03 et 05)
  quizAttempts          QuizAttempt[]                @relation("ElearningQuizAttempts")         // 03
  elearningEvaluations  EvaluationAcquis[]           @relation("ElearningEvaluations")          // 03
  seat                  ElearningSeat?                                                          // 05

// model ElearningCourse {  (01 — agrège inverses de 03 et 05)
  quizBanks             QuizBank[]                   @relation("CourseQuizBanks")               // 03
  quizzes               Quiz[]                       @relation("CourseQuizzes")                 // 03
  orderItems            ElearningOrderItem[]                                                    // 05
  seats                 ElearningSeat[]                                                         // 05

// model ElearningLesson {  (01 — agrège inverses de 03)
  quiz                  Quiz?                        @relation("LessonQuiz")                    // 03
  // (option) questionsGenerees Question[]  // si on contraint Question.sourceLessonId — sinon FK applicative
```

**Vérification d'unicité des `@relation` names.** Tous les noms ci-dessus sont **distincts par modèle** (aucune
collision entre `Trainee*`, `Client*`, `Admin*`) → conforme `prisma validate`. ✅

---

## 6. Points de cohérence VALIDÉS (à conserver tels quels)

- ✅ **FK vers l'existant** toutes typées `@db.Uuid` (`traineeId`, `clientId`, `enrollmentOrigineId`,
  `certificatDocumentId`, `evaluationAcquisId`, `corrigeParId`, `octroyeParId`, `invitedByAdminId`,
  `createdByAdminId`, `acheteurTraineeId`, `beneficiaireTraineeId`) — cohérent avec le code réel (Trainee/Client/
  Enrollment/EvaluationAcquis/AdminUser tous `@db.Uuid`).
- ✅ **Aucune collision de nom de modèle** avec le schéma réel : `Quiz`/`Question`/`QuizBank`/`QuizAttempt`/
  `Order` n'existent pas (seul `Questionnaire` existe, distinct).
- ✅ **Projection Qualiopi `EvaluationAcquis`** (doc 03 §10.3) : tous les champs cibles existent réellement —
  `scoreObtenu`, `scoreMax`, `scorePct`, `niveauGlobal`, `reussite`, `competences` (`schema.prisma:5665-5672`).
  Enums réutilisés corrects : `EvaluationType {initiale,intermediaire,finale}` (5630), `NiveauAcquisition
{non_acquis,partiellement_acquis,acquis}` (5637). L'invariant « exactement un rattachement » passe de 2 à 3
  branches (ajout `elearningEnrollmentId`) — cohérent avec le pattern AFEST existant (commentaire `:5657`).
- ✅ **Réutilisation `Invoice`/`Payment`** (doc 05 §7) : `Invoice.bookingId` est bien **`NOT NULL`** aujourd'hui
  (`schema.prisma:1699`) ; la relâche `DROP NOT NULL` + `CHECK (booking_id IS NOT NULL OR order_id IS NOT NULL)`
  est **non destructive** et le CHECK est **validable** (toutes les lignes existantes ont `booking_id`). `Invoice`
  porte déjà `vatRate`/`vatReverseCharge`/`vatMention`/`locale Locale`/`payerEmail @db.Citext` → `ElearningOrder`
  les miroite correctement.
- ✅ **`Locale` enum** = `{fr, en}` (40) → `ElearningOrder.locale Locale @default(fr)` valide.
- ✅ **Doctrine additive** (ADR-LMS-0008) respectée partout : `ADD COLUMN` nullable/DEFAULT, `DROP NOT NULL`
  (permis), aucun `DROP TABLE/COLUMN`, aucun `SET NOT NULL` sur table peuplée (sauf `DEFAULT` fourni —
  `learner_statut`, `failed_login_count` : autorisé).
- ✅ **Réutilisation R2** (`src/lib/r2-storage.ts`) : `getSignedUploadUrlR2` pour devoirs/médias, `videoAssetId`
  hors R2 (Cloudflare Stream) — cohérent ADR-0005, R2 ne streame pas.
- ✅ **Build `stub.invalid`** : pages e-learning derrière auth + `force-dynamic` ; le Proxy stub couvre
  génériquement `prisma.elearning*.*` — aucun modèle LMS ne casse le build.
- ✅ **Pas de cycle de FK** entre M1→M5 (doc 06 §4.1) : `unlockQuizId`/`quizId`/`sourceLessonId`/
  `enrollment.orderId` sont des **FK applicatives** non contraintes → ordre de migration sain.

---

## 7. Plan de correction (par fichier, ordonné)

1. **`03-DATA-MODEL/06-strategie-migrations.md`** (le plus urgent) :
   - §1.2 : **régénérer toutes les listes d'enum** depuis `01`-`05` (table §C3) ; compléter `ElearningXapiVerb`/
     `ElearningXapiObjectType`.
   - §4 + §5 M4 : `QuizAttempt.enrollment_id` → **CASCADE** (et NOT NULL), pas SET NULL (§C2).
   - §5 M1-M5 : remplacer les noms de colonnes inventés par les `@map` réels de `02`/`03` (§P1-1) ; renommer
     `actor_trainee_id`→`trainee_id` (§P1-2). Idéalement : « `.sql` généré par `migrate dev --create-only` ».
   - §5 : ajouter (si retenu) la migration isolée `ALTER TYPE DocumentType ADD VALUE` (§P2-3).
2. **`03-DATA-MODEL/01`, `02`, `05`** : bandeau « PK/FK internes = `@db.Uuid` (cf. 06 §1.3) » (§C1).
3. **`03-DATA-MODEL/03`** : réécrire **§2** (grille FK) et **§10.2** (`elearning_enrollment_id` → `@db.Uuid`) ;
   bandeau `@db.Uuid` (§C1).
4. **`02-ARCHITECTURE/reutilisation-existant.md`** : `ElearningQuiz*`→`Quiz/Question/QuizAttempt` ; supprimer
   `ElearningAccess` (→ `PortailAcces`) ; supprimer `Trainee.lessonProgress`/`elearningAccess` ; aligner
   `passwordHash @db.VarChar(255)` ; aligner mécanisme certificat sur doc 02 (§P1-4, §P2-1).
5. **Décisions de fond à acter** (puis propager) : `import_masse` vs `import` ; `stripe` vs `cb` + garder `opco` ;
   langue des enums (`suspended`/`suspendue`) ; **préfixe `Elearning*`** ou non sur le moteur quiz (§P2-2) ;
   relation `octroyeParId` (§P2-4) ; valeur `DocumentType` certificat (§P2-3).
6. **Checklist d'écriture `schema.prisma`** : agréger les inverses §5 ci-dessus ; `pnpm prisma validate` ;
   `prisma migrate dev --create-only` puis relecture (zéro `DROP`, seuls `booking_id DROP NOT NULL` attendus) ;
   `pnpm build` sous `DATABASE_URL=…stub.invalid…`.

---

## 8. Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001→0008 (notamment 0007 cloisonnement, 0008 additif).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — cœur LMS (corriger PK `@db.Uuid`, §C1).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — progression + xAPI (fait foi sur `@map` lesson_progress / `trainee_id`, §P1-1/P1-2).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — moteur quiz (corriger §2/§10.2 `@db.Uuid` §C1 ; `onDelete` §C2 ; enums §C3).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — auth apprenant / enums Org/Auth/Invitation (font foi §C3).
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — commandes (enums Order/Coupon font foi §C3 ; relâche Invoice/Payment ✅).
- `03-DATA-MODEL/06-strategie-migrations.md` — **fichier à corriger en priorité** (§1.2 enums, §4/§5 onDelete + colonnes).
- `02-ARCHITECTURE/reutilisation-existant.md` — **à resynchroniser** (noms de modèles, §P2-1).
- `99-VERIFICATION/01-critique-completude.md` — complétude fonctionnelle (complémentaire).
- `99-VERIFICATION/03-audit-conformite.md` — conformité FOAD/Qualiopi (les enums `echoue`/`a_corriger`/`partiellement_payee` supprimés par 06 ont un impact preuve/état → recouvre §C3).
- `99-VERIFICATION/06-coherence-existant.md` — cohérence avec le code legacy (réutilisation).
- Code réel ancré : `prisma/schema.prisma` (`Trainee:5274`, `Enrollment:5310`, `Client:4890`, `EvaluationAcquis:5653`, `DocumentType:5481`, `EvaluationType:5630`, `NiveauAcquisition:5637`, `Invoice:1695`, `Payment:1644`, `AdminUser:1526`, `Locale:40`), `src/lib/r2-storage.ts`, `src/server/qualiopi/portail/portail-service.ts`.
