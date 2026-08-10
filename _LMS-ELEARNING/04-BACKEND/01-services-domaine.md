# Backend — Couche services domaine (`src/server/elearning/**`)

> Spécification implémentable de la **couche services** du LMS. Les services portent **toute** la logique métier (transactions, invariants, idempotence) ; les **Server Actions** (`02-server-actions.md`), **API routes** (`04-api-routes.md`) et **workers** (`03-workers-bullmq-crons.md`) ne font qu'**appeler** ces services après authz. Aucune logique métier dans les actions/routes.
>
> Tout le code décrit ici vit sous `src/server/elearning/**` (ADR-LMS-0007). Migrations additives only (ADR-LMS-0008).
>
> Dernière mise à jour : 2026-06-27.

---

## 0. Ce qui est RÉUTILISÉ vs NEUF

| Brique                                                                                   | Statut                  | Source / cible                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client Prisma                                                                            | **réutilisé**           | `import { prisma } from "@/lib/prisma"` (stub-aware au build)                                                                                                                                   |
| Stockage objets (PDF, sous-titres, pièces)                                               | **réutilisé**           | `@/lib/r2-storage` : `uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`, `existsInR2`, `getObjectBufferR2`, `deleteFromR2`, `isR2Configured`                                                |
| Génération de PDF officiels + numérotation + QR + rétention                              | **réutilisé**           | `src/server/qualiopi/documents/documents-service.ts` (`generateDocument`), `DocumentType.certificat_realisation` existe déjà                                                                    |
| Tokens QR / vérification publique                                                        | **réutilisé**           | `src/server/qualiopi/documents/qr.ts` : `makeQrToken`, `qrDataUrl`, `verifyQrToken`                                                                                                             |
| Chiffrement PII                                                                          | **réutilisé**           | `@/lib/pii-crypto` : `encryptPii` / `decryptPii`                                                                                                                                                |
| RBAC admin                                                                               | **réutilisé**           | `src/server/actions/knowledge/_guards.ts` : `requireAdminRead/Write/Publish/Delete` (rôles `super_admin/admin/editor/reader`)                                                                   |
| Pattern token apprenant (64 hex, timing-safe, cookie 90 j)                               | **réutilisé (pattern)** | `src/server/qualiopi/portail/portail-service.ts`                                                                                                                                                |
| Modèles existants                                                                        | **réutilisés**          | `Trainee` (≈5274), `Enrollment` (≈5310), `Client` (≈4890), `PortailAcces` (≈6236), `Formation`/`TrainingSession`, `DocumentGenere` (≈5507), `EvaluationAcquis` (≈5653), `Questionnaire` (≈5704) |
| SSOT tarifs                                                                              | **réutilisé**           | `src/lib/pricing.ts`                                                                                                                                                                            |
| Queues BullMQ                                                                            | **réutilisé (pattern)** | `src/server/queue/queues.ts` (null si `BULLMQ_DISABLED=true`)                                                                                                                                   |
| Cœur LMS, progression, quiz, octroi, auth apprenant, import masse, certificat e-learning | **NEUF**                | ce document                                                                                                                                                                                     |

**Modèles Prisma référencés** (définis dans `03-DATA-MODEL/*`) :
`ElearningCourse`, `ElearningModule`, `ElearningLesson`, `ElearningResource` (doc 01 — écrit) ; `ElearningEnrollment`, `LessonProgress`, `ElearningEvent` (doc 02) ; `ElearningQuiz`, `ElearningQuestion`, `ElearningQuizAttempt`, `ElearningAnswer` (doc 03) ; `ElearningAccount`, `ElearningSession`, `ElearningMagicLink` (doc 04) ; `ElearningOrder`, `ElearningGrant`, `ElearningImportBatch` (doc 05). Les noms d'enums (`ElearningCourseStatut`, `ElearningLessonType`, `ElearningUnlockType`) viennent de `03-DATA-MODEL/01-…` (figés).

---

## 1. Principes transversaux (s'appliquent à TOUS les services)

### 1.1 Cloisonnement & arborescence cible

```
src/server/elearning/
  _shared/
    guards.ts            // requireLearner(), requireLearnerOwnsEnrollment(), reuse requireAdmin*
    errors.ts            // ElearningError + codes (typed, jamais de string nue)
    ids.ts               // genToken64(), timingSafeEqualToken() (réutilise le pattern portail)
    stub.ts              // isStubDb(): process.env.DATABASE_URL?.includes("stub.invalid")
    flags.ts             // readFlag("EDOF_ENABLED"), readFlag("STRIPE_ENABLED")…
  courses/
    course-service.ts            // CRUD cours/modules/leçons, publication, versionnage
    course-read-service.ts       // lectures publiques/apprenant (curriculum, signed video/pdf)
    resource-service.ts          // upload média R2 + sous-titres
  access/
    learner-auth-service.ts      // magic-link + password optionnel + sessions apprenant
    enrollment-service.ts        // ElearningEnrollment (apprenant ↔ cours)
    grant-service.ts             // octroi manuel + auto (session réalisée) + révocation
    import-service.ts            // import CSV masse entreprise (provisioning)
  progress/
    progress-service.ts          // heartbeat vidéo, complétion leçon, reprise auto
    unlock-service.ts            // moteur de déverrouillage (drip + gating par score)
    event-service.ts             // journal xAPI-like (verbe/objet) — preuves FOAD
  quiz/
    quiz-service.ts              // démarrage tentative, soumission, scoring, gating
    quiz-grading.ts             // correction par type de question (pure, testable)
    quiz-bank-service.ts        // banque + tirage N parmi M + shuffle (V1)
  certificates/
    certificate-service.ts       // certificat de réalisation e-learning (réutilise generateDocument)
  compliance/
    foad-evidence-service.ts     // faisceau de preuves D.6313-3-1 / R.6313-3
```

