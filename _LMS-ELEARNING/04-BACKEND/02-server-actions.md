# Backend — Server Actions LMS (admin + apprenant)

> **But du document.** Spécifier **toutes** les Server Actions du LMS e-learning, prêtes à coder par une équipe senior : pour chacune → **input Zod**, **guard RBAC**, **effet** (mutations Prisma / enqueue worker / R2), **retour `ActionResult`**, **revalidation**, **comportement stub-aware**.
>
> **Architecture imposée :** Next.js 16.2 App Router, **Server Actions par défaut (pas de REST)**, Prisma 5.22, Postgres, NextAuth v5 pour l'admin, **auth apprenant SÉPARÉE** (ADR-LMS-0001), BullMQ. Code cloisonné sous `src/server/elearning/**` (ADR-LMS-0007). Migrations additives (ADR-LMS-0008).
>
> **Statut des dépendances data model :** le cœur (`ElearningCourse/Module/Lesson/Resource`, enums) est figé dans [`03-DATA-MODEL/01-schema-cours-modules-lecons.md`](../03-DATA-MODEL/01-schema-cours-modules-lecons.md). Les modèles **progression** (`ElearningEnrollment`, `LessonProgress`, `ElearningAccessGrant`) et **quiz** (`Quiz`, `Question`, `QuizAttempt`, `QuizAnswer`) sont décrits dans `02-schema-progression-tracking.md` et `03-schema-quiz-evaluations.md` (en cours de rédaction). Ce document **fixe les noms de champs attendus** par les actions ; tout écart doit être réconcilié dans les docs data model.

---

## 0. Conventions communes (à coder UNE fois, réutilisées partout)

### 0.1 Type de retour — `ActionResult`

On reprend **à l'identique** le pattern déjà en place dans le repo (`src/server/actions/formateur/coaching.actions.ts:24` et `src/server/actions/knowledge/create-entry.ts:26`). On le centralise pour le LMS :

```ts
// src/server/elearning/actions/_types.ts
export interface ActionResult<T = undefined> {
  readonly ok: boolean;
  readonly error?: string; // code machine (ex: "forbidden", "validation", "not_found")
  readonly fieldErrors?: Record<string, string[] | undefined>; // Zod flatten().fieldErrors
  readonly id?: string; // id de l'entité créée/affectée (compat coaching.actions)
  readonly data?: T; // payload typé (ex: progress %, signed URL, attempt result)
}

export const OK: ActionResult = { ok: true };
export const FORBIDDEN: ActionResult = { ok: false, error: "forbidden" };
export const NOT_FOUND: ActionResult = { ok: false, error: "not_found" };
```

> **Doctrine d'erreur.** Les actions **ne throw pas** pour les erreurs métier (validation, not_found, forbidden hors guard) → elles retournent `{ ok:false, error }`. Les **guards** (`requireAdminWrite`…) **throw** `"unauthorized"`/`"forbidden"` (comportement existant conservé : c'est attrapé par l'error boundary admin). Les erreurs inattendues sont `console.error` + `{ ok:false, error:"unknown" }`.

### 0.2 Guards RBAC — admin (EXISTANT, réutilisé tel quel)

Réutiliser **sans copier** `src/server/actions/knowledge/_guards.ts` :

| Guard                   | Rôles autorisés                            | Usage LMS                                               |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `requireAdminRead()`    | `super_admin`, `admin`, `editor`, `reader` | listings, lecture builder, reporting                    |
| `requireAdminWrite()`   | `super_admin`, `admin`, `editor`           | CRUD cours/modules/leçons/quiz, octroi d'accès          |
| `requireAdminPublish()` | `super_admin`, `admin`                     | publier/archiver un cours, émettre un certificat manuel |
| `requireAdminDelete()`  | `super_admin`                              | suppression dure d'un cours/quiz                        |

Import : `import { requireAdminWrite } from "@/server/actions/knowledge/_guards";` (ces guards sont **génériques**, pas spécifiques KB ; on peut soit les réutiliser, soit les ré-exporter depuis `src/server/elearning/actions/_guards.ts` pour le cloisonnement — **décision : ré-export fin** pour respecter ADR-0007 sans dupliquer la logique) :

```ts
// src/server/elearning/actions/_guards.ts
export {
  requireAdminRead,
  requireAdminWrite,
  requireAdminPublish,
  requireAdminDelete,
  type AdminSession,
} from "@/server/actions/knowledge/_guards";
```

### 0.3 Guard RBAC — apprenant (NEUF, système séparé de NextAuth)

Les actions apprenant **n'utilisent jamais NextAuth** (ADR-LMS-0001). Elles s'appuient sur le **cookie apprenant** posé par l'auth apprenant (cf. [`05-authentification-apprenant.md`](./05-authentification-apprenant.md)). Le guard renvoie le **`learnerId`** (= `Trainee.id` réutilisé, cf. EXISTANT) :

```ts
// src/server/elearning/auth/learner-guard.ts (spécifié en détail dans 05-*)
export interface LearnerSession {
  readonly learnerId: string; // = Trainee.id (PII existant réutilisé)
  readonly enrollmentScopeIds: readonly string[]; // ElearningEnrollment.id actifs (cache)
}

/** Throw "unauthorized" si pas de session apprenant valide. */
export async function requireLearner(): Promise<LearnerSession>;
```

> **EXISTANT réutilisé.** L'auth magic-link s'appuie sur le `PortailAcces` (token 64 hex, cookie HttpOnly 90j — `src/server/qualiopi/portail/portail-service.ts:verifierToken`). L'auth e-learning **étend** ce mécanisme (cf. ADR-0001 + doc 05) ; le `learnerId` retourné est le `traineeId` résolu par `verifierToken`. **Aucune** action apprenant ne fait confiance à un `learnerId` passé en argument : il vient **toujours** du guard.

**Règle d'ownership (apprenant).** Toute action apprenant qui touche une `ElearningEnrollment` / `LessonProgress` / `QuizAttempt` vérifie que la ressource **appartient au `learnerId` du guard** (pattern `assertOwnership` de `coaching.actions.ts:33`). Jamais d'accès cross-apprenant.

### 0.4 Validation Zod

Schémas regroupés dans `src/server/elearning/actions/_schemas.ts` (testés dans `_schemas.test.ts`, comme `knowledge/_zod-schemas.test.ts`). Toujours `safeParse` → `{ ok:false, error:"validation", fieldErrors }` en cas d'échec.

### 0.5 Stub-aware (contrat build `stub.invalid`, ADR plateforme)

Toute action **mutante** commence par :

```ts
if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
  return { ok: false, error: "stub_db" };
}
```

(les actions sont derrière auth + `force-dynamic` → jamais appelées au SSG build, mais on garde la garde par défense en profondeur, alignée sur `portail-service.ts:111`).