Les **Server Actions** correspondantes vivent sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/**/actions.ts` (admin) et `src/app/[locale]/(elearning)/**/actions.ts` (apprenant) — elles **importent** ces services.

### 1.2 Stub-aware (contrat `stub.invalid`)

Chaque fonction **mutante** débute par le garde stub ; chaque **lecture** retourne une valeur sûre vide. Helper unique :

```ts
// src/server/elearning/_shared/stub.ts
export function isStubDb(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}
```

- **Mutation** sous stub → `throw new ElearningError("STUB_DB", "non disponible au build")`.
- **Lecture** sous stub → retour neutre (`[]`, `null`, objet vide) pour ne jamais casser le SSG.
- Toutes les pages e-learning sont **derrière auth + `force-dynamic`** : elles ne sont pas pré-rendues au build, mais le garde reste obligatoire (défense en profondeur, cf. AGENTS.md « nouvelle page SSG »).

### 1.3 Erreurs typées (jamais de `throw new Error("...")` nu)

```ts
// src/server/elearning/_shared/errors.ts
export type ElearningErrorCode =
  | "STUB_DB"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "COURSE_NOT_PUBLISHED"
  | "LESSON_LOCKED"
  | "MODULE_LOCKED"
  | "ENROLLMENT_INACTIVE"
  | "ENROLLMENT_EXPIRED"
  | "QUIZ_NO_ATTEMPTS_LEFT"
  | "QUIZ_ATTEMPT_CLOSED"
  | "QUIZ_TIME_EXPIRED"
  | "GRANT_ALREADY_EXISTS"
  | "IMPORT_INVALID_ROW"
  | "CERTIFICATE_NOT_ELIGIBLE"
  | "R2_UNCONFIGURED"
  | "CONFLICT";

export class ElearningError extends Error {
  constructor(
    public code: ElearningErrorCode,
    message?: string,
    public meta?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "ElearningError";
  }
}
```

Les actions traduisent ces codes en messages i18n FR (mapping centralisé), jamais d'exposition de stack au client.

### 1.4 Authz : deux mondes étanches

- **Admin** (console auteur, octroi, reporting) : `requireAdminRead/Write/Publish/Delete` (NextAuth, `_guards.ts`). Mapping :
  - lecture/reporting → `requireAdminRead`
  - créer/éditer cours, modules, leçons, quiz, octroi, import → `requireAdminWrite`
  - **publier** un cours, **émettre** un certificat manuel → `requireAdminPublish`
  - **supprimer/archiver** définitivement, purge RGPD → `requireAdminDelete`
- **Apprenant** : système **séparé de NextAuth** (ADR-0001). `requireLearner()` lit le cookie de session apprenant (cf. `learner-auth-service.ts`) et retourne `{ accountId, traineeId? }`. Toute lecture/mutation d'un enrollment passe par `requireLearnerOwnsEnrollment(enrollmentId)` (ownership check, jamais d'IDOR).

### 1.5 Transactions Prisma & invariants

- Toute opération qui touche ≥ 2 tables avec un invariant inter-table s'exécute dans `prisma.$transaction(async (tx) => …)`. On passe `tx` aux helpers (jamais `prisma` global dans une transaction).
- **Réordonnancement** (drag&drop modules/leçons) : réécrit tous les `ordre` en une seule transaction, en respectant `@@unique([courseId, ordre])` / `@@unique([moduleId, ordre])` → écriture en deux passes (offset négatif temporaire) pour éviter la collision d'unicité.
- **Sérialisation** des écritures concurrentes critiques (tentative de quiz, octroi) : `isolationLevel: "Serializable"` ou verrou applicatif via clé d'idempotence (cf. §1.6).

### 1.6 Idempotence (clé de robustesse)

Trois mécanismes selon le cas :

1. **Unicité DB** : contraintes `@@unique` (ex. `ElearningEnrollment @@unique([accountId, courseId])`, `LessonProgress @@unique([enrollmentId, lessonId])`) → `upsert` ou `create … catch P2002`.
2. **Clé d'idempotence externe** : pour les opérations déclenchées par webhook/worker/import, un champ `idempotencyKey @unique` (modèle dédié `ElearningGrant.idempotencyKey`, `ElearningOrder.idempotencyKey`) — pattern miroir de `ChatActionIdempotency` (≈4771) et `StripeWebhookEvent` (≈1793).
3. **No-op convergent** : les heartbeats de progression sont **monotones** (on n'écrit que si la nouvelle position > l'ancienne), donc rejouables sans effet de bord.

> Règle : **toute** fonction appelée par un worker BullMQ DOIT être idempotente (BullMQ peut rejouer un job).

### 1.7 SSOT & flags

- Tarifs : exclusivement via `src/lib/pricing.ts` (jamais de prix en dur dans un service e-learning).
- Flags lus via `_shared/flags.ts` (qui lit `src/env.ts`) : `STRIPE_ENABLED` (défaut `false`, ADR-0004), `EDOF_ENABLED` (**nouveau**, défaut `false`, ADR-0003 — à ajouter dans `env.ts` selon le pattern `STRIPE_ENABLED` ligne ≈105/350). Tant que `EDOF_ENABLED=false`, aucun appel EDOF, aucun blocage CPF.

---

## 2. Service Cours — `courses/course-service.ts`

**Responsabilité.** CRUD du cœur LMS (`ElearningCourse` / `ElearningModule` / `ElearningLesson` / `ElearningResource`), workflow brouillon→publication, versionnage, réordonnancement. Consommé par l'outil auteur (`06-CONSOLE-ADMIN/03-…`).

**Authz.** `requireAdminWrite` (édition), `requireAdminPublish` (publication/archivage).

### Signatures

```ts
// Cours
createCourse(input: CreateCourseInput): Promise<{ id: string; slug: string }>
updateCourse(courseId: string, patch: UpdateCoursePatch): Promise<void>
getCourseForEditor(courseId: string): Promise<CourseEditorDTO>   // arbre complet
listCourses(filter: { statut?: ElearningCourseStatut; ownerClientId?: string | null }): Promise<CourseListItem[]>
publishCourse(courseId: string): Promise<{ version: number; publishedAt: Date }>
archiveCourse(courseId: string): Promise<void>

// Modules
addModule(courseId: string, input: ModuleInput): Promise<{ id: string }>
updateModule(moduleId: string, patch: ModulePatch): Promise<void>
deleteModule(moduleId: string): Promise<void>          // refuse si progression existante → archive
reorderModules(courseId: string, orderedIds: string[]): Promise<void>

// Leçons
addLesson(moduleId: string, input: LessonInput): Promise<{ id: string }>
updateLesson(lessonId: string, patch: LessonPatch): Promise<void>
deleteLesson(lessonId: string): Promise<void>
reorderLessons(moduleId: string, orderedIds: string[]): Promise<void>
```

### Invariants

- `slug` unique (`@db.Citext`) ; généré par slugify + suffixe si collision.
- Un cours `publie` doit avoir ≥ 1 module et chaque module ≥ 1 leçon (validé dans `publishCourse`, sinon `ElearningError("CONFLICT")`).
- Une leçon `type=quiz` exige un `quizId` non nul **publié** ; `type=video` exige `videoAssetId` ; `type=pdf` exige `pdfKey`. Validation au moment de **publier le cours** (pas au brouillon, pour ne pas bloquer l'édition incrémentale).
- `unlockType=score_quiz` exige `unlockQuizId` + `unlockScorePct` cohérents (quiz appartient au même cours, seuil 1–100).
- `dureeEstimeeMinutes` du cours = **somme recalculée** des leçons à chaque publication (cache pour D.6313-3-1 §2 « durée moyenne »).

### Transactions / idempotence

- `publishCourse` : `$transaction` → valide la structure, incrémente `version`, set `statut=publie`, `publishedAt=now()`. **Idempotent** : republier un cours déjà publié sans modif = no-op convergent (compare un hash de structure ; n'incrémente `version` que si le contenu a changé).
- `reorderModules/reorderLessons` : two-pass dans une transaction (cf. §1.5) pour respecter `@@unique([courseId, ordre])`.
- `deleteModule/deleteLesson` : **soft refuse** si des `LessonProgress`/`ElearningQuizAttempt` existent → bascule en archivage logique (champ `archivedAt` à prévoir doc 01, additif) plutôt que `delete` (préserve les preuves FOAD ; ADR-0008 esprit). `onDelete: Cascade` n'est utilisé que pour les cours en `brouillon` jamais octroyés.

---

## 3. Service Lecture cours (apprenant/public) — `courses/course-read-service.ts`

**Responsabilité.** Toutes les lectures côté apprenant + vitrine publique. Sépare strictement le contenu **visible** (cours publié, leçon déverrouillée) du contenu masqué.

**Authz.** `requireLearner` + ownership pour le contenu rattaché à un enrollment ; lecture **publique** (catalogue) sans auth mais limitée aux champs vitrine.

```ts
getPublicCatalog(): Promise<CatalogItem[]>                      // statut=publie, vendableSeul, sans contenu interne
getCourseCurriculum(courseId, enrollmentId): Promise<CurriculumDTO>  // arbre + état unlock par leçon
getLessonForLearner(enrollmentId, lessonId): Promise<LessonViewDTO>  // contenu + URL signée
getSignedVideoPlayback(enrollmentId, lessonId): Promise<{ hlsUrl: string; tokenExpiresAt: Date }>
getSignedResourceUrl(enrollmentId, resourceId): Promise<string>     // R2 getSignedUrlR2, court TTL
```

### Invariants

- `getLessonForLearner` **vérifie le déverrouillage** via `unlock-service.isLessonUnlocked()` AVANT de renvoyer le contenu → sinon `ElearningError("LESSON_LOCKED", …, { raison })` (la **raison** est renvoyée, best practice 2026 : « verrou affiché avec sa raison »).
- URL vidéo : **jamais** d'URL R2 brute ni d'asset id exposé. On délègue à Cloudflare Stream une **URL signée + watermark utilisateur** (cf. `07-pipeline-video-streaming.md`). TTL court (ex. 2 h), régénérée à chaque lecture (pattern identique à la régénération `getSignedUrlR2` 24 h du portail stagiaire).
- Ressources `telechargeable=false` → seulement streaming/inline, pas de lien de download.
- Lectures **stub-aware** : retournent catalogue/curriculum vides au build.

---

## 4. Service Ressources média — `courses/resource-service.ts`

**Responsabilité.** Upload des médias non-vidéo (PDF, images, audio, **sous-titres WCAG**) vers R2 ; rattachement à une leçon (`ElearningResource`). La **vidéo** ne passe PAS ici (→ Cloudflare Stream, `videoAssetId`).

```ts
requestUploadUrl(lessonId, input: { filename; contentType; sizeBytes }): Promise<{ uploadUrl; r2Key }>
confirmResource(lessonId, input: { r2Key; titre; type; mimeType; sizeBytes; telechargeable }): Promise<{ id }>
deleteResource(resourceId): Promise<void>
```

### Invariants / réutilisation

- `requestUploadUrl` → `getSignedUploadUrlR2(key, contentType, 15*60)` (upload direct navigateur, évite la limite `bodySizeLimit` Next ; identique au pattern kits `.pptx`). Clé déterministe : `elearning/courses/<courseId>/lessons/<lessonId>/<uuid>-<filenameSlug>`.
- `confirmResource` vérifie `existsInR2(r2Key)` avant d'insérer (anti-fantôme : pas de ligne DB sans objet R2). **Idempotent** par `r2Key` (réimporter le même objet = upsert).
- `deleteResource` : supprime la ligne puis `deleteFromR2(r2Key)` en best-effort (la suppression DB prime ; échec R2 logué, pas bloquant).
- Sous-titres `type="sous_titres"` (`.vtt`) requis pour toute leçon `video` au moment de la publication (accessibilité EAA — `04-accessibilite-wcag22.md`).

---

## 5. Service Auth apprenant — `access/learner-auth-service.ts`

**Responsabilité.** Authentification apprenant **séparée de NextAuth** (ADR-0001) : magic-link par défaut + mot de passe **optionnel** (comptes entreprise). Modèles neufs `ElearningAccount` (avec `passwordHash` nullable argon2id, FK optionnelle `traineeId` vers `Trainee` existant), `ElearningMagicLink`, `ElearningSession` (cf. doc 04).

> Réutilise le **pattern** `portail-service.ts` (token 64 hex `randomBytes(32)`, `timingSafeEqual`, cookie HttpOnly 90 j) mais **ne réutilise pas** `PortailAcces` (qui reste dédié au portail stagiaire Qualiopi). Les deux peuvent coexister pour un même `Trainee`.

```ts
// Magic-link
requestMagicLink(email: string): Promise<void>            // crée ElearningMagicLink (TTL 30 min), enqueue email
consumeMagicLink(token: string): Promise<{ sessionToken: string; expiresAt: Date }>