### 0.6 Revalidation

- Admin : `revalidatePath("/" + adminPrefix + "/elearning/...")` + `revalidateTag("elearning-course:" + courseId)` après mutation de structure.
- Public/apprenant : `revalidatePath("/fr/apprendre/[slug]")` lors d'une **publication** (le catalogue public est ISR ; cf. `05-FRONTEND-APPRENANT/07-*`).
- Le cache `dureeEstimeeMinutes` (cours) est recalculé en transaction à chaque mutation de leçon (cf. helper `recomputeCourseDuration`).

### 0.7 Audit log

Réutiliser le pattern `logKbActivity` (`src/server/actions/knowledge/_audit.ts`) via un helper LMS `logElearningActivity` écrivant dans `ActivityLog` (modèle existant) avec `action` préfixé `elearning.*` (ex. `elearning.course.published`, `elearning.access.granted`, `elearning.certificate.issued`). IP/UA lus via `headers()` + `getClientIp()` (`@/lib/client-ip`), comme dans `create-entry.ts:52`.

### 0.8 Arborescence des fichiers cibles

```
src/server/elearning/
├─ actions/
│  ├─ _types.ts            # ActionResult, OK/FORBIDDEN/NOT_FOUND
│  ├─ _guards.ts           # ré-export admin guards
│  ├─ _schemas.ts          # tous les schémas Zod
│  ├─ _schemas.test.ts
│  ├─ _audit.ts            # logElearningActivity
│  ├─ _revalidate.ts       # helpers revalidatePath/Tag
│  ├─ course.actions.ts    # CRUD + publish/archive cours
│  ├─ module.actions.ts    # CRUD + reorder modules
│  ├─ lesson.actions.ts    # CRUD + reorder + upload média leçons
│  ├─ resource.actions.ts  # upload R2 ressources + sous-titres
│  ├─ quiz.actions.ts      # CRUD quiz + questions + banque
│  ├─ access.actions.ts    # octroyer/révoquer/inscrire/import CSV
│  ├─ progress.actions.ts  # heartbeat / complétion leçon / reprise   (APPRENANT)
│  ├─ quiz-attempt.actions.ts # démarrer/soumettre/noter quiz         (APPRENANT)
│  └─ certificate.actions.ts  # émission certificat de réalisation
├─ services/               # logique domaine pure (cf. 01-services-domaine.md)
│  ├─ unlock.ts            # moteur de déverrouillage (drip + gating score)
│  ├─ grading.ts           # correction auto des 12 types de questions
│  ├─ completion.ts        # calcul % complétion + éligibilité certificat
│  └─ provisioning.ts      # création/octroi d'accès + idempotence
└─ auth/learner-guard.ts   # cf. doc 05
```

---

## 1. Server Actions ADMIN — CRUD Cours

Fichier : `src/server/elearning/actions/course.actions.ts` (`"use server"`).

### 1.1 `createCourseAction`

- **Guard :** `requireAdminWrite()`.
- **Input Zod (`createCourseSchema`) :**

```ts
const createCourseSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
  titre: z.string().trim().min(3).max(250),
  sousTitre: z.string().trim().max(300).optional(),
  description: z.string().max(20_000).optional(),
  objectifs: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  prerequis: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  publicVise: z.string().trim().max(300).optional(),
  langue: z.string().length(2).default("fr"),
  estFoad: z.boolean().default(true),
  seuilReussitePct: z.number().int().min(0).max(100).default(70),
  vendableSeul: z.boolean().default(false),
  formationId: z.string().uuid().optional(), // EXISTANT: Formation Qualiopi
  ownerClientId: z.string().uuid().optional(), // EXISTANT: Client (multi-tenant V2)
});
```

- **Effet :** vérifie l'unicité `slug` (`prisma.elearningCourse.findUnique({ where:{ slug } })` → `slug_already_used` si présent). Crée `ElearningCourse` `{ statut: "brouillon", version: 1, createdById: session.userId }`. Si `formationId` fourni, valide qu'il existe (`prisma.formation.findUnique`). Audit `elearning.course.created`.
- **Retour :** `{ ok:true, id: course.id }`.

### 1.2 `updateCourseAction`