// Mot de passe (opt-in entreprise)
setPassword(accountId: string, plain: string): Promise<void>     // argon2id
verifyPassword(email: string, plain: string): Promise<{ sessionToken: string } | null>

// Sessions
createSession(accountId: string): Promise<{ sessionToken: string; expiresAt: Date }>
verifySession(sessionToken: string): Promise<{ accountId: string; traineeId: string | null } | null>
revokeSession(sessionToken: string): Promise<void>

// Provisioning (appelé par grant/import)
ensureAccountForTrainee(traineeId: string): Promise<{ accountId: string; created: boolean }>
ensureAccountForEmail(email: string, profile?: { nom; prenom }): Promise<{ accountId: string }>
```

### Invariants / sécurité

- **Token** : `randomBytes(32).toString("hex")` (64 chars). Comparaison **timing-safe** (`timingSafeEqualToken`, helper `_shared/ids.ts`). Magic-link **à usage unique** : `consumeMagicLink` marque `usedAt` dans la même transaction que la création de session (anti-rejeu) ; refuse si `usedAt != null` ou expiré.
- **Mot de passe** : argon2id (params OWASP 2026), jamais loggé, jamais retourné. `passwordHash` **nullable** (un compte magic-link n'en a pas). 3.3.8 WCAG : pas d'exigence de saisie cognitive (copier-coller autorisé, magic-link = alternative accessible à l'auth).
- **`verifyPassword`** : réponse en temps quasi-constant (toujours exécuter un hash factice si l'email est inconnu) pour ne pas révéler l'existence d'un compte.
- **Cookie session** : HttpOnly, Secure, SameSite=Lax, **distinct** du cookie NextAuth admin (nom dédié, ex. `el_sess`). Middleware apprenant dédié — **ne touche pas** au middleware admin (zéro risque de régression).
- **Rate-limit** : `requestMagicLink` et `verifyPassword` rate-limités (réutiliser l'infra Redis existante) ; anti-énumération.
- **Idempotence** : `ensureAccountForTrainee/Email` = `upsert` sur `traineeId`/`email` unique → rejouable par l'import de masse.
- **Stub-aware** : toutes les mutations throw `STUB_DB` ; `verifySession` retourne `null`.

---

## 6. Service Enrollment e-learning — `access/enrollment-service.ts`

**Responsabilité.** Lien apprenant↔cours (`ElearningEnrollment`, **distinct** de `Enrollment` Qualiopi qui reste participant↔session présentiel/live). Porte l'état d'accès (actif/suspendu/expiré), la date d'octroi (ancre du drip `offset_inscription`), la complétion globale.

```ts
getEnrollment(enrollmentId): Promise<ElearningEnrollmentDTO>
listEnrollmentsForAccount(accountId): Promise<EnrollmentSummary[]>   // dashboard apprenant
getOrCreateEnrollment(accountId, courseId, opts): Promise<{ id; created: boolean }>  // interne (octroi)
suspendEnrollment(enrollmentId, reason): Promise<void>
resumeEnrollment(enrollmentId): Promise<void>
recomputeCompletion(enrollmentId): Promise<{ completionPct: number; completedAt: Date | null }>
```

### Invariants

- `@@unique([accountId, courseId])` → un seul enrollment par (apprenant, cours). `getOrCreateEnrollment` = `upsert` **idempotent**.
- `accessExpiresAt` optionnel (accès limité dans le temps pour les packs entreprise) ; `getLessonForLearner` refuse si expiré (`ENROLLMENT_EXPIRED`).
- `recomputeCompletion` : `completionPct = leçons obligatoires complétées / total obligatoires` ; déclenche l'éligibilité certificat (cf. §11) quand `completionPct=100` ET seuil quiz global atteint. Appelé après chaque complétion de leçon et chaque tentative de quiz réussie.
- **Cohérence avec Qualiopi** : si le cours est adossé à une `Formation`/session (`formationId` non nul), l'`ElearningEnrollment` peut référencer l'`Enrollment` Qualiopi (champ `qualiopiEnrollmentId` nullable, doc 02) pour consolider les preuves dans le portail stagiaire.

---

## 7. Service Octroi d'accès — `access/grant-service.ts`

**Responsabilité.** Ouvrir un accès cours « à qui on veut » (ADR-0004 : MVP = virement + octroi manuel). Trois sources : **manuel admin**, **automatique** (session présentielle/live `terminee` → octroi e-learning de suivi), **import CSV masse** (§8). Modèle `ElearningGrant` (audit : qui a octroyé, source, idempotencyKey).

```ts
grantManual(input: { emailOrTraineeId; courseId; accessExpiresAt?; note? }): Promise<GrantResult>
grantBulk(courseId, recipients: GrantRecipient[], idempotencyKeyPrefix): Promise<BulkGrantReport>
grantFromSession(sessionId, courseId): Promise<BulkGrantReport>     // auto post-session
revokeGrant(grantId, reason): Promise<void>
```

### Pipeline `grantManual` (transaction)

1. `requireAdminWrite`.
2. `ensureAccountForEmail|Trainee` (§5) → `accountId`.
3. `getOrCreateEnrollment(accountId, courseId)` (§6).
4. `ElearningGrant.create` avec `idempotencyKey` = `hash(courseId|accountId|source)` → `@unique` ⇒ rejouer = no-op (`GRANT_ALREADY_EXISTS` capturé, retourne l'existant).
5. Hors transaction : enqueue email d'invitation (magic-link de bienvenue) via la queue emails.

### Invariants / idempotence

- **Tout** est idempotent par `idempotencyKey` (rejeu worker/double-clic admin sans double octroi ni double email).
- `grantFromSession` : itère les `Enrollment` Qualiopi `statut` réalisé de la session, octroie le cours e-learning de suivi. Idempotent par enrollment.
- **Révocation** ≠ suppression : `revokeGrant` suspend l'`ElearningEnrollment` (`suspendEnrollment`) et marque le grant `revokedAt` — on **conserve** la progression et les preuves (FOAD/RGPD rétention).
- **Stripe éteint** (ADR-0004) : aucun octroi n'est conditionné à un paiement CB en MVP. Le branchement `ElearningOrder` (doc 05) appelle `grant*` une fois `STRIPE_ENABLED=true` + paiement confirmé, **sans refonte** du service.

---

## 8. Service Import masse — `access/import-service.ts`

**Responsabilité.** Provisioning d'une liste entreprise (CSV) : crée comptes + octrois en masse, idempotent, avec rapport ligne-à-ligne. Modèle `ElearningImportBatch` (miroir conceptuel de `KitImportRun`/`KnowledgeImportBatch`).

```ts
parseCsv(buffer: Buffer): Promise<{ rows: ImportRow[]; errors: RowError[] }>   // pur, testable
startImport(courseId, rows: ImportRow[], opts): Promise<{ batchId: string }>   // enqueue worker
getImportReport(batchId): Promise<ImportReport>
```

### Invariants

- Colonnes attendues : `email, nom, prenom, [entreprise], [accessExpiresAt]`. Validation Zod par ligne ; lignes invalides **rejetées sans bloquer** le batch (rapport `IMPORT_INVALID_ROW`).
- Le **traitement** est délégué au worker `elearning-import-worker.ts` (gros volumes, retries BullMQ) qui appelle `grantBulk` avec `idempotencyKeyPrefix = batchId`. → **rejouable** intégralement (un batch relancé n'octroie pas en double).
- E-mails d'invitation **throttlés** (chunké) pour ne pas saturer Nodemailer maison.
- Dédup intra-fichier sur `email` (citext) ; les doublons fusionnent en un octroi.
- RGPD : un import = collecte de PII ⇒ traçabilité (qui a importé, quand, combien de lignes) dans `ElearningImportBatch` (preuve consentement à gérer en amont par l'entreprise).

---

## 9. Service Progression — `progress/progress-service.ts`

**Responsabilité.** Suivi fin de la progression apprenant : heartbeat vidéo, reprise auto persistée **serveur**, complétion de leçon, recalcul de complétion cours. C'est une **preuve FOAD majeure** (logs LMS, R.6313-3).

```ts
recordHeartbeat(enrollmentId, lessonId, input: { positionSec; watchedDeltaSec }): Promise<HeartbeatAck>
getResumePoint(enrollmentId, lessonId): Promise<{ positionSec: number } | null>
markLessonComplete(enrollmentId, lessonId): Promise<{ alreadyCompleted: boolean }>
getProgressMap(enrollmentId): Promise<Record<lessonId, LessonProgressState>>   // pour le curriculum UI
```

### Invariants & idempotence (cœur de la robustesse)

- `LessonProgress @@unique([enrollmentId, lessonId])` → upsert.
- **Heartbeat monotone** : `positionSec` n'est mis à jour que si `> ancien` (reprise = max vu) ; `watchedSecCumul += watchedDeltaSec` borné (anti-triche léger : un delta > intervalle réel × marge est clampé — **temps serveur**, pas client). Donc rejouable sans gonfler le temps.
- **Complétion auto** d'une leçon vidéo : déclenchée quand `watchedSecCumul ≥ seuil` (ex. 90 % de `videoDureeSec`) — `markLessonComplete` est alors appelée en interne (idempotent : `alreadyCompleted` si déjà fait, pas de second event/email).
- `markLessonComplete` écrit un **event** `event-service.record("completed", lessonId)` (xAPI-like) DANS la transaction, puis déclenche `enrollment-service.recomputeCompletion` + réévaluation des déverrouillages dépendants (`unlock-service`).
- Throttle : le client envoie un heartbeat ~ toutes les 15–30 s ; le service tolère les rejeux/désordre (monotone). Pas de blocage UI (fire-and-forget côté action, comme `lastUsedAt` du portail).
- **Stub-aware** : `getProgressMap`/`getResumePoint` → vide ; mutations → no-op silencieux côté heartbeat (pour ne pas casser un éventuel rendu), ou `STUB_DB` selon l'appelant.

---

## 10. Service Déverrouillage (drip + gating) — `progress/unlock-service.ts`

**Responsabilité.** Décider si un module/leçon est **déverrouillé** pour un enrollment, **et pourquoi pas** sinon. Implémente l'enum `ElearningUnlockType` (`immediat`, `apres_precedent`, `date_fixe`, `offset_inscription`, `score_quiz`). Best practices 2026 : 3 déclencheurs de drip + **gating par score réel** (pas attempt-only) + raison affichée + **override admin**.

```ts
isModuleUnlocked(enrollmentId, moduleId): Promise<UnlockState>
isLessonUnlocked(enrollmentId, lessonId): Promise<UnlockState>
nextUnlockHint(enrollmentId, courseId): Promise<UnlockHint | null>   // "débloqué le JJ/MM" ou "réussir le quiz X"
setAdminOverride(enrollmentId, targetId, unlocked: boolean): Promise<void>  // override manuel tracé
```

```ts
type UnlockState =
  | { unlocked: true }
  | {
      unlocked: false;
      raison: "precedent_incomplet" | "date_future" | "offset_non_atteint" | "score_insuffisant";
      detail?: { date?: Date; quizId?: string; requis?: number; obtenu?: number };
    };
```

### Règles par `unlockType`

- `immediat` → toujours `unlocked: true`.
- `apres_precedent` → l'élément précédent (par `ordre`) doit être **complété** (`LessonProgress.completedAt != null` / tous les éléments du module précédent complétés).
- `date_fixe` → `now >= unlockDate`.
- `offset_inscription` → `now >= ElearningEnrollment.grantedAt + unlockOffsetJours` (ancre = date d'octroi, §6).
- `score_quiz` → **gating par score réel** : `quiz-service.getBestScore(enrollmentId, unlockQuizId) >= unlockScorePct` (vraie note, pas « a tenté »). Refus → `raison: "score_insuffisant"` + `{ requis, obtenu }`.

### Invariants

- **Override admin** (`setAdminOverride`, `requireAdminWrite`) prime sur toute règle, tracé dans `ElearningEvent` (qui/quand/pourquoi) — exigé pour SAV et accessibilité.
- Service **pur de lecture** (pas d'écriture sauf override) → cacheable par requête ; combine plusieurs verrous (un élément peut cumuler drip + gating, tous doivent passer).
- Appelé systématiquement par `course-read-service.getLessonForLearner` (§3) — **chokepoint unique** anti-IDOR/anti-bypass.

---

## 11. Service Quiz — `quiz/quiz-service.ts` (+ `quiz-grading.ts`, `quiz-bank-service.ts`)

**Responsabilité.** Moteur de quiz **interactif** (MANQUE identifié) : démarrage de tentative, soumission, **scoring serveur**, gating. `EvaluationAcquis`/`Questionnaire` Qualiopi **stockent des résultats mais n'ont pas de moteur** — on construit `ElearningQuiz/Question/QuizAttempt/Answer` (doc 03). Optionnellement, une tentative réussie peut **écrire un `EvaluationAcquis`** (réutilisation) pour alimenter les preuves Qualiopi.

```ts
// Tentative
startAttempt(enrollmentId, quizId): Promise<{ attemptId; questions: QuestionForLearner[]; deadlineAt?: Date }>
saveDraftAnswer(attemptId, questionId, answer: AnswerInput): Promise<void>     // autosave
submitAttempt(attemptId, answers: AnswerInput[]): Promise<AttemptResult>
getBestScore(enrollmentId, quizId): Promise<number>      // utilisé par unlock-service (gating)
listAttempts(enrollmentId, quizId): Promise<AttemptSummary[]>