- **Guard :** `requireAdminWrite()`.
- **Input :** `updateCourseSchema = createCourseSchema.partial().extend({ id: z.string().uuid() })` (le `slug` modifiable mais re-checké unique en excluant l'id courant).
- **Effet :** `prisma.elearningCourse.update`. Si le cours est `publie` et qu'on modifie un champ structurant (titre/objectifs/seuil), **on ne re-publie pas** automatiquement (la version reste) mais on `revalidateTag` le cours. Audit `elearning.course.updated` avec le diff des champs.
- **Retour :** `{ ok:true, id }`.

### 1.3 `publishCourseAction`

- **Guard :** `requireAdminPublish()` (séparation des pouvoirs : un `editor` rédige, un `admin` publie).
- **Input :** `z.object({ id: z.string().uuid() })`.
- **Effet (transaction) :**
  1. Charge le cours + modules + leçons.
  2. **Gate de publication** (validation métier, retourne `{ ok:false, error:"publish_blocked", fieldErrors }` détaillant les manques) :
     - ≥ 1 module, chaque module ≥ 1 leçon ;
     - aucune leçon `type=video` sans `videoAssetId` **prêt** (statut transcodage `ready`, cf. doc 07) ;
     - aucune leçon `type=quiz` sans `quizId` valide et **publié** ;
     - si `estFoad=true` : au moins **une évaluation jalonnante** (≥ 1 quiz) — **exigence FOAD Ind.11**, non-conformité majeure si absente (cf. `08-CONFORMITE/02-*`) ;
     - `dureeEstimeeMinutes` agrégé > 0 (information de durée — D.6313-3-1 §2).
  3. `update { statut:"publie", version: { increment: 1 }, publishedAt: now, publishedById }`.
  4. `recomputeCourseDuration(tx, id)`.
  5. `revalidatePath("/fr/apprendre/" + slug)` + `revalidateTag`.
  6. Audit `elearning.course.published` (version).
- **Retour :** `{ ok:true, id, data: { version } }`.

### 1.4 `archiveCourseAction`

- **Guard :** `requireAdminPublish()`.
- **Input :** `z.object({ id: z.string().uuid() })`.
- **Effet :** `statut: "archive"` (jamais de DROP — conservation des preuves ADR-0008). Les accès existants restent lisibles (les apprenants en cours terminent) mais le cours sort du catalogue. Audit `elearning.course.archived`.
- **Retour :** `OK`.

### 1.5 `deleteCourseAction`

- **Guard :** `requireAdminDelete()` (super_admin uniquement).
- **Input :** `z.object({ id: z.string().uuid(), confirmSlug: z.string() })` — anti-erreur : `confirmSlug` doit égaler le slug réel.
- **Effet :** **refus** si le cours a des `ElearningEnrollment` (`enrollments` count > 0) → `{ ok:false, error:"has_enrollments" }` (on archive, on ne supprime pas un cours suivi → preuves FOAD). Sinon hard delete (cascade modules/leçons/ressources via `onDelete: Cascade`). Audit `elearning.course.deleted`.
- **Retour :** `OK`.

### 1.6 `duplicateCourseAction` (V1, listée pour complétude)

- **Guard :** `requireAdminWrite()`. Clone profond (modules/leçons/quiz/ressources) en `brouillon`, slug suffixé `-copie`. Détaillé en V1 (`06-CONSOLE-ADMIN/03-*`).

---

## 2. Server Actions ADMIN — Modules

Fichier : `src/server/elearning/actions/module.actions.ts`.

### 2.1 `createModuleAction`

- **Guard :** `requireAdminWrite()`.
- **Input :**

```ts
const createModuleSchema = z
  .object({
    courseId: z.string().uuid(),
    titre: z.string().trim().min(2).max(250),
    description: z.string().max(5_000).optional(),
    unlockType: z
      .enum(["immediat", "apres_precedent", "date_fixe", "offset_inscription", "score_quiz"])
      .default("apres_precedent"),
    unlockDate: z.string().datetime().optional(),
    unlockOffsetJours: z.number().int().min(0).max(365).optional(),
    unlockQuizId: z.string().uuid().optional(),
    unlockScorePct: z.number().int().min(0).max(100).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.unlockType === "date_fixe" && !v.unlockDate)
      ctx.addIssue({ code: "custom", path: ["unlockDate"], message: "requis" });
    if (v.unlockType === "offset_inscription" && v.unlockOffsetJours == null)
      ctx.addIssue({ code: "custom", path: ["unlockOffsetJours"], message: "requis" });
    if (v.unlockType === "score_quiz" && (!v.unlockQuizId || v.unlockScorePct == null))
      ctx.addIssue({ code: "custom", path: ["unlockQuizId"], message: "quiz + seuil requis" });
  });
```

- **Effet :** calcule `ordre = (max(ordre) du cours) + 1` (respecte `@@unique([courseId, ordre])`). Crée le module. Audit `elearning.module.created`.
- **Retour :** `{ ok:true, id }`.

### 2.2 `updateModuleAction`

- **Guard :** `requireAdminWrite()`. **Input :** schéma partiel + `id`. **Effet :** update (hors `ordre`, géré par reorder). **Retour :** `{ ok:true, id }`.

### 2.3 `reorderModulesAction`

- **Guard :** `requireAdminWrite()`.
- **Input :** `z.object({ courseId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).min(1) })`.
- **Effet (transaction) :** vérifie que `orderedIds` = exactement l'ensemble des modules du cours (anti-injection). Réécrit `ordre` 0..N-1. **Astuce conflit `@@unique`** : décaler d'abord vers un offset négatif (ou `ordre = ordre + 1000`) puis réassigner, dans la même transaction (pattern drag&drop, cf. doc data model §8). Audit `elearning.module.reordered`.
- **Retour :** `OK`.

### 2.4 `deleteModuleAction`

- **Guard :** `requireAdminWrite()`. **Input :** `{ id }`. **Effet :** delete (cascade leçons) + re-compactage des `ordre` + `recomputeCourseDuration`. Refus si une leçon du module a des `LessonProgress` enregistrés (preuve) → préférer désactivation. **Retour :** `OK`.

---

## 3. Server Actions ADMIN — Leçons

Fichier : `src/server/elearning/actions/lesson.actions.ts`.

### 3.1 `createLessonAction`

- **Guard :** `requireAdminWrite()`.
- **Input :**

```ts
const createLessonSchema = z.object({
  moduleId: z.string().uuid(),
  titre: z.string().trim().min(2).max(250),
  type: z.enum(["video","texte","pdf","quiz","embed","devoir"]),
  contenuJson: z.unknown().optional(),          // blocs Tiptap (texte/embed)
  videoAssetId: z.string().max(120).optional(), // Cloudflare Stream uid
  videoDureeSec: z.number().int().min(0).optional(),
  pdfKey: z.string().max(300).optional(),       // clé R2
  quizId: z.string().uuid().optional(),
  dureeEstimeeMinutes: z.number().int().min(0).max(600).optional(),
  obligatoire: z.boolean().default(true),
  unlockType: z.enum([...]).default("apres_precedent"),  // mêmes champs que module
  unlockDate: z.string().datetime().optional(),
  unlockOffsetJours: z.number().int().min(0).optional(),
  unlockQuizId: z.string().uuid().optional(),
  unlockScorePct: z.number().int().min(0).max(100).optional(),
}).superRefine(/* type=quiz ⇒ quizId requis ; type=pdf ⇒ pdfKey requis ; type=video ⇒ videoAssetId attendu (warning si absent) */);
```

- **Effet :** `ordre = max+1` dans le module. Crée la leçon. `recomputeCourseDuration`. Audit `elearning.lesson.created`.
- **Retour :** `{ ok:true, id }`.

### 3.2 `updateLessonAction`

- **Guard :** `requireAdminWrite()`. Schéma partiel + `id`. Recompute durée si `dureeEstimeeMinutes`/`videoDureeSec` changent. **Retour :** `{ ok:true, id }`.

### 3.3 `reorderLessonsAction`

- **Guard :** `requireAdminWrite()`. **Input :** `{ moduleId, orderedIds }`. Même technique que reorder modules. **Retour :** `OK`.

### 3.4 `deleteLessonAction`

- **Guard :** `requireAdminWrite()`. Refus si `LessonProgress` existant. Sinon delete (cascade ressources) + compactage `ordre` + recompute durée. **Retour :** `OK`.

### 3.5 `requestLessonVideoUploadAction` (préparation upload vidéo)

- **Guard :** `requireAdminWrite()`.
- **Input :** `z.object({ lessonId: z.string().uuid(), filename: z.string(), sizeBytes: z.number().int().max(5_000_000_000) })`.
- **Effet :** appelle le service vidéo (`createDirectUpload`, cf. [`07-pipeline-video-streaming.md`](./07-pipeline-video-streaming.md)) → Cloudflare Stream **Direct Creator Upload** (URL one-time). Stocke `videoAssetId` provisoire (statut `uploading`) sur la leçon. Le **transcodage** et le passage `ready` sont gérés par le webhook Stream + worker `elearning-video-worker.ts`.
- **Retour :** `{ ok:true, data: { uploadUrl, videoAssetId } }`.

> **Distinction R2 vs Stream (ADR-0005).** La **vidéo** ne passe **jamais** par R2 (`videoAssetId` Cloudflare Stream). Les **PDF / images / sous-titres / pièces de devoir** passent par R2 via `src/lib/r2-storage.ts`.

---

## 4. Server Actions ADMIN — Ressources (R2)

Fichier : `src/server/elearning/actions/resource.actions.ts`. **EXISTANT réutilisé :** `getSignedUploadUrlR2`, `uploadToR2`, `getSignedUrlR2` (`src/lib/r2-storage.ts`).

### 4.1 `requestResourceUploadAction` (upload direct navigateur → R2)

- **Guard :** `requireAdminWrite()`.
- **Input :** `z.object({ lessonId: z.string().uuid(), titre: z.string().max(250), type: z.enum(["pdf","image","audio","fichier","sous_titres"]), mimeType: z.string().max(120), sizeBytes: z.number().int().max(200_000_000) })`.
- **Effet :** construit une clé déterministe `elearning/courses/<courseId>/lessons/<lessonId>/<uuid>-<filename>` ; renvoie `getSignedUploadUrlR2(key, mimeType, 900)`. **N'écrit pas encore en DB** (le navigateur PUT, puis confirme).
- **Retour :** `{ ok:true, data: { uploadUrl, r2Key } }`.

### 4.2 `confirmResourceAction`

- **Guard :** `requireAdminWrite()`.
- **Input :** `z.object({ lessonId, titre, type, r2Key, mimeType, sizeBytes, telechargeable: z.boolean().default(false) })`.
- **Effet :** `existsInR2(r2Key)` (idempotence) ; crée `ElearningResource`. Si `type=sous_titres`, lie le VTT à la leçon vidéo (WCAG — sous-titres obligatoires, cf. `05-FRONTEND/05-*`). Audit `elearning.resource.added`.
- **Retour :** `{ ok:true, id }`.

### 4.3 `deleteResourceAction`

- **Guard :** `requireAdminWrite()`. Supprime la ligne ; **option** `deleteFromR2` seulement si la ressource n'est pas une preuve légale rattachée (les pièces de **devoir** rendues par les apprenants ne sont **jamais** supprimées avant la rétention — cf. §9 rétention). **Retour :** `OK`.

---

## 5. Server Actions ADMIN — Quiz & banque de questions

Fichier : `src/server/elearning/actions/quiz.actions.ts`. Modèles attendus (`03-schema-quiz-evaluations.md`) : `Quiz`, `Question` (+ `QuestionOption` ou options en `Json`), `QuizAttempt`, `QuizAnswer`. Enum `QuestionType` (12 types) :

```
qcm_unique | qcm_multiple | vrai_faux | appariement | texte_a_trous |
ordonnancement | reponse_courte | essai | upload
(+ extensions : numerique, glisser_deposer, zone_cliquable)
```

### 5.1 `createQuizAction`

- **Guard :** `requireAdminWrite()`.
- **Input :**

```ts
const createQuizSchema = z.object({
  titre: z.string().trim().min(2).max(250),
  description: z.string().max(5_000).optional(),
  seuilReussitePct: z.number().int().min(0).max(100).default(70), // gating PAR SCORE
  maxTentatives: z.number().int().min(0).max(20).default(0), // 0 = illimité
  tempsLimiteSec: z.number().int().min(0).optional(), // temps SERVEUR (anti-triche léger)
  tirageAleatoireN: z.number().int().min(0).optional(), // N parmi M (banque)
  melangerQuestions: z.boolean().default(true),
  melangerReponses: z.boolean().default(true),
  feedbackMode: z
    .enum(["immediat", "apres_soumission", "apres_cloture", "aucun"])
    .default("apres_soumission"),
  afficherRationale: z.boolean().default(true),
});
```

- **Effet :** crée `Quiz` (statut `brouillon`). Audit `elearning.quiz.created`.
- **Retour :** `{ ok:true, id }`.

### 5.2 `updateQuizAction` / `publishQuizAction` / `deleteQuizAction`

- `update` : `requireAdminWrite()`, schéma partiel + `id`.
- `publish` : `requireAdminWrite()`, gate = ≥ 1 question + somme des pondérations cohérente + si `tirageAleatoireN` alors `N ≤ nb questions`. Passe `statut:"publie"`. Un quiz référencé par `unlockQuizId`/`lesson.quizId` doit être publié avant publication du cours (cf. §1.3).
- `delete` : `requireAdminDelete()`, refus si `QuizAttempt` existent (preuves) → archiver.

### 5.3 `upsertQuestionAction`

- **Guard :** `requireAdminWrite()`.
- **Input (discriminé par `type`)** — schéma Zod **discriminated union** :

```ts
const baseQuestion = z.object({
  id: z.string().uuid().optional(), // présent = update
  quizId: z.string().uuid(),
  enonce: z.string().trim().min(1).max(5_000),
  ponderation: z.number().min(0).max(100).default(1),
  rationale: z.string().max(5_000).optional(), // explication affichée après
  banque: z.boolean().default(false), // dispo pour tirage aléatoire
});
const questionSchema = z.discriminatedUnion("type", [
  baseQuestion.extend({
    type: z.literal("qcm_unique"),
    options: z
      .array(z.object({ texte: z.string(), correct: z.boolean() }))
      .min(2)
      .max(10)
      .refine((o) => o.filter((x) => x.correct).length === 1, "exactement 1 bonne réponse"),
  }),
  baseQuestion.extend({
    type: z.literal("qcm_multiple"),
    options: z
      .array(z.object({ texte: z.string(), correct: z.boolean() }))
      .min(2)
      .max(12)
      .refine((o) => o.some((x) => x.correct), "≥ 1 bonne réponse"),
  }),
  baseQuestion.extend({ type: z.literal("vrai_faux"), bonneReponse: z.boolean() }),
  baseQuestion.extend({
    type: z.literal("appariement"),
    paires: z
      .array(z.object({ gauche: z.string(), droite: z.string() }))
      .min(2)
      .max(10),
  }),
  baseQuestion.extend({
    type: z.literal("texte_a_trous"),
    gabarit: z.string(), // "Le {{0}} est {{1}}"
    trous: z.array(z.object({ index: z.number().int(), accepte: z.array(z.string()).min(1) })),
  }),
  baseQuestion.extend({
    type: z.literal("ordonnancement"),
    elements: z.array(z.string()).min(2).max(12) /* ordre stocké = ordre correct */,
  }),
  baseQuestion.extend({
    type: z.literal("reponse_courte"),
    accepte: z.array(z.string()).min(1),
    insensibleCasse: z.boolean().default(true),
  }),
  baseQuestion.extend({ type: z.literal("essai") /* correction MANUELLE */ }),
  baseQuestion.extend({
    type: z.literal("upload"),
    typesAcceptes: z.array(z.string()).default([]) /* correction MANUELLE */,
  }),
]);
```

- **Effet :** upsert `Question` (la clé de correction est stockée côté serveur **jamais renvoyée à l'apprenant**, cf. §7). Audit `elearning.question.upserted`.
- **Retour :** `{ ok:true, id }`.

### 5.4 `deleteQuestionAction`, `reorderQuestionsAction`, `generateQuizFromContentAction`

- `delete`/`reorder` : `requireAdminWrite()`, mêmes patterns.
- `generateQuizFromContentAction` (V1, IA) : `requireAdminWrite()`, input `{ lessonId | courseId, nbQuestions, types[] }` → **enqueue** worker `elearning-quiz-gen-worker.ts` (réutilise `@anthropic-ai/sdk` + RAG knowledge, cf. [`08-ia-pedagogique-generation.md`](./08-ia-pedagogique-generation.md)). Retour `{ ok:true, data:{ jobId } }` ; le quiz généré arrive en `brouillon` pour relecture humaine.

---

## 6. Server Actions ADMIN — Accès & inscriptions

Fichier : `src/server/elearning/actions/access.actions.ts`. **Cœur MVP** (ADR-0002/0004 : pas de multi-tenant, pas de CB → octroi manuel + import CSV). Service support : `src/server/elearning/services/provisioning.ts`.

Modèle attendu (`02-schema-progression-tracking.md`) :

- `ElearningEnrollment { id, courseId, learnerId(=traineeId), source(enum), statut(enum), grantedById, accessExpiresAt?, startedAt?, completedAt?, certificateDocumentId?, createdAt }`
- `source` ∈ `{ session_auto, manuel_admin, import_csv, commande, entreprise }`
- `statut` ∈ `{ actif, suspendu, termine, expire, revoque }`

### 6.1 `grantAccessAction` (octroi individuel manuel)

- **Guard :** `requireAdminWrite()`.
- **Input :**

```ts
const grantAccessSchema = z
  .object({
    courseId: z.string().uuid(),
    // Cibler un apprenant EXISTANT (traineeId) OU en créer un à la volée par email
    traineeId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    prenom: z.string().max(120).optional(),
    nom: z.string().max(120).optional(),
    source: z
      .enum(["manuel_admin", "session_auto", "commande", "entreprise"])
      .default("manuel_admin"),
    clientId: z.string().uuid().optional(), // EXISTANT Client (rattachement entreprise)
    accessExpiresAt: z.string().datetime().optional(),
    envoyerEmail: z.boolean().default(true), // déclenche le magic-link
  })
  .refine((v) => v.traineeId || v.email, "traineeId ou email requis");
```

- **Effet (service `provisionAccess`, idempotent) :**
  1. Résout/crée le `Trainee` (réutilise le modèle PII existant ; **ne stocke pas** de mot de passe ici — magic-link par défaut, ADR-0001).
  2. **Idempotence** : si une `ElearningEnrollment` `actif` existe déjà pour `(courseId, learnerId)` → retourne l'existante (`{ ok:true, id, data:{ alreadyGranted:true } }`), pas de doublon.
  3. Crée l'`ElearningEnrollment` `{ source, statut:"actif", grantedById: session.userId, clientId }`.
  4. Si `envoyerEmail` : **enqueue** un email d'accès (réutilise `emailsQueue` + template React Email `elearning-acces-ouvert.tsx`) contenant un **magic-link** (création `PortailAcces` via `creerAcces(traineeId)` EXISTANT, ou jeton d'accès e-learning dédié — cf. doc 05).
  5. Audit `elearning.access.granted`.
- **Retour :** `{ ok:true, id: enrollment.id }`.

### 6.2 `revokeAccessAction`

- **Guard :** `requireAdminWrite()`. **Input :** `{ enrollmentId }`. **Effet :** `statut:"revoque"` (jamais delete — la progression et les preuves restent). N'invalide pas les certificats déjà émis. Audit `elearning.access.revoked`. **Retour :** `OK`.

### 6.3 `updateAccessAction`

- **Guard :** `requireAdminWrite()`. **Input :** `{ enrollmentId, statut?, accessExpiresAt? }`. Permet suspendre/réactiver/prolonger. **Retour :** `OK`.

### 6.4 `bulkImportAccessAction` (import CSV entreprise — MVP)

- **Guard :** `requireAdminWrite()`.
- **Input :**

```ts
const bulkImportSchema = z.object({
  courseId: z.string().uuid(),
  clientId: z.string().uuid().optional(), // entreprise commanditaire
  source: z.literal("import_csv").default("import_csv"),
  rows: z
    .array(
      z.object({
        email: z.string().email(),
        prenom: z.string().max(120).optional(),
        nom: z.string().max(120).optional(),
      }),
    )
    .min(1)
    .max(5_000),
  envoyerEmails: z.boolean().default(true),
  accessExpiresAt: z.string().datetime().optional(),
});
```

- **Effet :** **n'exécute pas en ligne** pour > 50 lignes — **enqueue** le worker `elearning-bulk-provision-worker.ts` (idempotent, réutilise `provisionAccess` par ligne + dédoublonnage email + rapport d'erreurs par ligne). Pour ≤ 50 lignes, exécution synchrone possible. Retourne un `jobId` suivable. Audit `elearning.access.bulk_import` (count). Détail : [`06-import-masse-provisioning.md`](./06-import-masse-provisioning.md).
- **Retour :** `{ ok:true, data:{ jobId, queued: rows.length } }`.