// Correction manuelle (essai / upload) — admin
listPendingManualGrading(courseId): Promise<PendingItem[]>
gradeManualAnswer(answerId, input: { points; feedback }): Promise<void>
```

### Types de questions supportés (correction dans `quiz-grading.ts`, fonctions **pures**)

QCM mono, QCM multi, vrai/faux, appariement, texte à trous, ordonnancement, réponse courte (match normalisé/regex), **essai** (correction manuelle), **upload** (correction manuelle). Chaque type : `grade(question, answer): { points; max; auto: boolean }`. Pondération par question. `quiz-grading.ts` est **sans I/O** (100 % testable Vitest).

### Invariants & anti-triche (CNIL-proportionné)

- **Scoring 100 % serveur** : le client ne calcule jamais la note. `QuestionForLearner` n'expose **pas** les bonnes réponses (les solutions ne quittent jamais le serveur avant soumission).
- **Tentatives** : `ElearningQuiz.maxAttempts` (null = illimité). `startAttempt` refuse si plus de tentatives (`QUIZ_NO_ATTEMPTS_LEFT`).
- **Temps serveur** : `deadlineAt = startedAt + tempsLimiteSec` ; `submitAttempt` refuse après deadline (`QUIZ_TIME_EXPIRED`) — l'horloge fait foi côté serveur (anti-triche léger, pas de proctoring sauf high-stakes RNCP futur).
- **Randomisation** (V1, `quiz-bank-service`) : tirage **N parmi M** depuis la banque + shuffle des questions **et** des réponses, seed stocké dans la tentative (rejouable/auditable).
- **Seuil & gating** : `scorePct >= seuilReussitePct` → `reussite=true`. `getBestScore` renvoie la **meilleure** tentative → consommé par `unlock-service` (vraie note).
- **Feedback configurable** : immédiat vs après clôture, avec/sans rationale (`ElearningQuiz.feedbackMode`).
- **Idempotence** : `submitAttempt` sur une tentative déjà `soumise` → retourne le résultat existant (`QUIZ_ATTEMPT_CLOSED` si re-soumission distincte). `@@unique` sur tentative active par (enrollment, quiz) si `maxAttempts` impose la sérialisation ; sinon `isolationLevel: Serializable` pour empêcher deux tentatives concurrentes au-delà du quota.
- **Transaction `submitAttempt`** : (1) verrouille la tentative, (2) corrige chaque réponse (auto), (3) calcule le score, (4) écrit `ElearningQuizAttempt` + `ElearningAnswer`, (5) écrit l'event `answered`/`passed`, (6) si réussite → `enrollment-service.recomputeCompletion` + réévaluation `unlock-service`, (7) option : `EvaluationAcquis.create` (preuve Qualiopi). Les questions **manuelles** laissent la tentative en `en_attente_correction` (score partiel) jusqu'à `gradeManualAnswer`.

---

## 12. Service Certificats — `certificates/certificate-service.ts`

**Responsabilité.** Émettre le **certificat de réalisation** e-learning (modèle officiel, heures réalisées, obligatoire depuis 01/06/2020). **Réutilise** `generateDocument` (numérotation séquentielle `AXI-…`, hash SHA-256, R2, QR public, rétention) avec `DocumentType.certificat_realisation` **déjà existant**.

```ts
isEligibleForCertificate(enrollmentId): Promise<{ eligible: boolean; raison?: string }>
issueCertificate(enrollmentId): Promise<{ documentId; numero; qrToken; pdfUrl: string | null }>
getCertificateForLearner(enrollmentId): Promise<CertificateDTO | null>
```

### Invariants

- **Éligibilité** = `completionPct=100` (leçons obligatoires) ET `seuilReussitePct` global du cours atteint sur les quiz bloquants. Sinon `CERTIFICATE_NOT_ELIGIBLE` (raison explicite).
- **Heures réalisées** : calculées depuis `LessonProgress.watchedSecCumul` agrégé + temps quiz, converties en **centièmes d'heures** (cohérent avec le format Qualiopi existant des certificats présentiels). Si `estFoad`, mention FOAD + durée moyenne (D.6313-3-1 §2).
- **QR public** : `makeQrToken()` → vérifiable via la route publique de vérification existante (`/verifier-attestation/[token]` réutilisée, ou route e-learning dédiée). `qrDataUrl` pour le rendu PDF.
- **Idempotence** : un seul certificat par enrollment → `@@unique` (champ `certificateDocumentId` sur `ElearningEnrollment`, doc 02). `issueCertificate` ré-appelé = retourne l'existant (ne régénère pas un nouveau numéro).
- **Rattachement** : `DocumentGenere` lié via `traineeId` (+ `formationId` si cours adossé) → apparaît automatiquement dans le **portail stagiaire** existant (`getEspaceStagiaire`) sans code supplémentaire côté portail.
- **Stub-aware** : hérite du early-exit de `generateDocument` (retourne un doc stub au build).

---

## 13. Service Preuves FOAD — `compliance/foad-evidence-service.ts`

**Responsabilité.** Constituer/exporter le **faisceau de preuves** exigé par R.6313-3 (preuve libre : pas d'émargement obligatoire, mais évaluations + travaux + **logs LMS** + traces d'accompagnement ; relevé de connexion seul insuffisant). Indispensable pour OPCO en contrôle + dossier RNCP futur.

```ts
buildEvidenceBundle(enrollmentId): Promise<EvidenceBundle>      // agrège progression + quiz + events + assistance
exportEvidencePdf(enrollmentId): Promise<{ documentId; pdfUrl: string | null }>
getAssistanceLog(enrollmentId): Promise<AssistanceEntry[]>      // Ind.19 tutorat
```

### Invariants

- Agrège : `LessonProgress` (assiduité/temps), `ElearningQuizAttempt` (évaluations jalonnantes — **Ind.11 majeur**), `ElearningEvent` (journal xAPI-like horodaté), traces d'assistance pédagogique (Ind.19 — tutorat/tuteur RAG V1, délais formalisés).
- **Rétention** alignée sur l'existant `DocumentGenere.suppressionPrevueAt` et les durées légales : 10 ans comptable, 6 ans fiscal/OPCO, 3–5 ans preuves de réalisation, 6 mois–1 an logs techniques (CNIL). Les `ElearningEvent` techniques bruts purgés plus tôt que les agrégats de preuve.
- `exportEvidencePdf` réutilise `generateDocument` (archivage R2 + hash). **Idempotent** : régénérable à la demande (la preuve est immuable une fois la formation close).
- **EDOF** (`EDOF_ENABLED=false` par défaut) : les hooks « entrée effective = 1re connexion substantielle » et « service fait » sont **calculables** depuis les events dès le MVP, mais **non transmis** tant que le flag est off (ADR-0003).

---

## 14. Touchpoints Workers / Queues (détail dans `03-workers-bullmq-crons.md`)

Les services ci-dessus sont **synchrones** ; les tâches longues/rejouables passent par BullMQ (queues `null` si `BULLMQ_DISABLED=true`, pattern `queues.ts`). Workers neufs (`src/server/queue/workers/elearning-*-worker.ts`) :

| Worker                                 | Appelle                                                     | Idempotence                    |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| `elearning-import-worker.ts`           | `grant-service.grantBulk`                                   | `idempotencyKey = batchId:row` |
| `elearning-grant-email-worker.ts`      | email magic-link bienvenue (Nodemailer)                     | jobId = grantId                |
| `elearning-video-ingest-worker.ts`     | poll Cloudflare Stream → set `videoAssetId`/`videoDureeSec` | par assetId                    |
| `elearning-reminder-worker.ts` (V1)    | relance anti-décrochage (Ind.12)                            | par (enrollment, fenêtre)      |
| `elearning-certificate-worker.ts`      | `certificate-service.issueCertificate` (auto à 100 %)       | par enrollment                 |
| `elearning-retention-worker.ts` (cron) | purge events techniques selon CNIL                          | par fenêtre date               |

> **Règle** rappelée : toute fonction appelée par un worker DOIT être idempotente (§1.6).

---

## 15. Matrice d'idempotence (synthèse)

| Opération               | Mécanisme                         | Clé                                 |
| ----------------------- | --------------------------------- | ----------------------------------- |
| `getOrCreateEnrollment` | `@@unique` + upsert               | `(accountId, courseId)`             |
| `grantManual/grantBulk` | `idempotencyKey @unique`          | `hash(courseId\|accountId\|source)` |
| `import (batch)`        | clé dérivée du batch              | `batchId:rowEmail`                  |
| `recordHeartbeat`       | no-op monotone                    | position max / cumul borné          |
| `markLessonComplete`    | flag `completedAt`                | `(enrollmentId, lessonId)`          |
| `submitAttempt`         | tentative verrouillée + état clos | `attemptId`                         |
| `issueCertificate`      | `@@unique` enrollment↔doc         | `certificateDocumentId`             |
| `consumeMagicLink`      | `usedAt` à usage unique           | `token`                             |
| `ensureAccountFor*`     | upsert                            | `traineeId` / `email` (citext)      |

---

## 16. Conventions de codage (rappel pour l'implémenteur)

- TypeScript strict + `exactOptionalPropertyTypes` (cohérent repo) : champs optionnels jamais `undefined` explicite dans les `data` Prisma.
- Imports Prisma via `@/lib/prisma` ; types générés via le chemin du repo (`prisma/generated/client`, cf. `portail-service.ts`).
- Aucune chaîne d'erreur nue → `ElearningError` typée.
- Aucune logique métier dans les Server Actions/routes (elles orchestrent authz + appel service + revalidate).
- Tests Vitest : `quiz-grading.ts`, `unlock-service.ts`, `import-service.parseCsv` sont **purs** → couverture prioritaire. Mock Prisma distinct (non affecté par le stub Proxy build-time, cf. AGENTS.md).
- Respect budgets Web Vitals : les services renvoient des DTO **minces** (pas de sur-fetch) pour limiter le JS/données côté lecteur (`/cours/*` à surveiller, risque INP sur le player).

---

## Liens

- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson/Resource` + enums (figés)
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, `ElearningEvent`
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `ElearningQuiz/Question/QuizAttempt/Answer`
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `ElearningAccount/Session/MagicLink`
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `ElearningOrder/Grant/ImportBatch`
- `04-BACKEND/02-server-actions.md` — actions qui appellent ces services
- `04-BACKEND/03-workers-bullmq-crons.md` — workers/crons e-learning
- `04-BACKEND/05-authentification-apprenant.md` — détail auth apprenant (§5)
- `04-BACKEND/06-import-masse-provisioning.md` — détail import (§8)
- `04-BACKEND/07-pipeline-video-streaming.md` — Cloudflare Stream (§3/§4)
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique UX des verrous (§10)
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — faisceau de preuves FOAD (§13)
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth), 0004 (Stripe), 0007 (cloisonnement), 0008 (migrations)