### 6.5 `autoGrantFromSessionAction` (octroi auto session → e-learning)

- **Guard :** `requireAdminWrite()` (appelée par l'admin OU par le worker Qualiopi quand une `TrainingSession` passe `realisee`).
- **Input :** `z.object({ sessionId: z.string().uuid(), courseId: z.string().uuid() })`.
- **Effet :** pour chaque `Enrollment` (EXISTANT, participant↔session) de la session, appelle `provisionAccess(courseId, traineeId, source:"session_auto")`. Idempotent. Permet le **blended learning** (présentiel/live + e-learning de prolongement). Audit `elearning.access.from_session`.
- **Retour :** `{ ok:true, data:{ granted: N } }`.

> **EXISTANT vs NEUF.** `Trainee`, `Enrollment` (session), `Client`, `PortailAcces`, `creerAcces`, `emailsQueue` = **réutilisés**. `ElearningEnrollment`, `provisioning.ts`, les workers `elearning-bulk-provision-worker` = **neufs**. **Ne pas confondre** `Enrollment` (participant↔TrainingSession, Qualiopi) et `ElearningEnrollment` (apprenant↔cours e-learning).

---

## 7. Server Actions APPRENANT — Progression

Fichier : `src/server/elearning/actions/progress.actions.ts`. Guard **apprenant** (`requireLearner`). Modèle `LessonProgress { id, enrollmentId, lessonId, statut(enum: non_commence|en_cours|termine), positionSec?, pourcentage, derniereVueAt, completedAt? }`.

### 7.1 `saveLessonHeartbeatAction` (reprise auto persistée serveur — MUST-HAVE 2026)

- **Guard :** `requireLearner()`.
- **Input :** `z.object({ lessonId: z.string().uuid(), positionSec: z.number().int().min(0), pourcentage: z.number().int().min(0).max(100) })`.
- **Effet :**
  1. Résout l'`ElearningEnrollment` actif du learner pour le cours de la leçon (**ownership** ; sinon `FORBIDDEN`).
  2. **Vérifie le déverrouillage** via `services/unlock.ts` (`isLessonUnlocked(enrollment, lesson)`) — refus `{ ok:false, error:"locked" }` si la leçon est verrouillée (drip/gating). Empêche de marquer une progression sur du contenu non débloqué.
  3. `upsert LessonProgress` `{ positionSec, pourcentage, statut: pourcentage>=95 ? "termine" : "en_cours", derniereVueAt: now }`. Si bascule en `termine`, set `completedAt` et **réévalue le déverrouillage** des éléments suivants (recalcul côté lecture, pas de matérialisation lourde).
  4. **Anti-fraude léger / temps serveur :** le `positionSec` est borné par `videoDureeSec` ; le passage `termine` d'une vidéo peut exiger un temps de visionnage minimal serveur (cf. doc 04 frontend). Aucune confiance aveugle au client.
- **Retour :** `{ ok:true, data:{ statut, pourcentage } }`.
- **Note perf (budget INP ≤ 100ms) :** appelée en **throttle** (toutes 15–30 s) par le player ; mutation légère, pas de revalidation de page (le client garde l'état). Idempotente.

### 7.2 `completeLessonAction` (complétion explicite : texte/pdf/embed/devoir)

- **Guard :** `requireLearner()`.
- **Input :** `z.object({ lessonId: z.string().uuid() })`.
- **Effet :** ownership + unlock check ; pour une leçon `type=devoir`, exige qu'au moins une **pièce rendue** existe (cf. §7.3). Set `LessonProgress.statut="termine"`, `completedAt`. Recalcule la complétion du cours (`services/completion.ts`) ; si le cours devient **complété** et **réussi** (seuils quiz OK), peut **déclencher l'éligibilité certificat** (cf. §9, ne l'émet pas automatiquement sauf config). Audit `elearning.lesson.completed`.
- **Retour :** `{ ok:true, data:{ courseProgressPct, courseCompleted } }`.

### 7.3 `submitAssignmentAction` (devoir — preuve FOAD « travaux »)

- **Guard :** `requireLearner()`.
- **Input :** `z.object({ lessonId: z.string().uuid(), r2Key: z.string(), filename: z.string(), mimeType: z.string(), sizeBytes: z.number().int().max(100_000_000) })` (upload R2 préalable via une action `requestAssignmentUploadAction` symétrique à §4.1 mais guard apprenant + ownership).
- **Effet :** crée une `ElearningResource` (ou table `AssignmentSubmission` dédiée) rattachée à la leçon ET au learner ; marque la leçon `en_cours` (en attente de correction si quiz `essai`/`upload` lié). Ces pièces sont **conservées** (preuve de réalisation, cf. §rétention). Notifie l'admin/tuteur (enqueue email). Audit `elearning.assignment.submitted`.
- **Retour :** `{ ok:true, id }`.

### 7.4 `getResumePointAction` (point de reprise)

- **Guard :** `requireLearner()`. **Input :** `{ courseId }`. **Effet :** lecture pure — renvoie la dernière leçon `en_cours` + `positionSec` + la prochaine leçon déverrouillée. (Souvent fait en RSC plutôt qu'en action ; listée pour complétude.) **Retour :** `{ ok:true, data:{ lessonId, positionSec, nextUnlockedLessonId } }`.

---

## 8. Server Actions APPRENANT — Quiz interactif

Fichier : `src/server/elearning/actions/quiz-attempt.actions.ts`. Service de correction : `src/server/elearning/services/grading.ts`. Guard apprenant.

### 8.1 `startQuizAttemptAction`

- **Guard :** `requireLearner()`.
- **Input :** `z.object({ quizId: z.string().uuid(), lessonId: z.string().uuid() })`.
- **Effet :**
  1. Ownership (enrollment actif couvrant la leçon) + unlock check.
  2. **Contrôle `maxTentatives`** : si dépassé → `{ ok:false, error:"max_attempts_reached" }`.
  3. Crée `QuizAttempt { quizId, enrollmentId, startedAt: now(serveur), statut:"en_cours", deadlineAt: tempsLimiteSec? now+limite : null }` (**temps serveur** = source de vérité anti-triche).
  4. Sélectionne les questions : si `tirageAleatoireN`, **tirage N parmi M** (banque) ; applique `melangerQuestions`/`melangerReponses` avec une **seed stockée sur l'attempt** (rejouabilité + correction stable).
  5. Renvoie les questions **EXPURGÉES** : aucun champ `correct`/`bonneReponse`/`accepte`/`rationale` n'est inclus (la clé de correction ne quitte jamais le serveur).
- **Retour :** `{ ok:true, id: attempt.id, data:{ questions: SafeQuestion[], deadlineAt } }`.

### 8.2 `submitQuizAttemptAction`

- **Guard :** `requireLearner()`.
- **Input :**

```ts
const submitAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        // valeur polymorphe selon le type, validée finement côté grading
        value: z.unknown(),
      }),
    )
    .min(1),
});
```

- **Effet (service `gradeAttempt`) :**
  1. Ownership de l'`attempt` (via enrollment) + statut `en_cours` + **deadline serveur** non dépassée (sinon note partielle/0 selon politique du quiz).
  2. **Correction automatique** des types objectifs (`qcm_*`, `vrai_faux`, `appariement`, `texte_a_trous`, `ordonnancement`, `reponse_courte` avec normalisation casse/espaces) → score pondéré.
  3. Types **manuels** (`essai`, `upload`) → stockés `en_attente_correction`, **exclus** du score auto ; le quiz reste `partiellement_note` jusqu'à correction admin (§8.4).
  4. Calcule `scorePct`, compare à `quiz.seuilReussitePct` → `reussi: boolean`. Persiste `QuizAttempt { submittedAt, scorePct, reussi, statut }` + `QuizAnswer[]` (réponse + correct + points, **immuable** = preuve).
  5. **Gating par score** : la réussite **débloque** les éléments dont `unlockType=score_quiz && unlockQuizId=quizId && scorePct>=unlockScorePct` (recalcul à la lecture via `unlock.ts`). C'est une **vraie note**, pas un attempt-only (best practice 2026).
  6. **Feedback** selon `quiz.feedbackMode` (immédiat/après soumission/aucun) + `rationale` si `afficherRationale`.
  7. Émet une trace **type xAPI** (`{ verbe:"answered"|"passed"|"failed", objet:quizId, result:{ score, success } }`) dans le journal d'activité (ADR-0006 : modélisé xAPI, pas d'émission LRS au lancement).
  8. Audit `elearning.quiz.submitted`.
- **Retour :** `{ ok:true, data:{ scorePct, reussi, feedback, unlockedNext: boolean } }`.

### 8.3 `overrideAttemptUnlockAction` (override admin du verrou)

- **Guard :** `requireAdminWrite()`.
- **Input :** `{ enrollmentId, lessonId|moduleId, raison: z.string().min(3) }`.
- **Effet :** pose un **déverrouillage manuel** (table `ElearningUnlockOverride` ou flag sur progression) avec motif tracé → l'élément verrouillé devient accessible pour CET apprenant (cas pédagogique légitime). Audit `elearning.unlock.override`. **Retour :** `OK`.

### 8.4 `gradeManualAnswerAction` (correction humaine essai/upload)

- **Guard :** `requireAdminWrite()` (ou tuteur — réutilise `requireFormateurAction` si correction par formateur, cf. EXISTANT `coaching.actions.ts`).
- **Input :** `z.object({ quizAnswerId: z.string().uuid(), points: z.number().min(0), commentaire: z.string().max(5_000).optional() })`.
- **Effet :** affecte les points, recalcule `QuizAttempt.scorePct`/`reussi`, recalcule le gating. Notifie l'apprenant (email). Audit `elearning.answer.graded`. **Retour :** `OK`.

---

## 9. Server Actions — Certificat de réalisation

Fichier : `src/server/elearning/actions/certificate.actions.ts`. **EXISTANT massivement réutilisé** : `DocumentGenere` (modèle, `schema.prisma:5507`), enum `DocumentType.certificat_realisation` (`schema.prisma:5493`), template `src/server/qualiopi/documents/templates/certificat-realisation.tsx`, `documents-service.ts`, QR (`makeQrToken`/`qrDataUrl`/`verifyQrToken`, `src/server/qualiopi/documents/qr.ts`), R2 (`uploadToR2` clé `documents/<year>/certificat/<numero>.pdf`), vérif publique `/verifier-attestation/[token]`.

### 9.1 `issueCertificateAction` (émission manuelle/validée)

- **Guard :** `requireAdminPublish()`.
- **Input :** `z.object({ enrollmentId: z.string().uuid() })`.
- **Effet (service `issueElearningCertificate`) :**
  1. Charge l'`ElearningEnrollment` + cours + learner + progression + attempts.
  2. **Vérifie l'éligibilité** (`services/completion.ts`) : 100 % des leçons obligatoires `termine` **ET** tous les quiz gating `reussi` **ET** `scoreGlobal >= course.seuilReussitePct`. Sinon `{ ok:false, error:"not_eligible", fieldErrors:{ manquants:[...] } }`.
  3. Calcule les **heures réalisées** (modèle officiel certificat de réalisation, obligatoire depuis 01/06/2020) à partir des durées de leçons complétées + temps de quiz (FOAD : durée moyenne / temps de connexion — cf. `08-CONFORMITE/06-*`). Exprimées en centièmes comme le reste du système Qualiopi.
  4. Réutilise le **pipeline document existant** : génère le PDF react-pdf (`certificat-realisation.tsx`), calcule `hashSha256`, `makeQrToken()`, upload R2, crée `DocumentGenere { type:"certificat_realisation", numero, qrToken, hashSha256, traineeId, suppressionPrevueAt: now+5ans }`, lie `ElearningEnrollment.certificateDocumentId`.
  5. `statut` enrollment → `termine`, `completedAt` si absent.
  6. Notifie l'apprenant (enqueue email `elearning-certificat.tsx` avec lien signé + QR de vérif). Audit `elearning.certificate.issued`.
- **Retour :** `{ ok:true, id: documentGenere.id, data:{ numero, qrToken } }`.

### 9.2 `autoIssueCertificateOnCompletion` (option, V1)

Pas une action UI : **hook** appelé depuis `completeLessonAction`/`gradeManualAnswerAction` quand `course.autoCertificat=true` → exécute la même logique que §9.1 si éligible. Gardé derrière un flag de cours pour laisser la main à l'admin en MVP.

### 9.3 `revokeCertificateAction`

- **Guard :** `requireAdminDelete()`. **Input :** `{ documentId, raison }`. **Effet :** marque le `DocumentGenere` `estCopie`/invalidé (jamais hard delete avant rétention) ; la page `/verifier-attestation/[token]` affiche « révoqué ». Audit `elearning.certificate.revoked`. **Retour :** `OK`.

---

## 10. Workers & queues touchés (récap)

Toutes les actions « lourdes » **enqueue** plutôt que d'exécuter en ligne (budget Web Vitals + robustesse). Queues déclarées dans `src/server/queue/queues.ts`, workers sous `src/server/queue/workers/elearning-*-worker.ts` (ADR-0007), enregistrés dans `worker.ts`. Helpers `enqueue*` typés via `types.ts` (pattern existant `emailsQueue`).

| Worker (neuf)                                 | Déclencheur (action)            | Rôle                                                |
| --------------------------------------------- | ------------------------------- | --------------------------------------------------- |
| `elearning-bulk-provision-worker.ts`          | `bulkImportAccessAction`        | provisionner N accès idempotents + emails + rapport |
| `elearning-video-worker.ts`                   | webhook Cloudflare Stream       | passer `videoAssetId` à `ready`, durée, miniatures  |
| `elearning-quiz-gen-worker.ts` (V1)           | `generateQuizFromContentAction` | génération IA quiz (Anthropic + RAG)                |
| `elearning-reminder-worker.ts` (V1)           | cron                            | relances anti-décrochage (Qualiopi Ind.12)          |
| (réutilisé) `email-worker.ts` + `emailsQueue` | octroi/certificat/correction    | envoi emails Nodemailer + React Email               |

> **Stub/BULLMQ.** Si `BULLMQ_DISABLED=true` (build), les `enqueue*` no-op proprement (pattern existant `queues.ts`). Les actions retournent alors `{ ok:false, error:"stub_db" }` en amont via la garde §0.5.

---

## 11. Matrice récapitulative (action → guard → effet)

| Action                         | Fichier              | Guard            | Effet principal                    | Retour           |
| ------------------------------ | -------------------- | ---------------- | ---------------------------------- | ---------------- |
| createCourseAction             | course.actions       | AdminWrite       | create ElearningCourse brouillon   | id               |
| updateCourseAction             | course.actions       | AdminWrite       | update                             | id               |
| publishCourseAction            | course.actions       | **AdminPublish** | gate + statut publie + version++   | version          |
| archiveCourseAction            | course.actions       | AdminPublish     | statut archive                     | OK               |
| deleteCourseAction             | course.actions       | **AdminDelete**  | hard delete si 0 enrollment        | OK               |
| createModuleAction             | module.actions       | AdminWrite       | create + ordre                     | id               |
| reorderModulesAction           | module.actions       | AdminWrite       | réécrit ordre (tx)                 | OK               |
| createLessonAction             | lesson.actions       | AdminWrite       | create + recompute durée           | id               |
| requestLessonVideoUploadAction | lesson.actions       | AdminWrite       | Cloudflare Stream direct upload    | uploadUrl        |
| requestResourceUploadAction    | resource.actions     | AdminWrite       | URL signée R2 PUT                  | uploadUrl, r2Key |
| confirmResourceAction          | resource.actions     | AdminWrite       | create ElearningResource           | id               |
| createQuizAction               | quiz.actions         | AdminWrite       | create Quiz                        | id               |
| upsertQuestionAction           | quiz.actions         | AdminWrite       | upsert Question (clé serveur)      | id               |
| grantAccessAction              | access.actions       | AdminWrite       | provision accès + email            | id               |
| revokeAccessAction             | access.actions       | AdminWrite       | statut revoque                     | OK               |
| bulkImportAccessAction         | access.actions       | AdminWrite       | enqueue bulk-provision             | jobId            |
| autoGrantFromSessionAction     | access.actions       | AdminWrite       | accès depuis Enrollment session    | granted          |
| saveLessonHeartbeatAction      | progress.actions     | **Learner**      | upsert LessonProgress              | statut, %        |
| completeLessonAction           | progress.actions     | Learner          | termine + recalcul cours           | progress         |
| submitAssignmentAction         | progress.actions     | Learner          | pièce devoir (preuve FOAD)         | id               |
| startQuizAttemptAction         | quiz-attempt.actions | Learner          | crée attempt + questions expurgées | questions        |
| submitQuizAttemptAction        | quiz-attempt.actions | Learner          | correction + gating score          | score, reussi    |
| gradeManualAnswerAction        | quiz-attempt.actions | AdminWrite       | correction essai/upload            | OK               |
| overrideAttemptUnlockAction    | quiz-attempt.actions | AdminWrite       | déverrouillage manuel tracé        | OK               |
| issueCertificateAction         | certificate.actions  | **AdminPublish** | DocumentGenere certificat + QR     | numero           |
| revokeCertificateAction        | certificate.actions  | **AdminDelete**  | invalidation tracée                | OK               |

---

## 12. Points de vigilance (résumé pour le dev)

1. **Deux mondes d'auth.** Actions admin = `requireAdmin*` (NextAuth). Actions apprenant = `requireLearner` (cookie séparé, ADR-0001). **Jamais** mélanger.
2. **`Enrollment` ≠ `ElearningEnrollment`.** Le premier est Qualiopi (session présentiel/live), le second e-learning. `autoGrantFromSessionAction` est le pont.
3. **Clé de correction quiz** : ne quitte jamais le serveur (questions expurgées à `startQuizAttemptAction`). Temps de référence = **serveur**.
4. **Gating par vraie note** (`scorePct >= seuil`), pas attempt-only ; verrou affiché **avec sa raison** + override admin tracé.
5. **Idempotence** partout sur l'octroi (anti double-accès) et l'upload R2 (`existsInR2`).
6. **Migrations additives** : tout champ ajouté à `Trainee`/`Formation`/`Client` est **nullable** (ADR-0008).
7. **Stub-aware** + **enqueue** pour les charges lourdes (budgets Web Vitals + build `stub.invalid`).
8. **Preuves FOAD conservées** : devoirs, attempts, certificats — **jamais** supprimés avant rétention (10 ans comptable / 6 ans fiscal / 3-5 ans preuves réalisation — cf. `08-CONFORMITE/05-*`).

---

## Liens

- [`03-DATA-MODEL/01-schema-cours-modules-lecons.md`](../03-DATA-MODEL/01-schema-cours-modules-lecons.md) — modèles `ElearningCourse/Module/Lesson/Resource`, enums (source des noms de champs).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, traces xAPI (référencés §6/§7).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`, `Question`, `QuizAttempt`, `QuizAnswer` (référencés §5/§8).
- [`04-BACKEND/01-services-domaine.md`](./01-services-domaine.md) — `unlock.ts`, `grading.ts`, `completion.ts`, `provisioning.ts`.
- [`04-BACKEND/03-workers-bullmq-crons.md`](./03-workers-bullmq-crons.md) — workers `elearning-*-worker.ts`, queues.
- [`04-BACKEND/05-authentification-apprenant.md`](./05-authentification-apprenant.md) — `requireLearner`, magic-link étendu, mot de passe optionnel.
- [`04-BACKEND/06-import-masse-provisioning.md`](./06-import-masse-provisioning.md) — CSV, idempotence, rapport d'erreurs.
- [`04-BACKEND/07-pipeline-video-streaming.md`](./07-pipeline-video-streaming.md) — Cloudflare Stream, direct upload, webhook `ready`.
- [`04-BACKEND/08-ia-pedagogique-generation.md`](./08-ia-pedagogique-generation.md) — quiz-gen IA.
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` + `04-progression-deverrouillage.md` — UI consommant ces actions.
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — UI builder consommant le CRUD.
- [`00-INDEX/DECISIONS-ARBITRAGES.md`](../00-INDEX/DECISIONS-ARBITRAGES.md) — ADR-0001 (auth), 0002 (multi-tenant), 0004 (e-commerce), 0005 (vidéo), 0006 (xAPI), 0007 (cloisonnement), 0008 (migrations).
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` + `06-tracabilite-preuves-realisation.md` — pourquoi quiz Ind.11, certificat heures, conservation preuves.

**Code EXISTANT réutilisé (ancrage repo) :** `src/server/actions/knowledge/_guards.ts` (RBAC) · `src/server/actions/formateur/coaching.actions.ts` (pattern ActionResult/ownership) · `src/server/qualiopi/portail/portail-service.ts` (`creerAcces`/`verifierToken`, magic-link) · `src/lib/r2-storage.ts` (upload/signed URL) · `src/server/qualiopi/documents/{documents-service.ts,qr.ts,templates/certificat-realisation.tsx}` + `DocumentGenere` (`prisma/schema.prisma:5507`) · `src/server/queue/queues.ts` (`emailsQueue`, pattern enqueue).
